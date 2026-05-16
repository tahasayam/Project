const { poolPromise } = require('../Config/db');
const bcrypt = require('bcryptjs');

// GET /api/students/all
const getAllStudents = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.query(`
            SELECT s.id as "StudentID", s.roll_no as "RollNo", s.fullname as "FullName", s.dob as "DOB", s.guardian_name as "GuardianName", s.email as "Email",
                   c.classname as "ClassName", c.id as "ClassID", u.username as "Username"
            FROM school_students s
            LEFT JOIN school_classes c ON s.class_id = c.id
            LEFT JOIN school_auth u ON u.id = s.auth_id
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /api/students/by-class/:classID  — for teacher to load students in their class
const getStudentsByClass = async (req, res) => {
    const { classID } = req.params;
    try {
        const pool = await poolPromise;
        const result = await pool.query(
            'SELECT id as "StudentID", roll_no as "RollNo", fullname as "FullName" FROM school_students WHERE class_id = $1 ORDER BY roll_no',
            [classID]
        );
        res.json(result.rows);
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
        const dupRoll = await pool.query(
            'SELECT id FROM school_students WHERE roll_no = $1',
            [rollNo]
        );
        if (dupRoll.rows.length > 0) {
            return res.status(400).json({ message: `Roll No '${rollNo}' already exists.` });
        }

        // Check duplicate email (Username in school_auth table)
        const dupEmail = await pool.query(
            'SELECT id FROM school_auth WHERE username = $1',
            [email]
        );
        if (dupEmail.rows.length > 0) {
            return res.status(400).json({ message: `Email '${email}' is already in use.` });
        }

        // Hash provided password
        const hashedPwd = await bcrypt.hash(password, 10);

        // Insert into school_auth
        const userResult = await pool.query(
            'INSERT INTO school_auth (username, password, role) VALUES ($1, $2, $3) RETURNING id',
            [email, hashedPwd, 'Student']
        );

        const newUserID = userResult.rows[0].id;

        // Insert into school_students
        await pool.query(
            'INSERT INTO school_students (roll_no, fullname, class_id, dob, guardian_name, auth_id, class_name, section, email) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
            [rollNo, fullName, classID, dob || null, guardianName || null, newUserID, className || '', section || '', email]
        );

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

        const studentResult = await pool.query(
            'SELECT id as "StudentID", auth_id as "UserID" FROM school_students WHERE roll_no = $1',
            [rollNo]
        );

        if (studentResult.rows.length === 0) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        const userID = studentResult.rows[0].UserID;
        const studentID = studentResult.rows[0].StudentID;
        
        if (userID) {
            await pool.query('DELETE FROM school_auth WHERE id = $1', [userID]);
        } else {
            await pool.query('DELETE FROM school_students WHERE id = $1', [studentID]);
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
        const result = await pool.query(`
                SELECT s.id as "StudentID", s.roll_no as "RollNo", s.fullname as "FullName", s.dob as "DOB", s.guardian_name as "GuardianName",
                       c.classname as "ClassName", c.id as "ClassID"
                FROM school_students s
                LEFT JOIN school_classes c ON s.class_id = c.id
                WHERE s.auth_id = $1
            `, [req.user.id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Student profile not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { getAllStudents, getStudentsByClass, addStudent, deleteStudent, getStudentProfile };
