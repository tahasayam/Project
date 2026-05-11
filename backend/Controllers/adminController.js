const { poolPromise, sql } = require('../Config/db');

// GET /api/admin/stats
// Returns total students, teachers, and active classes for the dashboard
const getDashboardStats = async (req, res) => {
    try {
        const pool = await poolPromise;

        const studentsResult = await pool.request().query('SELECT COUNT(*) AS Total FROM Students');
        const teachersResult = await pool.request().query('SELECT COUNT(*) AS Total FROM Teachers');
        const classesResult  = await pool.request().query('SELECT COUNT(*) AS Total FROM Classes');

        res.json({
            totalStudents: studentsResult.recordset[0].Total,
            totalTeachers: teachersResult.recordset[0].Total,
            totalClasses:  classesResult.recordset[0].Total,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { getDashboardStats };
