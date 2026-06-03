<?php

class ClassController {
    public static function getAllClasses($db) {
        try {
            // Note: Postgres JSON_AGG produces a JSON string, which we need to parse in PHP
            $stmt = $db->query('
                SELECT c.id as "ClassID", c.classname as "ClassName", c.max_students as "MaxStudents",
                       (SELECT COUNT(*) FROM school_students s WHERE s.class_id = c.id) AS "StudentCount",
                       COALESCE((
                           SELECT JSON_AGG(JSON_BUILD_OBJECT(\'SubjectID\', s.id, \'SubjectName\', s.subjectname))
                           FROM class_subjects_map cs
                           JOIN school_subjects s ON cs.subject_id = s.id
                           WHERE cs.class_id = c.id
                       ), \'[]\'::json) AS "SubjectAssignments"
                FROM school_classes c
            ');
            $rows = $stmt->fetchAll();

            // Decode the JSON string returned by PostgreSQL for SubjectAssignments
            foreach ($rows as &$row) {
                if (isset($row['SubjectAssignments'])) {
                    $row['SubjectAssignments'] = json_decode($row['SubjectAssignments'], true);
                } else {
                    $row['SubjectAssignments'] = [];
                }
            }

            echo json_encode($rows);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['message' => $e->getMessage()]);
        }
    }

    public static function getAvailableTeachers($db) {
        try {
            $stmt = $db->query('
                SELECT id as "TeacherID", fullname as "FullName", subject_specialty as "Subject" 
                FROM staff_teachers
                WHERE id NOT IN (
                    SELECT teacher_id FROM school_classes WHERE teacher_id IS NOT NULL
                )
            ');
            echo json_encode($stmt->fetchAll());
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['message' => $e->getMessage()]);
        }
    }

    public static function addClass($db) {
        $input = json_decode(file_get_contents('php://input'), true);
        $className = isset($input['className']) ? trim($input['className']) : null;
        $maxStudents = isset($input['maxStudents']) ? (int)$input['maxStudents'] : 30;
        $subjects = isset($input['subjects']) ? $input['subjects'] : [];

        if (!$className) {
            http_response_code(400);
            echo json_encode(['message' => 'Class name is required.']);
            return;
        }

        // Validate grade level
        preg_match('/\d+/', $className, $matches);
        if (empty($matches)) {
            http_response_code(400);
            echo json_encode(['message' => 'Class name must contain a grade number (e.g., Class 1A).']);
            return;
        }

        $gradeLevel = (int)$matches[0];
        if ($gradeLevel < 1 || $gradeLevel > 10) {
            http_response_code(400);
            echo json_encode(['message' => 'Grade level must be between 1 and 10.']);
            return;
        }

        try {
            // Check duplicate class
            $stmt = $db->prepare('SELECT id FROM school_classes WHERE classname = :classname');
            $stmt->execute([':classname' => $className]);
            if ($stmt->fetch()) {
                http_response_code(400);
                echo json_encode(['message' => "Class '{$className}' already exists."]);
                return;
            }

            $db->beginTransaction();

            $stmt = $db->prepare('INSERT INTO school_classes (classname, max_students) VALUES (:classname, :max_students) RETURNING id');
            $stmt->execute([
                ':classname' => $className,
                ':max_students' => $maxStudents
            ]);
            $classID = $stmt->fetchColumn();

            if (!empty($subjects) && is_array($subjects)) {
                foreach ($subjects as $sub) {
                    $subjectID = null;
                    if (is_string($sub)) {
                        // Postgres Upsert
                        $subQuery = $db->prepare('
                            WITH ins AS (
                                INSERT INTO school_subjects (subjectname) 
                                VALUES (:subname) 
                                ON CONFLICT (subjectname) DO NOTHING 
                                RETURNING id
                            )
                            SELECT id FROM ins
                            UNION ALL
                            SELECT id FROM school_subjects WHERE subjectname = :subname
                            LIMIT 1
                        ');
                        $subQuery->execute([':subname' => $sub]);
                        $subjectID = $subQuery->fetchColumn();
                    } else {
                        $subjectID = (int)$sub;
                    }

                    if ($subjectID) {
                        $insMap = $db->prepare('INSERT INTO class_subjects_map (class_id, subject_id) VALUES (:class_id, :subject_id)');
                        $insMap->execute([
                            ':class_id' => $classID,
                            ':subject_id' => $subjectID
                        ]);
                    }
                }
            }

            $db->commit();
            http_response_code(201);
            echo json_encode(['message' => 'Class created successfully.']);
        } catch (PDOException $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            http_response_code(500);
            echo json_encode(['message' => $e->getMessage()]);
        }
    }

    public static function getAllSubjects($db) {
        try {
            $stmt = $db->query('SELECT id as "SubjectID", subjectname as "SubjectName" FROM school_subjects ORDER BY subjectname');
            echo json_encode($stmt->fetchAll());
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['message' => $e->getMessage()]);
        }
    }

    public static function addSubject($db) {
        $input = json_decode(file_get_contents('php://input'), true);
        $subjectName = isset($input['subjectName']) ? trim($input['subjectName']) : null;

        if (!$subjectName) {
            http_response_code(400);
            echo json_encode(['message' => 'Subject name is required.']);
            return;
        }

        try {
            $stmt = $db->prepare('INSERT INTO school_subjects (subjectname) VALUES (:subjectname)');
            $stmt->execute([':subjectname' => $subjectName]);
            http_response_code(201);
            echo json_encode(['message' => 'Subject created.']);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['message' => $e->getMessage()]);
        }
    }

    public static function deleteClass($db, $params) {
        $classID = isset($params['classID']) ? (int)$params['classID'] : null;

        if (!$classID) {
            http_response_code(400);
            echo json_encode(['message' => 'Class ID is required.']);
            return;
        }

        try {
            $stmt = $db->prepare('DELETE FROM school_classes WHERE id = :id');
            $stmt->execute([':id' => $classID]);
            echo json_encode(['message' => 'Class deleted.']);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['message' => $e->getMessage()]);
        }
    }
}
