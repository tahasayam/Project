const { poolPromise } = require('../Config/db');

async function checkData() {
    try {
        const pool = await poolPromise;
        const assignments = await pool.request().query('SELECT * FROM TeacherAssignments');
        console.log('Assignments:', JSON.stringify(assignments.recordset, null, 2));
        
        const teachers = await pool.request().query('SELECT * FROM Teachers');
        console.log('Teachers:', JSON.stringify(teachers.recordset, null, 2));
        
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

checkData();
