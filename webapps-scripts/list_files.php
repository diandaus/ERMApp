<?php
// list_files.php — dipanggil ERMApp backend (peruri_dokumen_handler.go)
// utk fitur "Lihat Dokumen" Peruri di mode REMOTE (backend & webapps beda
// server). Taruh file ini di ROOT webapps, SATU FOLDER dengan upload.php
// yang sudah ada di produksi (pola pemakaian query param "doc" sama persis).
//
// Contoh panggilan: GET /list_files.php?doc=berkasrawat/pages/upload/

header('Content-Type: application/json');

$doc = isset($_GET['doc']) ? $_GET['doc'] : '';
$dir = rtrim($doc, '/');

if ($dir === '' || strpos($dir, '..') !== false) {
    http_response_code(400);
    echo json_encode(['error' => 'Parameter doc tidak valid']);
    exit;
}

if (!is_dir($dir)) {
    http_response_code(404);
    echo json_encode(['error' => 'Folder tidak ditemukan: ' . $dir]);
    exit;
}

$files = [];
foreach (scandir($dir) as $name) {
    if ($name === '.' || $name === '..' || strcasecmp($name, 'index.php') === 0) {
        continue;
    }
    $path = $dir . '/' . $name;
    if (is_dir($path)) {
        continue;
    }
    $files[] = [
        'name' => $name,
        'size' => filesize($path),
        'modified_at' => date('Y-m-d H:i:s', filemtime($path)),
    ];
}

echo json_encode(['files' => $files]);
