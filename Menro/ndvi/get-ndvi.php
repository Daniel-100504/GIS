<?php
/**
 * get-ndvi.php
 * Serves the latest satellite-derived NDVI readings to satellite.js.
 * update_ndvi.py writes ndvi_data.json on its own schedule (Task
 * Scheduler); this file just reads and re-serves it — same pattern
 * as kobo-proxy.php reading from KoboToolbox.
 *
 * Place this file (and ndvi_data.json, kept updated by the Python
 * script) in the same folder as your other PHP files.
 */

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *"); // tighten this to your own domain before going live

$path = __DIR__ . "/ndvi_data.json";

if (!file_exists($path)) {
    http_response_code(503);
    echo json_encode([
        "error" => "NDVI data not generated yet — run update_ndvi.py at least once."
    ]);
    exit;
}

$raw = file_get_contents($path);
$data = json_decode($raw, true);

if ($data === null) {
    http_response_code(500);
    echo json_encode(["error" => "ndvi_data.json is corrupted."]);
    exit;
}

// Warn the frontend if the data is stale (e.g. Task Scheduler stopped
// running, or every recent Sentinel-2 pass was too cloudy).
$generatedAt = strtotime($data["generated_at"] ?? "");
$ageHours = $generatedAt ? (time() - $generatedAt) / 3600 : null;
$data["stale"] = $ageHours !== null && $ageHours > 48;

echo json_encode($data);
