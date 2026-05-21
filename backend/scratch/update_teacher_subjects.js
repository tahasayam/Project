const { poolPromise, sql } = require('../Config/db');

async function updateTeachers() {
    try {
        const pool = await poolPromise;
        console.log('Updating all teachers with their assigned subjects...');
        
        await pool.request().query(`
            UPDATE Teachers 
            SET 
                Subject = (
                    SELECT STRING_AGG(s.SubjectName, ', ') 
                    FROM TeacherAssignments ta
                    JOIN Subjects s ON ta.SubjectID = s.SubjectID
                    WHERE ta.TeacherID = Teachers.TeacherID
                ),
                AssignedClasses = (
                    SELECT STRING_AGG(ClassName, ', ') 
                    FROM (
                        SELECT DISTINCT c.ClassName, ta2.TeacherID
                        FROM TeacherAssignments ta2
                        JOIN Classes c ON ta2.ClassID = c.ClassID
                    ) AS ClassSub
                    WHERE ClassSub.TeacherID = Teachers.TeacherID
                )
        `);

        console.log('✅ All teachers updated successfully!');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
updateTeachers();
