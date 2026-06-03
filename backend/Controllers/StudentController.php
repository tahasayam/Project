<?php

class StudentController {
    public static function getAllStudents($db) {
        try {
            $stmt = $db->query('
                SELECT s.id as "StudentID", s.roll_no as "RollNo", s.fullname as "FullName", s.dob as "DOB", s.guardian_name as "GuardianName", s.email as "Email",
                       c.classname as "ClassName", c.id as "ClassID", u.username as "Username"
                FROM school_students s
                LEFT JOIN school_classes c ON s.class_id = c.id
                LEFT JOIN school_auth u ON u.id = s.auth_id
            ');
            echo json_encode($stmt->fetchAll());
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['message' => $e->getMessage()]);
        }
    }

    public static function getStudentsByClass($db, $params) {
        $classID = isset($params['classID']) ? (int)$params['classID'] : null;
        if (!$classID) {
            http_response_code(400);
            echo json_encode(['message' => 'Class ID is required.']);
            return;
        }

        try {
            $stmt = $db->prepare('SELECT id as "StudentID", roll_no as "RollNo", fullname as "FullName" FROM school_students WHERE class_id = :class_id ORDER BY roll_no');
            $stmt->execute([':class_id' => $classID]);
            echo json_encode($stmt->fetchAll());
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['message' => $e->getMessage()]);
        }
    }

    public static function addStudent($db) {
        $input = json_decode(file_get_contents('php://input'), true);
        $rollNo = isset($input['rollNo']) ? trim($input['rollNo']) : null;
        $fullName = isset($input['fullName']) ? trim($input['fullName']) : null;
        $classID = isset($input['classID']) ? (int)$input['classID'] : null;
        $dob = isset($input['dob']) ? trim($input['dob']) : null;
        $guardianName = isset($input['guardianName']) ? trim($input['guardianName']) : null;
        $className = isset($input['className']) ? trim($input['className']) : '';
        $section = isset($input['section']) ? trim($input['section']) : '';
        $email = isset($input['email']) ? trim($input['email']) : null;
        $password = isset($input['password']) ? $input['password'] : null;

        if (!$rollNo || !$fullName || !$classID || !$email || !$password) {
            http_response_code(400);
            echo json_encode(['message' => 'Full name, roll number, class, email, and password are required.']);
            return;
        }

        try {
            // Check duplicate roll number
            $stmt = $db->prepare('SELECT id FROM school_students WHERE roll_no = :roll_no');
            $stmt->execute([':roll_no' => $rollNo]);
            if ($stmt->fetch()) {
                http_response_code(400);
                echo json_encode(['message' => "Roll No '{$rollNo}' already exists."]);
                return;
            }

            // Check duplicate email
            $stmt = $db->prepare('SELECT id FROM school_auth WHERE username = :username');
            $stmt->execute([':username' => $email]);
            if ($stmt->fetch()) {
                http_response_code(400);
                echo json_encode(['message' => "Email '{$email}' is already in use."]);
                return;
            }

            $db->beginTransaction();

            // Hash password
            $hashedPwd = password_hash($password, PASSWORD_BCRYPT, ['cost' => 10]);

            // Insert into school_auth
            $stmtAuth = $db->prepare('INSERT INTO school_auth (username, password, role) VALUES (:username, :password, :role) RETURNING id');
            $stmtAuth->execute([
                ':username' => $email,
                ':password' => $hashedPwd,
                ':role' => 'Student'
            ]);
            $newUserID = $stmtAuth->fetchColumn();

            // Insert into school_students
            $stmtStudent = $db->prepare('
                INSERT INTO school_students (roll_no, fullname, class_id, dob, guardian_name, auth_id, class_name, section, email) 
                VALUES (:roll_no, :fullname, :class_id, :dob, :guardian_name, :auth_id, :class_name, :section, :email)
            ');
            $stmtStudent->execute([
                ':roll_no' => $rollNo,
                ':fullname' => $fullName,
                ':class_id' => $classID,
                ':dob' => $dob ?: null,
                ':guardian_name' => $guardianName ?: null,
                ':auth_id' => $newUserID,
                ':class_name' => $className,
                ':section' => $section,
                ':email' => $email
            ]);

            $db->commit();
            http_response_code(201);
            echo json_encode(['message' => "Student added successfully. Login: {$email}"]);
        } catch (PDOException $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            http_response_code(500);
            echo json_encode(['message' => $e->getMessage()]);
        }
    }

    public static function deleteStudent($db, $params) {
        $rollNo = isset($params['rollNo']) ? trim($params['rollNo']) : null;
        if (!$rollNo) {
            http_response_code(400);
            echo json_encode(['message' => 'Roll number is required.']);
            return;
        }

        try {
            $stmt = $db->prepare('SELECT id as "StudentID", auth_id as "UserID" FROM school_students WHERE roll_no = :roll_no');
            $stmt->execute([':roll_no' => $rollNo]);
            $student = $stmt->fetch();

            if (!$student) {
                http_response_code(404);
                echo json_encode(['message' => 'Student not found.']);
                return;
            }

            $userID = $student['UserID'];
            $studentID = $student['StudentID'];

            $db->beginTransaction();

            if ($userID) {
                $stmtDel = $db->prepare('DELETE FROM school_auth WHERE id = :id');
                $stmtDel->execute([':id' => $userID]);
            } else {
                $stmtDel = $db->prepare('DELETE FROM school_students WHERE id = :id');
                $stmtDel->execute([':id' => $studentID]);
            }

            $db->commit();
            echo json_encode(['message' => 'Student deleted successfully.']);
        } catch (PDOException $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            http_response_code(500);
            echo json_encode(['message' => $e->getMessage()]);
        }
    }

    public static function getStudentProfile($db, $user) {
        if (!$user || !isset($user['id'])) {
            http_response_code(401);
            echo json_encode(['message' => 'Unauthorized']);
            return;
        }

        try {
            $stmt = $db->prepare('
                SELECT s.id as "StudentID", s.roll_no as "RollNo", s.fullname as "FullName", s.dob as "DOB", s.guardian_name as "GuardianName",
                       c.classname as "ClassName", c.id as "ClassID"
                FROM school_students s
                LEFT JOIN school_classes c ON s.class_id = c.id
                WHERE s.auth_id = :auth_id
            ');
            $stmt->execute([':auth_id' => $user['id']]);
            $profile = $stmt->fetch();

            if (!$profile) {
                http_response_code(404);
                echo json_encode(['message' => 'Student profile not found']);
                return;
            }

            echo json_encode($profile);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['message' => $e->getMessage()]);
        }
    }
}
