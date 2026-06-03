<?php
require_once __DIR__ . '/env.php';

// Load .env from backend directory
loadEnv(__DIR__ . '/../.env');

$dbHost = getenv('DB_SERVER');
$dbPort = getenv('DB_PORT') ?: '5432';
$dbName = getenv('DB_NAME');
$dbUser = getenv('DB_USER');
$dbPwd = getenv('DB_PWD');

if (!$dbHost || !$dbName || !$dbUser || !$dbPwd) {
    // If not set, fallback to default or fail gracefully
    error_log("Database configuration variables are missing.");
}

try {
    // Supabase/Neon require sslmode=require or rejectUnauthorized=false.
    // For PHP PDO PostgreSQL, we add sslmode=require to the connection string.
    $dsn = "pgsql:host={$dbHost};port={$dbPort};dbname={$dbName};sslmode=require";
    
    $db = new PDO($dsn, $dbUser, $dbPwd, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (PDOException $e) {
    error_log("❌ Database Connection Failed: " . $e->getMessage());
    $db = null;
}
