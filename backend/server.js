const express = require('express');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();
const { poolPromise } = require('./Config/db');

// Import Routes
const authRoutes = require('./Routes/authRoutes');
const adminRoutes = require('./Routes/adminRoutes');
const studentRoutes = require('./Routes/studentRoutes');
const teacherRoutes = require('./Routes/teacherRoutes');
const attendanceRoutes = require('./Routes/attendanceRoutes');
const classRoutes = require('./Routes/classRoutes');
const resultRoutes = require('./Routes/resultRoutes');

const app = express();

// Middleware
const allowedOrigins = [
    'http://localhost:5500', 
    'http://127.0.0.1:5500',
    process.env.FRONTEND_URL // Vercel URL will be added here on Render
].filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, '../frontend')));

// Root route to serve the login page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/Pages/login.html'));
});

// Register Project Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/results', resultRoutes);

// Health Check Route
app.get('/health', async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) throw new Error("Database pool not initialized");
        await pool.request().query('SELECT 1');
        res.json({ status: "OK", database: "Connected" });
    } catch (err) {
        console.error('❌ Health check failed:', err.message);
        res.status(500).json({ status: "Error", message: err.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 Health check available at http://localhost:${PORT}/health`);
});