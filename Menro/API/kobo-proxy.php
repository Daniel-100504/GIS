<?php

session_start();

header('Content-Type: application/json');

$allowedRoles = ['ranger', 'menro', 'admin'];
if (!isset($_SESSION['user']) || !in_array($_SESSION['user']['role'], $allowedRoles, true)) {
    http_response_code(401);
    echo json_encode(['error' => 'Not authorized.']);
    exit;
}
session_write_close();

require_once __DIR__ . '/config.php';

$action = $_GET['action'] ?? ($_POST['action'] ?? 'list');

if ($action === 'delete') {
    $submissionId = $_GET['id'] ?? ($_POST['id'] ?? null);

    if (!$submissionId || !ctype_digit((string) $submissionId)) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing or invalid submission id']);
        exit;
    }

    $deleteUrl = 'https://kf.kobotoolbox.org/api/v2/assets/' . KOBO_FORM_UID . '/data/' . $submissionId . '/';

    $ch = curl_init($deleteUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'DELETE');
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Token ' . KOBO_TOKEN
    ]);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);

    $deleteResponse = curl_exec($ch);
    $deleteHttpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($deleteResponse === false || ($deleteHttpCode !== 204 && $deleteHttpCode !== 200)) {
        http_response_code(502);
        echo json_encode(['error' => 'Failed to delete submission on KoboToolbox', 'code' => $deleteHttpCode]);
        exit;
    }

    echo json_encode(['success' => true, 'id' => $submissionId]);
    exit;
}

$url = 'https://kf.kobotoolbox.org/api/v2/assets/' . KOBO_FORM_UID . '/data/?format=json';

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Token ' . KOBO_TOKEN
]);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
curl_setopt($ch, CURLOPT_TIMEOUT, 15);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($response === false || $httpCode !== 200) {
    http_response_code(502);
    echo json_encode(['error' => 'Failed to reach KoboToolbox API', 'code' => $httpCode]);
    exit;
}

echo $response;