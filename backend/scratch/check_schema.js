const { poolPromise } = require('../Config/db');

async function checkSchema() {
    try {
        const pool = await poolPromise;
        
        console.log('Checking Users table columns:');
        const usersCols = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Users'");
        console.log(usersCols.recordset.map(r => r.COLUMN_NAME));

        console.log('Checking Students table columns:');
        const studentsCols = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Students'");
        console.log(studentsCols.recordset.map(r => r.COLUMN_NAME));
        
    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

checkSchema();
