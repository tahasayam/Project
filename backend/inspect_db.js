const { poolPromise } = require('./Config/db');

async function check() {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'");
        console.log('TABLES:', result.recordset.map(r => r.TABLE_NAME).join(', '));
        
        for (let table of result.recordset) {
            const cols = await pool.request().query(`SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${table.TABLE_NAME}'`);
            console.log(`\nTable: ${table.TABLE_NAME}`);
            console.table(cols.recordset);
        }
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
check();
