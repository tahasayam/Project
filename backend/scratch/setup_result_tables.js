const { poolPromise, sql } = require('../Config/db');

async function setupResultTables() {
    try {
        const pool = await poolPromise;
        
        console.log('Creating ResultClass tables...');
        
        for (let i = 1; i <= 10; i++) {
            const tableName = `ResultClass${i}`;
            
            // Check if table exists
            const check = await pool.request().query(`
                SELECT TABLE_NAME 
                FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_NAME = '${tableName}'
            `);
            
            if (check.recordset.length === 0) {
                console.log(`Creating ${tableName}...`);
                await pool.request().query(`
                    CREATE TABLE ${tableName} (
                        ResultID INT IDENTITY(1,1) PRIMARY KEY,
                        StudentID INT NOT NULL,
                        SubjectName NVARCHAR(255) NOT NULL,
                        Term NVARCHAR(50) NOT NULL,
                        MarksObtained DECIMAL(5,2) NOT NULL,
                        TotalMarks DECIMAL(5,2) NOT NULL,
                        IsPublished BIT DEFAULT 0,
                        StudentName NVARCHAR(255) NULL,
                        ClassName NVARCHAR(50) NULL,
                        Section NVARCHAR(50) NULL,
                        CONSTRAINT FK_${tableName}_Student FOREIGN KEY (StudentID) REFERENCES Students(StudentID) ON DELETE CASCADE
                    )
                `);
            } else {
                console.log(`${tableName} already exists.`);
            }
        }

        console.log('Migrating existing results...');
        // Copy existing data from Results into the correct ResultClass table
        // We'll figure out the table by checking the ClassID from the Students table
        const results = await pool.request().query(`
            SELECT r.*, s.ClassID, c.ClassName as StudentClassName
            FROM Results r
            JOIN Students s ON r.StudentID = s.StudentID
            JOIN Classes c ON s.ClassID = c.ClassID
        `);
        
        for (const row of results.recordset) {
            const gradeMatch = row.StudentClassName ? row.StudentClassName.match(/\d+/) : null;
            const gradeLevel = gradeMatch ? parseInt(gradeMatch[0]) : 1;
            const level = Math.min(Math.max(gradeLevel, 1), 10);
            const tableName = `ResultClass${level}`;
            
            // Upsert or insert into new table
            await pool.request()
                .input('sid', sql.Int, row.StudentID)
                .input('sub', sql.NVarChar, row.SubjectName)
                .input('term', sql.NVarChar, row.Term)
                .input('mo', sql.Decimal(5,2), row.MarksObtained)
                .input('tm', sql.Decimal(5,2), row.TotalMarks)
                .input('pub', sql.Bit, row.IsPublished)
                .input('name', sql.NVarChar, row.StudentName)
                .input('cname', sql.NVarChar, row.ClassName)
                .input('sec', sql.NVarChar, row.Section)
                .query(`
                    IF NOT EXISTS (SELECT 1 FROM ${tableName} WHERE StudentID = @sid AND SubjectName = @sub AND Term = @term)
                    BEGIN
                        INSERT INTO ${tableName} (StudentID, SubjectName, Term, MarksObtained, TotalMarks, IsPublished, StudentName, ClassName, Section)
                        VALUES (@sid, @sub, @term, @mo, @tm, @pub, @name, @cname, @sec)
                    END
                `);
        }
        
        console.log('Successfully set up ResultClass tables and migrated data.');
    } catch (err) {
        console.error('Error setting up tables:', err);
    } finally {
        process.exit();
    }
}

setupResultTables();
