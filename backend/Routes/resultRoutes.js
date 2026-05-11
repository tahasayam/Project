const express = require('express');
const router = express.Router();
const { addResult, publishResults, getClassResults, getStudentResults, getAvailableTerms } = require('../Controllers/resultController');
const verifyToken = require('../Middleware/verifyToken');

router.post('/add', verifyToken(['Teacher']), addResult);
router.post('/publish', verifyToken(['Admin']), publishResults);
router.get('/class/:classID/:term', verifyToken(['Admin', 'Teacher']), getClassResults);
router.get('/student/:studentID', verifyToken(['Student']), getStudentResults);
router.get('/available-terms/:classID', verifyToken(), getAvailableTerms);

module.exports = router;
