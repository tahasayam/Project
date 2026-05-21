const sql = require('mssql');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PWD,
    server: process.env.DB_SERVER,
    database: 'master', // Start with master to create the new DB
    options: {
        encrypt: true,
        trustServerCertificate: true
    },
    port: parseInt(process.env.DB_PORT)
};

const NEW_DB_NAME = 'EduManage_DB';

async function rebuild() {
    try {
        let pool = await sql.connect(config);
        
        console.log(`Checking if ${NEW_DB_NAME} exists...`);
        await pool.request().query(`
            IF EXISTS (SELECT name FROM sys.databases WHERE name = '${NEW_DB_NAME}')
            BEGIN
                ALTER DATABASE ${NEW_DB_NAME} SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
                DROP DATABASE ${NEW_DB_NAME};
            END
        `);
        
        console.log(`Creating fresh database: ${NEW_DB_NAME}...`);
        await pool.request().query(`CREATE DATABASE ${NEW_DB_NAME}`);
        await pool.close();

        // Connect to the new database
        config.database = NEW_DB_NAME;
        pool = await sql.connect(config);
        console.log(`Connected to ${NEW_DB_NAME}. Creating tables...`);

        // 1. Users Table
        await pool.request().query(`
            CREATE TABLE Users (
                UserID INT PRIMARY KEY IDENTITY(1,1),
                Username NVARCHAR(100) UNIQUE NOT NULL,
                Password NVARCHAR(MAX) NOT NULL,
                Role NVARCHAR(20) NOT NULL CHECK (Role IN ('Admin', 'Teacher', 'Student'))
            )
        `);

        // 2. Teachers Table
        await pool.request().query(`
            CREATE TABLE Teachers (
                TeacherID INT PRIMARY KEY IDENTITY(1,1),
                FullName NVARCHAR(100) NOT NULL,
                Subject NVARCHAR(100),
                Email NVARCHAR(100),
                PhoneNo NVARCHAR(20),
                UserID INT FOREIGN KEY REFERENCES Users(UserID) ON DELETE SET NULL
            )
        `);

        // 3. Classes Table (Removed TeacherID)
        await pool.request().query(`
            CREATE TABLE Classes (
                ClassID INT PRIMARY KEY IDENTITY(1,1),
                ClassName NVARCHAR(50) NOT NULL,
                MaxStudents INT DEFAULT 30
            )
        `);

        // 4. Subjects Table
        await pool.request().query(`
            CREATE TABLE Subjects (
                SubjectID INT PRIMARY KEY IDENTITY(1,1),
                SubjectName NVARCHAR(100) UNIQUE NOT NULL
            )
        `);

        // 5. Class Subjects Table (Many-to-Many Class <-> Subject)
        await pool.request().query(`
            CREATE TABLE ClassSubjects (
                ClassSubjectID INT PRIMARY KEY IDENTITY(1,1),
                ClassID INT FOREIGN KEY REFERENCES Classes(ClassID) ON DELETE CASCADE,
                SubjectID INT FOREIGN KEY REFERENCES Subjects(SubjectID) ON DELETE CASCADE
            )
        `);

        // 6. Teacher Assignments Table (Linking Teachers to Class Subjects)
        await pool.request().query(`
            CREATE TABLE TeacherAssignments (
                AssignmentID INT PRIMARY KEY IDENTITY(1,1),
                TeacherID INT FOREIGN KEY REFERENCES Teachers(TeacherID) ON DELETE CASCADE,
                ClassID INT FOREIGN KEY REFERENCES Classes(ClassID) ON DELETE NO ACTION,
                SubjectID INT FOREIGN KEY REFERENCES Subjects(SubjectID) ON DELETE NO ACTION
            )
        `);

        // 7. Students Table
        await pool.request().query(`
            CREATE TABLE Students (
                StudentID INT PRIMARY KEY IDENTITY(1,1),
                RollNo NVARCHAR(20) UNIQUE NOT NULL,
                FullName NVARCHAR(100) NOT NULL,
                ClassID INT FOREIGN KEY REFERENCES Classes(ClassID) ON DELETE SET NULL,
                DOB DATE,
                GuardianName NVARCHAR(100),
                UserID INT FOREIGN KEY REFERENCES Users(UserID) ON DELETE CASCADE,
                ClassName NVARCHAR(100),
                Section NVARCHAR(50)
            )
        `);

        // 8. Separate Student Attendance Tables (Class 1 to 10)
        for (let i = 1; i <= 10; i++) {
            await pool.request().query(`
                CREATE TABLE StudentAttendanceClass${i} (
                    AttendanceID INT PRIMARY KEY IDENTITY(1,1),
                    Date DATE NOT NULL,
                    Status NVARCHAR(20) CHECK (Status IN ('Present', 'Absent', 'Late')),
                    StudentID INT FOREIGN KEY REFERENCES Students(StudentID) ON DELETE CASCADE
                )
            `);
        }

        // 9. Teacher Attendance Table
        await pool.request().query(`
            CREATE TABLE TeacherAttendance (
                AttendanceID INT PRIMARY KEY IDENTITY(1,1),
                Date DATE NOT NULL,
                Status NVARCHAR(20) CHECK (Status IN ('Present', 'Absent', 'Late')),
                TeacherID INT FOREIGN KEY REFERENCES Teachers(TeacherID) ON DELETE CASCADE
            )
        `);

        // 10. Results Table
        await pool.request().query(`
            CREATE TABLE Results (
                ResultID INT PRIMARY KEY IDENTITY(1,1),
                StudentID INT FOREIGN KEY REFERENCES Students(StudentID) ON DELETE CASCADE,
                SubjectName NVARCHAR(100) NOT NULL,
                Term NVARCHAR(50) NOT NULL, -- e.g., 'First', 'Second', 'Final'
                MarksObtained DECIMAL(5,2),
                TotalMarks DECIMAL(5,2),
                IsPublished BIT DEFAULT 0
            )
        `);

        console.log('Tables created successfully.');

        // Seed Admin Account
        console.log('Seeding Admin account...');
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await pool.request()
            .input('user', sql.NVarChar, 'admin@gmail.com')
            .input('pass', sql.NVarChar, hashedPassword)
            .input('role', sql.NVarChar, 'Admin')
            .query('INSERT INTO Users (Username, Password, Role) VALUES (@user, @pass, @role)');

        console.log('Admin account created: admin@gmail.com / admin123');
        
        await pool.close();
        console.log('Database rebuild complete!');
        process.exit(0);
    } catch (err) {
        console.error('Error during rebuild:', err);
        process.exit(1);
    }
}

rebuild();
