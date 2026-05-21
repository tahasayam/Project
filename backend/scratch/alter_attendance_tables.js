const { poolPromise } = require('../Config/db');

async function alterTables() {
    try {
        const pool = await poolPromise;
        
        for (let i = 1; i <= 10; i++) {
            const tableName = `StudentAttendanceClass${i}`;
            console.log(`Checking ${tableName}...`);
            
            // Check if StudentName exists
            const check = await pool.request().query(`
                SELECT COLUMN_NAME
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME = '${tableName}' AND COLUMN_NAME = 'StudentName'
            `);
            
            if (check.recordset.length === 0) {
                console.log(`Altering ${tableName}...`);
                await pool.request().query(`
                    ALTER TABLE ${tableName} ADD
                    StudentName NVARCHAR(255) NULL,
                    ClassName NVARCHAR(50) NULL,
                    Section NVARCHAR(50) NULL
                `);
            } else {
                console.log(`${tableName} already has the columns.`);
            }
        }
        
        console.log('Successfully altered all attendance tables.');
    } catch (err) {
        console.error('Error altering tables:', err);
    } finally {
        process.exit();
    }
}

alterTables();
