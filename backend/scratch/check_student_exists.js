const { poolPromise } = require('../Config/db');

async function checkStudent() {
    try {
        const pool = await poolPromise;
        
        // Check Users table
        const users = await pool.request().query("SELECT * FROM Users WHERE Email = 'student@gmail.com'");
        console.log('Users found with email student@gmail.com:', users.recordset);

        // Check Students table
        const students = await pool.request().query("SELECT * FROM Students WHERE Email = 'student@gmail.com'");
        console.log('Students found with email student@gmail.com:', students.recordset);
        
    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

checkStudent();
