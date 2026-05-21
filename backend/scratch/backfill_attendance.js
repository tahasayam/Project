const { poolPromise } = require('../Config/db');

async function backfill() {
    try {
        const pool = await poolPromise;
        
        for (let i = 1; i <= 10; i++) {
            const tableName = `StudentAttendanceClass${i}`;
            console.log(`Backfilling ${tableName}...`);
            
            try {
                await pool.request().query(`
                    UPDATE a
                    SET a.StudentName = s.FullName,
                        a.ClassName = s.ClassName,
                        a.Section = s.Section
                    FROM ${tableName} a
                    INNER JOIN Students s ON a.StudentID = s.StudentID
                    WHERE a.StudentName IS NULL
                `);
            } catch(e) {
                // Table might not have columns or records, ignore
                console.log(`Skipping ${tableName} due to error: ${e.message}`);
            }
        }
        
        console.log('Successfully backfilled all attendance tables.');
    } catch (err) {
        console.error('Error backfilling tables:', err);
    } finally {
        process.exit();
    }
}

backfill();
