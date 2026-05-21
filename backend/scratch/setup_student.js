const { poolPromise, sql } = require('../Config/db');
const bcrypt = require('bcryptjs');

async function setupStudent() {
    try {
        const pool = await poolPromise;
        const hashedPassword = await bcrypt.hash('student123', 10);

        // 1. Create a Class if none exists
        console.log('Ensuring a class exists...');
        let classID;
        const classCheck = await pool.request().query('SELECT TOP 1 ClassID FROM Classes');
        if (classCheck.recordset.length === 0) {
            const classResult = await pool.request()
                .input('name', sql.VarChar, 'Class 10-A')
                .input('max', sql.Int, 30)
                .query('INSERT INTO Classes (ClassName, MaxStudents) OUTPUT INSERTED.ClassID VALUES (@name, @max)');
            classID = classResult.recordset[0].ClassID;
            console.log(`Created Class 10-A with ID: ${classID}`);
        } else {
            classID = classCheck.recordset[0].ClassID;
            console.log(`Using existing Class ID: ${classID}`);
        }

        // 2. Create User
        console.log('Creating student user...');
        const userResult = await pool.request()
            .input('username', sql.VarChar, 'student@gmail.com')
            .input('password', sql.VarChar, hashedPassword)
            .input('role', sql.VarChar, 'Student')
            .query('INSERT INTO Users (Username, Password, Role) OUTPUT INSERTED.UserID VALUES (@username, @password, @role)');
        
        const userID = userResult.recordset[0].UserID;
        console.log(`User created with ID: ${userID}`);

        // 3. Create Student Profile
        console.log('Creating student profile...');
        const studentResult = await pool.request()
            .input('rollNo', sql.VarChar, 'S101')
            .input('fullName', sql.VarChar, 'John Doe')
            .input('classID', sql.Int, classID)
            .input('dob', sql.Date, '2010-05-15')
            .input('guardianName', sql.VarChar, 'Jane Doe')
            .input('userID', sql.Int, userID)
            .query('INSERT INTO Students (RollNo, FullName, ClassID, DOB, GuardianName, UserID) OUTPUT INSERTED.StudentID VALUES (@rollNo, @fullName, @classID, @dob, @guardianName, @userID)');
        
        const studentID = studentResult.recordset[0].StudentID;
        console.log(`Student profile created with ID: ${studentID}`);

        // 4. Add some dummy attendance for the current month
        const currentMonth = new Date().getMonth() + 1;
        const year = new Date().getFullYear();
        console.log('Adding dummy attendance...');
        // Determine table based on class name "10-A"
        const gradeLevel = 10; 
        const tableName = `StudentAttendanceClass${gradeLevel}`;

        for(let d=1; d<=10; d++) {
            await pool.request()
                .input('date', sql.Date, `${year}-${currentMonth}-${d}`)
                .input('status', sql.VarChar, d % 3 === 0 ? 'Absent' : 'Present')
                .input('sid', sql.Int, studentID)
                .query(`INSERT INTO ${tableName} (Date, Status, StudentID) VALUES (@date, @status, @sid)`);
        }
        
        // 5. Add a dummy result
        console.log('Adding dummy result...');
        await pool.request()
            .input('sid', sql.Int, studentID)
            .input('sub', sql.VarChar, 'Mathematics')
            .input('term', sql.VarChar, 'First')
            .input('marks', sql.Decimal, 85)
            .input('total', sql.Decimal, 100)
            .input('pub', sql.Bit, 1)
            .query('INSERT INTO Results (StudentID, SubjectName, Term, MarksObtained, TotalMarks, IsPublished) VALUES (@sid, @sub, @term, @marks, @total, @pub)');

        console.log('Setup complete!');
        process.exit(0);
    } catch (err) {
        console.error('Error during setup:', err.message);
        process.exit(1);
    }
}

setupStudent();
