const express = require('express');
const router = express.Router();
const { getAllClasses, getAvailableTeachers, addClass, deleteClass, getAllSubjects, addSubject } = require('../Controllers/classController');
const verifyToken = require('../Middleware/verifyToken');

router.get('/all', verifyToken(), getAllClasses);
router.get('/available-teachers', verifyToken(['Admin']), getAvailableTeachers);
router.get('/subjects', verifyToken(), getAllSubjects);
router.post('/subjects', verifyToken(['Admin']), addSubject);
router.post('/add', verifyToken(['Admin']), addClass);
router.delete('/delete/:classID', verifyToken(['Admin']), deleteClass);

module.exports = router;
