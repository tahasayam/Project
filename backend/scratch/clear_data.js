const { poolPromise, sql } = require('../Config/db');

async function clearData() {
    try {
        const pool = await poolPromise;
        console.log("Connecting to database to erase all data...");

        // Order is important due to foreign key relationships
        await pool.request().query('DELETE FROM Results');
        
        for (let i = 1; i <= 10; i++) {
            await pool.request().query(`DELETE FROM StudentAttendanceClass${i}`);
        }
        
        await pool.request().query('DELETE FROM TeacherAttendance');
        await pool.request().query('DELETE FROM TeacherAssignments');
        await pool.request().query('DELETE FROM ClassSubjects');
        await pool.request().query('DELETE FROM Students');
        await pool.request().query('DELETE FROM Teachers');
        await pool.request().query('DELETE FROM Classes');
        await pool.request().query('DELETE FROM Subjects');
        
        // Delete all user accounts EXCEPT the Admin
        await pool.request().query("DELETE FROM Users WHERE Role != 'Admin'");
        
        // Reset the auto-increment counters back to 0
        const tables = ['Students', 'Teachers', 'Classes', 'Subjects', 'TeacherAssignments', 'ClassSubjects', 'Results'];
        for(let t of tables) {
            try {
                await pool.request().query(`DBCC CHECKIDENT ('${t}', RESEED, 0)`);
            } catch(err) { /* Ignore if empty */ }
        }
        
        console.log("✅ All data erased successfully! (Admin user was kept intact)");
        process.exit(0);
    } catch (e) {
        console.error("Error clearing data:", e);
        process.exit(1);
    }
}
clearData();
