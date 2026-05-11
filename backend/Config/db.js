const { Pool } = require('pg');
require('dotenv').config();

// Use DATABASE_URL from environment variables (provided by Render)
const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
    connectionString: connectionString,
    ssl: {
        rejectUnauthorized: false // Required for Render's hosted PostgreSQL
    }
});

// Compatibility wrapper to make pg look like mssql for simple queries
const poolPromise = (async () => {
    try {
        const client = await pool.connect();
        console.log('✅ Connected to PostgreSQL');
        client.release();
        
        // Return an object that mimics the mssql pool object
        return {
            request: () => ({
                query: async (queryString) => {
                    const result = await pool.query(queryString);
                    return {
                        recordset: result.rows,
                        rowsAffected: [result.rowCount]
                    };
                },
                input: function() { return this; } // Mock mssql input() for simple parameterized queries if needed
            }),
            query: async (queryString) => {
                const result = await pool.query(queryString);
                return {
                    recordset: result.rows,
                    rowsAffected: [result.rowCount]
                };
            }
        };
    } catch (err) {
        console.error('❌ Database Connection Failed: ', err);
        throw err;
    }
})();

// We export sql as an empty object or mock if needed, but primarily poolPromise
module.exports = { sql: {}, poolPromise };