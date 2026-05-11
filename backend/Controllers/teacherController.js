const { poolPromise, sql } = require('../Config/db');
const bcrypt = require('bcryptjs');

// GET /api/teachers/all
const getAllTeachers = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT t.TeacherID, t.FullName, t.Subject, t.AssignedClasses, t.Email, t.PhoneNo,
                   u.Username
            FROM Teachers t
            LEFT JOIN Users u ON u.UserID = t.UserID
        `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// POST /api/teachers/add
// Auto-creates a User account for the teacher (email = login username)
const addTeacher = async (req, res) => {
    const { fullName, email, phoneNo, password, assignments } = req.body;
    if (!fullName || !email || !phoneNo || !password) {
        return res.status(400).json({ message: 'Full Name, Email, Phone Number, and Password are required.' });
    }
    try {
        const pool = await poolPromise;

        // Check duplicate email in Users
        const dup = await pool.request()
            .input('email', sql.NVarChar, email)
            .query('SELECT UserID FROM Users WHERE Username = @email');
        if (dup.recordset.length > 0) {
            return res.status(400).json({ message: 'A user with this email already exists.' });
        }

        // Hash the provided password
        const hashedPwd = await bcrypt.hash(password, 10);

        // Insert into Users
        const userResult = await pool.request()
            .input('username', sql.NVarChar, email)
            .input('password', sql.NVarChar, hashedPwd)
            .input('role', sql.NVarChar, 'Teacher')
            .query('INSERT INTO Users (Username, Password, Role) OUTPUT INSERTED.UserID VALUES (@username, @password, @role)');

        const newUserID = userResult.recordset[0].UserID;

        const teacherResult = await pool.request()
            .input('fullName', sql.NVarChar, fullName)
            .input('subject', sql.NVarChar, req.body.subject || null)
            .input('email', sql.NVarChar, email)
            .input('phoneNo', sql.NVarChar, phoneNo)
            .input('userID', sql.Int, newUserID)
            .query('INSERT INTO Teachers (FullName, Subject, Email, PhoneNo, UserID) OUTPUT INSERTED.TeacherID VALUES (@fullName, @subject, @email, @phoneNo, @userID)');

        const teacherID = teacherResult.recordset[0].TeacherID;

        // Add Assignments
        if (assignments && Array.isArray(assignments)) {
            for (const ass of assignments) {
                await pool.request()
                    .input('tid', sql.Int, teacherID)
                    .input('cid', sql.Int, ass.classID)
                    .input('sid', sql.Int, ass.subjectID)
                    .query('INSERT INTO TeacherAssignments (TeacherID, ClassID, SubjectID) VALUES (@tid, @cid, @sid)');
            }

            // --- NEW: Update the Teacher's summary columns ---
            await pool.request()
                .input('tid', sql.Int, teacherID)
                .query(`
                    UPDATE Teachers 
                    SET 
                        Subject = (
                            SELECT STRING_AGG(s.SubjectName, ', ') 
                            FROM TeacherAssignments ta
                            JOIN Subjects s ON ta.SubjectID = s.SubjectID
                            WHERE ta.TeacherID = @tid
                        ),
                        AssignedClasses = (
                            SELECT STRING_AGG(ClassName, ', ') 
                            FROM (
                                SELECT DISTINCT c.ClassName 
                                FROM TeacherAssignments ta
                                JOIN Classes c ON ta.ClassID = c.ClassID
                                WHERE ta.TeacherID = @tid
                            ) AS ClassSub
                        )
                    WHERE TeacherID = @tid
                `);
        }

        res.status(201).json({ message: `Teacher added successfully.` });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// DELETE /api/teachers/delete/:phoneNo
// Delete by Name + PhoneNo (as per your scenario)
const deleteTeacher = async (req, res) => {
    const { phoneNo } = req.params;
    try {
        const pool = await poolPromise;

        // Get the userID linked to this teacher
        const teacherResult = await pool.request()
            .input('phoneNo', sql.NVarChar, phoneNo)
            .query('SELECT TeacherID, UserID FROM Teachers WHERE PhoneNo = @phoneNo');

        if (teacherResult.recordset.length === 0) {
            return res.status(404).json({ message: 'Teacher not found.' });
        }

        const userID = teacherResult.recordset[0].UserID;
        const teacherID = teacherResult.recordset[0].TeacherID;

        // Delete assignments first
        await pool.request()
            .input('teacherID', sql.Int, teacherID)
            .query('DELETE FROM TeacherAssignments WHERE TeacherID = @teacherID');

        // Delete teacher record
        await pool.request()
            .input('teacherID', sql.Int, teacherID)
            .query('DELETE FROM Teachers WHERE TeacherID = @teacherID');

        // Delete user account
        if (userID) {
            await pool.request()
                .input('userID', sql.Int, userID)
                .query('DELETE FROM Users WHERE UserID = @userID');
        }

        res.json({ message: 'Teacher deleted successfully.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /api/teachers/profile  (Teacher logs in and gets their own profile)
const getTeacherProfile = async (req, res) => {
    try {
        const pool = await poolPromise;
        const profileResult = await pool.request()
            .input('userID', sql.Int, req.user.id)
            .query('SELECT * FROM Teachers WHERE UserID = @userID');
        
        if (profileResult.recordset.length === 0) return res.status(404).json({ message: 'Teacher profile not found' });
        const teacher = profileResult.recordset[0];

        const assignmentsResult = await pool.request()
            .input('tid', sql.Int, teacher.TeacherID)
            .query(`
                SELECT c.ClassID, c.ClassName, s.SubjectID, s.SubjectName,
                       (SELECT COUNT(*) FROM Students st WHERE st.ClassID = c.ClassID) as StudentCount
                FROM TeacherAssignments ta
                JOIN Classes c ON ta.ClassID = c.ClassID
                JOIN Subjects s ON ta.SubjectID = s.SubjectID
                WHERE ta.TeacherID = @tid
            `);
        
        const studentCountResult = await pool.request()
            .input('tid', sql.Int, teacher.TeacherID)
            .query(`
                SELECT COUNT(DISTINCT s.StudentID) AS TotalStudents
                FROM Students s
                JOIN TeacherAssignments ta ON s.ClassID = ta.ClassID
                WHERE ta.TeacherID = @tid
            `);

        res.json({
            ...teacher,
            Assignments: assignmentsResult.recordset,
            StudentCount: studentCountResult.recordset[0].TotalStudents
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const updateTeacherAssignments = async (req, res) => {
    const { teacherID, assignments, append } = req.body;
    try {
        const pool = await poolPromise;
        
        // Delete existing assignments ONLY if not appending
        if (!append) {
            await pool.request()
                .input('tid', sql.Int, teacherID)
                .query('DELETE FROM TeacherAssignments WHERE TeacherID = @tid');
        }

        // Add new assignments
        if (assignments && Array.isArray(assignments)) {
            for (const ass of assignments) {
                await pool.request()
                    .input('tid', sql.Int, teacherID)
                    .input('cid', sql.Int, ass.classID)
                    .input('sid', sql.Int, ass.subjectID)
                    .query('INSERT INTO TeacherAssignments (TeacherID, ClassID, SubjectID) VALUES (@tid, @cid, @sid)');
            }
        }

        // Update summary columns
        await pool.request()
            .input('tid', sql.Int, teacherID)
            .query(`
                UPDATE Teachers 
                SET 
                    Subject = (
                        SELECT STRING_AGG(s.SubjectName, ', ') 
                        FROM TeacherAssignments ta
                        JOIN Subjects s ON ta.SubjectID = s.SubjectID
                        WHERE ta.TeacherID = @tid
                    ),
                    AssignedClasses = (
                        SELECT STRING_AGG(ClassName, ', ') 
                        FROM (
                            SELECT DISTINCT c.ClassName 
                            FROM TeacherAssignments ta
                            JOIN Classes c ON ta.ClassID = c.ClassID
                            WHERE ta.TeacherID = @tid
                        ) AS ClassSub
                    )
                WHERE TeacherID = @tid
            `);

        res.json({ message: 'Assignments updated successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { getAllTeachers, addTeacher, deleteTeacher, getTeacherProfile, updateTeacherAssignments };
