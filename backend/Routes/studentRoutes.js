const express = require('express');
const router = express.Router();
const { getAllStudents, getStudentsByClass, addStudent, deleteStudent, getStudentProfile } = require('../Controllers/studentController');
const verifyToken = require('../Middleware/verifyToken');

router.get('/all', verifyToken(['Admin']), getAllStudents);
router.get('/by-class/:classID', verifyToken(['Admin', 'Teacher']), getStudentsByClass);
router.post('/add', verifyToken(['Admin']), addStudent);
router.delete('/delete/:rollNo', verifyToken(['Admin']), deleteStudent);
router.get('/profile', verifyToken(['Student']), getStudentProfile);

module.exports = router;
