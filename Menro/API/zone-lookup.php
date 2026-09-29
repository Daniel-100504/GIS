<?php

// Matches a GPS point to the nearest field-mapped mangrove or protected
// area. Shared by the actual submission save (which tags the record with
// this same match) and the ranger's live "which zone am I in" preview on
// the Submit Field Data form, so both always agree on the same answer.
function nearestMangroveAreaZone(float $lat, float $lng) {
    $ch = curl_init(SUPABASE_URL . '/rest/v1/rpc/nearest_mangrove_area');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['in_lat' => $lat, 'in_lng' => $lng]));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'apikey: ' . SUPABASE_SECRET_KEY,
        'Authorization: Bearer ' . SUPABASE_SECRET_KEY,
        'Content-Type: application/json',
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 8);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($response === false || $httpCode >= 400) return null;

    $rows = json_decode($response, true);
    $best = $rows[0] ?? null;
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

// Ray-casting point-in-polygon test. $ring is the outer ring of a GeoJSON
// polygon, an array of [lng, lat] pairs.
function pointInPolygon(float $lat, float $lng, array $ring) {
    $inside = false;
    $n = count($ring);
    for ($i = 0, $j = $n - 1; $i < $n; $j = $i++) {
        $xi = $ring[$i][0]; $yi = $ring[$i][1];
        $xj = $ring[$j][0]; $yj = $ring[$j][1];
        $intersect = (($yi > $lat) !== ($yj > $lat))
            && ($lng < ($xj - $xi) * ($lat - $yi) / ($yj - $yi) + $xi);
        if ($intersect) $inside = !$inside;
    }
    return $inside;
}

function nearestVertexDistanceMeters(float $lat, float $lng, array $ring) {
    $min = INF;
    foreach ($ring as $pt) {
        $d = haversineMeters($lat, $lng, $pt[1], $pt[0]);
        if ($d < $min) $min = $d;
    }
    return $min;
}

// Same nearest-zone match, but also says how far the ranger actually is
// from that zone's mapped boundary — the plain match above always returns
// *some* zone, even from a hundred kilometers away, which reads as "you're
// nearby" when really nothing is. Used only for the ranger's live on-screen
// preview; the submission's own zone tag is unaffected.
function nearestMangroveAreaZoneWithDistance(float $lat, float $lng) {
    $zone = nearestMangroveAreaZone($lat, $lng);
    if ($zone === null) return null;

    $zoneRowId = (int) str_replace('field-', '', $zone['zoneId']);
    $ch = curl_init(SUPABASE_URL . '/rest/v1/mangrove_areas_geojson?select=coordinates&id=eq.' . $zoneRowId);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'apikey: ' . SUPABASE_SECRET_KEY,
        'Authorization: Bearer ' . SUPABASE_SECRET_KEY,
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 8);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $zone['distanceMeters'] = null;
    $zone['inside'] = false;

    if ($response !== false && $httpCode < 400) {
        $rows = json_decode($response, true);
        $ring = $rows[0]['coordinates']['coordinates'][0] ?? null;
        if (is_array($ring)) {
            $inside = pointInPolygon($lat, $lng, $ring);
            $zone['inside'] = $inside;
            $zone['distanceMeters'] = $inside ? 0 : round(nearestVertexDistanceMeters($lat, $lng, $ring));
        }
    }

    return $zone;
}
