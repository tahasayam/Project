const { poolPromise } = require('../Config/db');

// POST /api/attendance/mark
// Marks attendance for multiple students or teachers
// Body: { date, targetType, records: [{targetID, status}] }
const markAttendance = async (req, res) => {
    const { date, targetType, records } = req.body;
    if (!date || !targetType || !records || !Array.isArray(records)) {
        return res.status(400).json({ message: 'Date, targetType, and records array are required.' });
    }

    try {
        const pool = await poolPromise;
        let tableName = 'teacher_attendance_log';
        let idColumn = 'teacher_id';

        if (targetType === 'Student') {
            idColumn = 'student_id';
            // Need to find the class of the first student to determine the table
            const firstStudentID = records[0]?.targetID;
            if (firstStudentID) {
                const classRes = await pool.query('SELECT class_id FROM school_students WHERE id = $1', [firstStudentID]);
                const classID = classRes.rows[0]?.class_id;
                tableName = await getStudentAttendanceTable(pool, classID);
            } else {
                tableName = 'att_class_1';
            }
        }

        for (const rec of records) {
            // Upsert: delete existing for same day then insert
            await pool.query(`DELETE FROM ${tableName} WHERE log_date = $1 AND ${idColumn} = $2`, [date, rec.targetID]);

            if (targetType === 'Student') {
                await pool.query(`
                        INSERT INTO ${tableName} (log_date, status, ${idColumn}) 
                        VALUES ($1, $2, $3)
                    `, [date, rec.status, rec.targetID]);
            } else {
                await pool.query(`INSERT INTO ${tableName} (log_date, status, ${idColumn}) VALUES ($1, $2, $3)`, [date, rec.status, rec.targetID]);
            }
        }

        res.status(201).json({ message: 'Attendance saved successfully.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /api/attendance/stats/:studentID/:month
// Student: get their attendance % for a given month (1-12)
const getAttendanceStats = async (req, res) => {
    const { studentID, month } = req.params;
    try {
        const pool = await poolPromise;
        
        // Find the class to get the table name
        const classRes = await pool.query('SELECT class_id FROM school_students WHERE id = $1', [studentID]);
        const classID = classRes.rows[0]?.class_id;
        const tableName = await getStudentAttendanceTable(pool, classID);

        const result = await pool.query(`
                SELECT
                    COUNT(*) AS totaldays,
                    SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) AS presentdays,
                    SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END) AS absentdays,
                    SUM(CASE WHEN status = 'Leave' THEN 1 ELSE 0 END) AS leavedays
                FROM ${tableName}
                WHERE student_id = $1 
                  AND EXTRACT(MONTH FROM log_date) = $2 
                  AND EXTRACT(YEAR FROM log_date) = $3
                  AND EXTRACT(DOW FROM log_date) != 0
            `, [studentID, month, new Date().getFullYear()]);
        
        const stats = result.rows[0];
        const total = parseInt(stats.totaldays || 0);
        const present = parseInt(stats.presentdays || 0);
        const absent = parseInt(stats.absentdays || 0);
        const leave = parseInt(stats.leavedays || 0);

        const percent = total > 0
            ? Math.round(((present + leave) / total) * 100)
            : 0;
        res.json({ 
            percent, 
            totalDays: total, 
            presentDays: present,
            absentDays: absent,
            leaveDays: leave
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /api/attendance/view-student/:classID/:date
// Admin/Teacher: view student attendance for a class on a given date
const viewStudentAttendanceByDate = async (req, res) => {
    const { classID, date } = req.params;
    try {
        const pool = await poolPromise;
        const tableName = await getStudentAttendanceTable(pool, classID);
        
        const result = await pool.query(`
                SELECT s.id as "StudentID", s.roll_no as "RollNo", s.fullname as "FullName", a.status as "Status"
                FROM school_students s
                LEFT JOIN ${tableName} a ON a.student_id = s.id
                    AND a.log_date = $1
                WHERE s.class_id = $2
                ORDER BY s.roll_no
            `, [date, classID]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Helper to get the correct attendance table name based on ClassID
async function getStudentAttendanceTable(pool, classID) {
    const result = await pool.query('SELECT classname as "ClassName" FROM school_classes WHERE id = $1', [classID]);
    
    if (result.rows.length === 0) return 'att_class_1'; // Fallback
    
    const className = result.rows[0].ClassName || result.rows[0].classname;
    const gradeMatch = className.match(/\d+/);
    const gradeLevel = gradeMatch ? parseInt(gradeMatch[0]) : 1;
    
    // Ensure grade level is between 1 and 10
    const level = Math.min(Math.max(gradeLevel, 1), 10);
    return `att_class_${level}`;
}

module.exports = { markAttendance, getAttendanceStats, viewStudentAttendanceByDate };
