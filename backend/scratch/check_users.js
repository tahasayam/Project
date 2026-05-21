const { poolPromise } = require('../Config/db');

async function checkUsers() {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM Users');
        console.log('Users in database:');
        console.table(result.recordset);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
checkUsers();
