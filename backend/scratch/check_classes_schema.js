const { poolPromise } = require('../Config/db');

async function checkSchema() {
    try {
        const pool = await poolPromise;
        const schema = await pool.request().query("SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Classes'");
        console.log('Schema:', JSON.stringify(schema.recordset, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

checkSchema();
