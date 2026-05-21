const { poolPromise } = require('../Config/db');

async function alterResultsTable() {
    try {
        const pool = await poolPromise;
        
        console.log('Checking Results table schema...');
        
        // Check if StudentName exists
        const check = await pool.request().query(`
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'Results' AND COLUMN_NAME = 'StudentName'
        `);
        
        if (check.recordset.length === 0) {
            console.log('Altering Results table...');
            await pool.request().query(`
                ALTER TABLE Results ADD
                StudentName NVARCHAR(255) NULL,
                ClassName NVARCHAR(50) NULL,
                Section NVARCHAR(50) NULL
            `);
            console.log('Successfully altered Results table.');
        } else {
            console.log('Results table already has the columns.');
        }
        
    } catch (err) {
        console.error('Error altering table:', err);
    } finally {
        process.exit();
    }
}

alterResultsTable();
