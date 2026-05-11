-- Users Table
CREATE TABLE Users (
    UserID SERIAL PRIMARY KEY,
    Username VARCHAR(255) UNIQUE NOT NULL,
    Password VARCHAR(255) NOT NULL,
    Role VARCHAR(50) NOT NULL
);

-- Teachers Table
CREATE TABLE Teachers (
    TeacherID SERIAL PRIMARY KEY,
    FullName VARCHAR(255) NOT NULL,
    Email VARCHAR(255),
    PhoneNo VARCHAR(50),
    UserID INTEGER REFERENCES Users(UserID) ON DELETE CASCADE,
    Subject VARCHAR(255)
);

-- Classes Table
CREATE TABLE Classes (
    ClassID SERIAL PRIMARY KEY,
    ClassName VARCHAR(100) NOT NULL,
    MaxStudents INTEGER,
    TeacherID INTEGER REFERENCES Teachers(TeacherID) ON DELETE SET NULL
);

-- Students Table
CREATE TABLE Students (
    StudentID SERIAL PRIMARY KEY,
    RollNo VARCHAR(50) UNIQUE NOT NULL,
    FullName VARCHAR(255) NOT NULL,
    ClassID INTEGER REFERENCES Classes(ClassID) ON DELETE SET NULL,
    DOB DATE,
    GuardianName VARCHAR(255),
    UserID INTEGER REFERENCES Users(UserID) ON DELETE CASCADE,
    ClassName VARCHAR(100),
    Section VARCHAR(50),
    Email VARCHAR(255)
);

-- Attendance Table
CREATE TABLE Attendance (
    AttendanceID SERIAL PRIMARY KEY,
    Date DATE NOT NULL,
    TargetID INTEGER NOT NULL, -- StudentID or TeacherID
    TargetType VARCHAR(50) NOT NULL, -- 'Student' or 'Teacher'
    Status VARCHAR(50) NOT NULL -- 'Present', 'Absent', 'Late'
);

-- Results Table
CREATE TABLE Results (
    ResultID SERIAL PRIMARY KEY,
    StudentID INTEGER REFERENCES Students(StudentID) ON DELETE CASCADE,
    SubjectName VARCHAR(255) NOT NULL,
    MarksObtained INTEGER,
    TotalMarks INTEGER,
    Term VARCHAR(100),
    IsPublished BOOLEAN DEFAULT FALSE
);

-- Teacher-Class Assignments (Many-to-Many)
-- Note: Some parts of the code suggest teachers are assigned to classes directly in Classes table,
-- but others suggest multiple assignments. 
CREATE TABLE TeacherAssignments (
    AssignmentID SERIAL PRIMARY KEY,
    TeacherID INTEGER REFERENCES Teachers(TeacherID) ON DELETE CASCADE,
    ClassID INTEGER REFERENCES Classes(ClassID) ON DELETE CASCADE,
    Subject VARCHAR(100)
);
