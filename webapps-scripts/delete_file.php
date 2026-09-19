<?php
// delete_file.php — dipanggil ERMApp backend (peruri_dokumen_handler.go)
// utk fitur "Lihat Dokumen" Peruri (tombol Hapus) di mode REMOTE (backend &
// webapps beda server). Taruh file ini di ROOT webapps, SATU FOLDER dengan
// upload.php yang sudah ada di produksi.
//
// Contoh panggilan: POST /delete_file.php?doc=berkasrawat/pages/upload/&name=xxx.pdf

header('Content-Type: application/json');

$doc = isset($_GET['doc']) ? $_GET['doc'] : '';
$name = isset($_GET['name']) ? $_GET['name'] : '';
$dir = rtrim($doc, '/');

if ($dir === '' || strpos($dir, '..') !== false || $name === '' || strpos($name, '/') !== false || strpos($name, '..') !== false) {
    http_response_code(400);
    echo json_encode(['error' => 'Parameter tidak valid']);
    exit;
}

if (strcasecmp($name, 'index.php') === 0) {
    http_response_code(400);
    echo json_encode(['error' => 'File ini tidak boleh dihapus']);
    exit;
}

$path = $dir . '/' . $name;

if (!file_exists($path)) {
    http_response_code(404);
    echo json_encode(['error' => 'File tidak ditemukan']);
    exit;
}

if (unlink($path)) {
    echo json_encode(['success' => true]);
} else {
    http_response_code(500);
    echo json_encode(['error' => 'Gagal menghapus file']);
}
