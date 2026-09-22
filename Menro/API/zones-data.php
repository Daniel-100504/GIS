<?php

// Serves the ZONES list (name, area, coordinates, protected area) straight
// from the mangrove_zones database table, followed by the rest of the
// zone/submission-handling script (connection status, aquafarm registry,
// etc.), which lives in zones-data-body.js.
header('Content-Type: application/javascript; charset=utf-8');

require_once __DIR__ . '/../../Login/Database/db.php';

$pdo = getDbConnection();
$rows = $pdo->query(
    "SELECT id, name, area_ha, lat, lng, partner FROM mangrove_zones ORDER BY name"
)->fetchAll(PDO::FETCH_ASSOC);

$zones = array_map(function ($row) {
    return [
        'id'      => $row['id'],
        'name'    => $row['name'],
        'area'    => $row['area_ha'] !== null ? (float) $row['area_ha'] : null,
        'partner' => $row['partner'] ?: '—',
        'ndvi'    => null,
        'status'  => 'pending',
        'lat'     => $row['lat'] !== null ? (float) $row['lat'] : null,
        'lng'     => $row['lng'] !== null ? (float) $row['lng'] : null,
    ];
}, $rows);

echo "const ZONES = " . json_encode($zones, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . ";\n\n";
readfile(__DIR__ . '/../js/zones-data-body.js');
