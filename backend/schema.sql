-- 1. Users Table
CREATE TABLE Users (
    UserID SERIAL PRIMARY KEY,
    Username VARCHAR(100) UNIQUE NOT NULL,
    Password TEXT NOT NULL,
    Role VARCHAR(20) NOT NULL CHECK (Role IN ('Admin', 'Teacher', 'Student'))
);

-- 2. Teachers Table
CREATE TABLE Teachers (
    TeacherID SERIAL PRIMARY KEY,
    FullName VARCHAR(100) NOT NULL,
    Subject VARCHAR(100),
    Email VARCHAR(100),
    PhoneNo VARCHAR(20),
    UserID INTEGER REFERENCES Users(UserID) ON DELETE SET NULL
);

-- 3. Classes Table
CREATE TABLE Classes (
    ClassID SERIAL PRIMARY KEY,
    ClassName VARCHAR(50) NOT NULL,
    MaxStudents INTEGER DEFAULT 30
);

-- 4. Subjects Table
CREATE TABLE Subjects (
    SubjectID SERIAL PRIMARY KEY,
    SubjectName VARCHAR(100) UNIQUE NOT NULL
);

-- 5. Class Subjects Table (Many-to-Many Class <-> Subject)
CREATE TABLE ClassSubjects (
    ClassSubjectID SERIAL PRIMARY KEY,
    ClassID INTEGER REFERENCES Classes(ClassID) ON DELETE CASCADE,
    SubjectID INTEGER REFERENCES Subjects(SubjectID) ON DELETE CASCADE
);

-- 6. Teacher Assignments Table
CREATE TABLE TeacherAssignments (
    AssignmentID SERIAL PRIMARY KEY,
    TeacherID INTEGER REFERENCES Teachers(TeacherID) ON DELETE CASCADE,
    ClassID INTEGER REFERENCES Classes(ClassID) ON DELETE NO ACTION,
    SubjectID INTEGER REFERENCES Subjects(SubjectID) ON DELETE NO ACTION
);

-- 7. Students Table
CREATE TABLE Students (
    StudentID SERIAL PRIMARY KEY,
    RollNo VARCHAR(20) UNIQUE NOT NULL,
    FullName VARCHAR(100) NOT NULL,
    ClassID INTEGER REFERENCES Classes(ClassID) ON DELETE SET NULL,
    DOB DATE,
    GuardianName VARCHAR(100),
    UserID INTEGER REFERENCES Users(UserID) ON DELETE CASCADE,
    ClassName VARCHAR(100),
    Section VARCHAR(50),
    Email VARCHAR(255)
);

-- 8. Separate Student Attendance Tables (Class 1 to 10)
CREATE TABLE StudentAttendanceClass1 ( AttendanceID SERIAL PRIMARY KEY, Date DATE NOT NULL, Status VARCHAR(20) CHECK (Status IN ('Present', 'Absent', 'Late')), StudentID INTEGER REFERENCES Students(StudentID) ON DELETE CASCADE, StudentName VARCHAR(100), ClassName VARCHAR(100), Section VARCHAR(50) );
CREATE TABLE StudentAttendanceClass2 ( AttendanceID SERIAL PRIMARY KEY, Date DATE NOT NULL, Status VARCHAR(20) CHECK (Status IN ('Present', 'Absent', 'Late')), StudentID INTEGER REFERENCES Students(StudentID) ON DELETE CASCADE, StudentName VARCHAR(100), ClassName VARCHAR(100), Section VARCHAR(50) );
CREATE TABLE StudentAttendanceClass3 ( AttendanceID SERIAL PRIMARY KEY, Date DATE NOT NULL, Status VARCHAR(20) CHECK (Status IN ('Present', 'Absent', 'Late')), StudentID INTEGER REFERENCES Students(StudentID) ON DELETE CASCADE, StudentName VARCHAR(100), ClassName VARCHAR(100), Section VARCHAR(50) );
CREATE TABLE StudentAttendanceClass4 ( AttendanceID SERIAL PRIMARY KEY, Date DATE NOT NULL, Status VARCHAR(20) CHECK (Status IN ('Present', 'Absent', 'Late')), StudentID INTEGER REFERENCES Students(StudentID) ON DELETE CASCADE, StudentName VARCHAR(100), ClassName VARCHAR(100), Section VARCHAR(50) );
CREATE TABLE StudentAttendanceClass5 ( AttendanceID SERIAL PRIMARY KEY, Date DATE NOT NULL, Status VARCHAR(20) CHECK (Status IN ('Present', 'Absent', 'Late')), StudentID INTEGER REFERENCES Students(StudentID) ON DELETE CASCADE, StudentName VARCHAR(100), ClassName VARCHAR(100), Section VARCHAR(50) );
CREATE TABLE StudentAttendanceClass6 ( AttendanceID SERIAL PRIMARY KEY, Date DATE NOT NULL, Status VARCHAR(20) CHECK (Status IN ('Present', 'Absent', 'Late')), StudentID INTEGER REFERENCES Students(StudentID) ON DELETE CASCADE, StudentName VARCHAR(100), ClassName VARCHAR(100), Section VARCHAR(50) );
CREATE TABLE StudentAttendanceClass7 ( AttendanceID SERIAL PRIMARY KEY, Date DATE NOT NULL, Status VARCHAR(20) CHECK (Status IN ('Present', 'Absent', 'Late')), StudentID INTEGER REFERENCES Students(StudentID) ON DELETE CASCADE, StudentName VARCHAR(100), ClassName VARCHAR(100), Section VARCHAR(50) );
CREATE TABLE StudentAttendanceClass8 ( AttendanceID SERIAL PRIMARY KEY, Date DATE NOT NULL, Status VARCHAR(20) CHECK (Status IN ('Present', 'Absent', 'Late')), StudentID INTEGER REFERENCES Students(StudentID) ON DELETE CASCADE, StudentName VARCHAR(100), ClassName VARCHAR(100), Section VARCHAR(50) );
CREATE TABLE StudentAttendanceClass9 ( AttendanceID SERIAL PRIMARY KEY, Date DATE NOT NULL, Status VARCHAR(20) CHECK (Status IN ('Present', 'Absent', 'Late')), StudentID INTEGER REFERENCES Students(StudentID) ON DELETE CASCADE, StudentName VARCHAR(100), ClassName VARCHAR(100), Section VARCHAR(50) );
CREATE TABLE StudentAttendanceClass10 ( AttendanceID SERIAL PRIMARY KEY, Date DATE NOT NULL, Status VARCHAR(20) CHECK (Status IN ('Present', 'Absent', 'Late')), StudentID INTEGER REFERENCES Students(StudentID) ON DELETE CASCADE, StudentName VARCHAR(100), ClassName VARCHAR(100), Section VARCHAR(50) );

-- 9. Teacher Attendance Table
CREATE TABLE TeacherAttendance (
    AttendanceID SERIAL PRIMARY KEY,
    Date DATE NOT NULL,
    Status VARCHAR(20) CHECK (Status IN ('Present', 'Absent', 'Late')),
    TeacherID INTEGER REFERENCES Teachers(TeacherID) ON DELETE CASCADE
);

-- 10. Results Table
CREATE TABLE Results (
    ResultID SERIAL PRIMARY KEY,
    StudentID INTEGER REFERENCES Students(StudentID) ON DELETE CASCADE,
    SubjectName VARCHAR(100) NOT NULL,
    Term VARCHAR(50) NOT NULL,
    MarksObtained DECIMAL(5,2),
    TotalMarks DECIMAL(5,2),
    IsPublished BOOLEAN DEFAULT FALSE
);

-- Seed Admin Account (admin@gmail.com / admin123)
-- Password hashed for bcrypt
INSERT INTO Users (Username, Password, Role) 
VALUES ('admin@gmail.com', '$2a$10$wI5uYvFvR4E8.v/X9U2E.e6pX5I6P5G6p6G6P6G6P6G6P6G6P6G6', 'Admin');
