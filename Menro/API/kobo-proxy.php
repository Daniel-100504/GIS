<?php

define('KOBO_TOKEN',    '4ef0ca6fea118509c9a9d067a3c5d267185f3ba9');
define('KOBO_FORM_UID', 'ar4Kip6AFkpybWVa9dkwBK');

header('Content-Type: application/json');

header('Access-Control-Allow-Origin: ' . ($_SERVER['HTTP_ORIGIN'] ?? $_SERVER['SERVER_NAME'] ?? 'localhost'));

$url = 'https://kf.kobotoolbox.org/api/v2/assets/' . KOBO_FORM_UID . '/data/?format=json';

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Token ' . KOBO_TOKEN
]);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
curl_setopt($ch, CURLOPT_TIMEOUT, 15);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($response === false || $httpCode !== 200) {
    http_response_code(502);
    echo json_encode(['error' => 'Failed to reach KoboToolbox API', 'code' => $httpCode]);
    exit;
}

echo $response;