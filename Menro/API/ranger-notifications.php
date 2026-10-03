<?php

require_once __DIR__ . '/../../Login/Database/session-init.php';

header('Content-Type: application/json');

if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'ranger') {
    http_response_code(401);
    echo json_encode(['error' => 'Not authorized.']);
    exit;
}
$currentUser = $_SESSION['user'];
session_write_close();

require_once __DIR__ . '/../../Login/Database/db.php';

$ownName = trim((string) ($currentUser['fullName'] ?: $currentUser['username']));

$action = $_GET['action'] ?? ($_POST['action'] ?? 'list');
$pdo = getDbConnection();

if ($action === 'markRead') {
    $id = $_POST['id'] ?? null;

    if ($id === 'all') {
        $stmt = $pdo->prepare("UPDATE ranger_notifications SET is_read = 1 WHERE LOWER(ranger_name) = LOWER(:name)");
        $stmt->execute(['name' => $ownName]);
    } elseif ($id !== null && ctype_digit((string) $id)) {
        // Scoped to this ranger's own name too, so one ranger can't mark
        // another's notification read by guessing an id.
        $stmt = $pdo->prepare("UPDATE ranger_notifications SET is_read = 1 WHERE id = :id AND LOWER(ranger_name) = LOWER(:name)");
        $stmt->execute(['id' => $id, 'name' => $ownName]);
    } else {
        http_response_code(400);
        echo json_encode(['error' => 'Missing or invalid notification id']);
        exit;
    }

    echo json_encode(['success' => true]);
    exit;
}

// Plain list — most recent first, capped so the bell's dropdown never has to
// render an unbounded history of old approvals.
$stmt = $pdo->prepare(
    "SELECT id, kobo_id, message, status, zone_name, inspection_date, notes, is_read, created_at
     FROM ranger_notifications
     WHERE LOWER(ranger_name) = LOWER(:name)
     ORDER BY created_at DESC
     LIMIT 30"
);
$stmt->execute(['name' => $ownName]);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

$results = array_map(function ($row) {
    return [
        'id'             => (int) $row['id'],
        'koboId'         => (int) $row['kobo_id'],
        'message'        => $row['message'],
        'status'         => $row['status'],
        'zoneName'       => $row['zone_name'],
        'inspectionDate' => $row['inspection_date'],
        'notes'          => $row['notes'],
        'isRead'         => (bool) $row['is_read'],
        'createdAt'      => $row['created_at'],
    ];
}, $rows);

echo json_encode(['results' => $results]);
