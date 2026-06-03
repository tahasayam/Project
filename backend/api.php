<?php
// Set CORS headers
if (isset($_SERVER['HTTP_ORIGIN'])) {
    header("Access-Control-Allow-Origin: {$_SERVER['HTTP_ORIGIN']}");
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Max-Age: 86400');    // cache for 1 day
}

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_METHOD'])) {
        header("Access-Control-Allow-Methods: GET, POST, OPTIONS, DELETE, PUT");
    }
    if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS'])) {
        header("Access-Control-Allow-Headers: {$_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS']}");
    }
    exit(0);
}

// Set Content Type to JSON
header('Content-Type: application/json');

// Include necessary files
require_once __DIR__ . '/Config/db.php';
require_once __DIR__ . '/Middleware/verifyToken.php';
require_once __DIR__ . '/Controllers/AuthController.php';
require_once __DIR__ . '/Controllers/AdminController.php';
require_once __DIR__ . '/Controllers/ClassController.php';
require_once __DIR__ . '/Controllers/StudentController.php';
require_once __DIR__ . '/Controllers/TeacherController.php';
require_once __DIR__ . '/Controllers/AttendanceController.php';
require_once __DIR__ . '/Controllers/ResultController.php';

// Simple Router Class
class Router {
    private $routes = [];

    public function add($method, $path, $controllerClass, $action, $roles = null) {
        // Convert route parameters (e.g., :classID) to regex named capture groups
        $pattern = preg_replace('/:([a-zA-Z0-9_]+)/', '(?P<$1>[^/]+)', $path);
        $pattern = '#^' . $pattern . '$#';
        
        $this->routes[] = [
            'method' => strtoupper($method),
            'pattern' => $pattern,
            'controller' => $controllerClass,
            'action' => $action,
            'roles' => $roles
        ];
    }

    public function handle($requestMethod, $requestUri) {
        $path = parse_url($requestUri, PHP_URL_PATH);
        
        foreach ($this->routes as $route) {
            if ($route['method'] === $requestMethod && preg_match($route['pattern'], $path, $matches)) {
                // Extract named parameters
                $params = array_filter($matches, 'is_string', ARRAY_FILTER_USE_KEY);
                return [
                    'controller' => $route['controller'],
                    'action' => $route['action'],
                    'params' => $params,
                    'roles' => $route['roles']
                ];
            }
        }
        return null;
    }
}

// Instantiate and register routes
$router = new Router();

// Health check (no auth needed)
$router->add('GET', '/health', null, 'healthcheck', null);

// Auth Routes (no auth needed)
$router->add('POST', '/api/auth/login', 'AuthController', 'login', null);
$router->add('POST', '/api/auth/register', 'AuthController', 'register', null);

// Admin Routes
$router->add('GET', '/api/admin/stats', 'AdminController', 'getDashboardStats', ['Admin']);

// Attendance Routes
$router->add('POST', '/api/attendance/mark', 'AttendanceController', 'markAttendance', ['Teacher', 'Admin']);
$router->add('GET', '/api/attendance/stats/:studentID/:month', 'AttendanceController', 'getAttendanceStats', ['Student', 'Admin']);
$router->add('GET', '/api/attendance/view-student/:classID/:date', 'AttendanceController', 'viewStudentAttendanceByDate', ['Teacher', 'Admin']);

// Class Routes
$router->add('GET', '/api/classes/all', 'ClassController', 'getAllClasses', []); // verifyToken() with empty roles allows any authenticated user
$router->add('GET', '/api/classes/available-teachers', 'ClassController', 'getAvailableTeachers', ['Admin']);
$router->add('GET', '/api/classes/subjects', 'ClassController', 'getAllSubjects', []);
$router->add('POST', '/api/classes/subjects', 'ClassController', 'addSubject', ['Admin']);
$router->add('POST', '/api/classes/add', 'ClassController', 'addClass', ['Admin']);
$router->add('DELETE', '/api/classes/delete/:classID', 'ClassController', 'deleteClass', ['Admin']);

// Result Routes
$router->add('POST', '/api/results/add', 'ResultController', 'addResult', ['Teacher']);
$router->add('POST', '/api/results/publish', 'ResultController', 'publishResults', ['Admin']);
$router->add('GET', '/api/results/class/:classID/:term', 'ResultController', 'getClassResults', ['Admin', 'Teacher']);
$router->add('GET', '/api/results/student/:studentID', 'ResultController', 'getStudentResults', ['Student']);
$router->add('GET', '/api/results/available-terms/:classID', 'ResultController', 'getAvailableTerms', []);

// Student Routes
$router->add('GET', '/api/students/all', 'StudentController', 'getAllStudents', ['Admin']);
$router->add('GET', '/api/students/by-class/:classID', 'StudentController', 'getStudentsByClass', ['Admin', 'Teacher']);
$router->add('POST', '/api/students/add', 'StudentController', 'addStudent', ['Admin']);
$router->add('DELETE', '/api/students/delete/:rollNo', 'StudentController', 'deleteStudent', ['Admin']);
$router->add('GET', '/api/students/profile', 'StudentController', 'getStudentProfile', ['Student']);

// Teacher Routes
$router->add('GET', '/api/teachers/all', 'TeacherController', 'getAllTeachers', ['Admin']);
$router->add('POST', '/api/teachers/add', 'TeacherController', 'addTeacher', ['Admin']);
$router->add('DELETE', '/api/teachers/delete/:phoneNo', 'TeacherController', 'deleteTeacher', ['Admin']);
$router->add('GET', '/api/teachers/profile', 'TeacherController', 'getTeacherProfile', ['Teacher']);
$router->add('POST', '/api/teachers/update-assignments', 'TeacherController', 'updateTeacherAssignments', ['Admin']);

// Dispatch Request
$requestMethod = $_SERVER['REQUEST_METHOD'];
$requestUri = $_SERVER['REQUEST_URI'];

$route = $router->handle($requestMethod, $requestUri);

if ($route) {
    // 1. Healthcheck Route Handling
    if ($route['action'] === 'healthcheck') {
        if ($db) {
            try {
                $db->query('SELECT 1');
                echo json_encode(['status' => 'OK', 'database' => 'Connected']);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(['status' => 'Error', 'message' => $e->getMessage()]);
            }
        } else {
            http_response_code(500);
            echo json_encode(['status' => 'Error', 'message' => 'Database connection not initialized']);
        }
        exit;
    }

    // 2. Auth Verification (if route specifies roles or empty array for general authentication)
    $user = null;
    if ($route['roles'] !== null) {
        $user = verifyToken($route['roles']);
    }

    // 3. Controller Execution
    $controller = $route['controller'];
    $action = $route['action'];
    $params = $route['params'];

    // In PHP, controllers are class methods. We pass the database connection.
    // If the method expects params or the user context, we pass them.
    if ($controller === 'StudentController' && $action === 'getStudentProfile') {
        $controller::$action($db, $user);
    } elseif ($controller === 'TeacherController' && $action === 'getTeacherProfile') {
        $controller::$action($db, $user);
    } elseif (!empty($params)) {
        $controller::$action($db, $params);
    } else {
        $controller::$action($db);
    }
} else {
    http_response_code(404);
    echo json_encode(['message' => 'API Endpoint Not Found']);
}
