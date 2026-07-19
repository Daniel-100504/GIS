<?php

define('CDSE_CLIENT_ID',     'sh-70f32f1b-d5f0-477e-8141-5271e145f2b1');
define('CDSE_CLIENT_SECRET', '4AIkqqYHJG5ZuMN1UmUzqRtNLZqfRhf9');
define('CDSE_INSTANCE_ID',   '3f1a0299-ea8a-45d6-a1a3-91684cb34b91');

define('CDSE_TOKEN_URL', 'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token');
define('CDSE_WMS_BASE',  'https://sh.dataspace.copernicus.eu/ogc/wms/' . CDSE_INSTANCE_ID);
define('CDSE_STATS_URL', 'https://sh.dataspace.copernicus.eu/api/v1/statistics');
define('TOKEN_CACHE_FILE', __DIR__ . '/.cdse_token_cache.json');

header('Access-Control-Allow-Origin: ' . ($_SERVER['HTTP_ORIGIN'] ?? $_SERVER['SERVER_NAME'] ?? 'localhost'));

function circlePolygon($lat, $lng, $radiusMeters, $sides = 24) {
    $coords = [];
    $latRad = deg2rad($lat);
    $metersPerDegLat = 111320;
    $metersPerDegLng = 111320 * cos($latRad);

    for ($i = 0; $i <= $sides; $i++) {
        $theta = 2 * M_PI * $i / $sides;
        $dLat = ($radiusMeters * sin($theta)) / $metersPerDegLat;
        $dLng = ($radiusMeters * cos($theta)) / $metersPerDegLng;
        $coords[] = [$lng + $dLng, $lat + $dLat];
    }

    return ['type' => 'Polygon', 'coordinates' => [$coords]];
}

function getAccessToken() {
    if (file_exists(TOKEN_CACHE_FILE)) {
        $cache = json_decode(file_get_contents(TOKEN_CACHE_FILE), true);
        if ($cache && !empty($cache['access_token']) && $cache['expires_at'] > time() + 30) {
            return $cache['access_token'];
        }
    }

    $ch = curl_init(CDSE_TOKEN_URL);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
        'grant_type'    => 'client_credentials',
        'client_id'     => CDSE_CLIENT_ID,
        'client_secret' => CDSE_CLIENT_SECRET,
    ]));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/x-www-form-urlencoded']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);
    $response = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($response === false || $code !== 200) {
        http_response_code(502);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Failed to authenticate with Copernicus Data Space Ecosystem', 'code' => $code]);
        exit;
    }

    $data = json_decode($response, true);
    @file_put_contents(TOKEN_CACHE_FILE, json_encode([
        'access_token' => $data['access_token'],
        'expires_at'   => time() + intval($data['expires_in']) - 30,
    ]));

    return $data['access_token'];
}

$mode = $_GET['mode'] ?? 'wms';

if ($mode === 'wms') {
    $token = getAccessToken();

    $params = $_GET;
    unset($params['mode']);
    $url = CDSE_WMS_BASE . '?' . http_build_query($params);

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Authorization: Bearer ' . $token]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    $body = curl_exec($ch);
    $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE) ?: 'image/png';
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($body === false || $httpCode >= 400) {
        http_response_code(502);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'WMS tile request failed', 'code' => $httpCode]);
        exit;
    }

    header('Content-Type: ' . $contentType);
    header('Cache-Control: public, max-age=3600');
    echo $body;
    exit;
}

if ($mode === 'ndvi') {
    header('Content-Type: application/json');

    $lat    = floatval($_GET['lat'] ?? 0);
    $lng    = floatval($_GET['lng'] ?? 0);
    $radius = floatval($_GET['radius'] ?? 300); // meters
    $to     = $_GET['date'] ?? date('Y-m-d');
    $from   = date('Y-m-d', strtotime($to . ' -15 days'));

    if (!$lat || !$lng) {
        http_response_code(400);
        echo json_encode(['error' => 'lat and lng are required']);
        exit;
    }

    $evalscript = <<<'EVAL'
//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B08", "dataMask"] }],
    output: [
      { id: "ndvi", bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1 }
    ]
  };
}
function evaluatePixel(s) {
  let ndvi = (s.B08 - s.B04) / (s.B08 + s.B04 + 0.0001);
  return { ndvi: [ndvi], dataMask: [s.dataMask] };
}
EVAL;

    $payload = [
        'input' => [
            'bounds' => [
                'geometry'   => circlePolygon($lat, $lng, $radius),
                'properties' => ['crs' => 'http://www.opengis.net/def/crs/OGC/1.3/CRS84'],
            ],
            'data' => [[
                'type'       => 'sentinel-2-l2a',
                'dataFilter' => [
                    'timeRange'        => ['from' => "{$from}T00:00:00Z", 'to' => "{$to}T23:59:59Z"],
                    'maxCloudCoverage' => 40,
                ],
            ]],
        ],
        'aggregation' => [
            'timeRange'           => ['from' => "{$from}T00:00:00Z", 'to' => "{$to}T23:59:59Z"],
            'aggregationInterval' => ['of' => 'P15D'],
            'evalscript'          => $evalscript,
            'resx'                => 10,
            'resy'                => 10,
        ],
    ];

    $token = getAccessToken();
    $ch = curl_init(CDSE_STATS_URL);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $token,
        'Content-Type: application/json',
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 25);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($response === false || $httpCode !== 200) {
        http_response_code(502);
        echo json_encode(['error' => 'Statistics API request failed', 'code' => $httpCode, 'detail' => $response]);
        exit;
    }

    $data  = json_decode($response, true);
    $stats = $data['data'][0]['outputs']['ndvi']['bands']['B0']['stats'] ?? null;
    $mean  = null;
    if ($stats && $stats['sampleCount'] > $stats['noDataCount']) {
        $mean = round($stats['mean'], 3);
    }

    echo json_encode(['ndvi' => $mean, 'from' => $from, 'to' => $to, 'raw' => $stats]);
    exit;
}

http_response_code(400);
header('Content-Type: application/json');
echo json_encode(['error' => 'Unknown mode']);