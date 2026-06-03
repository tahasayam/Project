<?php

class AdminController {
    public static function getDashboardStats($db) {
        try {
            $studentsQuery = $db->query('SELECT COUNT(*) AS total FROM school_students');
            $studentsCount = $studentsQuery->fetchColumn();

            $teachersQuery = $db->query('SELECT COUNT(*) AS total FROM staff_teachers');
            $teachersCount = $teachersQuery->fetchColumn();

            $classesQuery = $db->query('SELECT COUNT(*) AS total FROM school_classes');
            $classesCount = $classesQuery->fetchColumn();

            echo json_encode([
                'totalStudents' => (int)$studentsCount,
                'totalTeachers' => (int)$teachersCount,
                'totalClasses'  => (int)$classesCount
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['message' => $e->getMessage()]);
        }
    }
}
