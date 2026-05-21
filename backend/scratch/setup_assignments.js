const { poolPromise, sql } = require('../Config/db');
const bcrypt = require('bcryptjs');

async function setupTestScenario() {
    try {
        const pool = await poolPromise;
        const hashedPassword = await bcrypt.hash('teacher123', 10);

        console.log('Creating Class 10A...');
        const classResult = await pool.request()
            .input('name', sql.NVarChar, 'Class 10A')
            .query('INSERT INTO Classes (ClassName, MaxStudents) OUTPUT INSERTED.ClassID VALUES (@name, 30)');
        const classID10A = classResult.recordset[0].ClassID;

        console.log('Creating Class 10B...');
        const classResultB = await pool.request()
            .input('name', sql.NVarChar, 'Class 10B')
            .query('INSERT INTO Classes (ClassName, MaxStudents) OUTPUT INSERTED.ClassID VALUES (@name, 30)');
        const classID10B = classResultB.recordset[0].ClassID;

        console.log('Creating Subjects...');
        const sub1 = await pool.request().input('n', sql.NVarChar, 'Mathematics').query('INSERT INTO Subjects (SubjectName) OUTPUT INSERTED.SubjectID VALUES (@n)');
        const sub2 = await pool.request().input('n', sql.NVarChar, 'Physics').query('INSERT INTO Subjects (SubjectName) OUTPUT INSERTED.SubjectID VALUES (@n)');
        const mathID = sub1.recordset[0].SubjectID;
        const physicsID = sub2.recordset[0].SubjectID;

        console.log('Linking Subjects to Classes...');
        await pool.request().input('cid', sql.Int, classID10A).input('sid', sql.Int, mathID).query('INSERT INTO ClassSubjects (ClassID, SubjectID) VALUES (@cid, @sid)');
        await pool.request().input('cid', sql.Int, classID10A).input('sid', sql.Int, physicsID).query('INSERT INTO ClassSubjects (ClassID, SubjectID) VALUES (@cid, @sid)');
        await pool.request().input('cid', sql.Int, classID10B).input('sid', sql.Int, mathID).query('INSERT INTO ClassSubjects (ClassID, SubjectID) VALUES (@cid, @sid)');

        console.log('Creating Teacher user...');
        const userResult = await pool.request()
            .input('u', sql.NVarChar, 'teacher@gmail.com')
            .input('p', sql.NVarChar, hashedPassword)
            .input('r', sql.NVarChar, 'Teacher')
            .query('INSERT INTO Users (Username, Password, Role) OUTPUT INSERTED.UserID VALUES (@u, @p, @r)');
        const userID = userResult.recordset[0].UserID;

        console.log('Creating Teacher profile...');
        const tResult = await pool.request()
            .input('n', sql.NVarChar, 'Hamza')
            .input('e', sql.NVarChar, 'teacher@gmail.com')
            .input('uid', sql.Int, userID)
            .query('INSERT INTO Teachers (FullName, Email, UserID) OUTPUT INSERTED.TeacherID VALUES (@n, @e, @uid)');
        const teacherID = tResult.recordset[0].TeacherID;

        console.log('Assigning Teacher to Classes/Subjects...');
        // Hamza teaches Math in 10A and Physics in 10A and Math in 10B
        await pool.request().input('tid', sql.Int, teacherID).input('cid', sql.Int, classID10A).input('sid', sql.Int, mathID).query('INSERT INTO TeacherAssignments (TeacherID, ClassID, SubjectID) VALUES (@tid, @cid, @sid)');
        await pool.request().input('tid', sql.Int, teacherID).input('cid', sql.Int, classID10A).input('sid', sql.Int, physicsID).query('INSERT INTO TeacherAssignments (TeacherID, ClassID, SubjectID) VALUES (@tid, @cid, @sid)');
        await pool.request().input('tid', sql.Int, teacherID).input('cid', sql.Int, classID10B).input('sid', sql.Int, mathID).query('INSERT INTO TeacherAssignments (TeacherID, ClassID, SubjectID) VALUES (@tid, @cid, @sid)');

        console.log('Adding some students to 10A and 10B...');
        for(let i=1; i<=5; i++) {
            await pool.request().input('n', sql.NVarChar, `Student ${i}`).input('r', sql.NVarChar, `R${100+i}`).input('cid', sql.Int, classID10A).query('INSERT INTO Students (FullName, RollNo, ClassID) VALUES (@n, @r, @cid)');
        }
        for(let i=6; i<=8; i++) {
            await pool.request().input('n', sql.NVarChar, `Student ${i}`).input('r', sql.NVarChar, `R${100+i}`).input('cid', sql.Int, classID10B).query('INSERT INTO Students (FullName, RollNo, ClassID) VALUES (@n, @r, @cid)');
        }

        console.log('Setup complete! Login: teacher@gmail.com / teacher123');
        console.log('Hamza should see 8 students total (5 from 10A, 3 from 10B)');
        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

setupTestScenario();
