<?php

session_start();

header('Content-Type: application/json');

$allowedRoles = ['ranger', 'menro', 'admin'];
if (!isset($_SESSION['user']) || !in_array($_SESSION['user']['role'], $allowedRoles, true)) {
    http_response_code(401);
    echo json_encode(['error' => 'Not authorized.']);
    exit;
}
$currentUser = $_SESSION['user'];
session_write_close();

require_once __DIR__ . '/ranger-submissions-store.php';
require_once __DIR__ . '/config.php';

// Removes the matching backup row from Supabase too, so a deleted submission
// doesn't stay behind forever in the backup copy. Best-effort: the local
// delete has already happened by the time this runs, so a Supabase hiccup
// here doesn't block the actual delete the user asked for.
function deleteFromSupabase(int $localId) {
    $ch = curl_init(SUPABASE_URL . '/rest/v1/ranger_submissions?local_id=eq.' . $localId);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'DELETE');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'apikey: ' . SUPABASE_SECRET_KEY,
        'Authorization: Bearer ' . SUPABASE_SECRET_KEY,
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 8);
    curl_exec($ch);
    curl_close($ch);
}

$action = $_GET['action'] ?? ($_POST['action'] ?? 'list');

if ($action === 'delete') {
    $submissionId = $_GET['id'] ?? ($_POST['id'] ?? null);

    if ($submissionId === null || $submissionId === '' || !ctype_digit(ltrim((string) $submissionId, '-'))) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing or invalid submission id']);
        exit;
    }

    $pdo = getDbConnection();
    $stmt = $pdo->prepare("DELETE FROM ranger_submissions WHERE kobo_id = :id");
    $stmt->execute(['id' => $submissionId]);
    deleteFromSupabase((int) $submissionId);
    echo json_encode(['success' => true, 'id' => $submissionId]);
    exit;
}

if ($action === 'updateFields') {
    $submissionId = $_POST['id'] ?? null;

    if ($submissionId === null || $submissionId === '' || !ctype_digit(ltrim((string) $submissionId, '-'))) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing or invalid submission id']);
        exit;
    }

    // Only these fields can be changed here — the ones the ranger dashboard
    // actually displays. Identity fields (barangay, ranger, date, GPS) stay
    // fixed, since changing those would mean the record belongs somewhere else.
    $editableFields = [
        'Nearby_Aquafarm_Activity'                => $_POST['aquafarm']         ?? null,
        'Aquafarm_Name_if_Discharge_Observed'      => $_POST['aquafarmName']     ?? null,
        'Water_Quality_Notes'                      => $_POST['waterNotes']       ?? null,
        'Observed_Threats'                         => $_POST['observedThreats'] ?? null,
        'Additional_Notes'                         => $_POST['additionalNotes'] ?? null,
        'Water_Color'                              => $_POST['waterColor']      ?? null,
        'Odor'                                     => $_POST['odor']            ?? null,
        'Visible_Foam_or_Discharge'                => $_POST['foamDischarge']   ?? null,
    ];

    $pdo = getDbConnection();

    $stmt = $pdo->prepare("SELECT raw_json FROM ranger_submissions WHERE kobo_id = :id");
    $stmt->execute(['id' => $submissionId]);
    $rawJson = $stmt->fetchColumn();

    if ($rawJson === false) {
        http_response_code(404);
        echo json_encode(['error' => 'Submission not found']);
        exit;
    }

    $record = json_decode($rawJson, true);

    if ($currentUser['role'] === 'ranger') {
        $ownName = mb_strtolower(trim((string) ($currentUser['fullName'] ?: $currentUser['username'])));
        $recordRanger = mb_strtolower(trim((string) ($record['Ranger_Name'] ?? '')));
        if ($recordRanger !== $ownName) {
            http_response_code(403);
            echo json_encode(['error' => 'You can only edit your own submissions']);
            exit;
        }
    }

    foreach ($editableFields as $field => $value) {
        if ($value !== null && $value !== '') {
            $record[$field] = $value;
        }
    }

    // A replacement photo is optional — most edits don't touch it, and the
    // existing one (if any) stays untouched unless a new file is uploaded.
    if (isset($_FILES['photo']) && $_FILES['photo']['error'] === UPLOAD_ERR_OK) {
        $uploadsDir = __DIR__ . '/../data/uploads';
        if (!is_dir($uploadsDir)) mkdir($uploadsDir, 0775, true);

        $ext = strtolower(pathinfo($_FILES['photo']['name'], PATHINFO_EXTENSION));
        $allowedExt = ['jpg', 'jpeg', 'png', 'webp'];
        if (in_array($ext, $allowedExt, true)) {
            $filename = 'photo_' . bin2hex(random_bytes(8)) . '.' . $ext;
            $destPath = $uploadsDir . '/' . $filename;
            if (move_uploaded_file($_FILES['photo']['tmp_name'], $destPath)) {
                $oldPhoto = $record['Photo_Documentation'] ?? '';
                $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
                $host = $_SERVER['HTTP_HOST'];
                $record['Photo_Documentation'] = "{$scheme}://{$host}/GIS/Menro/data/uploads/{$filename}";

                // Clean up the file it's replacing, if it lived in our own uploads folder.
                if ($oldPhoto && strpos($oldPhoto, '/Menro/data/uploads/') !== false) {
                    $oldFile = $uploadsDir . '/' . basename($oldPhoto);
                    if (is_file($oldFile)) @unlink($oldFile);
                }
            }
        }
    }

    // An empty aquafarm name is normally skipped above (empty usually just
    // means "leave this field alone"), but when the ranger sets aquafarm
    // activity to a non-active state an empty name is deliberate — clear out
    // any name left over from when it was previously active, instead of
    // leaving it stale.
    $aquafarmVal = (string) ($_POST['aquafarm'] ?? '');
    if ($aquafarmVal !== '' && strpos($aquafarmVal, 'active') !== 0) {
        $record['Aquafarm_Name_if_Discharge_Observed'] = '';
    }

    // Tree Measurements can arrive two ways: as a real repeat-group array
    // (once "Repeat this group" is on) or as flat top-level fields (a single
    // tree, repeat not triggered). Both are handled generically here instead
    // of assuming one shape, since the form can be in either state.
    $treesInput = json_decode($_POST['trees'] ?? '[]', true);
    if (is_array($treesInput) && count($treesInput) > 0) {
        $fieldMap = [
            'species'         => 'Species_Name',
            'height'          => 'Average_Tree_Height_m',
            'gbh'             => 'GBH_Girth_at_Breast_Height_cm',
            'canopyLength'    => 'Canopy_Length_m',
            'canopyWidth'     => 'Canopy_Width_m',
            'canopyCover'     => 'Estimated_Canopy_Cover_',
            'treeCount'       => 'Tree_Count',
            'healthAssessment' => 'Overall_Health_Assessment',
            'molluskSpecies'  => 'Mollusk_Species_Name',
            'molluskCount'    => 'Mollusk_Count',
            'seedlingSpecies' => 'Seedling_Species',
            'seedlingCount'   => 'Seedling_Count',
            'saplingSpecies'  => 'Sapling_Species',
            'saplingCount'    => 'Sapling_Count',
        ];

        // Find the repeat-group array, if this record has one, by the same
        // generic "array of objects" test used elsewhere in the codebase.
        $arrayKey = null;
        foreach ($record as $k => $v) {
            if (is_array($v) && count($v) > 0 && is_array($v[0] ?? null)) {
                $arrayKey = $k;
                break;
            }
        }

        if ($arrayKey !== null) {
            // Preserve whatever key-prefix style the original entries used
            // (e.g. "GroupName/Tree_code" vs plain "Tree_code").
            $prefix = '';
            foreach (array_keys($record[$arrayKey][0]) as $sampleKey) {
                if (strpos($sampleKey, '/') !== false) {
                    $prefix = substr($sampleKey, 0, strrpos($sampleKey, '/') + 1);
                    break;
                }
            }
            $newArray = [];
            foreach ($treesInput as $t) {
                $entry = [];
                foreach ($fieldMap as $inKey => $koboKey) {
                    $entry[$prefix . $koboKey] = $t[$inKey] ?? '';
                }
                $newArray[] = $entry;
            }
            $record[$arrayKey] = $newArray;
        } else {
            // No repeat array on this record — it's a flat single tree.
            $t = $treesInput[0];
            foreach ($fieldMap as $inKey => $koboKey) {
                if (isset($t[$inKey]) && $t[$inKey] !== '') {
                    $record[$koboKey] = $t[$inKey];
                }
            }
        }
    }

    $update = $pdo->prepare(
        "UPDATE ranger_submissions
         SET raw_json = :raw_json, locally_edited = 1, edited_at = NOW()
         WHERE kobo_id = :id"
    );
    $update->execute([
        'raw_json' => json_encode($record),
        'id'       => $submissionId,
    ]);

    echo json_encode(['success' => true, 'record' => $record]);
    exit;
}

$pdo = getDbConnection();
$data = loadStoredSubmissions($pdo);

if ($currentUser['role'] === 'ranger') {
    $ownName = trim((string) ($currentUser['fullName'] ?: $currentUser['username']));
    $ownNameLower = mb_strtolower($ownName);

    $data['results'] = array_values(array_filter($data['results'], function ($record) use ($ownNameLower) {
        foreach ($record as $key => $value) {
            $shortKey = mb_strtolower(trim(substr($key, strrpos($key, '/') !== false ? strrpos($key, '/') + 1 : 0)));
            if ($shortKey === 'ranger_name') {
                return mb_strtolower(trim((string) $value)) === $ownNameLower;
            }
        }
        return false;
    }));
    $data['count'] = count($data['results']);
}

echo json_encode($data);
