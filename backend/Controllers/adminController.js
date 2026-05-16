const { poolPromise } = require('../Config/db');

// GET /api/admin/stats
// Returns total students, teachers, and active classes for the dashboard
const getDashboardStats = async (req, res) => {
    try {
        const pool = await poolPromise;

        const studentsResult = await pool.query('SELECT COUNT(*) AS total FROM school_students');
        const teachersResult = await pool.query('SELECT COUNT(*) AS total FROM staff_teachers');
        const classesResult  = await pool.query('SELECT COUNT(*) AS total FROM school_classes');

        res.json({
            totalStudents: parseInt(studentsResult.rows[0].total),
            totalTeachers: parseInt(teachersResult.rows[0].total),
            totalClasses:  parseInt(classesResult.rows[0].total),
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { getDashboardStats };
