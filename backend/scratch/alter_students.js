const { poolPromise, sql } = require('../Config/db');

async function alterTable() {
    try {
        const pool = await poolPromise;
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Students]') AND name = 'ClassName')
            BEGIN
                ALTER TABLE Students ADD ClassName NVARCHAR(100);
            END
            
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Students]') AND name = 'Section')
            BEGIN
                ALTER TABLE Students ADD Section NVARCHAR(50);
            END
        `);
        console.log("Students table altered successfully. Added ClassName and Section.");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
alterTable();
