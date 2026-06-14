<?php
declare(strict_types=1);
require_once __DIR__ . '/runtime-config.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method_not_allowed']);
    exit;
}

try {
    $payload = json_decode(file_get_contents('php://input') ?: '{}', true, 512, JSON_THROW_ON_ERROR);
    $url = trim((string)($payload['appsScriptUrl'] ?? ''));
    $password = (string)($payload['password'] ?? '');

    if (!isValidAppsScriptUrl($url)) throw new RuntimeException('URL do Apps Script inválida.');
    if ($password === '') throw new RuntimeException('Senha não informada.');

    $testUrl = $url . '?' . http_build_query([
        'action' => 'stats',
        'password' => $password,
        '_t' => time()
    ]);
    $response = httpRequest($testUrl);
    $decoded = json_decode($response['body'], true);

    if ($response['status'] < 200 || $response['status'] >= 400 || !is_array($decoded) || ($decoded['ok'] ?? false) !== true) {
        $error = is_array($decoded) ? (string)($decoded['error'] ?? 'Falha na validação.') : 'Resposta inválida do Apps Script.';
        throw new RuntimeException($error === 'unauthorized' ? 'Senha incorreta.' : $error);
    }

    if (!writeRuntimeConfig([
        'appsScriptUrl' => $url,
        'updatedAt' => gmdate('c')
    ])) {
        throw new RuntimeException('Não foi possível salvar a configuração no servidor.');
    }

    echo json_encode(['ok' => true, 'configured' => true], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
