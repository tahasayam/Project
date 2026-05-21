const { poolPromise, sql } = require('../Config/db');
const bcrypt = require('bcryptjs');

async function setupTeacher() {
    try {
        const pool = await poolPromise;
        const hashedPassword = await bcrypt.hash('teacher123', 10);

        console.log('Creating teacher user...');
        const userResult = await pool.request()
            .input('username', sql.VarChar, 'teacher@gmail.com')
            .input('password', sql.VarChar, hashedPassword)
            .input('role', sql.VarChar, 'Teacher')
            .query('INSERT INTO Users (Username, Password, Role) OUTPUT INSERTED.UserID VALUES (@username, @password, @role)');
        
        const userID = userResult.recordset[0].UserID;
        console.log(`User created with ID: ${userID}`);

        console.log('Creating teacher profile...');
        await pool.request()
            .input('fullName', sql.VarChar, 'Test Teacher')
            .input('subject', sql.VarChar, 'Physics')
            .input('email', sql.VarChar, 'teacher@gmail.com')
            .input('phone', sql.VarChar, '1234567890')
            .input('userID', sql.Int, userID)
            .query('INSERT INTO Teachers (FullName, Subject, Email, PhoneNo, UserID) VALUES (@fullName, @subject, @email, @phone, @userID)');
        
        console.log('Teacher setup complete! Login: teacher@gmail.com / teacher123');
        process.exit(0);
    } catch (err) {
        console.error('Error during setup:', err.message);
        process.exit(1);
    }
}

setupTeacher();
