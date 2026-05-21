const { poolPromise } = require('../Config/db');

async function checkStudent() {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query("SELECT * FROM Students WHERE UserID = 6");
        console.log('Student for UserID 6:', result.recordset);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

checkStudent();
