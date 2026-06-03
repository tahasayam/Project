<?php

class AttendanceController {
    public static function markAttendance($db) {
        $input = json_decode(file_get_contents('php://input'), true);
        $date = isset($input['date']) ? trim($input['date']) : null;
        $targetType = isset($input['targetType']) ? trim($input['targetType']) : null;
        $records = isset($input['records']) ? $input['records'] : null;

        if (!$date || !$targetType || !$records || !is_array($records)) {
            http_response_code(400);
            echo json_encode(['message' => 'Date, targetType, and records array are required.']);
            return;
        }

        try {
            $tableName = 'teacher_attendance_log';
            $idColumn = 'teacher_id';

            if ($targetType === 'Student') {
                $idColumn = 'student_id';
                $firstStudentID = isset($records[0]['targetID']) ? (int)$records[0]['targetID'] : null;
                if ($firstStudentID) {
                    $stmtClass = $db->prepare('SELECT class_id FROM school_students WHERE id = :student_id');
                    $stmtClass->execute([':student_id' => $firstStudentID]);
                    $classID = $stmtClass->fetchColumn();
                    $tableName = self::getStudentAttendanceTable($db, $classID);
                } else {
                    $tableName = 'att_class_1';
                }
            }

            $db->beginTransaction();

            // Prepare statements outside the loop
            // NOTE: Since table name is dynamic and sanitized by our helper, we interpolate it.
            // But we must sanitize table name to prevent SQL Injection, which we do via hardcoded list or prefix check in getStudentAttendanceTable.
            $stmtDel = $db->prepare("DELETE FROM {$tableName} WHERE log_date = :log_date AND {$idColumn} = :id");
            $stmtIns = $db->prepare("INSERT INTO {$tableName} (log_date, status, {$idColumn}) VALUES (:log_date, :status, :id)");

            foreach ($records as $rec) {
                $targetID = isset($rec['targetID']) ? (int)$rec['targetID'] : null;
                $status = isset($rec['status']) ? trim($rec['status']) : null;

                if ($targetID && $status) {
                    $stmtDel->execute([
                        ':log_date' => $date,
                        ':id' => $targetID
                    ]);

                    $stmtIns->execute([
                        ':log_date' => $date,
                        ':status' => $status,
                        ':id' => $targetID
                    ]);
                }
            }

            $db->commit();
            http_response_code(201);
            echo json_encode(['message' => 'Attendance saved successfully.']);
        } catch (PDOException $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            http_response_code(500);
            echo json_encode(['message' => $e->getMessage()]);
        }
    }

    public static function getAttendanceStats($db, $params) {
        $studentID = isset($params['studentID']) ? (int)$params['studentID'] : null;
        $month = isset($params['month']) ? (int)$params['month'] : null;

        if (!$studentID || !$month) {
            http_response_code(400);
            echo json_encode(['message' => 'Student ID and month are required.']);
            return;
        }

        try {
            $stmtClass = $db->prepare('SELECT class_id FROM school_students WHERE id = :student_id');
            $stmtClass->execute([':student_id' => $studentID]);
            $classID = $stmtClass->fetchColumn();
            $tableName = self::getStudentAttendanceTable($db, $classID);

            $currentYear = (int)date('Y');

            $stmtStats = $db->prepare("
                SELECT
                    COUNT(*) AS totaldays,
                    SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) AS presentdays,
                    SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END) AS absentdays,
                    SUM(CASE WHEN status = 'Leave' THEN 1 ELSE 0 END) AS leavedays
                FROM {$tableName}
                WHERE student_id = :student_id 
                  AND EXTRACT(MONTH FROM log_date) = :month 
                  AND EXTRACT(YEAR FROM log_date) = :year
                  AND EXTRACT(DOW FROM log_date) != 0
            ");
            $stmtStats->execute([
                ':student_id' => $studentID,
                ':month' => $month,
                ':year' => $currentYear
            ]);
            $stats = $stmtStats->fetch();

            $total = isset($stats['totaldays']) ? (int)$stats['totaldays'] : 0;
            $present = isset($stats['presentdays']) ? (int)$stats['presentdays'] : 0;
            $absent = isset($stats['absentdays']) ? (int)$stats['absentdays'] : 0;
            $leave = isset($stats['leavedays']) ? (int)$stats['leavedays'] : 0;

            $percent = $total > 0
                ? (int)round((($present + $leave) / $total) * 100)
                : 0;

            echo json_encode([
                'percent' => $percent,
                'totalDays' => $total,
                'presentDays' => $present,
                'absentDays' => $absent,
                'leaveDays' => $leave
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['message' => $e->getMessage()]);
        }
    }

    public static function viewStudentAttendanceByDate($db, $params) {
        $classID = isset($params['classID']) ? (int)$params['classID'] : null;
        $date = isset($params['date']) ? trim($params['date']) : null;

        if (!$classID || !$date) {
            http_response_code(400);
            echo json_encode(['message' => 'Class ID and date are required.']);
            return;
        }

        try {
            $tableName = self::getStudentAttendanceTable($db, $classID);

            $stmt = $db->prepare("
                SELECT s.id as \"StudentID\", s.roll_no as \"RollNo\", s.fullname as \"FullName\", a.status as \"Status\"
                FROM school_students s
                LEFT JOIN {$tableName} a ON a.student_id = s.id AND a.log_date = :log_date
                WHERE s.class_id = :class_id
                ORDER BY s.roll_no
            ");
            $stmt->execute([
                ':log_date' => $date,
                ':class_id' => $classID
            ]);
            echo json_encode($stmt->fetchAll());
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['message' => $e->getMessage()]);
        }
    }

    private static function getStudentAttendanceTable($db, $classID) {
        if (!$classID) {
            return 'att_class_1';
        }

        $stmt = $db->prepare('SELECT classname FROM school_classes WHERE id = :id');
        $stmt->execute([':id' => $classID]);
        $className = $stmt->fetchColumn();

        if (!$className) {
            return 'att_class_1';
        }

        preg_match('/\d+/', $className, $matches);
        $gradeLevel = !empty($matches) ? (int)$matches[0] : 1;
        $level = min(max($gradeLevel, 1), 10);
        return "att_class_{$level}";
    }
}
