const { poolPromise, sql } = require('../Config/db');

async function fixTayyab() {
    try {
        const pool = await poolPromise;
        const teacherID = 1;
        
        // Find a class and subject to assign
        const classRes = await pool.request().query('SELECT TOP 1 ClassID FROM Classes');
        const subRes = await pool.request().query('SELECT TOP 1 SubjectID FROM Subjects');
        
        if (classRes.recordset.length === 0 || subRes.recordset.length === 0) {
            console.log('No classes or subjects found to assign.');
            return;
        }
        
        const classID = classRes.recordset[0].ClassID;
        const subjectID = subRes.recordset[0].SubjectID;
        
        console.log(`Assigning Teacher 1 to Class ${classID} and Subject ${subjectID}`);
        
        await pool.request()
            .input('tid', sql.Int, teacherID)
            .input('cid', sql.Int, classID)
            .input('sid', sql.Int, subjectID)
            .query('INSERT INTO TeacherAssignments (TeacherID, ClassID, SubjectID) VALUES (@tid, @cid, @sid)');
            
        // Run the summary update
        await pool.request()
            .input('tid', sql.Int, teacherID)
            .query(`
                UPDATE Teachers 
                SET 
                    Subject = (
                        SELECT STRING_AGG(s.SubjectName, \', \') 
                        FROM TeacherAssignments ta
                        JOIN Subjects s ON ta.SubjectID = s.SubjectID
                        WHERE ta.TeacherID = @tid
                    ),
                    AssignedClasses = (
                        SELECT STRING_AGG(ClassName, \', \') 
                        FROM (
                            SELECT DISTINCT c.ClassName 
                            FROM TeacherAssignments ta
                            JOIN Classes c ON ta.ClassID = c.ClassID
                            WHERE ta.TeacherID = @tid
                        ) AS ClassSub
                    )
                WHERE TeacherID = @tid
            `);
            
        console.log('Update complete. Check DB now.');
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

fixTayyab();
