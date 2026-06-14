<?php
declare(strict_types=1);

/*
 * Estrutura reservada para o futuro rastreamento de vendas da Hotmart.
 * O endpoint nasce desligado e não registra vendas até que estes itens sejam concluídos:
 * 1. Definir HOTMART_TRACKING_ENABLED como true.
 * 2. Criar uma chave exclusiva em HOTMART_WEBHOOK_SECRET.
 * 3. Configurar o webhook da Hotmart com ?key=SUA_CHAVE.
 * 4. Validar os campos do payload conforme a versão do webhook usada na conta.
 */
const HOTMART_TRACKING_ENABLED = false;
const HOTMART_WEBHOOK_SECRET = '';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Método não permitido.'], JSON_UNESCAPED_UNICODE);
    exit;
}

if (!HOTMART_TRACKING_ENABLED) {
    http_response_code(503);
    echo json_encode(['ok' => false, 'disabled' => true, 'error' => 'Rastreamento de vendas desativado.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$receivedKey = (string)($_GET['key'] ?? '');
if (HOTMART_WEBHOOK_SECRET === '' || !hash_equals(HOTMART_WEBHOOK_SECRET, $receivedKey)) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Chave inválida.'], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $raw = file_get_contents('php://input') ?: '';
    $payload = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    $data = is_array($payload['data'] ?? null) ? $payload['data'] : $payload;
    $purchase = is_array($data['purchase'] ?? null) ? $data['purchase'] : [];
    $product = is_array($data['product'] ?? null) ? $data['product'] : [];
    $buyer = is_array($data['buyer'] ?? null) ? $data['buyer'] : [];
    $price = is_array($purchase['price'] ?? null) ? $purchase['price'] : [];

    $sale = [
        'timestamp' => (string)($payload['creation_date'] ?? $purchase['approved_date'] ?? date(DATE_ATOM)),
        'transaction' => (string)($purchase['transaction'] ?? ''),
        'status' => (string)($purchase['status'] ?? $payload['event'] ?? ''),
        'buyer_email_hash' => !empty($buyer['email']) ? hash('sha256', strtolower(trim((string)$buyer['email']))) : '',
        'product' => (string)($product['name'] ?? ''),
        'offer' => (string)($purchase['offer']['code'] ?? ''),
        'price' => (float)($price['value'] ?? 0),
        'currency' => (string)($price['currency_value'] ?? 'BRL'),
        'utm_source' => (string)($purchase['tracking']['source_sck'] ?? ''),
        'utm_campaign' => '',
        'raw' => $payload
    ];

    $appsScriptUrl = readAppsScriptUrl();
    if ($appsScriptUrl === '') throw new RuntimeException('Google Apps Script não configurado.');
    forwardJson($appsScriptUrl, ['type' => 'hotmart_sale', 'sale' => $sale]);
    echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}

function readAppsScriptUrl(): string
{
    $config = file_get_contents(dirname(__DIR__) . '/assets/js/config.js') ?: '';
    if (preg_match('/googleSheetsWebhookUrl\s*:\s*["\']([^"\']+)["\']/', $config, $match)) {
        $url = trim($match[1]);
        if (strpos($url, 'script.google.com/macros/s/') !== false && substr($url, -5) === '/exec') return $url;
    }
    return '';
}

function forwardJson(string $url, array $payload): void
{
    $body = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $context = stream_context_create(['http' => [
        'method' => 'POST',
        'header' => "Content-Type: text/plain;charset=UTF-8\r\n",
        'content' => $body,
        'timeout' => 15,
        'ignore_errors' => true
    ]]);
    $result = @file_get_contents($url, false, $context);
    if ($result === false) throw new RuntimeException('Falha ao encaminhar a venda.');
}
