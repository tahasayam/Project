const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    password: process.env.DB_PWD,
    port: process.env.DB_PORT,
    ssl: {
        rejectUnauthorized: false // Required for most cloud providers like Supabase/Neon
    }
});

const poolPromise = pool.connect()
    .then(client => {
        console.log('✅ Connected to Cloud PostgreSQL Database');
        client.release();
        return pool;
    })
    .catch(err => {
        console.error('❌ Database Connection Failed:', err.message);
        return null;
    });

module.exports = { pool, poolPromise };