<?php
declare(strict_types=1);

function runtimeConfigPath(): string
{
    return __DIR__ . '/.runtime-config.json';
}

function isValidAppsScriptUrl(string $url): bool
{
    return $url !== ''
        && strpos($url, 'https://script.google.com/macros/s/') === 0
        && substr($url, -5) === '/exec';
}

function readRuntimeConfig(): array
{
    $path = runtimeConfigPath();
    if (!is_file($path)) return [];
    $decoded = json_decode(file_get_contents($path) ?: '{}', true);
    return is_array($decoded) ? $decoded : [];
}

function writeRuntimeConfig(array $config): bool
{
    $path = runtimeConfigPath();
    $json = json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) return false;

    $htaccess = __DIR__ . '/.htaccess';
    if (!is_file($htaccess)) {
        @file_put_contents($htaccess, "<Files \".runtime-config.json\">\n  Require all denied\n</Files>\n");
    }

    return @file_put_contents($path, $json, LOCK_EX) !== false;
}

function readAppsScriptUrlFromJs(): string
{
    $configPath = dirname(__DIR__) . '/assets/js/config.js';
    if (!is_file($configPath)) return '';
    $contents = file_get_contents($configPath) ?: '';
    if (preg_match('/googleSheetsWebhookUrl\s*:\s*["\']([^"\']+)["\']/', $contents, $match)) {
        $url = trim($match[1]);
        return isValidAppsScriptUrl($url) ? $url : '';
    }
    return '';
}

function getAppsScriptUrl(): string
{
    $runtime = readRuntimeConfig();
    $runtimeUrl = trim((string)($runtime['appsScriptUrl'] ?? ''));
    if (isValidAppsScriptUrl($runtimeUrl)) return $runtimeUrl;
    return readAppsScriptUrlFromJs();
}

function httpRequest(string $url, string $method = 'GET', ?string $body = null, array $headers = []): array
{
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        $options = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 20,
            CURLOPT_USERAGENT => 'MetodoRecupereAdmin/2.0'
        ];
        if ($method !== 'GET') {
            $options[CURLOPT_CUSTOMREQUEST] = $method;
            $options[CURLOPT_POSTFIELDS] = $body ?? '';
        }
        if ($headers) $options[CURLOPT_HTTPHEADER] = $headers;
        curl_setopt_array($ch, $options);
        $response = curl_exec($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $error = curl_error($ch);
        curl_close($ch);
        if ($response === false) throw new RuntimeException('Falha de conexão: ' . $error);
        return ['status' => $status, 'body' => (string)$response];
    }

    $headerText = $headers ? implode("\r\n", $headers) . "\r\n" : '';
    $context = stream_context_create(['http' => [
        'method' => $method,
        'header' => $headerText,
        'content' => $body ?? '',
        'timeout' => 20,
        'ignore_errors' => true
    ]]);
    $response = @file_get_contents($url, false, $context);
    $status = 200;
    if (!empty($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $m)) {
        $status = (int)$m[1];
    }
    if ($response === false) throw new RuntimeException('Falha de conexão com o Google Apps Script.');
    return ['status' => $status, 'body' => (string)$response];
}
