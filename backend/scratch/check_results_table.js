const { poolPromise } = require('../Config/db');

async function checkTables() {
    try {
        const pool = await poolPromise;
        
        const check = await pool.request().query(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME = 'Results'
        `);
        
        if (check.recordset.length === 0) {
            console.log('The Results table DOES NOT exist. It has been completely deleted.');
        } else {
            console.log('The Results table STILL EXISTS!');
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

checkTables();
