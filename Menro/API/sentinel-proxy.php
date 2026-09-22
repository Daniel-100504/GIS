<?php

session_start();

$allowedRoles = ['menro', 'admin'];
if (!isset($_SESSION['user']) || !in_array($_SESSION['user']['role'], $allowedRoles, true)) {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Not authorized.']);
    exit;
}
session_write_close();

require_once __DIR__ . '/config.php';

define('CDSE_TOKEN_URL', 'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token');
define('CDSE_WMS_BASE',  'https://sh.dataspace.copernicus.eu/ogc/wms/' . CDSE_INSTANCE_ID);
define('CDSE_STATS_URL', 'https://sh.dataspace.copernicus.eu/api/v1/statistics');
define('TOKEN_CACHE_FILE', __DIR__ . '/.cdse_token_cache.json');

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
    $params = $_GET;
    unset($params['mode']);

    // The stock Sentinel Hub "NDVI" preset layer uses a red/yellow/green
    // ramp. Swapping in this custom evalscript instead — Sentinel Hub's own
    // official public NDVI color script — matches the dark-green-for-dense-
    // vegetation look their own Copernicus Browser shows by default.
    if (($params['layers'] ?? '') === 'NDVI_CUSTOM') {
        // WMS still requires a LAYERS param even with a custom evalscript
        // (it just gets overridden) — any existing configured layer works here.
        $params['layers'] = 'TRUE_COLOR';
        $ndviEvalscript = <<<'EVAL'
//VERSION=3
const ramp = [
  [-0.5, 0x0c0c0c],
  [-0.2, 0xbfbfbf],
  [-0.1, 0xdbdbdb],
  [0, 0xeaeaea],
  [0.025, 0xfff9cc],
  [0.05, 0xede8b5],
  [0.075, 0xddd89b],
  [0.1, 0xccc682],
  [0.125, 0xbcb76b],
  [0.15, 0xafc160],
  [0.175, 0xa3cc59],
  [0.2, 0x91bf51],
  [0.25, 0x7fb247],
  [0.3, 0x70a33f],
  [0.35, 0x609635],
  [0.4, 0x4f892d],
  [0.45, 0x3f7c23],
  [0.5, 0x306d1c],
  [0.55, 0x216011],
  [0.6, 0x0f540a],
  [1, 0x004400],
];
const visualizer = new ColorRampVisualizer(ramp);
function setup() {
  return {
    input: ["B04", "B08", "dataMask"],
    output: { bands: 4 }
  };
}
function evaluatePixel(samples) {
  let ndvi = index(samples.B08, samples.B04);
  let imgVals = visualizer.process(ndvi);
  return imgVals.concat(samples.dataMask);
}
EVAL;
        $params['evalscript'] = base64_encode($ndviEvalscript);
    }

    ksort($params);

    $tileCacheDir = __DIR__ . '/tile-cache';
    if (!is_dir($tileCacheDir)) {
        @mkdir($tileCacheDir, 0775, true);
    }
    $cacheKey  = md5(http_build_query($params));
    $cacheFile = "{$tileCacheDir}/{$cacheKey}.tile";
    $cacheMeta = "{$cacheFile}.meta";
    $cacheTtl  = 86400; // tiles for a given bbox/date/layer don't change; safe to keep a day

    if (is_file($cacheFile) && is_file($cacheMeta) && (time() - filemtime($cacheFile)) < $cacheTtl) {
        header('Content-Type: ' . trim(file_get_contents($cacheMeta)));
        header('Cache-Control: public, max-age=3600');
        header('X-Tile-Cache: HIT');
        readfile($cacheFile);
        exit;
    }

    $token = getAccessToken();
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

    @file_put_contents($cacheFile, $body);
    @file_put_contents($cacheMeta, $contentType);

    header('Content-Type: ' . $contentType);
    header('Cache-Control: public, max-age=3600');
    header('X-Tile-Cache: MISS');
    echo $body;
    exit;
}

if ($mode === 'ndvi') {
    header('Content-Type: application/json');

    $lat    = floatval($_GET['lat'] ?? 0);
    $lng    = floatval($_GET['lng'] ?? 0);
    $radius = floatval($_GET['radius'] ?? 300); 
    $to     = $_GET['date'] ?? date('Y-m-d');
    $windowDays = 30;
    $from   = date('Y-m-d', strtotime($to . " -{$windowDays} days"));
    $maxcc  = isset($_GET['maxcc']) ? floatval($_GET['maxcc']) : 50;

    if (!$lat || !$lng) {
        http_response_code(400);
        echo json_encode(['error' => 'lat and lng are required']);
        exit;
    }

    // A drawn field-mapped area's exact boundary, when given, is sampled
    // directly instead of an approximate circle — a circle around a coastal
    // area's center can include nearby water or mud, which swings the
    // reading in ways that have nothing to do with the mangrove itself.
    $geometry = null;
    $geometryJson = $_GET['geometry'] ?? null;
    if ($geometryJson) {
        $decoded = json_decode($geometryJson, true);
        if (is_array($decoded) && isset($decoded['type'], $decoded['coordinates'])) {
            $geometry = $decoded;
        }
    }
    if ($geometry === null) {
        $geometry = circlePolygon($lat, $lng, $radius);
    }

    // The area below is described in plain lat/lng degrees (CRS84), so a pixel
    // size given as a bare number is read in DEGREES, not meters — passing "10"
    // here previously meant "10 degrees" (about 1,100km), turning the whole
    // sampling area into a single oversized, meaningless pixel. Converting the
    // real 10m target size into degrees at this latitude fixes that.
    $targetMeters = 10;
    $resy = $targetMeters / 111320;
    $resx = $targetMeters / (111320 * cos(deg2rad($lat)));

    $evalscript = <<<'EVAL'
//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B08", "SCL", "dataMask"] }],
    output: [
      { id: "ndvi", bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1 }
    ]
  };
}
// Sentinel-2's own per-pixel scene classification (SCL) — used to drop
// cloud, cloud-shadow, thin-cirrus, snow, and no-data pixels from the
// average, not just whole scenes. A scene's overall cloud percentage can't
// tell us whether THIS specific small area was actually clear, since the
// clouds counted in that percentage might be somewhere else in the scene.
// 0=no data, 1=saturated/defective, 3=cloud shadow, 8/9=cloud, 10=thin cirrus, 11=snow
function isClearPixel(scl) {
  return scl !== 0 && scl !== 1 && scl !== 3 && scl !== 8 && scl !== 9 && scl !== 10 && scl !== 11;
}
function evaluatePixel(s) {
  const clear = s.dataMask === 1 && isClearPixel(s.SCL);
  let ndvi = (s.B08 - s.B04) / (s.B08 + s.B04 + 0.0001);
  return { ndvi: [ndvi], dataMask: [clear ? 1 : 0] };
}
EVAL;

    $payload = [
        'input' => [
            'bounds' => [
                'geometry'   => $geometry,
                'properties' => ['crs' => 'http://www.opengis.net/def/crs/OGC/1.3/CRS84'],
            ],
            'data' => [[
                'type'       => 'sentinel-2-l2a',
                'dataFilter' => [
                    'timeRange'        => ['from' => "{$from}T00:00:00Z", 'to' => "{$to}T23:59:59Z"],
                    'maxCloudCoverage' => $maxcc,
                ],
            ]],
        ],
        'aggregation' => [
            'timeRange'           => ['from' => "{$from}T00:00:00Z", 'to' => "{$to}T23:59:59Z"],
            'aggregationInterval' => ['of' => "P{$windowDays}D"],
            'evalscript'          => $evalscript,
            'resx'                => $resx,
            'resy'                => $resy,
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

if ($mode === 'catalog') {
    header('Content-Type: application/json');

    $month = $_GET['month'] ?? date('Y-m');
    $maxcc = isset($_GET['maxcc']) ? floatval($_GET['maxcc']) : 50;

    if (!preg_match('/^\d{4}-\d{2}$/', $month)) {
        http_response_code(400);
        echo json_encode(['error' => 'month must be in YYYY-MM format']);
        exit;
    }

    $monthStart = $month . '-01';
    $monthEnd   = date('Y-m-t', strtotime($monthStart));

    $bbox = [120.595, 13.745, 120.685, 13.945];

    $payload = [
        'bbox'        => $bbox,
        'datetime'    => "{$monthStart}T00:00:00Z/{$monthEnd}T23:59:59Z",
        'collections' => ['sentinel-2-l2a'],
        'limit'       => 100,
        'filter'      => "eo:cloud_cover <= {$maxcc}",
        'filter-lang' => 'cql2-text',
    ];

    $token = getAccessToken();
    $ch = curl_init('https://sh.dataspace.copernicus.eu/api/v1/catalog/1.0.0/search');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $token,
        'Content-Type: application/json',
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($response === false || $httpCode !== 200) {
        http_response_code(502);
        echo json_encode(['error' => 'Catalog search failed', 'code' => $httpCode, 'detail' => $response]);
        exit;
    }

    $data = json_decode($response, true);

    $truncated = isset($data['context']['returned'], $data['context']['matched'])
        && $data['context']['returned'] < $data['context']['matched'];

    $dates = [];
    foreach (($data['features'] ?? []) as $feature) {
        $props = $feature['properties'] ?? [];
        $dt    = $props['datetime'] ?? null;
        $cc    = $props['eo:cloud_cover'] ?? ($props['cloudCover'] ?? null);
        if (!$dt) continue;

        $day = substr($dt, 0, 10);
        if (!isset($dates[$day]) || ($cc !== null && $cc < $dates[$day])) {
            $dates[$day] = $cc;
        }
    }

    echo json_encode(['month' => $month, 'maxcc' => $maxcc, 'dates' => $dates, 'truncated' => $truncated]);
    exit;
}

http_response_code(400);
header('Content-Type: application/json');
echo json_encode(['error' => 'Unknown mode']);