const { poolPromise } = require('../Config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const login = async (req, res) => {
    const { username, password } = req.body;

    try {
        const pool = await poolPromise;
        const result = await pool.query('SELECT * FROM school_auth WHERE username = $1', [username]);

        const user = result.rows[0];
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Compare password
        const validPass = await bcrypt.compare(password, user.password); 
        if (!validPass) return res.status(401).json({ message: 'Invalid credentials' });

        const token = jwt.sign(
            { id: user.id, role: user.role }, 
            process.env.JWT_SECRET || 'supersecretkey',
            { expiresIn: '1d' }
        );

        res.json({ token, role: user.role, username: user.username });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const register = async (req, res) => {
    const { username, password, role } = req.body;

    try {
        const pool = await poolPromise;
        const hashedPassword = await bcrypt.hash(password, 10);

        await pool.query(
            'INSERT INTO school_auth (username, password, role) VALUES ($1, $2, $3)',
            [username, hashedPassword, role || 'Student']
        );

        res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { login, register };
