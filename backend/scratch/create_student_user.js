const { poolPromise, sql } = require('../Config/db');
const bcrypt = require('bcryptjs');

async function createStudentUser() {
    try {
        const pool = await poolPromise;
        
        // Hash password
        const hashedPassword = await bcrypt.hash('student123', 10);
        
        // Insert User
        const userRes = await pool.request()
            .input('username', sql.NVarChar, 'student@gmail.com')
            .input('password', sql.NVarChar, hashedPassword)
            .input('role', sql.NVarChar, 'Student')
            .query("INSERT INTO Users (Username, Password, Role) OUTPUT INSERTED.UserID VALUES (@username, @password, @role)");
        
        const userID = userRes.recordset[0].UserID;
        console.log('User created with ID:', userID);

        // Insert Student (assuming ClassID 1 exists)
        await pool.request()
            .input('roll', sql.NVarChar, 'STUDENT-001')
            .input('name', sql.NVarChar, 'Test Student')
            .input('classID', sql.Int, 1)
            .input('dob', sql.Date, '2010-01-01')
            .input('guardian', sql.NVarChar, 'Test Guardian')
            .input('userID', sql.Int, userID)
            .input('className', sql.NVarChar, '1')
            .input('section', sql.NVarChar, 'A')
            .query(`INSERT INTO Students (RollNo, FullName, ClassID, DOB, GuardianName, UserID, ClassName, Section) 
                    VALUES (@roll, @name, @classID, @dob, @guardian, @userID, @className, @section)`);
        
        console.log('Student record created.');
        
    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

createStudentUser();
