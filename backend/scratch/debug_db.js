const { poolPromise, sql } = require('../Config/db');

async function checkData() {
    try {
        const pool = await poolPromise;
        console.log('--- Classes ---');
        const classes = await pool.request().query('SELECT * FROM Classes');
        console.table(classes.recordset);

        console.log('--- Subjects ---');
        const subjects = await pool.request().query('SELECT * FROM Subjects');
        console.table(subjects.recordset);

        console.log('--- ClassSubjects ---');
        const cs = await pool.request().query('SELECT * FROM ClassSubjects');
        console.table(cs.recordset);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
checkData();
