<?php
require_once __DIR__ . '/../Middleware/verifyToken.php';

class AuthController {
    public static function login($db) {
        $input = json_decode(file_get_contents('php://input'), true);
        $username = isset($input['username']) ? trim($input['username']) : null;
        $password = isset($input['password']) ? $input['password'] : null;

        if (!$username || !$password) {
            http_response_code(400);
            echo json_encode(['message' => 'Username and password are required.']);
            return;
        }

        try {
            $stmt = $db->prepare('SELECT * FROM school_auth WHERE username = :username');
            $stmt->execute([':username' => $username]);
            $user = $stmt->fetch();

            if (!$user) {
                http_response_code(404);
                echo json_encode(['message' => 'User not found']);
                return;
            }

            // Verify password using native PHP password_verify (handles bcrypt $2a$ format)
            if (!password_verify($password, $user['password'])) {
                http_response_code(401);
                echo json_encode(['message' => 'Invalid credentials']);
                return;
            }

            $secret = getenv('JWT_SECRET') ?: 'supersecretkey';
            $token = JWT::sign([
                'id' => $user['id'],
                'role' => $user['role'],
                'username' => $user['username']
            ], $secret);

            echo json_encode([
                'token' => $token,
                'role' => $user['role'],
                'username' => $user['username']
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['message' => $e->getMessage()]);
        }
    }

    public static function register($db) {
        $input = json_decode(file_get_contents('php://input'), true);
        $username = isset($input['username']) ? trim($input['username']) : null;
        $password = isset($input['password']) ? $input['password'] : null;
        $role = isset($input['role']) ? trim($input['role']) : 'Student';

        if (!$username || !$password) {
            http_response_code(400);
            echo json_encode(['message' => 'Username and password are required.']);
            return;
        }

        try {
            // Hash password with cost 10, matching bcryptjs in Node
            $hashedPassword = password_hash($password, PASSWORD_BCRYPT, ['cost' => 10]);

            $stmt = $db->prepare('INSERT INTO school_auth (username, password, role) VALUES (:username, :password, :role)');
            $stmt->execute([
                ':username' => $username,
                ':password' => $hashedPassword,
                ':role' => $role
            ]);

            http_response_code(201);
            echo json_encode(['message' => 'User registered successfully']);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['message' => $e->getMessage()]);
        }
    }
}
