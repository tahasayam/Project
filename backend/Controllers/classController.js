const { poolPromise } = require('../Config/db');

// GET /api/classes/all
const getAllClasses = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.query(`
            SELECT c.id as "ClassID", c.classname as "ClassName", c.max_students as "MaxStudents",
                   (SELECT COUNT(*) FROM school_students s WHERE s.class_id = c.id) AS "StudentCount",
                   COALESCE((
                       SELECT JSON_AGG(JSON_BUILD_OBJECT('SubjectID', s.id, 'SubjectName', s.subjectname))
                       FROM class_subjects_map cs
                       JOIN school_subjects s ON cs.subject_id = s.id
                       WHERE cs.class_id = c.id
                   ), '[]'::json) AS "SubjectAssignments"
            FROM school_classes c
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /api/classes/available-teachers
const getAvailableTeachers = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.query(`
            SELECT id as "TeacherID", fullname as "FullName", subject_specialty as "Subject" FROM staff_teachers
            WHERE id NOT IN (
                SELECT teacher_id FROM school_classes WHERE teacher_id IS NOT NULL
            )
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const addClass = async (req, res) => {
    const { className, maxStudents, subjects } = req.body;
    if (!className) {
        return res.status(400).json({ message: 'Class name is required.' });
    }
    try {
        const pool = await poolPromise;

        const gradeMatch = className.match(/\d+/);
        if (!gradeMatch) {
            return res.status(400).json({ message: 'Class name must contain a grade number (e.g., Class 1A).' });
        }
        const gradeLevel = parseInt(gradeMatch[0]);
        if (gradeLevel < 1 || gradeLevel > 10) {
            return res.status(400).json({ message: 'Grade level must be between 1 and 10.' });
        }

        const dup = await pool.query('SELECT id FROM school_classes WHERE classname = $1', [className]);
        if (dup.rows.length > 0) {
            return res.status(400).json({ message: `Class '${className}' already exists.` });
        }

        const classResult = await pool.query(
            'INSERT INTO school_classes (classname, max_students) VALUES ($1, $2) RETURNING id',
            [className, maxStudents || 30]
        );
        
        const classID = classResult.rows[0].id;

        if (subjects && Array.isArray(subjects)) {
            for (const sub of subjects) {
                let subjectID;
                if (typeof sub === 'string') {
                    // Postgres "Upsert" style or separate check
                    const subRes = await pool.query(`
                        WITH ins AS (
                            INSERT INTO school_subjects (subjectname) 
                            VALUES ($1) 
                            ON CONFLICT (subjectname) DO NOTHING 
                            RETURNING id
                        )
                        SELECT id FROM ins
                        UNION ALL
                        SELECT id FROM school_subjects WHERE subjectname = $1
                        LIMIT 1
                    `, [sub]);
                    subjectID = subRes.rows[0].id;
                } else {
                    subjectID = sub;
                }

                await pool.query(
                    'INSERT INTO class_subjects_map (class_id, subject_id) VALUES ($1, $2)',
                    [classID, subjectID]
                );
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
        const result = await pool.query('SELECT id as "SubjectID", subjectname as "SubjectName" FROM school_subjects ORDER BY subjectname');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const addSubject = async (req, res) => {
    const { subjectName } = req.body;
    try {
        const pool = await poolPromise;
        await pool.query('INSERT INTO school_subjects (subjectname) VALUES ($1)', [subjectName]);
        res.status(201).json({ message: 'Subject created.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const deleteClass = async (req, res) => {
    const { classID } = req.params;
    try {
        const pool = await poolPromise;
        await pool.query('DELETE FROM school_classes WHERE id = $1', [classID]);
        res.json({ message: 'Class deleted.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { getAllClasses, getAvailableTeachers, addClass, deleteClass, getAllSubjects, addSubject };
