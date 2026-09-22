<?php

session_start();

require_once __DIR__ . '/../../Login/Database/db.php';

header('Content-Type: application/json');

function respond($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data);
    exit;
}

function requireMenro() {
    if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'menro') {
        respond(['success' => false, 'error' => 'Not authorized.'], 401);
    }
}

const CATEGORIES = ['mangrove', 'protected_area', 'watershed_hazard'];
const HAZARD_TYPES = ['illegal_cutting', 'aquaculture_conversion', 'siltation', 'pollution', 'erosion', 'land_reclamation', 'illegal_dumping', 'other'];
const SEVERITY_LEVELS = ['low', 'moderate', 'high'];

$pdo = getDbConnection();
$action = $_GET['action'] ?? $_POST['action'] ?? '';

if ($action === 'list') {
    requireMenro();
    $rows = $pdo->query("SELECT id, name, barangay, category, hazard_type, severity, coordinates, created_by, created_at FROM mangrove_areas ORDER BY created_at DESC")->fetchAll(PDO::FETCH_ASSOC);

    $features = array_map(function ($row) {
        return [
            'type' => 'Feature',
            'properties' => [
                'id'          => (int) $row['id'],
                'name'        => $row['name'],
                'barangay'    => $row['barangay'],
                'category'    => $row['category'],
                'hazard_type' => $row['hazard_type'],
                'severity'    => $row['severity'],
                'created_by'  => $row['created_by'],
                'created_at'  => $row['created_at'],
            ],
            'geometry' => json_decode($row['coordinates'], true),
        ];
    }, $rows);

    respond(['type' => 'FeatureCollection', 'features' => $features]);
}

if ($action === 'create') {
    requireMenro();
    $name = trim($_POST['name'] ?? '');
    $barangay = trim($_POST['barangay'] ?? '');
    $category = trim($_POST['category'] ?? '');
    $hazardType = trim($_POST['hazard_type'] ?? '');
    $severity = trim($_POST['severity'] ?? '');
    $geometry = $_POST['geometry'] ?? '';
    $isHazard = $category === 'watershed_hazard';

    if ($name === '' || $barangay === '' || $geometry === '' || !in_array($category, CATEGORIES, true)) {
        respond(['success' => false, 'error' => 'Name, barangay, category, and shape are required.'], 400);
    }
    if ($isHazard && (!in_array($hazardType, HAZARD_TYPES, true) || !in_array($severity, SEVERITY_LEVELS, true))) {
        respond(['success' => false, 'error' => 'Hazard type and severity are required for a watershed hazard.'], 400);
    }
    json_decode($geometry);
    if (json_last_error() !== JSON_ERROR_NONE) {
        respond(['success' => false, 'error' => 'Invalid shape data.'], 400);
    }

    $stmt = $pdo->prepare("INSERT INTO mangrove_areas (name, barangay, category, hazard_type, severity, coordinates, created_by) VALUES (:name, :barangay, :category, :hazardType, :severity, :coordinates, :createdBy)");
    $stmt->execute([
        'name'        => $name,
        'barangay'    => $barangay,
        'category'    => $category,
        'hazardType'  => $isHazard ? $hazardType : null,
        'severity'    => $isHazard ? $severity : null,
        'coordinates' => $geometry,
        'createdBy'   => $_SESSION['user']['username'],
    ]);

    respond(['success' => true, 'id' => $pdo->lastInsertId()]);
}

if ($action === 'update') {
    requireMenro();
    $id = $_POST['id'] ?? '';
    $geometry = $_POST['geometry'] ?? '';
    $name = trim($_POST['name'] ?? '');
    $barangay = trim($_POST['barangay'] ?? '');
    $category = trim($_POST['category'] ?? '');
    $hazardType = trim($_POST['hazard_type'] ?? '');
    $severity = trim($_POST['severity'] ?? '');

    if (!ctype_digit((string) $id) || $geometry === '') {
        respond(['success' => false, 'error' => 'Invalid id or shape data.'], 400);
    }
    if ($category === 'watershed_hazard' && (!in_array($hazardType, HAZARD_TYPES, true) || !in_array($severity, SEVERITY_LEVELS, true))) {
        respond(['success' => false, 'error' => 'Hazard type and severity are required for a watershed hazard.'], 400);
    }
    json_decode($geometry);
    if (json_last_error() !== JSON_ERROR_NONE) {
        respond(['success' => false, 'error' => 'Invalid shape data.'], 400);
    }

    $fields = ['coordinates = :coordinates'];
    $params = ['coordinates' => $geometry, 'id' => $id];
    if ($name !== '') {
        $fields[] = 'name = :name';
        $params['name'] = $name;
    }
    if ($barangay !== '') {
        $fields[] = 'barangay = :barangay';
        $params['barangay'] = $barangay;
    }
    if (in_array($category, CATEGORIES, true)) {
        $fields[] = 'category = :category';
        $params['category'] = $category;
        $fields[] = 'hazard_type = :hazardType';
        $params['hazardType'] = $category === 'watershed_hazard' ? $hazardType : null;
        $fields[] = 'severity = :severity';
        $params['severity'] = $category === 'watershed_hazard' ? $severity : null;
    }

    $stmt = $pdo->prepare("UPDATE mangrove_areas SET " . implode(', ', $fields) . " WHERE id = :id");
    $stmt->execute($params);

    respond(['success' => true]);
}

if ($action === 'delete') {
    requireMenro();
    $id = $_POST['id'] ?? '';

    if (!ctype_digit((string) $id)) {
        respond(['success' => false, 'error' => 'Invalid id.'], 400);
    }

    $stmt = $pdo->prepare("DELETE FROM mangrove_areas WHERE id = :id");
    $stmt->execute(['id' => $id]);

    respond(['success' => true]);
}

respond(['success' => false, 'error' => 'Unknown action.'], 400);
