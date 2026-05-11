const { poolPromise, sql } = require('../Config/db');

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
        let tableName = 'TeacherAttendance';
        let idColumn = 'TeacherID';

        if (targetType === 'Student') {
            idColumn = 'StudentID';
            // Need to find the class of the first student to determine the table
            const firstStudentID = records[0]?.targetID;
            if (firstStudentID) {
                const classRes = await pool.request()
                    .input('sid', sql.Int, firstStudentID)
                    .query('SELECT ClassID FROM Students WHERE StudentID = @sid');
                const classID = classRes.recordset[0]?.ClassID;
                tableName = await getStudentAttendanceTable(pool, classID);
            } else {
                tableName = 'StudentAttendanceClass1';
            }
        }

        for (const rec of records) {
            // Upsert: delete existing for same day then insert
            await pool.request()
                .input('date', sql.Date, date)
                .input('id', sql.Int, rec.targetID)
                .query(`DELETE FROM ${tableName} WHERE Date = @date AND ${idColumn} = @id`);

            if (targetType === 'Student') {
                await pool.request()
                    .input('date', sql.Date, date)
                    .input('status', sql.NVarChar, rec.status)
                    .input('id', sql.Int, rec.targetID)
                    .query(`
                        INSERT INTO ${tableName} (Date, Status, ${idColumn}, StudentName, ClassName, Section) 
                        SELECT @date, @status, @id, FullName, ClassName, Section 
                        FROM Students 
                        WHERE StudentID = @id
                    `);
            } else {
                await pool.request()
                    .input('date', sql.Date, date)
                    .input('status', sql.NVarChar, rec.status)
                    .input('id', sql.Int, rec.targetID)
                    .query(`INSERT INTO ${tableName} (Date, Status, ${idColumn}) VALUES (@date, @status, @id)`);
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
        const classRes = await pool.request()
            .input('sid', sql.Int, studentID)
            .query('SELECT ClassID FROM Students WHERE StudentID = @sid');
        const classID = classRes.recordset[0]?.ClassID;
        const tableName = await getStudentAttendanceTable(pool, classID);

        const result = await pool.request()
            .input('sid', sql.Int, studentID)
            .input('month', sql.Int, month)
            .input('year', sql.Int, new Date().getFullYear())
            .query(`
                SELECT
                    COUNT(*) AS TotalDays,
                    SUM(CASE WHEN Status = 'Present' THEN 1 ELSE 0 END) AS PresentDays,
                    SUM(CASE WHEN Status = 'Absent' THEN 1 ELSE 0 END) AS AbsentDays,
                    SUM(CASE WHEN Status = 'Leave' THEN 1 ELSE 0 END) AS LeaveDays
                FROM ${tableName}
                WHERE StudentID = @sid 
                  AND MONTH(Date) = @month 
                  AND YEAR(Date) = @year
                  AND (DATEDIFF(day, 0, Date) % 7) != 6
            `);
        const stats = result.recordset[0];
        const percent = stats.TotalDays > 0
            ? Math.round(((stats.PresentDays + stats.LeaveDays) / stats.TotalDays) * 100)
            : 0;
        res.json({ 
            percent, 
            totalDays: stats.TotalDays, 
            presentDays: stats.PresentDays,
            absentDays: stats.AbsentDays,
            leaveDays: stats.LeaveDays
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
        
        const result = await pool.request()
            .input('classID', sql.Int, classID)
            .input('date', sql.Date, date)
            .query(`
                SELECT s.StudentID, s.RollNo, s.FullName, a.Status
                FROM Students s
                LEFT JOIN ${tableName} a ON a.StudentID = s.StudentID
                    AND a.Date = @date
                WHERE s.ClassID = @classID
                ORDER BY s.RollNo
            `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Helper to get the correct attendance table name based on ClassID
async function getStudentAttendanceTable(pool, classID) {
    const result = await pool.request()
        .input('cid', sql.Int, classID)
        .query('SELECT ClassName FROM Classes WHERE ClassID = @cid');
    
    if (result.recordset.length === 0) return 'StudentAttendanceClass1'; // Fallback
    
    const className = result.recordset[0].ClassName;
    const gradeMatch = className.match(/\d+/);
    const gradeLevel = gradeMatch ? parseInt(gradeMatch[0]) : 1;
    
    // Ensure grade level is between 1 and 10
    const level = Math.min(Math.max(gradeLevel, 1), 10);
    return `StudentAttendanceClass${level}`;
}

module.exports = { markAttendance, getAttendanceStats, viewStudentAttendanceByDate };
