const { poolPromise, sql } = require('../Config/db');
const bcrypt = require('bcryptjs');

// GET /api/students/all
const getAllStudents = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT s.StudentID, s.RollNo, s.FullName, s.DOB, s.GuardianName, s.Email,
                   c.ClassName, c.ClassID, u.Username
            FROM Students s
            LEFT JOIN Classes c ON s.ClassID = c.ClassID
            LEFT JOIN Users u ON u.UserID = s.UserID
        `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /api/students/by-class/:classID  — for teacher to load students in their class
const getStudentsByClass = async (req, res) => {
    const { classID } = req.params;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('classID', sql.Int, classID)
            .query('SELECT StudentID, RollNo, FullName FROM Students WHERE ClassID = @classID ORDER BY RollNo');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// POST /api/students/add
// Auto-creates a User account for the student
const addStudent = async (req, res) => {
    const { rollNo, fullName, classID, dob, guardianName, className, section, email, password } = req.body;
    
    if (!rollNo || !fullName || !classID || !email || !password) {
        return res.status(400).json({ message: 'Full name, roll number, class, email, and password are required.' });
    }

    try {
        const pool = await poolPromise;

        // Check duplicate roll number
        const dupRoll = await pool.request()
            .input('rollNo', sql.NVarChar, rollNo)
            .query('SELECT StudentID FROM Students WHERE RollNo = @rollNo');
        if (dupRoll.recordset.length > 0) {
            return res.status(400).json({ message: `Roll No '${rollNo}' already exists.` });
        }

        // Check duplicate email (Username in Users table)
        const dupEmail = await pool.request()
            .input('email', sql.NVarChar, email)
            .query('SELECT UserID FROM Users WHERE Username = @email');
        if (dupEmail.recordset.length > 0) {
            return res.status(400).json({ message: `Email '${email}' is already in use.` });
        }

        // Hash provided password
        const hashedPwd = await bcrypt.hash(password, 10);

        // Insert into Users
        const userResult = await pool.request()
            .input('username', sql.NVarChar, email)
            .input('password', sql.NVarChar, hashedPwd)
            .input('role', sql.NVarChar, 'Student')
            .query('INSERT INTO Users (Username, Password, Role) OUTPUT INSERTED.UserID VALUES (@username, @password, @role)');

        const newUserID = userResult.recordset[0].UserID;

        // Insert into Students
        await pool.request()
            .input('rollNo', sql.NVarChar, rollNo)
            .input('fullName', sql.NVarChar, fullName)
            .input('classID', sql.Int, classID)
            .input('dob', sql.Date, dob || null)
            .input('guardianName', sql.NVarChar, guardianName || null)
            .input('userID', sql.Int, newUserID)
            .input('className', sql.NVarChar, className || '')
            .input('section', sql.NVarChar, section || '')
            .input('email', sql.NVarChar, email)
            .query('INSERT INTO Students (RollNo, FullName, ClassID, DOB, GuardianName, UserID, ClassName, Section, Email) VALUES (@rollNo, @fullName, @classID, @dob, @guardianName, @userID, @className, @section, @email)');

        res.status(201).json({ message: `Student added successfully. Login: ${email}` });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// DELETE /api/students/delete/:rollNo
const deleteStudent = async (req, res) => {
    const { rollNo } = req.params;
    try {
        const pool = await poolPromise;

        const studentResult = await pool.request()
            .input('rollNo', sql.NVarChar, rollNo)
            .query('SELECT StudentID, UserID FROM Students WHERE RollNo = @rollNo');

        if (studentResult.recordset.length === 0) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        // Deleting the user will cascade delete student (due to CASCADE on StudentID)
        const userID = studentResult.recordset[0].UserID;
        const studentID = studentResult.recordset[0].StudentID;
        
        if (userID) {
            await pool.request()
                .input('userID', sql.Int, userID)
                .query('DELETE FROM Users WHERE UserID = @userID');
        } else {
            await pool.request()
                .input('studentID', sql.Int, studentID)
                .query('DELETE FROM Students WHERE StudentID = @studentID');
        }

        res.json({ message: 'Student deleted successfully.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /api/students/profile  — Student gets their own profile
const getStudentProfile = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('userID', sql.Int, req.user.id)
            .query(`
                SELECT s.StudentID, s.RollNo, s.FullName, s.DOB, s.GuardianName,
                       c.ClassName, c.ClassID
                FROM Students s
                LEFT JOIN Classes c ON s.ClassID = c.ClassID
                WHERE s.UserID = @userID
            `);
        if (result.recordset.length === 0) return res.status(404).json({ message: 'Student profile not found' });
        res.json(result.recordset[0]);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { getAllStudents, getStudentsByClass, addStudent, deleteStudent, getStudentProfile };
