<?php
declare(strict_types=1);
require_once __DIR__ . '/runtime-config.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

try {
    $appsScriptUrl = getAppsScriptUrl();
    if (!$appsScriptUrl) {
        throw new RuntimeException('not_configured');
    }

    $password = (string)($_GET['password'] ?? '');
    if ($password === '') throw new RuntimeException('Senha não informada.');

    $params = $_GET;
    unset($params['password']);
    $params['password'] = $password;
    $params['action'] = (string)($params['action'] ?? 'stats');
    $params['_t'] = time();

    $url = $appsScriptUrl . '?' . http_build_query($params);
    $response = httpRequest($url);
    http_response_code($response['status'] >= 200 && $response['status'] < 500 ? $response['status'] : 502);
    echo $response['body'];
} catch (Throwable $e) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
