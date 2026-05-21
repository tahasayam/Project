const sql = require('mssql');
require('dotenv').config();

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PWD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT),
    options: {
        encrypt: false,
        trustServerCertificate: true,
    }
};

async function test() {
    try {
        console.log('Attempting to connect to:', config.server, 'on port:', config.port);
        let pool = await sql.connect(config);
        console.log('SUCCESS!');
        await pool.close();
    } catch (err) {
        console.error('FAILURE:', err.message);
        if (err.originalError) {
            console.error('Original Error:', err.originalError.message);
        }
    }
}

test();
