const { poolPromise, sql } = require('../Config/db');

// GET /api/classes/all
const getAllClasses = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT c.ClassID, c.ClassName, c.MaxStudents,
                   (SELECT COUNT(*) FROM Students s WHERE s.ClassID = c.ClassID) AS StudentCount,
                   ISNULL((
                       SELECT s.SubjectID, s.SubjectName
                       FROM ClassSubjects cs
                       JOIN Subjects s ON cs.SubjectID = s.SubjectID
                       WHERE cs.ClassID = c.ClassID
                       FOR JSON PATH
                   ), '[]') AS SubjectAssignments
            FROM Classes c
        `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /api/classes/available-teachers
// Teachers NOT already assigned to any class
const getAvailableTeachers = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT TeacherID, FullName, Subject FROM Teachers
            WHERE TeacherID NOT IN (
                SELECT TeacherID FROM Classes WHERE TeacherID IS NOT NULL
            )
        `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const addClass = async (req, res) => {
    const { className, maxStudents, subjects } = req.body; // subjects is an array of IDs or names
    if (!className) {
        return res.status(400).json({ message: 'Class name is required.' });
    }
    try {
        const pool = await poolPromise;

        // Extract grade number from className (e.g., "Class 10A" -> 10)
        const gradeMatch = className.match(/\d+/);
        if (!gradeMatch) {
            return res.status(400).json({ message: 'Class name must contain a grade number (e.g., Class 1A).' });
        }
        const gradeLevel = parseInt(gradeMatch[0]);
        if (gradeLevel < 1 || gradeLevel > 10) {
            return res.status(400).json({ message: 'Grade level must be between 1 and 10.' });
        }

        // Check duplicate class name
        const dup = await pool.request()
            .input('className', sql.NVarChar, className)
            .query('SELECT ClassID FROM Classes WHERE ClassName = @className');
        if (dup.recordset.length > 0) {
            return res.status(400).json({ message: `Class '${className}' already exists.` });
        }

        const classResult = await pool.request()
            .input('className', sql.NVarChar, className)
            .input('maxStudents', sql.Int, maxStudents || 30)
            .query('INSERT INTO Classes (ClassName, MaxStudents) OUTPUT INSERTED.ClassID VALUES (@className, @maxStudents)');
        
        const classID = classResult.recordset[0].ClassID;

        // Add subjects to class
        if (subjects && Array.isArray(subjects)) {
            for (const sub of subjects) {
                // If sub is a string (name), find or create it
                let subjectID;
                if (typeof sub === 'string') {
                    const subRes = await pool.request()
                        .input('name', sql.NVarChar, sub)
                        .query('IF NOT EXISTS (SELECT SubjectID FROM Subjects WHERE SubjectName = @name) BEGIN INSERT INTO Subjects (SubjectName) OUTPUT INSERTED.SubjectID VALUES (@name) END ELSE BEGIN SELECT SubjectID FROM Subjects WHERE SubjectName = @name END');
                    subjectID = subRes.recordset[0].SubjectID;
                } else {
                    subjectID = sub;
                }

                await pool.request()
                    .input('cid', sql.Int, classID)
                    .input('sid', sql.Int, subjectID)
                    .query('INSERT INTO ClassSubjects (ClassID, SubjectID) VALUES (@cid, @sid)');
            }
        }

        res.status(201).json({ message: 'Class created successfully.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const getAllSubjects = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM Subjects ORDER BY SubjectName');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const addSubject = async (req, res) => {
    const { subjectName } = req.body;
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('name', sql.NVarChar, subjectName)
            .query('INSERT INTO Subjects (SubjectName) VALUES (@name)');
        res.status(201).json({ message: 'Subject created.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// DELETE /api/classes/delete/:classID
const deleteClass = async (req, res) => {
    const { classID } = req.params;
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('classID', sql.Int, classID)
            .query('DELETE FROM Classes WHERE ClassID = @classID');
        res.json({ message: 'Class deleted.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { getAllClasses, getAvailableTeachers, addClass, deleteClass, getAllSubjects, addSubject };
