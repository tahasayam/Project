<?php
// Custom JWT implementation for HS256 (no external dependencies)

class JWT {
    public static function sign($payload, $secret, $expiry = 86400) {
        $header = json_encode(['alg' => 'HS256', 'typ' => 'JWT']);
        $payload['exp'] = time() + $expiry;
        $payloadEncoded = json_encode($payload);
        
        $base64UrlHeader = self::base64UrlEncode($header);
        $base64UrlPayload = self::base64UrlEncode($payloadEncoded);
        
        $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, $secret, true);
        $base64UrlSignature = self::base64UrlEncode($signature);
        
        return $base64UrlHeader . "." . $base64UrlPayload . "." . $base64UrlSignature;
    }
    
    public static function verify($token, $secret) {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return false;
        }
        list($header, $payload, $signature) = $parts;
        
        $signatureCheck = hash_hmac('sha256', $header . "." . $payload, $secret, true);
        $base64UrlSignatureCheck = self::base64UrlEncode($signatureCheck);
        
        if (!hash_equals(self::base64UrlDecode($signature), self::base64UrlDecode($base64UrlSignatureCheck))) {
            return false;
        }
        
        $payloadDecoded = json_decode(self::base64UrlDecode($payload), true);
        if (!$payloadDecoded) {
            return false;
        }
        
        if (isset($payloadDecoded['exp']) && $payloadDecoded['exp'] < time()) {
            return false; // Token expired
        }
        
        return $payloadDecoded;
    }
    
    private static function base64UrlEncode($text) {
        return str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($text));
    }
    
    private static function base64UrlDecode($text) {
        $base64 = str_replace(['-', '_'], ['+', '/'], $text);
        $len = strlen($base64) % 4;
        if ($len) {
            $base64 .= str_repeat('=', 4 - $len);
        }
        return base64_decode($base64);
    }
}

/**
 * Verifies JWT token and checks if the role is allowed.
 * Returns decoded payload on success, or exits with JSON response on failure.
 */
function verifyToken($roles = []) {
    $headers = getallheaders();
    $authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';
    
    if (empty($authHeader) && isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
    }

    if (empty($authHeader)) {
        http_response_code(401);
        echo json_encode(['message' => 'Access Denied: No Token Provided']);
        exit;
    }

    $token = str_replace('Bearer ', '', $authHeader);
    $secret = getenv('JWT_SECRET') ?: 'supersecretkey';

    $verified = JWT::verify($token, $secret);
    if (!$verified) {
        http_response_code(400);
        echo json_encode(['message' => 'Invalid Token']);
        exit;
    }

    // Convert role to standard casing for comparison
    $userRole = isset($verified['role']) ? $verified['role'] : '';

    if (!empty($roles) && !in_array($userRole, $roles)) {
        http_response_code(403);
        echo json_encode(['message' => 'Forbidden: You do not have permission to access this resource']);
        exit;
    }

    return $verified;
}

// polyfill getallheaders if not exists (e.g. running under php-cgi)
if (!function_exists('getallheaders')) {
    function getallheaders() {
        $headers = [];
        foreach ($_SERVER as $name => $value) {
            if (substr($name, 0, 5) == 'HTTP_') {
                $headers[str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($name, 5)))))] = $value;
            }
        }
        return $headers;
    }
}
