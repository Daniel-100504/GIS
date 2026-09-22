<?php

require_once __DIR__ . '/../../Login/Database/db.php';

// Reads the stored ranger submissions out as { results: [ {...}, {...} ] } —
// every submission is created directly by submit-field-survey.php now
// (KoboToolbox is no longer part of this system), so this is a plain read
// of what's already in the table, no external sync involved.
function loadStoredSubmissions(PDO $pdo) {
    $rows = $pdo->query("SELECT raw_json, locally_edited, edited_at FROM ranger_submissions ORDER BY inspection_date DESC")
                ->fetchAll(PDO::FETCH_ASSOC);

    $results = array_map(function ($row) {
        $record = json_decode($row['raw_json'], true);
        $record['_locally_edited'] = (bool) $row['locally_edited'];
        $record['_edited_at'] = $row['edited_at'];
        return $record;
    }, $rows);

    return ['results' => $results, 'count' => count($results)];
}
