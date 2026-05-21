const { poolPromise } = require('../Config/db');

async function checkUsers() {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query("SELECT * FROM Users");
        console.log('All Users:', result.recordset);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

checkUsers();
