<?php
declare(strict_types=1);
require_once __DIR__ . '/runtime-config.php';

/*
 * Proxy de rastreamento do Raio-X.
 * - Captura o IP no servidor.
 * - Envia apenas um hash do IP ao Google Sheets.
 * - Acrescenta localização aproximada quando disponível.
 * - Encaminha o payload ao Google Apps Script configurado em assets/js/config.js.
 */

const IP_HASH_SALT = '4658551bc7586fd6193b0dd208a9f01dc9831a95180336f11e6ddf27f60e60b0';

/*
 * OPCIONAL: cole um token do IPinfo para enriquecer a localização.
 * - IPinfo Lite: país e ASN.
 * - Planos com geolocalização: cidade, estado e fuso quando disponíveis.
 */
const IPINFO_TOKEN = 'd4e21cf9697fe9';
const GEO_CACHE_TTL = 2592000; // 30 dias

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('X-Content-Type-Options: nosniff');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Método não permitido.'], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $raw = file_get_contents('php://input') ?: '';
    $payload = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($payload)) {
        throw new RuntimeException('Payload inválido.');
    }

    $appsScriptUrl = getAppsScriptUrl();
    if (!$appsScriptUrl) {
        throw new RuntimeException('Google Apps Script não configurado. Entre no painel uma vez para importar a conexão anterior.');
    }

    $clientMeta = is_array($payload['client_meta'] ?? null) ? $payload['client_meta'] : [];
    unset($payload['client_meta']);

    $ip = detectClientIp();
    $visitorMeta = buildVisitorMeta($ip, $clientMeta);

    if (($payload['type'] ?? '') === 'session_snapshot') {
        $session = is_array($payload['session'] ?? null) ? $payload['session'] : [];
        $session['visitor_id'] = (string)($clientMeta['visitor_id'] ?? $session['visitor_id'] ?? $session['session_id'] ?? '');
        $session['session_id'] = $session['visitor_id'] ?: (string)($session['session_id'] ?? '');
        $session['visit_id'] = (string)($clientMeta['visit_id'] ?? $session['visit_id'] ?? '');
        $session['visit_started_at'] = (string)($clientMeta['visit_started_at'] ?? $session['visit_started_at'] ?? '');
        $session['visit_count'] = max((int)($clientMeta['visit_count'] ?? 1), (int)($session['visit_count'] ?? 1));
        $session['browser_timezone'] = (string)($clientMeta['browser_timezone'] ?? $session['browser_timezone'] ?? '');
        $session['browser_language'] = (string)($clientMeta['browser_language'] ?? $session['browser_language'] ?? '');
        $session = array_merge($session, $visitorMeta);
        $payload['session'] = $session;
    } elseif (($payload['type'] ?? '') === 'lead') {
        $payload['visitorId'] = (string)($clientMeta['visitor_id'] ?? $payload['visitorId'] ?? $payload['sessionId'] ?? '');
        $payload['visitId'] = (string)($clientMeta['visit_id'] ?? $payload['visitId'] ?? '');
        $payload['visitCount'] = max((int)($clientMeta['visit_count'] ?? 1), (int)($payload['visitCount'] ?? 1));
        $payload['visitor_meta'] = $visitorMeta;
    }

    $upstream = forwardJson($appsScriptUrl, $payload);
    $decoded = json_decode($upstream['body'], true);
    $ok = $upstream['status'] >= 200 && $upstream['status'] < 400 && (!is_array($decoded) || ($decoded['ok'] ?? true));

    http_response_code($ok ? 200 : 502);
    echo json_encode([
        'ok' => $ok,
        'visitor_meta' => $visitorMeta,
        'upstream_status' => $upstream['status'],
        'upstream' => is_array($decoded) ? $decoded : null,
        'error' => $ok ? null : (is_array($decoded) ? ($decoded['error'] ?? 'Falha no Google Apps Script.') : 'Falha no Google Apps Script.')
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Throwable $e) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}

function detectClientIp(): string
{
    $candidates = [];
    if (!empty($_SERVER['HTTP_CF_CONNECTING_IP'])) $candidates[] = $_SERVER['HTTP_CF_CONNECTING_IP'];
    if (!empty($_SERVER['HTTP_X_REAL_IP'])) $candidates[] = $_SERVER['HTTP_X_REAL_IP'];
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        foreach (explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']) as $part) $candidates[] = trim($part);
    }
    if (!empty($_SERVER['REMOTE_ADDR'])) $candidates[] = $_SERVER['REMOTE_ADDR'];

    foreach ($candidates as $candidate) {
        if (filter_var($candidate, FILTER_VALIDATE_IP)) return $candidate;
    }
    return '';
}

function buildVisitorMeta(string $ip, array $clientMeta): array
{
    $cached = is_array($clientMeta['cached_geo'] ?? null) ? $clientMeta['cached_geo'] : [];
    $meta = [
        'ip_hash' => $ip ? hash_hmac('sha256', $ip, IP_HASH_SALT) : '',
        'country_code' => serverValue(['HTTP_CF_IPCOUNTRY', 'GEOIP_COUNTRY_CODE']) ?: (string)($cached['country_code'] ?? ''),
        'country' => serverValue(['GEOIP_COUNTRY_NAME']) ?: (string)($cached['country'] ?? ''),
        'region' => serverValue(['GEOIP_REGION_NAME', 'GEOIP_REGION']) ?: (string)($cached['region'] ?? ''),
        'city' => serverValue(['GEOIP_CITY']) ?: (string)($cached['city'] ?? ''),
        'timezone' => (string)($cached['timezone'] ?? $clientMeta['browser_timezone'] ?? ''),
        'isp' => (string)($cached['isp'] ?? ''),
        'asn' => (string)($cached['asn'] ?? ''),
        'browser_timezone' => (string)($clientMeta['browser_timezone'] ?? ''),
        'browser_language' => (string)($clientMeta['browser_language'] ?? ''),
        'screen_width' => (string)($clientMeta['screen_width'] ?? ''),
        'screen_height' => (string)($clientMeta['screen_height'] ?? '')
    ];

    if ($ip && IPINFO_TOKEN !== '') {
        $geo = lookupIpInfo($ip);
        foreach ($geo as $key => $value) {
            if ($value !== '' && $value !== null) $meta[$key] = $value;
        }
    }

    return $meta;
}

function serverValue(array $keys): string
{
    foreach ($keys as $key) {
        if (!empty($_SERVER[$key])) return trim((string)$_SERVER[$key]);
    }
    return '';
}

function lookupIpInfo(string $ip): array
{
    $cacheDir = __DIR__ . '/.geo-cache';
    if (!is_dir($cacheDir)) {
        @mkdir($cacheDir, 0700, true);
        @file_put_contents($cacheDir . '/.htaccess', "Deny from all\n");
        @file_put_contents($cacheDir . '/index.html', '');
    }
    $cacheFile = $cacheDir . '/' . hash('sha256', $ip) . '.json';
    if (is_file($cacheFile) && (time() - filemtime($cacheFile)) < GEO_CACHE_TTL) {
        $cached = json_decode(file_get_contents($cacheFile) ?: '{}', true);
        if (is_array($cached)) return $cached;
    }

    $url = 'https://ipinfo.io/' . rawurlencode($ip) . '/json?token=' . rawurlencode(IPINFO_TOKEN);
    $result = httpGetJson($url);
    if (!$result) return [];

    $countryCode = (string)($result['country_code'] ?? $result['country'] ?? '');
    $countryName = (string)($result['country_name'] ?? '');
    $org = (string)($result['org'] ?? $result['as_name'] ?? '');
    $asn = '';
    if (preg_match('/^(AS\d+)/', $org, $m)) $asn = $m[1];
    if (!$asn) $asn = (string)($result['asn'] ?? '');

    $geo = [
        'country_code' => $countryCode,
        'country' => $countryName ?: $countryCode,
        'region' => (string)($result['region'] ?? ''),
        'city' => (string)($result['city'] ?? ''),
        'timezone' => (string)($result['timezone'] ?? ''),
        'isp' => $org,
        'asn' => $asn
    ];
    @file_put_contents($cacheFile, json_encode($geo, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    return $geo;
}

function httpGetJson(string $url): array
{
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_TIMEOUT => 5,
            CURLOPT_USERAGENT => 'MetodoRecupereQuiz/2.0'
        ]);
        $body = curl_exec($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);
        if ($status >= 200 && $status < 300 && is_string($body)) {
            $decoded = json_decode($body, true);
            return is_array($decoded) ? $decoded : [];
        }
        return [];
    }

    $context = stream_context_create(['http' => [
        'timeout' => 5,
        'header' => "User-Agent: MetodoRecupereQuiz/2.0\r\n"
    ]]);
    $body = @file_get_contents($url, false, $context);
    $decoded = is_string($body) ? json_decode($body, true) : null;
    return is_array($decoded) ? $decoded : [];
}

function forwardJson(string $url, array $payload): array
{
    $body = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($body === false) throw new RuntimeException('Falha ao serializar os dados.');

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_HTTPHEADER => ['Content-Type: text/plain;charset=UTF-8'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_USERAGENT => 'MetodoRecupereQuiz/2.0'
        ]);
        $response = curl_exec($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $error = curl_error($ch);
        curl_close($ch);
        if ($response === false) throw new RuntimeException('Falha ao encaminhar dados: ' . $error);
        return ['status' => $status, 'body' => (string)$response];
    }

    $context = stream_context_create(['http' => [
        'method' => 'POST',
        'header' => "Content-Type: text/plain;charset=UTF-8\r\n",
        'content' => $body,
        'timeout' => 15,
        'ignore_errors' => true
    ]]);
    $response = @file_get_contents($url, false, $context);
    $status = 200;
    if (!empty($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $m)) {
        $status = (int)$m[1];
    }
    if ($response === false) throw new RuntimeException('Falha ao encaminhar dados ao Google Apps Script.');
    return ['status' => $status, 'body' => (string)$response];
}
