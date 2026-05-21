const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    password: process.env.DB_PWD,
    port: process.env.DB_PORT,
    ssl: { rejectUnauthorized: false }
});

async function resetAdmin() {
    try {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await pool.query('DELETE FROM school_auth WHERE username = $1', ['admin@gmail.com']);
        await pool.query(
            'INSERT INTO school_auth (username, password, role) VALUES ($1, $2, $3)',
            ['admin@gmail.com', hashedPassword, 'Admin']
        );
        console.log('✅ Admin account reset successfully with password: admin123');
    } catch (err) {
        console.error('❌ Error resetting admin:', err.message);
    } finally {
        await pool.end();
    }
}

resetAdmin();
