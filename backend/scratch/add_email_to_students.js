const { poolPromise } = require('../Config/db');

async function addEmailColumn() {
    try {
        const pool = await poolPromise;
        console.log('Adding Email column to Students table...');
        await pool.request().query("ALTER TABLE Students ADD Email NVARCHAR(100)");
        console.log('Column added successfully.');
    } catch (err) {
        if (err.message.includes('already exists')) {
            console.log('Email column already exists.');
        } else {
            console.error('Error:', err);
        }
    } finally {
        process.exit();
    }
}

addEmailColumn();
