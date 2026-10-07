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
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/zone-lookup.php';

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
    // Short timeout on purpose — this is a best-effort backup copy, not the
    // primary save (that already succeeded by the time this runs), so it's
    // not worth making the ranger wait long for it if Supabase is slow.
    curl_setopt($ch, CURLOPT_TIMEOUT, 3);
    curl_exec($ch);
    curl_close($ch);
}


$lat = isset($_POST['lat']) && $_POST['lat'] !== '' ? floatval($_POST['lat']) : null;
$lng = isset($_POST['lng']) && $_POST['lng'] !== '' ? floatval($_POST['lng']) : null;

$rangerName = trim((string) ($currentUser['fullName'] ?: $currentUser['username']));

$record = [
    'Ranger_Name'                          => $rangerName,
    'Inspection_Date'                      => $_POST['inspectionDate'] ?? date('Y-m-d'),
    'Record_your_current_location'         => ($lat !== null && $lng !== null) ? "{$lat} {$lng} 0 0" : '',
    'Estimated_Canopy_Cover_'              => $_POST['canopyCover'] ?? '',
    'Overall_Health_Assessment'            => $_POST['healthAssessment'] ?? '',
    'Observed_Threats'                     => $_POST['observedThreats'] ?? '',
    'Observed_Threats_Other'               => $_POST['observedThreatsOther'] ?? '',
    'Additional_Notes'                     => $_POST['additionalNotes'] ?? '',
    'Water_Clarity'                        => $_POST['waterClarity'] ?? '',
    'Water_Color'                          => $_POST['waterColor'] ?? '',
    'Odor'                                 => $_POST['odor'] ?? '',
    'Visible_Foam_or_Discharge'            => $_POST['foamDischarge'] ?? '',
    'Nearby_Aquafarm_Activity'             => $_POST['aquafarmActivity'] ?? '',
    'Aquafarm_Name'                        => $_POST['aquafarmName'] ?? '',
    'Aquafarm_Location_Lat'                => $_POST['aquafarmLat'] ?? '',
    'Aquafarm_Location_Lng'                => $_POST['aquafarmLng'] ?? '',
    'Aquafarm_Distance_m'                  => $_POST['aquafarmDistance'] ?? '',
    'Discharge_Toward_Mangroves'           => $_POST['dischargeTowardMangroves'] ?? '',
    'Salinity_ppt'                         => $_POST['salinity'] ?? '',
    'PH'                                   => $_POST['ph'] ?? '',
    'Water_Temperature_C'                  => $_POST['waterTemp'] ?? '',
    'Secchi_Depth_cm'                      => $_POST['secchiDepth'] ?? '',
    'Water_Quality_Notes'                  => $_POST['waterNotes'] ?? '',
];

// The Vegetation step now logs one row per species actually found in the
// plot (Species | Trees | Saplings | Seedlings) instead of a single fixed
// species — saved as a real repeat-group array so it displays and edits the
// same way a Kobo repeat-group submission already does, with no schema
// change needed (extractTrees() on the ranger/MENRO side already knows how
// to find and read any array-of-objects field on the record).
$speciesRows = json_decode($_POST['speciesRows'] ?? '[]', true);
if (is_array($speciesRows)) {
    $record['Species_Records'] = array_values(array_filter(array_map(function ($row) {
        if (!is_array($row) || empty($row['species'])) return null;
        return [
            'Species_Name'  => $row['species'],
            'Tree_Count'    => $row['treeCount'] ?? '',
            'Sapling_Count' => $row['saplingCount'] ?? '',
            'Seedling_Count' => $row['seedlingCount'] ?? '',
        ];
    }, $speciesRows)));
}

// Same idea for the Fauna step's mollusk table — its own separate
// repeat-group array, distinct from Species_Records so a species row and a
// mollusk row are never confused with each other. Species presence only,
// no count — mollusks are too small and numerous to count reliably in the
// field, unlike trees.
$molluskRows = json_decode($_POST['molluskRows'] ?? '[]', true);
if (is_array($molluskRows)) {
    $record['Mollusk_Records'] = array_values(array_filter(array_map(function ($row) {
        if (!is_array($row) || empty($row['species'])) return null;
        return ['Mollusk_Species_Name' => $row['species']];
    }, $molluskRows)));
}

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

$pdo = getDbConnection();
if ($lat !== null && $lng !== null) {
    $zone = nearestMangroveAreaZone($lat, $lng);
    if ($zone !== null) {
        $record['_zone_id']       = $zone['zoneId'];
        $record['_zone_name']     = $zone['name'];
        $record['_zone_barangay'] = $zone['barangay'];
    }
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
