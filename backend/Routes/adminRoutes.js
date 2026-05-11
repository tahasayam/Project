const express = require('express');
const router = express.Router();
const { getDashboardStats } = require('../Controllers/adminController');
const verifyToken = require('../Middleware/verifyToken');

router.get('/stats', verifyToken(['Admin']), getDashboardStats);

module.exports = router;
