const { poolPromise } = require('../Config/db');

// POST /api/results/add
// Teacher adds marks for a student
const addResult = async (req, res) => {
    const { studentID, subjectName, term, marksObtained, totalMarks } = req.body;
    if (!studentID || !subjectName || !term || marksObtained == null || totalMarks == null) {
        return res.status(400).json({ message: 'All fields are required.' });
    }
    try {
        const pool = await poolPromise;

        // Using single 'school_results' table as per schema.sql
        const tableName = 'school_results';

        // Upsert: remove existing and re-insert so teacher can update marks
        await pool.query(
            `DELETE FROM ${tableName} WHERE student_id = $1 AND subject_name = $2 AND term = $3`,
            [studentID, subjectName, term]
        );

        await pool.query(`
                INSERT INTO school_results (student_id, subject_name, term, marks, total_marks, is_published)
                VALUES ($1, $2, $3, $4, $5, FALSE)
            `, [studentID, subjectName, term, marksObtained, totalMarks]);

        res.status(201).json({ message: 'Marks saved successfully.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// POST /api/results/publish
// Admin publishes results for a class + term
// Body: { classID, term }
const publishResults = async (req, res) => {
    const { classID, term } = req.body;
    if (!classID || !term) {
        return res.status(400).json({ message: 'classID and term are required.' });
    }
    try {
        const pool = await poolPromise;
        
        const result = await pool.query(`
                UPDATE school_results SET is_published = TRUE
                WHERE term = $1
                AND student_id IN (SELECT id FROM school_students WHERE class_id = $2)
            `, [term, classID]);

        res.json({ message: `Results published for term '${term}'.`, affected: result.rowCount });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /api/results/class/:classID/:term
// Admin views results for a class + term (all students, published or not)
const getClassResults = async (req, res) => {
    const { classID, term } = req.params;
    try {
        const pool = await poolPromise;
        const result = await pool.query(`
                SELECT s.id as "StudentID", s.roll_no as "RollNo", s.fullname as "FullName",
                       r.subject_name as "SubjectName", r.marks as "MarksObtained", r.total_marks as "TotalMarks", r.is_published as "IsPublished", r.term as "Term"
                FROM school_students s
                LEFT JOIN school_results r ON r.student_id = s.id AND r.term = $1
                WHERE s.class_id = $2
                ORDER BY s.roll_no
            `, [term, classID]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /api/results/student/:studentID
// Student sees ONLY their published results
const getStudentResults = async (req, res) => {
    const { studentID } = req.params;
    try {
        const pool = await poolPromise;

        const result = await pool.query(`
                SELECT id as "ResultID", subject_name as "SubjectName", term as "Term", marks as "MarksObtained", total_marks as "TotalMarks"
                FROM school_results
                WHERE student_id = $1 AND is_published = TRUE
                ORDER BY term, subject_name
            `, [studentID]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /api/results/available-terms/:classID
// Returns unique terms that have results for students in a specific class
const getAvailableTerms = async (req, res) => {
    const { classID } = req.params;
    try {
        const pool = await poolPromise;
        const result = await pool.query(`
                SELECT DISTINCT term 
                FROM school_results 
                WHERE student_id IN (SELECT id FROM school_students WHERE class_id = $1)
                ORDER BY term
            `, [classID]);
        res.json(result.rows.map(row => row.term));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { addResult, publishResults, getClassResults, getStudentResults, getAvailableTerms };
