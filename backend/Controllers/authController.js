const { poolPromise, sql } = require('../Config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const login = async (req, res) => {
    const { username, password } = req.body;

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('username', sql.VarChar, username)
            .query('SELECT * FROM Users WHERE Username = @username');

        const user = result.recordset[0];
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Compare password (using bcrypt if hashed, or plain text if not - but let's stick to bcrypt)
        const validPass = await bcrypt.compare(password, user.Password);
        if (!validPass) return res.status(401).json({ message: 'Invalid credentials' });

        const token = jwt.sign(
            { id: user.UserID, role: user.Role }, 
            process.env.JWT_SECRET || 'supersecretkey',
            { expiresIn: '1d' }
        );

        res.json({ token, role: user.Role, username: user.Username });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const register = async (req, res) => {
    const { username, password, role } = req.body;

    try {
        const pool = await poolPromise;
        const hashedPassword = await bcrypt.hash(password, 10);

        await pool.request()
            .input('username', sql.VarChar, username)
            .input('password', sql.VarChar, hashedPassword)
            .input('role', sql.VarChar, role || 'Student')
            .query('INSERT INTO Users (Username, Password, Role) VALUES (@username, @password, @role)');

        res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { login, register };
