<?php

require_once __DIR__ . '/../../Login/Database/session-init.php';

header('Content-Type: application/json');

// admin is account-management only, not an operator role — it never gets
// review/approval authority over field survey data, the same as it can't
// see this data's own map page (satellite.php only lets 'menro' load at all).
$allowedRoles = ['ranger', 'menro'];
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

// Keeps the Supabase backup copy's raw_json in step with an edit made here —
// without this, Supabase would keep showing the submission exactly as it was
// first submitted, forever missing anything changed later. Best-effort, same
// as deleteFromSupabase: the local save already succeeded by the time this
// runs, so a Supabase hiccup here doesn't fail the edit the user asked for.
function updateSupabaseRecord(int $localId, array $record) {
    $ch = curl_init(SUPABASE_URL . '/rest/v1/ranger_submissions?local_id=eq.' . $localId);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PATCH');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['raw_json' => $record]));
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

$action = $_GET['action'] ?? ($_POST['action'] ?? 'list');

if ($action === 'delete') {
    $submissionId = $_GET['id'] ?? ($_POST['id'] ?? null);

    if ($submissionId === null || $submissionId === '' || !ctype_digit(ltrim((string) $submissionId, '-'))) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing or invalid submission id']);
        exit;
    }

    $pdo = getDbConnection();

    if ($currentUser['role'] === 'ranger') {
        $check = $pdo->prepare("SELECT raw_json, approval_status FROM ranger_submissions WHERE kobo_id = :id");
        $check->execute(['id' => $submissionId]);
        $row = $check->fetch(PDO::FETCH_ASSOC);

        if ($row === false) {
            http_response_code(404);
            echo json_encode(['error' => 'Submission not found']);
            exit;
        }

        // A ranger can only ever delete their own submissions — without this,
        // any logged-in ranger could delete another ranger's survey just by
        // knowing or guessing its id.
        $record = json_decode($row['raw_json'], true);
        $ownName = mb_strtolower(trim((string) ($currentUser['fullName'] ?: $currentUser['username'])));
        $recordRanger = mb_strtolower(trim((string) ($record['Ranger_Name'] ?? '')));
        if ($recordRanger !== $ownName) {
            http_response_code(403);
            echo json_encode(['error' => 'You can only delete your own submissions']);
            exit;
        }

        // Same reasoning as the edit lock: once MENRO has approved a
        // submission it's the official reviewed record, so the ranger who
        // submitted it shouldn't be able to erase it unilaterally. Enforced
        // here since the UI's own disabled button is only a client-side hint.
        if ($row['approval_status'] === 'approved') {
            http_response_code(403);
            echo json_encode(['error' => 'This submission has already been verified and can\'t be deleted. Contact MENRO if a correction is needed.']);
            exit;
        }
    }

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
        'Aquafarm_Name'                             => $_POST['aquafarmName']     ?? null,
        'Aquafarm_Location_Lat'                     => $_POST['aquafarmLat']      ?? null,
        'Aquafarm_Location_Lng'                     => $_POST['aquafarmLng']      ?? null,
        'Aquafarm_Distance_m'                       => $_POST['aquafarmDistance'] ?? null,
        'Discharge_Toward_Mangroves'                => $_POST['dischargeTowardMangroves'] ?? null,
        'Water_Quality_Notes'                      => $_POST['waterNotes']       ?? null,
        'Observed_Threats'                         => $_POST['observedThreats'] ?? null,
        'Observed_Threats_Other'                    => $_POST['observedThreatsOther'] ?? null,
        'Additional_Notes'                         => $_POST['additionalNotes'] ?? null,
        'Water_Clarity'                              => $_POST['waterClarity']    ?? null,
        'Water_Color'                              => $_POST['waterColor']      ?? null,
        'Odor'                                     => $_POST['odor']            ?? null,
        'Visible_Foam_or_Discharge'                => $_POST['foamDischarge']   ?? null,
        'Salinity_ppt'                               => $_POST['salinity']        ?? null,
        'PH'                                         => $_POST['ph']             ?? null,
        'Water_Temperature_C'                        => $_POST['waterTemp']       ?? null,
        'Secchi_Depth_cm'                            => $_POST['secchiDepth']     ?? null,
        'Area_No'                                   => $_POST['areaNo']          ?? null,
        'Overall_Health_Assessment'                => $_POST['healthAssessment'] ?? null,
    ];

    $pdo = getDbConnection();

    $stmt = $pdo->prepare("SELECT raw_json, approval_status FROM ranger_submissions WHERE kobo_id = :id");
    $stmt->execute(['id' => $submissionId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($row === false) {
        http_response_code(404);
        echo json_encode(['error' => 'Submission not found']);
        exit;
    }

    $record = json_decode($row['raw_json'], true);

    if ($currentUser['role'] === 'ranger') {
        $ownName = mb_strtolower(trim((string) ($currentUser['fullName'] ?: $currentUser['username'])));
        $recordRanger = mb_strtolower(trim((string) ($record['Ranger_Name'] ?? '')));
        if ($recordRanger !== $ownName) {
            http_response_code(403);
            echo json_encode(['error' => 'You can only edit your own submissions']);
            exit;
        }
        // Once MENRO has approved a submission it's the official record of
        // what was reviewed — a silent edit afterward would invalidate that
        // approval without MENRO ever knowing. Locked in the UI too, but
        // enforced here since the UI's own lock is only a client-side hint.
        if ($row['approval_status'] === 'approved') {
            http_response_code(403);
            echo json_encode(['error' => 'This submission has already been verified and can\'t be edited. Contact MENRO if a correction is needed.']);
            exit;
        }
    }

    foreach ($editableFields as $field => $value) {
        if ($value !== null && $value !== '') {
            $record[$field] = $value;
        }
    }

    // A replacement photo/video is optional — most edits don't touch them,
    // and the existing ones stay untouched unless a new file is uploaded
    // for that same slot.
    function storeUploadedMediaForEdit($file, string $prefix, array $allowedExt) {
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

    $uploadsDir = __DIR__ . '/../data/uploads';
    $photoKeys = ['photo', 'photo2', 'photo3', 'photo4', 'photo5'];
    $photoFields = ['Photo_Documentation', 'Photo_Documentation_2', 'Photo_Documentation_3', 'Photo_Documentation_4', 'Photo_Documentation_5'];
    foreach ($photoKeys as $i => $key) {
        if (!isset($_FILES[$key])) continue;
        $url = storeUploadedMediaForEdit($_FILES[$key], 'photo', ['jpg', 'jpeg', 'png', 'webp']);
        if (!$url) continue;
        $oldPhoto = $record[$photoFields[$i]] ?? '';
        $record[$photoFields[$i]] = $url;
        if ($oldPhoto && strpos($oldPhoto, '/Menro/data/uploads/') !== false) {
            $oldFile = $uploadsDir . '/' . basename($oldPhoto);
            if (is_file($oldFile)) @unlink($oldFile);
        }
    }

    if (isset($_FILES['video'])) {
        $videoUrl = storeUploadedMediaForEdit($_FILES['video'], 'video', ['mp4', 'mov', 'webm', '3gp']);
        if ($videoUrl) {
            $oldVideo = $record['Video_Documentation'] ?? '';
            $record['Video_Documentation'] = $videoUrl;
            if ($oldVideo && strpos($oldVideo, '/Menro/data/uploads/') !== false) {
                $oldFile = $uploadsDir . '/' . basename($oldVideo);
                if (is_file($oldFile)) @unlink($oldFile);
            }
        }
    }

    // An empty aquafarm follow-up field is normally skipped above (empty
    // usually just means "leave this field alone"), but when the ranger
    // switches the answer back to No, any name/location/distance/discharge
    // left over from when it was Yes is now stale and gets cleared instead
    // of lingering.
    $aquafarmVal = (string) ($_POST['aquafarm'] ?? '');
    if ($aquafarmVal !== '' && $aquafarmVal !== 'yes') {
        $record['Aquafarm_Name'] = '';
        $record['Aquafarm_Location_Lat'] = '';
        $record['Aquafarm_Location_Lng'] = '';
        $record['Aquafarm_Distance_m'] = '';
        $record['Discharge_Toward_Mangroves'] = '';
    }

    // Rebuilds one of this record's repeat-group arrays (Species_Records or
    // Mollusk_Records) from the wizard's row data. Named explicitly rather
    // than found by a generic "first array of objects" scan, since a record
    // can now hold both arrays at once and a generic scan could easily grab
    // the wrong one.
    function rebuildRepeatGroup(array &$record, string $arrayKey, array $rowsInput, array $fieldMap) {
        if (!is_array($rowsInput) || count($rowsInput) === 0) return;

        // Preserve whatever key-prefix style the original entries used
        // (e.g. "GroupName/Species_Name" vs plain "Species_Name"), and fall
        // back to this exact key name for a record that doesn't have it yet
        // (a brand new array, or a legacy record predating this feature).
        $prefix = '';
        if (!empty($record[$arrayKey][0])) {
            foreach (array_keys($record[$arrayKey][0]) as $sampleKey) {
                if (strpos($sampleKey, '/') !== false) {
                    $prefix = substr($sampleKey, 0, strrpos($sampleKey, '/') + 1);
                    break;
                }
            }
        }
        $newArray = [];
        foreach ($rowsInput as $row) {
            if (empty($row['species'])) continue;
            $entry = [];
            foreach ($fieldMap as $inKey => $koboKey) {
                $entry[$prefix . $koboKey] = $row[$inKey] ?? '';
            }
            $newArray[] = $entry;
        }
        $record[$arrayKey] = $newArray;
    }

    // Rebuilds every plot the ranger edited — each plot keeps its own
    // Species_Records list, matching how the survey now groups species by
    // the numbered plot they were found in.
    $plotsRaw = json_decode($_POST['plots'] ?? '[]', true);
    if (is_array($plotsRaw) && count($plotsRaw) > 0) {
        $speciesFieldMap = [
            'species'       => 'Species_Name',
            'code'          => 'Tree_Code',
            'treeCount'     => 'Tree_Count',
            'saplingCount'  => 'Sapling_Count',
            'seedlingCount' => 'Seedling_Count',
            'height'        => 'Height_m',
            'gbh'           => 'GBH_cm',
            'canopyLength'  => 'Canopy_Length_m',
            'canopyWidth'   => 'Canopy_Width_m',
        ];
        $plotRecords = [];
        foreach ($plotsRaw as $plot) {
            if (!is_array($plot)) continue;
            $speciesRows = is_array($plot['speciesRows'] ?? null) ? $plot['speciesRows'] : [];
            $speciesEntries = [];
            foreach ($speciesRows as $speciesRow) {
                if (empty($speciesRow['species'])) continue;
                $entry = [];
                foreach ($speciesFieldMap as $inKey => $koboKey) {
                    $entry[$koboKey] = $speciesRow[$inKey] ?? '';
                }
                $speciesEntries[] = $entry;
            }
            $plotRecords[] = [
                'Plot_No'         => $plot['plotNo'] ?? '',
                'Plot_Size'       => $plot['plotSize'] ?? '',
                'Species_Records' => $speciesEntries,
            ];
        }
        $record['Plot_Records'] = $plotRecords;
        // Also kept flattened at the top level — the dashboard's zone-wide
        // stats and species charts read this one array and don't know about
        // individual plots, so this keeps them working unchanged.
        $record['Species_Records'] = array_merge(...array_map(fn($p) => $p['Species_Records'], $plotRecords ?: [['Species_Records' => []]]));
    }

    rebuildRepeatGroup($record, 'Mollusk_Records', json_decode($_POST['molluskRows'] ?? '[]', true), [
        'species' => 'Mollusk_Species_Name',
    ]);

    // A resubmitted revision needs a fresh look from MENRO, same as a
    // resent government form or a pull request pushed after "changes
    // requested" — it goes back into the review queue instead of staying
    // parked under its old rejection, which nothing would otherwise clear.
    $backToPending = $row['approval_status'] === 'rejected';

    $update = $pdo->prepare(
        "UPDATE ranger_submissions
         SET raw_json = :raw_json, locally_edited = 1, edited_at = NOW()"
        . ($backToPending ? ", approval_status = 'pending', reviewed_at = NULL, reviewed_by = NULL, review_notes = NULL" : "")
        . " WHERE kobo_id = :id"
    );
    $update->execute([
        'raw_json' => json_encode($record),
        'id'       => $submissionId,
    ]);

    updateSupabaseRecord((int) $submissionId, $record);

    echo json_encode([
        'success'         => true,
        'record'          => $record,
        'approval_status' => $backToPending ? 'pending' : $row['approval_status'],
    ]);
    exit;
}

if ($action === 'approve' || $action === 'reject') {
    if ($currentUser['role'] !== 'menro') {
        http_response_code(403);
        echo json_encode(['error' => 'Only MENRO can review submissions.']);
        exit;
    }

    $submissionId = $_POST['id'] ?? null;
    if ($submissionId === null || $submissionId === '' || !ctype_digit(ltrim((string) $submissionId, '-'))) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing or invalid submission id']);
        exit;
    }

    $pdo = getDbConnection();
    $stmt = $pdo->prepare("SELECT raw_json, approval_status FROM ranger_submissions WHERE kobo_id = :id");
    $stmt->execute(['id' => $submissionId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($row === false) {
        http_response_code(404);
        echo json_encode(['error' => 'Submission not found']);
        exit;
    }
    $record = json_decode($row['raw_json'], true);

    // Already approved — nothing left to do. The UI itself disables the
    // Approve button once a submission reaches this state, but this is
    // enforced here too so a duplicate "approved" notification can't reach
    // the ranger a second time from a stray direct request.
    if ($action === 'approve' && $row['approval_status'] === 'approved') {
        echo json_encode(['success' => true, 'id' => $submissionId, 'approval_status' => 'approved']);
        exit;
    }

    $newStatus = $action === 'approve' ? 'approved' : 'rejected';
    $reviewerName = trim((string) ($currentUser['fullName'] ?: $currentUser['username']));
    // Only meaningful on a rejection — MENRO can optionally explain what
    // needs fixing, but Approve never shows this field in the first place.
    $reviewNotes = trim((string) ($_POST['notes'] ?? ''));

    $update = $pdo->prepare(
        "UPDATE ranger_submissions
         SET approval_status = :status, reviewed_at = NOW(), reviewed_by = :reviewer, review_notes = :notes
         WHERE kobo_id = :id"
    );
    $update->execute([
        'status'   => $newStatus,
        'reviewer' => $reviewerName,
        'notes'    => $reviewNotes !== '' ? $reviewNotes : null,
        'id'       => $submissionId,
    ]);

    // The ranger only learns about this through their own notification bell
    // (polled from the ranger app), never a push of any kind — a plain row
    // here is all that's needed for that poll to pick it up. Zone/date are
    // stored as their own columns (not baked into one message string) so the
    // ranger app can render title + subtitle the same way MENRO's own bell
    // does, instead of one long wrapped sentence.
    if ($record && !empty($record['Ranger_Name'])) {
        $areaLabel = $record['_zone_name'] ?? ($record['Protected_area_Zone'] ?? ($record['Barangay'] ?? 'Unknown zone'));
        $areaLabel = str_replace('_', ' ', (string) $areaLabel);
        $dateLabel = $record['Inspection_Date'] ?? '';
        $message = $newStatus === 'approved' ? 'Your survey was verified' : 'Your survey needs revision';

        $notif = $pdo->prepare(
            "INSERT INTO ranger_notifications (kobo_id, ranger_name, message, status, zone_name, inspection_date, notes)
             VALUES (:kobo_id, :ranger_name, :message, :status, :zone_name, :inspection_date, :notes)"
        );
        $notif->execute([
            'kobo_id'         => $submissionId,
            'ranger_name'     => $record['Ranger_Name'],
            'message'         => $message,
            'status'          => $newStatus,
            'zone_name'       => $areaLabel,
            'inspection_date' => $dateLabel,
            'notes'           => $reviewNotes !== '' ? $reviewNotes : null,
        ]);
    }

    echo json_encode(['success' => true, 'id' => $submissionId, 'approval_status' => $newStatus]);
    exit;
}

// Clears a flagged survey off MENRO's active Threats & Alerts board once
// someone has actually looked into it — a separate flag from the survey's
// own approval status, since reviewing a threat and approving the data
// quality of the survey that reported it are two different things.
if ($action === 'markAlertReviewed') {
    if ($currentUser['role'] !== 'menro') {
        http_response_code(403);
        echo json_encode(['error' => 'Only MENRO can review alerts.']);
        exit;
    }

    $submissionId = $_POST['id'] ?? null;
    if ($submissionId === null || $submissionId === '' || !ctype_digit(ltrim((string) $submissionId, '-'))) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing or invalid submission id']);
        exit;
    }

    $pdo = getDbConnection();
    $reviewerName = trim((string) ($currentUser['fullName'] ?: $currentUser['username']));
    $update = $pdo->prepare(
        "UPDATE ranger_submissions
         SET alert_reviewed = 1, alert_reviewed_at = NOW(), alert_reviewed_by = :reviewer
         WHERE kobo_id = :id"
    );
    $update->execute([
        'reviewer' => $reviewerName,
        'id'       => $submissionId,
    ]);

    echo json_encode(['success' => true, 'id' => $submissionId]);
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
