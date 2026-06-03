<?php

class TeacherController {
    public static function getAllTeachers($db) {
        try {
            $stmt = $db->query('
                SELECT t.id as "TeacherID", t.fullname as "FullName", t.subject_specialty as "Subject", t.assigned_classes as "AssignedClasses", t.email as "Email", t.phone as "PhoneNo",
                       u.username as "Username"
                FROM staff_teachers t
                LEFT JOIN school_auth u ON u.id = t.auth_id
            ');
            echo json_encode($stmt->fetchAll());
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['message' => $e->getMessage()]);
        }
    }

    public static function addTeacher($db) {
        $input = json_decode(file_get_contents('php://input'), true);
        $fullName = isset($input['fullName']) ? trim($input['fullName']) : null;
        $email = isset($input['email']) ? trim($input['email']) : null;
        $phoneNo = isset($input['phoneNo']) ? trim($input['phoneNo']) : null;
        $password = isset($input['password']) ? $input['password'] : null;
        $assignments = isset($input['assignments']) ? $input['assignments'] : null;
        $subject = isset($input['subject']) ? trim($input['subject']) : null;

        if (!$fullName || !$email || !$phoneNo || !$password) {
            http_response_code(400);
            echo json_encode(['message' => 'Full Name, Email, Phone Number, and Password are required.']);
            return;
        }

        try {
            // Check duplicate email
            $stmt = $db->prepare('SELECT id FROM school_auth WHERE username = :username');
            $stmt->execute([':username' => $email]);
            if ($stmt->fetch()) {
                http_response_code(400);
                echo json_encode(['message' => 'A user with this email already exists.']);
                return;
            }

            $db->beginTransaction();

            $hashedPwd = password_hash($password, PASSWORD_BCRYPT, ['cost' => 10]);

            // Insert into school_auth
            $stmtAuth = $db->prepare('INSERT INTO school_auth (username, password, role) VALUES (:username, :password, :role) RETURNING id');
            $stmtAuth->execute([
                ':username' => $email,
                ':password' => $hashedPwd,
                ':role' => 'Teacher'
            ]);
            $newUserID = $stmtAuth->fetchColumn();

            // Insert into staff_teachers
            $stmtTeacher = $db->prepare('INSERT INTO staff_teachers (fullname, subject_specialty, email, phone, auth_id) VALUES (:fullname, :subject, :email, :phone, :auth_id) RETURNING id');
            $stmtTeacher->execute([
                ':fullname' => $fullName,
                ':subject' => $subject,
                ':email' => $email,
                ':phone' => $phoneNo,
                ':auth_id' => $newUserID
            ]);
            $teacherID = $stmtTeacher->fetchColumn();

            // Insert assignments
            if ($assignments && is_array($assignments)) {
                $stmtAss = $db->prepare('INSERT INTO teacher_assignments_map (teacher_id, class_id, subject_id) VALUES (:teacher_id, :class_id, :subject_id)');
                foreach ($assignments as $ass) {
                    $classID = isset($ass['classID']) ? (int)$ass['classID'] : null;
                    $subjectID = isset($ass['subjectID']) ? (int)$ass['subjectID'] : null;
                    if ($classID && $subjectID) {
                        $stmtAss->execute([
                            ':teacher_id' => $teacherID,
                            ':class_id' => $classID,
                            ':subject_id' => $subjectID
                        ]);
                    }
                }

                // Update summary columns
                self::updateTeacherSummaries($db, $teacherID);
            }

            $db->commit();
            http_response_code(201);
            echo json_encode(['message' => 'Teacher added successfully.']);
        } catch (PDOException $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            http_response_code(500);
            echo json_encode(['message' => $e->getMessage()]);
        }
    }

    public static function deleteTeacher($db, $params) {
        $phoneNo = isset($params['phoneNo']) ? trim($params['phoneNo']) : null;
        if (!$phoneNo) {
            http_response_code(400);
            echo json_encode(['message' => 'Phone number is required.']);
            return;
        }

        try {
            $stmt = $db->prepare('SELECT id as "TeacherID", auth_id as "UserID" FROM staff_teachers WHERE phone = :phone');
            $stmt->execute([':phone' => $phoneNo]);
            $teacher = $stmt->fetch();

            if (!$teacher) {
                http_response_code(404);
                echo json_encode(['message' => 'Teacher not found.']);
                return;
            }

            $userID = $teacher['UserID'];
            $teacherID = $teacher['TeacherID'];

            $db->beginTransaction();

            // Delete assignments first
            $stmtAss = $db->prepare('DELETE FROM teacher_assignments_map WHERE teacher_id = :teacher_id');
            $stmtAss->execute([':teacher_id' => $teacherID]);

            // Delete teacher record
            $stmtT = $db->prepare('DELETE FROM staff_teachers WHERE id = :id');
            $stmtT->execute([':id' => $teacherID]);

            // Delete user account
            if ($userID) {
                $stmtA = $db->prepare('DELETE FROM school_auth WHERE id = :id');
                $stmtA->execute([':id' => $userID]);
            }

            $db->commit();
            echo json_encode(['message' => 'Teacher deleted successfully.']);
        } catch (PDOException $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            http_response_code(500);
            echo json_encode(['message' => $e->getMessage()]);
        }
    }

    public static function getTeacherProfile($db, $user) {
        if (!$user || !isset($user['id'])) {
            http_response_code(401);
            echo json_encode(['message' => 'Unauthorized']);
            return;
        }

        try {
            $stmtProfile = $db->prepare('SELECT * FROM staff_teachers WHERE auth_id = :auth_id');
            $stmtProfile->execute([':auth_id' => $user['id']]);
            $teacher = $stmtProfile->fetch();

            if (!$teacher) {
                http_response_code(404);
                echo json_encode(['message' => 'Teacher profile not found']);
                return;
            }

            $tid = $teacher['id'];

            // Fetch assignments
            $stmtAss = $db->prepare('
                SELECT c.id as "ClassID", c.classname as "ClassName", s.id as "SubjectID", s.subjectname as "SubjectName",
                       (SELECT COUNT(*) FROM school_students st WHERE st.class_id = c.id) as "StudentCount"
                FROM teacher_assignments_map ta
                JOIN school_classes c ON ta.class_id = c.id
                JOIN school_subjects s ON ta.subject_id = s.id
                WHERE ta.teacher_id = :teacher_id
            ');
            $stmtAss->execute([':teacher_id' => $tid]);
            $assignments = $stmtAss->fetchAll();

            // Fetch distinct students count
            $stmtCount = $db->prepare('
                SELECT COUNT(DISTINCT s.id) AS totalstudents
                FROM school_students s
                JOIN teacher_assignments_map ta ON s.class_id = ta.class_id
                WHERE ta.teacher_id = :teacher_id
            ');
            $stmtCount->execute([':teacher_id' => $tid]);
            $studentCount = $stmtCount->fetchColumn();

            echo json_encode([
                'teacherid' => $tid,
                'FullName' => $teacher['fullname'],
                'Subject' => $teacher['subject_specialty'],
                'Email' => $teacher['email'],
                'PhoneNo' => $teacher['phone'],
                'AssignedClasses' => $teacher['assigned_classes'],
                'Assignments' => $assignments,
                'StudentCount' => (int)$studentCount
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['message' => $e->getMessage()]);
        }
    }

    public static function updateTeacherAssignments($db) {
        $input = json_decode(file_get_contents('php://input'), true);
        $teacherID = isset($input['teacherID']) ? (int)$input['teacherID'] : null;
        $assignments = isset($input['assignments']) ? $input['assignments'] : [];
        $append = isset($input['append']) ? (bool)$input['append'] : false;

        if (!$teacherID) {
            http_response_code(400);
            echo json_encode(['message' => 'Teacher ID is required.']);
            return;
        }

        try {
            $db->beginTransaction();

            if (!$append) {
                $stmtDel = $db->prepare('DELETE FROM teacher_assignments_map WHERE teacher_id = :teacher_id');
                $stmtDel->execute([':teacher_id' => $teacherID]);
            }

            if ($assignments && is_array($assignments)) {
                $stmtIns = $db->prepare('INSERT INTO teacher_assignments_map (teacher_id, class_id, subject_id) VALUES (:teacher_id, :class_id, :subject_id)');
                foreach ($assignments as $ass) {
                    $classID = isset($ass['classID']) ? (int)$ass['classID'] : null;
                    $subjectID = isset($ass['subjectID']) ? (int)$ass['subjectID'] : null;
                    if ($classID && $subjectID) {
                        $stmtIns->execute([
                            ':teacher_id' => $teacherID,
                            ':class_id' => $classID,
                            ':subject_id' => $subjectID
                        ]);
                    }
                }
            }

            // Update specialty and assigned classes summary
            self::updateTeacherSummaries($db, $teacherID);

            $db->commit();
            echo json_encode(['message' => 'Assignments updated successfully']);
        } catch (PDOException $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            http_response_code(500);
            echo json_encode(['message' => $e->getMessage()]);
        }
    }

    private static function updateTeacherSummaries($db, $teacherID) {
        $stmtUpdate = $db->prepare('
            UPDATE staff_teachers 
            SET 
                subject_specialty = (
                    SELECT STRING_AGG(s.subjectname, \', \') 
                    FROM teacher_assignments_map ta
                    JOIN school_subjects s ON ta.subject_id = s.id
                    WHERE ta.teacher_id = :teacher_id
                ),
                assigned_classes = (
                    SELECT STRING_AGG(classname, \', \') 
                    FROM (
                        SELECT DISTINCT c.classname 
                        FROM teacher_assignments_map ta
                        JOIN school_classes c ON ta.class_id = c.id
                        WHERE ta.teacher_id = :teacher_id
                    ) AS ClassSub
                )
            WHERE id = :teacher_id
        ');
        $stmtUpdate->execute([':teacher_id' => $teacherID]);
    }
}
