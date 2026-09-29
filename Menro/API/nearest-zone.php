<?php

session_start();

header('Content-Type: application/json');

if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'ranger') {
    http_response_code(401);
    echo json_encode(['error' => 'Not authorized.']);
    exit;
}
session_write_close();

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/zone-lookup.php';

$lat = isset($_GET['lat']) ? (float) $_GET['lat'] : null;
$lng = isset($_GET['lng']) ? (float) $_GET['lng'] : null;

if ($lat === null || $lng === null) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing lat/lng']);
    exit;
}

echo json_encode(['zone' => nearestMangroveAreaZoneWithDistance($lat, $lng)]);
