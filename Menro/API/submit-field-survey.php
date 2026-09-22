<?php

session_start();

header('Content-Type: application/json');

if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'ranger') {
    http_response_code(401);
    echo json_encode(['error' => 'Not authorized.']);
    exit;
}
$currentUser = $_SESSION['user'];
session_write_close();

require_once __DIR__ . '/../../Login/Database/db.php';
require_once __DIR__ . '/config.php';

// Sends a copy of the finished submission to Supabase — a plain data store
// with no form or UI of its own, so the ranger never sees or interacts with
// it. Best-effort: if this fails (network hiccup, Supabase down), the
// submission is still safely saved in the main database above; this is only
// a backup copy, not the primary save.
function backupToSupabase(array $record, int $localId) {
    $payload = [
        'local_id'         => $localId,
        'ranger_name'      => $record['Ranger_Name'] ?? null,
        'inspection_date'  => $record['Inspection_Date'] ?? null,
        'barangay'         => $record['_zone_barangay'] ?? null,
        'zone_name'        => $record['_zone_name'] ?? null,
        'raw_json'         => $record,
    ];

    $ch = curl_init(SUPABASE_URL . '/rest/v1/ranger_submissions');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'apikey: ' . SUPABASE_SECRET_KEY,
        'Authorization: Bearer ' . SUPABASE_SECRET_KEY,
        'Content-Type: application/json',
        'Prefer: return=minimal',
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 8);
    curl_exec($ch);
    curl_close($ch);
}

// Matches this submission's GPS point to the nearest field-mapped mangrove
// or protected area, so it shows up attached to a zone on the map.
function nearestMangroveAreaZone(PDO $pdo, float $lat, float $lng) {
    $rows = $pdo->query(
        "SELECT id, name, barangay, coordinates FROM mangrove_areas WHERE category IN ('mangrove', 'protected_area')"
    )->fetchAll(PDO::FETCH_ASSOC);

    $best = null;
    $bestDist = null;

    foreach ($rows as $row) {
        $geo = json_decode($row['coordinates'], true);
        $ring = $geo['coordinates'][0] ?? null;
        if (!is_array($ring) || count($ring) === 0) continue;

        $lngSum = 0;
        $latSum = 0;
        foreach ($ring as $point) {
            $lngSum += $point[0];
            $latSum += $point[1];
        }
        $centroidLng = $lngSum / count($ring);
        $centroidLat = $latSum / count($ring);

        $dist = haversineMeters($lat, $lng, $centroidLat, $centroidLng);
        if ($bestDist === null || $dist < $bestDist) {
            $bestDist = $dist;
            $best = $row;
        }
    }

    if ($best === null) return null;

    return [
        'zoneId'   => 'field-' . $best['id'],
        'name'     => $best['name'],
        'barangay' => $best['barangay'],
    ];
}

function haversineMeters(float $lat1, float $lng1, float $lat2, float $lng2) {
    $earthRadius = 6371000;
    $dLat = deg2rad($lat2 - $lat1);
    $dLng = deg2rad($lng2 - $lng1);
    $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;
    return $earthRadius * 2 * atan2(sqrt($a), sqrt(1 - $a));
}

$lat = isset($_POST['lat']) && $_POST['lat'] !== '' ? floatval($_POST['lat']) : null;
$lng = isset($_POST['lng']) && $_POST['lng'] !== '' ? floatval($_POST['lng']) : null;

$rangerName = trim((string) ($currentUser['fullName'] ?: $currentUser['username']));

$record = [
    'Ranger_Name'                          => $rangerName,
    'Inspection_Date'                      => $_POST['inspectionDate'] ?? date('Y-m-d'),
    'Record_your_current_location'         => ($lat !== null && $lng !== null) ? "{$lat} {$lng} 0 0" : '',
    'Canopy_Length_m'                      => $_POST['canopyLength'] ?? '',
    'Canopy_Width_m'                       => $_POST['canopyWidth'] ?? '',
    'Estimated_Canopy_Cover_'              => $_POST['canopyCover'] ?? '',
    'Species_Name'                         => $_POST['speciesName'] ?? '',
    'Tree_Count'                           => $_POST['treeCount'] ?? '',
    'Average_Tree_Height_m'                => $_POST['avgHeight'] ?? '',
    'GBH_Girth_at_Breast_Height_cm'        => $_POST['gbh'] ?? '',
    'Seedling_Species'                     => $_POST['seedlingSpecies'] ?? '',
    'Seedling_Count'                       => $_POST['seedlingCount'] ?? '',
    'Sapling_Species'                      => $_POST['saplingSpecies'] ?? '',
    'Sapling_Count'                        => $_POST['saplingCount'] ?? '',
    'Overall_Health_Assessment'            => $_POST['healthAssessment'] ?? '',
    'Mollusk_Species_Name'                 => $_POST['molluskSpecies'] ?? '',
    'Mollusk_Count'                        => $_POST['molluskCount'] ?? '',
    'Observed_Threats'                     => $_POST['observedThreats'] ?? '',
    'Additional_Notes'                     => $_POST['additionalNotes'] ?? '',
    'Water_Color'                          => $_POST['waterColor'] ?? '',
    'Odor'                                 => $_POST['odor'] ?? '',
    'Visible_Foam_or_Discharge'            => $_POST['foamDischarge'] ?? '',
    'Nearby_Aquafarm_Activity'             => $_POST['aquafarmActivity'] ?? '',
    'Aquafarm_Name_if_Discharge_Observed'  => $_POST['aquafarmName'] ?? '',
    'Water_Quality_Notes'                  => $_POST['waterNotes'] ?? '',
];

// Photo upload — stored as a plain absolute URL so the existing photo
// display logic (which only recognizes a value starting with http/https)
// can show it without needing any changes on its end.
if (isset($_FILES['photo']) && $_FILES['photo']['error'] === UPLOAD_ERR_OK) {
    $uploadsDir = __DIR__ . '/../data/uploads';
    if (!is_dir($uploadsDir)) mkdir($uploadsDir, 0775, true);

    $ext = strtolower(pathinfo($_FILES['photo']['name'], PATHINFO_EXTENSION));
    $allowedExt = ['jpg', 'jpeg', 'png', 'webp'];
    if (in_array($ext, $allowedExt, true)) {
        $filename = 'photo_' . bin2hex(random_bytes(8)) . '.' . $ext;
        $destPath = $uploadsDir . '/' . $filename;
        if (move_uploaded_file($_FILES['photo']['tmp_name'], $destPath)) {
            $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
            $host = $_SERVER['HTTP_HOST'];
            $record['Photo_Documentation'] = "{$scheme}://{$host}/GIS/Menro/data/uploads/{$filename}";
        }
    }
}

if ($lat !== null && $lng !== null) {
    $pdo = getDbConnection();
    $zone = nearestMangroveAreaZone($pdo, $lat, $lng);
    if ($zone !== null) {
        $record['_zone_id']       = $zone['zoneId'];
        $record['_zone_name']     = $zone['name'];
        $record['_zone_barangay'] = $zone['barangay'];
    }
} else {
    $pdo = getDbConnection();
}

// Kobo IDs are large positive integers, so a negative one can never collide —
// this submission never touched Kobo, so it needs its own kind of ID.
$koboId = -1 * time();
$record['_id'] = $koboId;
$record['_uuid'] = bin2hex(random_bytes(16));
$record['_submission_time'] = date('c');
$record['_status'] = 'submitted_natively';

$insert = $pdo->prepare(
    "INSERT INTO ranger_submissions (kobo_id, uuid, barangay, inspection_date, raw_json)
     VALUES (:kobo_id, :uuid, :barangay, :inspection_date, :raw_json)"
);

try {
    $insert->execute([
        'kobo_id'         => $koboId,
        'uuid'            => $record['_uuid'],
        'barangay'        => $record['_zone_barangay'] ?? null,
        'inspection_date' => $record['Inspection_Date'],
        'raw_json'        => json_encode($record),
    ]);
} catch (PDOException $e) {
    // Extremely unlikely (two submissions in the same second), but retry
    // once with a slightly different id rather than fail the ranger's report.
    $koboId -= 1;
    $record['_id'] = $koboId;
    $insert->execute([
        'kobo_id'         => $koboId,
        'uuid'            => $record['_uuid'],
        'barangay'        => $record['_zone_barangay'] ?? null,
        'inspection_date' => $record['Inspection_Date'],
        'raw_json'        => json_encode($record),
    ]);
}

backupToSupabase($record, $koboId);

echo json_encode(['success' => true, 'id' => $koboId]);
