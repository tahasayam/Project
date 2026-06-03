<?php
// PHP front controller and router for local development

$requestUri = $_SERVER['REQUEST_URI'];
$uriPath = parse_url($requestUri, PHP_URL_PATH);

// 1. Route API requests to api.php
if (strpos($uriPath, '/api/') === 0 || $uriPath === '/health') {
    require __DIR__ . '/api.php';
    exit;
}

// 2. Serve static files from the frontend directory
$frontendDir = realpath(__DIR__ . '/../frontend');
$targetFile = $frontendDir . $uriPath;

// Default root path serves login page
if ($uriPath === '/' || $uriPath === '') {
    $targetFile = $frontendDir . '/Pages/login.html';
}

// Check that the file exists and is indeed within the frontend directory (prevent directory traversal)
$realTargetFile = realpath($targetFile);

if ($realTargetFile && strpos($realTargetFile, $frontendDir) === 0 && is_file($realTargetFile)) {
    // Determine the Content-Type based on extension
    $ext = pathinfo($realTargetFile, PATHINFO_EXTENSION);
    $mimes = [
        'html' => 'text/html',
        'css'  => 'text/css',
        'js'   => 'application/javascript',
        'json' => 'application/json',
        'png'  => 'image/png',
        'jpg'  => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'gif'  => 'image/gif',
        'svg'  => 'image/svg+xml',
        'ico'  => 'image/x-icon',
        'woff' => 'font/woff',
        'woff2'=> 'font/woff2',
        'ttf'  => 'font/ttf',
        'otf'  => 'font/otf',
    ];
    
    $contentType = isset($mimes[$ext]) ? $mimes[$ext] : 'application/octet-stream';
    header("Content-Type: {$contentType}");
    readfile($realTargetFile);
    exit;
}

// 3. Fallback for 404
http_response_code(404);
echo "404 Not Found";
