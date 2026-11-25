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
    'Area_No'                              => $_POST['areaNo'] ?? '',
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

// The Vegetation step now logs one or more plots, each with its own species
// table (Species | Trees | Saplings | Seedlings) — matching the real MENRO
// sheet, where one visit can measure several numbered plots. Each plot's
// row becomes a real repeat-group entry the same way a Kobo repeat-group
// submission already works, nested under that plot.
function buildSpeciesRecords(array $speciesRows): array {
    return array_values(array_filter(array_map(function ($row) {
        if (!is_array($row) || empty($row['species'])) return null;
        return [
            'Tree_Code'      => $row['code'] ?? '',
            'Species_Name'   => $row['species'],
            'Tree_Count'     => $row['treeCount'] ?? '',
            'Sapling_Count'  => $row['saplingCount'] ?? '',
            'Seedling_Count' => $row['seedlingCount'] ?? '',
            'Height_m'       => $row['height'] ?? '',
            'GBH_cm'         => $row['gbh'] ?? '',
            'Canopy_Length_m' => $row['canopyLength'] ?? '',
            'Canopy_Width_m'  => $row['canopyWidth'] ?? '',
        ];
    }, $speciesRows)));
}

$plotsRaw = json_decode($_POST['plots'] ?? '[]', true);
$plotRecords = [];
if (is_array($plotsRaw)) {
    foreach ($plotsRaw as $plot) {
        if (!is_array($plot)) continue;
        $plotRecords[] = [
            'Plot_No'         => $plot['plotNo'] ?? '',
            'Plot_Size'       => $plot['plotSize'] ?? '',
            'Species_Records' => buildSpeciesRecords(is_array($plot['speciesRows'] ?? null) ? $plot['speciesRows'] : []),
        ];
    }
}
$record['Plot_Records'] = $plotRecords;

// Also kept flattened at the top level (every plot's trees merged into one
// list) — the dashboard's zone-wide stats, health derivation, and species
// charts all read this one array and were never written to know about
// individual plots, so this keeps them working unchanged.
$record['Species_Records'] = array_merge(...array_map(fn($p) => $p['Species_Records'], $plotRecords ?: [['Species_Records' => []]]));

// Same idea for the Fauna step's mollusk table — its own separate
// repeat-group array, distinct from Species_Records so a species row and a
// mollusk row are never confused with each other.
$molluskRows = json_decode($_POST['molluskRows'] ?? '[]', true);
if (is_array($molluskRows)) {
    $record['Mollusk_Records'] = array_values(array_filter(array_map(function ($row) {
        if (!is_array($row) || empty($row['species'])) return null;
        return ['Mollusk_Species_Name' => $row['species']];
    }, $molluskRows)));
}

// Photo upload — up to 5, stored as plain absolute URLs across separate
// fields (Photo_Documentation, Photo_Documentation_2, ...) so the existing
// generic "any field whose name contains photo/image/picture" lookup on the
// ranger side picks up every one of them automatically, with no changes
// needed there.
function storeUploadedMedia($file, string $prefix, array $allowedExt) {
    if (!isset($file['error']) || $file['error'] !== UPLOAD_ERR_OK) return null;
    $uploadsDir = __DIR__ . '/../data/uploads';
    if (!is_dir($uploadsDir)) mkdir($uploadsDir, 0775, true);

    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, $allowedExt, true)) return null;

    $filename = $prefix . '_' . bin2hex(random_bytes(8)) . '.' . $ext;
    $destPath = $uploadsDir . '/' . $filename;
    if (!move_uploaded_file($file['tmp_name'], $destPath)) return null;

    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'];
    // Derived from this script's own location instead of a hardcoded
    // "/GIS" — that only worked under the local XAMPP setup and broke
    // every media URL the moment the site was deployed at a domain's
    // root (Hostinger) instead of a /GIS subfolder.
    $basePath = preg_replace('#/Menro/API$#', '', dirname($_SERVER['SCRIPT_NAME']));
    return "{$scheme}://{$host}{$basePath}/Menro/data/uploads/{$filename}";
}

$photoKeys = ['photo', 'photo2', 'photo3', 'photo4', 'photo5'];
$photoFields = ['Photo_Documentation', 'Photo_Documentation_2', 'Photo_Documentation_3', 'Photo_Documentation_4', 'Photo_Documentation_5'];
foreach ($photoKeys as $i => $key) {
    if (!isset($_FILES[$key])) continue;
    $url = storeUploadedMedia($_FILES[$key], 'photo', ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']);
    if ($url) $record[$photoFields[$i]] = $url;
}

if (isset($_FILES['video'])) {
    $videoUrl = storeUploadedMedia($_FILES['video'], 'video', ['mp4', 'mov', 'webm', '3gp']);
    if ($videoUrl) $record['Video_Documentation'] = $videoUrl;
}

$pdo = getDbConnection();
if ($lat !== null && $lng !== null) {
    $zone = nearestMangroveAreaZone($lat, $lng);
    if ($zone !== null) {
        $record['_zone_id']       = $zone['zoneId'];
        $record['_zone_name']     = $zone['name'];
        $record['_zone_barangay'] = $zone['barangay'];
        $record['MPA_Manager']    = $zone['mpaManager'] ?? '';
    }
}
// No GPS match (or no GPS at all) means no mapped area to pull this from —
// MPA manager is MENRO's to set when they map the area, not the ranger's,
// so there's nothing to fall back to here.
if (!isset($record['MPA_Manager'])) {
    $record['MPA_Manager'] = '';
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
