const { poolPromise, sql } = require('../Config/db');

async function dropResultsTable() {
    try {
        const pool = await poolPromise;
        console.log('Dropping old Results table...');
        
        await pool.request().query('DROP TABLE IF EXISTS Results');
        
        console.log('Successfully dropped Results table.');
    } catch (err) {
        console.error('Error dropping table:', err);
    } finally {
        process.exit();
    }
}

dropResultsTable();
