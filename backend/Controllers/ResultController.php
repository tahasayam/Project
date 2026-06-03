<?php

class ResultController {
    public static function addResult($db) {
        $input = json_decode(file_get_contents('php://input'), true);
        $studentID = isset($input['studentID']) ? (int)$input['studentID'] : null;
        $subjectName = isset($input['subjectName']) ? trim($input['subjectName']) : null;
        $term = isset($input['term']) ? trim($input['term']) : null;
        $marksObtained = isset($input['marksObtained']) ? (float)$input['marksObtained'] : null;
        $totalMarks = isset($input['totalMarks']) ? (float)$input['totalMarks'] : null;

        if (!$studentID || !$subjectName || !$term || $marksObtained === null || $totalMarks === null) {
            http_response_code(400);
            echo json_encode(['message' => 'All fields are required.']);
            return;
        }

        try {
            $db->beginTransaction();

            $stmtDel = $db->prepare('DELETE FROM school_results WHERE student_id = :student_id AND subject_name = :subject_name AND term = :term');
            $stmtDel->execute([
                ':student_id' => $studentID,
                ':subject_name' => $subjectName,
                ':term' => $term
            ]);

            $stmtIns = $db->prepare('
                INSERT INTO school_results (student_id, subject_name, term, marks, total_marks, is_published)
                VALUES (:student_id, :subject_name, :term, :marks, :total_marks, FALSE)
            ');
            $stmtIns->execute([
                ':student_id' => $studentID,
                ':subject_name' => $subjectName,
                ':term' => $term,
                ':marks' => $marksObtained,
                ':total_marks' => $totalMarks
            ]);

            $db->commit();
            http_response_code(201);
            echo json_encode(['message' => 'Marks saved successfully.']);
        } catch (PDOException $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            http_response_code(500);
            echo json_encode(['message' => $e->getMessage()]);
        }
    }

    public static function publishResults($db) {
        $input = json_decode(file_get_contents('php://input'), true);
        $classID = isset($input['classID']) ? (int)$input['classID'] : null;
        $term = isset($input['term']) ? trim($input['term']) : null;

        if (!$classID || !$term) {
            http_response_code(400);
            echo json_encode(['message' => 'classID and term are required.']);
            return;
        }

        try {
            $stmt = $db->prepare('
                UPDATE school_results SET is_published = TRUE
                WHERE term = :term
                AND student_id IN (SELECT id FROM school_students WHERE class_id = :class_id)
            ');
            $stmt->execute([
                ':term' => $term,
                ':class_id' => $classID
            ]);

            echo json_encode([
                'message' => "Results published for term '{$term}'.",
                'affected' => $stmt->rowCount()
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['message' => $e->getMessage()]);
        }
    }

    public static function getClassResults($db, $params) {
        $classID = isset($params['classID']) ? (int)$params['classID'] : null;
        $term = isset($params['term']) ? trim($params['term']) : null;

        if (!$classID || !$term) {
            http_response_code(400);
            echo json_encode(['message' => 'classID and term are required.']);
            return;
        }

        try {
            $stmt = $db->prepare('
                SELECT s.id as "StudentID", s.roll_no as "RollNo", s.fullname as "FullName",
                       r.subject_name as "SubjectName", r.marks as "MarksObtained", r.total_marks as "TotalMarks", r.is_published as "IsPublished", r.term as "Term"
                FROM school_students s
                LEFT JOIN school_results r ON r.student_id = s.id AND r.term = :term
                WHERE s.class_id = :class_id
                ORDER BY s.roll_no
            ');
            $stmt->execute([
                ':term' => $term,
                ':class_id' => $classID
            ]);
            $rows = $stmt->fetchAll();

            // Cast types to match Express return values
            foreach ($rows as &$row) {
                if ($row['MarksObtained'] !== null) {
                    $row['MarksObtained'] = (float)$row['MarksObtained'];
                }
                if ($row['TotalMarks'] !== null) {
                    $row['TotalMarks'] = (float)$row['TotalMarks'];
                }
                if ($row['IsPublished'] !== null) {
                    $row['IsPublished'] = (bool)$row['IsPublished'];
                }
            }

            echo json_encode($rows);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['message' => $e->getMessage()]);
        }
    }

    public static function getStudentResults($db, $params) {
        $studentID = isset($params['studentID']) ? (int)$params['studentID'] : null;

        if (!$studentID) {
            http_response_code(400);
            echo json_encode(['message' => 'StudentID is required.']);
            return;
        }

        try {
            $stmt = $db->prepare('
                SELECT id as "ResultID", subject_name as "SubjectName", term as "Term", marks as "MarksObtained", total_marks as "TotalMarks"
                FROM school_results
                WHERE student_id = :student_id AND is_published = TRUE
                ORDER BY term, subject_name
            ');
            $stmt->execute([':student_id' => $studentID]);
            $rows = $stmt->fetchAll();

            foreach ($rows as &$row) {
                if ($row['MarksObtained'] !== null) {
                    $row['MarksObtained'] = (float)$row['MarksObtained'];
                }
                if ($row['TotalMarks'] !== null) {
                    $row['TotalMarks'] = (float)$row['TotalMarks'];
                }
            }

            echo json_encode($rows);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['message' => $e->getMessage()]);
        }
    }

    public static function getAvailableTerms($db, $params) {
        $classID = isset($params['classID']) ? (int)$params['classID'] : null;

        if (!$classID) {
            http_response_code(400);
            echo json_encode(['message' => 'ClassID is required.']);
            return;
        }

        try {
            $stmt = $db->prepare('
                SELECT DISTINCT term 
                FROM school_results 
                WHERE student_id IN (SELECT id FROM school_students WHERE class_id = :class_id)
                ORDER BY term
            ');
            $stmt->execute([':class_id' => $classID]);
            $rows = $stmt->fetchAll();

            $terms = [];
            foreach ($rows as $row) {
                $terms[] = $row['term'];
            }

            echo json_encode($terms);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['message' => $e->getMessage()]);
        }
    }
}
