const { poolPromise, sql } = require('../Config/db');

async function testTeacherProfile() {
    try {
        const pool = await poolPromise;
        
        // Find teacher tayyab
        const t = await pool.request()
            .query("SELECT TeacherID FROM Teachers WHERE FullName LIKE '%tayyab%'");
        
        if (t.recordset.length > 0) {
            const tid = t.recordset[0].TeacherID;
            console.log('TeacherID:', tid);
            
            const assignments = await pool.request()
                .input('tid', sql.Int, tid)
                .query(`
                    SELECT a.AssignmentID, c.ClassID, c.ClassName, sub.SubjectName
                    FROM TeacherAssignments a
                    JOIN Classes c ON a.ClassID = c.ClassID
                    JOIN Subjects sub ON a.SubjectID = sub.SubjectID
                    WHERE a.TeacherID = @tid
                `);
            console.log('Assignments:', JSON.stringify(assignments.recordset, null, 2));
        } else {
            console.log('Teacher tayyab not found');
        }
        
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

testTeacherProfile();
