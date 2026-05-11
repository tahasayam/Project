const { poolPromise, sql } = require('../Config/db');

// POST /api/results/add
// Teacher adds marks for a student
const addResult = async (req, res) => {
    const { studentID, subjectName, term, marksObtained, totalMarks } = req.body;
    if (!studentID || !subjectName || !term || marksObtained == null || totalMarks == null) {
        return res.status(400).json({ message: 'All fields are required.' });
    }
    try {
        const pool = await poolPromise;

        const classRes = await pool.request()
            .input('sid', sql.Int, studentID)
            .query('SELECT ClassID FROM Students WHERE StudentID = @sid');
        const classID = classRes.recordset[0]?.ClassID;
        const tableName = await getResultTable(pool, classID);

        // Upsert: remove existing and re-insert so teacher can update marks
        await pool.request()
            .input('studentID', sql.Int, studentID)
            .input('subjectName', sql.NVarChar, subjectName)
            .input('term', sql.NVarChar, term)
            .query(`DELETE FROM ${tableName} WHERE StudentID = @studentID AND SubjectName = @subjectName AND Term = @term`);

        await pool.request()
            .input('studentID', sql.Int, studentID)
            .input('subjectName', sql.NVarChar, subjectName)
            .input('term', sql.NVarChar, term)
            .input('marksObtained', sql.Decimal(5, 2), marksObtained)
            .input('totalMarks', sql.Decimal(5, 2), totalMarks)
            .query(`
                INSERT INTO ${tableName} (StudentID, SubjectName, Term, MarksObtained, TotalMarks, IsPublished, StudentName, ClassName, Section)
                SELECT @studentID, @subjectName, @term, @marksObtained, @totalMarks, 0, FullName, ClassName, Section
                FROM Students
                WHERE StudentID = @studentID
            `);

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
        const tableName = await getResultTable(pool, classID);
        const result = await pool.request()
            .input('classID', sql.Int, classID)
            .input('term', sql.NVarChar, term)
            .query(`
                UPDATE ${tableName} SET IsPublished = 1
                WHERE Term = @term
                AND StudentID IN (SELECT StudentID FROM Students WHERE ClassID = @classID)
            `);

        res.json({ message: `Results published for term '${term}'.`, affected: result.rowsAffected[0] });
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
        const tableName = await getResultTable(pool, classID);
        const result = await pool.request()
            .input('classID', sql.Int, classID)
            .input('term', sql.NVarChar, term)
            .query(`
                SELECT s.StudentID, s.RollNo, s.FullName,
                       r.SubjectName, r.MarksObtained, r.TotalMarks, r.IsPublished, r.Term
                FROM Students s
                LEFT JOIN ${tableName} r ON r.StudentID = s.StudentID AND r.Term = @term
                WHERE s.ClassID = @classID
                ORDER BY s.RollNo
            `);
        res.json(result.recordset);
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
        const classRes = await pool.request()
            .input('sid', sql.Int, studentID)
            .query('SELECT ClassID FROM Students WHERE StudentID = @sid');
        const classID = classRes.recordset[0]?.ClassID;
        const tableName = await getResultTable(pool, classID);

        const result = await pool.request()
            .input('studentID', sql.Int, studentID)
            .query(`
                SELECT ResultID, SubjectName, Term, MarksObtained, TotalMarks
                FROM ${tableName}
                WHERE StudentID = @studentID AND IsPublished = 1
                ORDER BY Term, SubjectName
            `);
        res.json(result.recordset);
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
        const tableName = await getResultTable(pool, classID);
        const result = await pool.request()
            .input('classID', sql.Int, classID)
            .query(`
                SELECT DISTINCT Term 
                FROM ${tableName} 
                WHERE StudentID IN (SELECT StudentID FROM Students WHERE ClassID = @classID)
                ORDER BY Term
            `);
        res.json(result.recordset.map(row => row.Term));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
// Helper to get the correct result table name based on ClassID
async function getResultTable(pool, classID) {
    const result = await pool.request()
        .input('cid', sql.Int, classID)
        .query('SELECT ClassName FROM Classes WHERE ClassID = @cid');
    
    if (result.recordset.length === 0) return 'ResultClass1'; // Fallback
    
    const className = result.recordset[0].ClassName;
    const gradeMatch = className.match(/\d+/);
    const gradeLevel = gradeMatch ? parseInt(gradeMatch[0]) : 1;
    
    const level = Math.min(Math.max(gradeLevel, 1), 10);
    return `ResultClass${level}`;
}

module.exports = { addResult, publishResults, getClassResults, getStudentResults, getAvailableTerms };
