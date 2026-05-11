const express = require('express');
const router = express.Router();
const { getAllTeachers, addTeacher, deleteTeacher, getTeacherProfile } = require('../Controllers/teacherController');
const verifyToken = require('../Middleware/verifyToken');

router.get('/all', verifyToken(['Admin']), getAllTeachers);
router.post('/add', verifyToken(['Admin']), addTeacher);
router.delete('/delete/:phoneNo', verifyToken(['Admin']), deleteTeacher);
router.get('/profile', verifyToken(['Teacher']), getTeacherProfile);
router.post('/update-assignments', verifyToken(['Admin']), require('../Controllers/teacherController').updateTeacherAssignments);

module.exports = router;
