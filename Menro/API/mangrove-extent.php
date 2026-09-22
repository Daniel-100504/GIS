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

$pdo = getDbConnection();
$action = $_GET['action'] ?? $_POST['action'] ?? '';

if ($action === 'list') {
    requireMenro();
    $rows = $pdo->query("SELECT id, name, coordinates FROM mangrove_extent_shapes ORDER BY id")->fetchAll(PDO::FETCH_ASSOC);

    $features = array_map(function ($row) {
        return [
            'type' => 'Feature',
            'properties' => [
                'id'   => (int) $row['id'],
                'name' => $row['name'],
            ],
            'geometry' => json_decode($row['coordinates'], true),
        ];
    }, $rows);

    respond(['type' => 'FeatureCollection', 'features' => $features]);
}

if ($action === 'update') {
    requireMenro();
    $id = $_POST['id'] ?? '';
    $geometry = $_POST['geometry'] ?? '';
    $name = trim($_POST['name'] ?? '');

    if (!ctype_digit((string) $id) || $geometry === '') {
        respond(['success' => false, 'error' => 'Invalid id or shape data.'], 400);
    }
    json_decode($geometry);
    if (json_last_error() !== JSON_ERROR_NONE) {
        respond(['success' => false, 'error' => 'Invalid shape data.'], 400);
    }

    $fields = ['coordinates = :coordinates', 'updated_by = :updatedBy'];
    $params = ['coordinates' => $geometry, 'updatedBy' => $_SESSION['user']['username'], 'id' => $id];
    if ($name !== '') {
        $fields[] = 'name = :name';
        $params['name'] = $name;
    }

    $stmt = $pdo->prepare("UPDATE mangrove_extent_shapes SET " . implode(', ', $fields) . " WHERE id = :id");
    $stmt->execute($params);

    respond(['success' => true]);
}

respond(['success' => false, 'error' => 'Unknown action.'], 400);
