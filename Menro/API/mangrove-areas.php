<?php

require_once __DIR__ . '/../../Login/Database/session-init.php';

require_once __DIR__ . '/config.php';

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

// Read-only zone shapes are safe for a ranger to see too — they're the ones
// standing in the field deciding where to drop their survey pin, and seeing
// the real zone boundaries on that map is the whole point. Only list() uses
// this; create/update/delete stay menro-only.
function requireMenroOrRanger() {
    $role = $_SESSION['user']['role'] ?? null;
    if (!isset($_SESSION['user']) || ($role !== 'menro' && $role !== 'ranger')) {
        respond(['success' => false, 'error' => 'Not authorized.'], 401);
    }
}

// 'mangrove' (unprotected mangrove forest area) used to be a second valid
// category — removed since those shapes were never actually visited or
// verified by a ranger (only protected areas are), so their data had no way
// to stay accurate. There were zero in the live database by the time this
// was restricted; this just stops any new ones being created.
const CATEGORIES = ['protected_area'];

// Every mangrove/protected area shape now lives in Supabase (Postgres with
// PostGIS), not the local database — this talks to it over Supabase's REST
// API (PostgREST) using the server-side secret key, which bypasses Row
// Level Security the same way the ranger_submissions backup already does.
function supabaseRequest($method, $path, $body = null) {
    $ch = curl_init(SUPABASE_URL . $path);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    $headers = [
        'apikey: ' . SUPABASE_SECRET_KEY,
        'Authorization: Bearer ' . SUPABASE_SECRET_KEY,
        'Content-Type: application/json',
    ];
    if ($method === 'POST') {
        $headers[] = 'Prefer: return=representation';
    }
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    if ($body !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    }
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($response === false) {
        respond(['success' => false, 'error' => 'Could not reach the database.'], 502);
    }
    return ['code' => $httpCode, 'data' => json_decode($response, true)];
}

$action = $_GET['action'] ?? $_POST['action'] ?? '';

if ($action === 'list') {
    requireMenroOrRanger();
    $result = supabaseRequest('GET', '/rest/v1/mangrove_areas_geojson?select=id,name,barangay,category,created_by,created_at,coordinates&order=created_at.desc');
    if ($result['code'] >= 400) {
        respond(['success' => false, 'error' => 'Could not load mangrove areas.'], 502);
    }

    // mpa_manager isn't part of the geojson view, so it's fetched separately
    // from the plain table and merged in by id. Best-effort: if this one
    // fails, areas still load, just without their MPA manager shown.
    $mpaManagerById = [];
    $mpaResult = supabaseRequest('GET', '/rest/v1/mangrove_areas?select=id,mpa_manager');
    if ($mpaResult['code'] < 400 && is_array($mpaResult['data'])) {
        foreach ($mpaResult['data'] as $row) {
            $mpaManagerById[(int) $row['id']] = $row['mpa_manager'] ?? null;
        }
    }

    $features = array_map(function ($row) use ($mpaManagerById) {
        $id = (int) $row['id'];
        return [
            'type' => 'Feature',
            'properties' => [
                'id'          => $id,
                'name'        => $row['name'],
                'barangay'    => $row['barangay'],
                'category'    => $row['category'],
                'mpa_manager' => $mpaManagerById[$id] ?? null,
                'created_by'  => $row['created_by'],
                'created_at'  => $row['created_at'],
            ],
            'geometry' => $row['coordinates'],
        ];
    }, $result['data'] ?? []);

    respond(['type' => 'FeatureCollection', 'features' => $features]);
}

if ($action === 'create') {
    requireMenro();
    $name = trim($_POST['name'] ?? '');
    $barangay = trim($_POST['barangay'] ?? '');
    $mpaManager = trim($_POST['mpaManager'] ?? '');
    $category = trim($_POST['category'] ?? '');
    $geometry = $_POST['geometry'] ?? '';

    if ($name === '' || $barangay === '' || $mpaManager === '' || $geometry === '' || !in_array($category, CATEGORIES, true)) {
        respond(['success' => false, 'error' => 'Name, barangay, MPA manager, category, and shape are required.'], 400);
    }
    json_decode($geometry);
    if (json_last_error() !== JSON_ERROR_NONE) {
        respond(['success' => false, 'error' => 'Invalid shape data.'], 400);
    }

    $result = supabaseRequest('POST', '/rest/v1/rpc/create_mangrove_area', [
        'in_name'       => $name,
        'in_barangay'   => $barangay,
        'in_category'   => $category,
        'in_geometry'   => $geometry,
        'in_created_by' => $_SESSION['user']['username'],
    ]);
    if ($result['code'] >= 400) {
        respond(['success' => false, 'error' => 'Could not save this mangrove area.'], 502);
    }

    $newId = $result['data'];
    // MPA manager isn't a param the create RPC knows about — set separately
    // with a direct table update right after. Best-effort: the area itself
    // is already saved by this point, so a failure here isn't fatal, just
    // leaves MPA manager blank until edited.
    if ($newId) {
        supabaseRequest('PATCH', '/rest/v1/mangrove_areas?id=eq.' . (int) $newId, ['mpa_manager' => $mpaManager]);
    }

    respond(['success' => true, 'id' => $newId]);
}

if ($action === 'update') {
    requireMenro();
    $id = $_POST['id'] ?? '';
    $geometry = $_POST['geometry'] ?? '';
    $name = trim($_POST['name'] ?? '');
    $barangay = trim($_POST['barangay'] ?? '');
    $mpaManager = trim($_POST['mpaManager'] ?? '');
    $category = trim($_POST['category'] ?? '');

    if (!ctype_digit((string) $id) || $geometry === '') {
        respond(['success' => false, 'error' => 'Invalid id or shape data.'], 400);
    }
    json_decode($geometry);
    if (json_last_error() !== JSON_ERROR_NONE) {
        respond(['success' => false, 'error' => 'Invalid shape data.'], 400);
    }

    $result = supabaseRequest('POST', '/rest/v1/rpc/update_mangrove_area', [
        'in_id'       => (int) $id,
        'in_name'     => $name,
        'in_barangay' => $barangay,
        'in_category' => in_array($category, CATEGORIES, true) ? $category : '',
        'in_geometry' => $geometry,
    ]);
    if ($result['code'] >= 400) {
        respond(['success' => false, 'error' => 'Could not save changes to this mangrove area.'], 502);
    }

    // Same reasoning as create — MPA manager lives outside the update RPC's
    // own params, so it's patched directly on the row.
    supabaseRequest('PATCH', '/rest/v1/mangrove_areas?id=eq.' . (int) $id, ['mpa_manager' => $mpaManager]);

    respond(['success' => true]);
}

if ($action === 'delete') {
    requireMenro();
    $id = $_POST['id'] ?? '';

    if (!ctype_digit((string) $id)) {
        respond(['success' => false, 'error' => 'Invalid id.'], 400);
    }

    $result = supabaseRequest('POST', '/rest/v1/rpc/delete_mangrove_area', ['in_id' => (int) $id]);
    if ($result['code'] >= 400) {
        respond(['success' => false, 'error' => 'Could not delete this mangrove area.'], 502);
    }

    respond(['success' => true]);
}

respond(['success' => false, 'error' => 'Unknown action.'], 400);
