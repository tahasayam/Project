const express = require('express');
const router = express.Router();
const { markAttendance, getAttendanceStats, viewStudentAttendanceByDate } = require('../Controllers/attendanceController');
const verifyToken = require('../Middleware/verifyToken');

router.post('/mark', verifyToken(['Teacher', 'Admin']), markAttendance);
router.get('/stats/:studentID/:month', verifyToken(['Student', 'Admin']), getAttendanceStats);
router.get('/view-student/:classID/:date', verifyToken(['Teacher', 'Admin']), viewStudentAttendanceByDate);

module.exports = router;
