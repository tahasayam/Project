const { poolPromise } = require('../Config/db');
const bcrypt = require('bcryptjs');

// GET /api/teachers/all
const getAllTeachers = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.query(`
            SELECT t.id as "TeacherID", t.fullname as "FullName", t.subject_specialty as "Subject", t.assigned_classes as "AssignedClasses", t.email as "Email", t.phone as "PhoneNo",
                   u.username as "Username"
            FROM staff_teachers t
            LEFT JOIN school_auth u ON u.id = t.auth_id
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// POST /api/teachers/add
const addTeacher = async (req, res) => {
    const { fullName, email, phoneNo, password, assignments } = req.body;
    if (!fullName || !email || !phoneNo || !password) {
        return res.status(400).json({ message: 'Full Name, Email, Phone Number, and Password are required.' });
    }
    try {
        const pool = await poolPromise;

        // Check duplicate email in school_auth
        const dup = await pool.query('SELECT id FROM school_auth WHERE username = $1', [email]);
        if (dup.rows.length > 0) {
            return res.status(400).json({ message: 'A user with this email already exists.' });
        }

        // Hash the provided password
        const hashedPwd = await bcrypt.hash(password, 10);

        // Insert into school_auth
        const userResult = await pool.query(
            'INSERT INTO school_auth (username, password, role) VALUES ($1, $2, $3) RETURNING id',
            [email, hashedPwd, 'Teacher']
        );

        const newUserID = userResult.rows[0].id;

        const teacherResult = await pool.query(
            'INSERT INTO staff_teachers (fullname, subject_specialty, email, phone, auth_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [fullName, req.body.subject || null, email, phoneNo, newUserID]
        );

        const teacherID = teacherResult.rows[0].id;

        // Add Assignments
        if (assignments && Array.isArray(assignments)) {
            for (const ass of assignments) {
                await pool.query(
                    'INSERT INTO teacher_assignments_map (teacher_id, class_id, subject_id) VALUES ($1, $2, $3)',
                    [teacherID, ass.classID, ass.subjectID]
                );
            }

            // Update the Teacher's summary columns
            await pool.query(`
                    UPDATE staff_teachers 
                    SET 
                        subject_specialty = (
                            SELECT STRING_AGG(s.subjectname, ', ') 
                            FROM teacher_assignments_map ta
                            JOIN school_subjects s ON ta.subject_id = s.id
                            WHERE ta.teacher_id = $1
                        ),
                        assigned_classes = (
                            SELECT STRING_AGG(classname, ', ') 
                            FROM (
                                SELECT DISTINCT c.classname 
                                FROM teacher_assignments_map ta
                                JOIN school_classes c ON ta.class_id = c.id
                                WHERE ta.teacher_id = $1
                            ) AS ClassSub
                        )
                    WHERE id = $1
                `, [teacherID]);
        }

        res.status(201).json({ message: `Teacher added successfully.` });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// DELETE /api/teachers/delete/:phoneNo
const deleteTeacher = async (req, res) => {
    const { phoneNo } = req.params;
    try {
        const pool = await poolPromise;

        const teacherResult = await pool.query(
            'SELECT id as "TeacherID", auth_id as "UserID" FROM staff_teachers WHERE phone = $1',
            [phoneNo]
        );

        if (teacherResult.rows.length === 0) {
            return res.status(404).json({ message: 'Teacher not found.' });
        }

        const userID = teacherResult.rows[0].UserID;
        const teacherID = teacherResult.rows[0].TeacherID;

        // Delete assignments first
        await pool.query('DELETE FROM teacher_assignments_map WHERE teacher_id = $1', [teacherID]);

        // Delete teacher record
        await pool.query('DELETE FROM staff_teachers WHERE id = $1', [teacherID]);

        // Delete user account
        if (userID) {
            await pool.query('DELETE FROM school_auth WHERE id = $1', [userID]);
        }

        res.json({ message: 'Teacher deleted successfully.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /api/teachers/profile
const getTeacherProfile = async (req, res) => {
    try {
        const pool = await poolPromise;
        const profileResult = await pool.query('SELECT * FROM staff_teachers WHERE auth_id = $1', [req.user.id]);
        
        if (profileResult.rows.length === 0) return res.status(404).json({ message: 'Teacher profile not found' });
        const teacher = profileResult.rows[0];

        // Access properties safely
        const tid = teacher.id;

        const assignmentsResult = await pool.query(`
                SELECT c.id as "ClassID", c.classname as "ClassName", s.id as "SubjectID", s.subjectname as "SubjectName",
                       (SELECT COUNT(*) FROM school_students st WHERE st.class_id = c.id) as "StudentCount"
                FROM teacher_assignments_map ta
                JOIN school_classes c ON ta.class_id = c.id
                JOIN school_subjects s ON ta.subject_id = s.id
                WHERE ta.teacher_id = $1
            `, [tid]);
        
        const studentCountResult = await pool.query(`
                SELECT COUNT(DISTINCT s.id) AS totalstudents
                FROM school_students s
                JOIN teacher_assignments_map ta ON s.class_id = ta.class_id
                WHERE ta.teacher_id = $1
            `, [tid]);

        res.json({
            teacherid: tid,
            FullName: teacher.fullname,
            Subject: teacher.subject_specialty,
            Email: teacher.email,
            PhoneNo: teacher.phone,
            AssignedClasses: teacher.assigned_classes,
            Assignments: assignmentsResult.rows,
            StudentCount: parseInt(studentCountResult.rows[0].totalstudents)
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const updateTeacherAssignments = async (req, res) => {
    const { teacherID, assignments, append } = req.body;
    try {
        const pool = await poolPromise;
        
        if (!append) {
            await pool.query('DELETE FROM teacher_assignments_map WHERE teacher_id = $1', [teacherID]);
        }

        if (assignments && Array.isArray(assignments)) {
            for (const ass of assignments) {
                await pool.query(
                    'INSERT INTO teacher_assignments_map (teacher_id, class_id, subject_id) VALUES ($1, $2, $3)',
                    [teacherID, ass.classID, ass.subjectID]
                );
            }
        }

        // Update summary columns
        await pool.query(`
                UPDATE staff_teachers 
                SET 
                    subject_specialty = (
                        SELECT STRING_AGG(s.subjectname, ', ') 
                        FROM teacher_assignments_map ta
                        JOIN school_subjects s ON ta.subject_id = s.id
                        WHERE ta.teacher_id = $1
                    ),
                    assigned_classes = (
                        SELECT STRING_AGG(classname, ', ') 
                        FROM (
                            SELECT DISTINCT c.classname 
                            FROM teacher_assignments_map ta
                            JOIN school_classes c ON ta.class_id = c.id
                            WHERE ta.teacher_id = $1
                        ) AS ClassSub
                    )
                WHERE id = $1
            `, [teacherID]);

        res.json({ message: 'Assignments updated successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { getAllTeachers, addTeacher, deleteTeacher, getTeacherProfile, updateTeacherAssignments };
