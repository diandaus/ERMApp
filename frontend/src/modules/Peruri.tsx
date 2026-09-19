import React from 'react';
import Swal from 'sweetalert2';
import { AkunPeruriView } from './AkunPeruri';

// Peruri.tsx — shell sidebar modul Bridging Peruri (integrasi TTE/e-meterai
// PERURI), dibuka fullscreen dari Bridging.tsx (persis pola BridgingBpjsView/
// SatuSehatView — <PeruriView onBack={...}> dibungkus position:fixed inset:0
// di Bridging.tsx). Tahap ini BARU shell (Dashboard + Lihat Dokumen +
// Pengaturan), menu lain menyusul.

// LihatDokumenSection — daftar file dibaca LANGSUNG dari folder server
// webapps (bukan dari tabel DB manapun — ERMApp tidak mencatat riwayat
// auto-upload TTE sendiri, lihat komentar downloadPeruriDocument di
// peruri_handler.go), lewat GET /api/peruri/dokumen/list. Cuma didukung
// mode LOKAL server webapps (backend & webapps satu server); mode remote
// dibalas error jelas oleh backend.
type PeruriDokumenFile = { name: string; size: number; modified_at: string; url: string };

const FOLDER_OPTIONS: { key: string; label: string }[] = [
  { key: 'berkasrawat', label: 'Berkas Rawat (hasil TTE Lab/Radiologi)' },
  { key: 'radiologi', label: 'Radiologi' },
];

const formatUkuran = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const LihatDokumenSection: React.FC = () => {
  const [folder, setFolder] = React.useState('berkasrawat');
  const [search, setSearch] = React.useState('');
  const [files, setFiles] = React.useState<PeruriDokumenFile[]>([]);
  const [dir, setDir] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [deletingName, setDeletingName] = React.useState<string | null>(null);

  const fetchFiles = React.useCallback(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ folder });
    if (search.trim()) params.set('search', search.trim());
    fetch(`/api/peruri/dokumen/list?${params}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal memuat daftar file');
        setFiles(Array.isArray(data.files) ? data.files : []);
        setDir(data.dir || '');
      })
      .catch((err) => { setFiles([]); setError(err instanceof Error ? err.message : 'Terjadi kesalahan'); })
      .finally(() => setLoading(false));
  }, [folder, search]);

  React.useEffect(() => {
    const t = setTimeout(fetchFiles, 300);
    return () => clearTimeout(t);
  }, [fetchFiles]);

  const handleHapus = async (name: string) => {
    const result = await Swal.fire({
      icon: 'warning', title: 'Hapus File?',
      html: `File <b>${name}</b> akan dihapus permanen dari server webapps.`,
      showCancelButton: true, confirmButtonColor: '#dc2626', cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Hapus', cancelButtonText: 'Batal',
    });
    if (!result.isConfirmed) return;
    setDeletingName(name);
    try {
      const params = new URLSearchParams({ folder, name });
      const res = await fetch(`/api/peruri/dokumen?${params}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus file');
      setFiles((prev) => prev.filter((f) => f.name !== name));
      Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'File dihapus', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setDeletingName(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%', minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', background: '#fff' }}
        >
          {FOLDER_OPTIONS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
        <input
          type="text"
          placeholder="Cari nama file..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none' }}
        />
        <button
          type="button"
          onClick={fetchFiles}
          disabled={loading}
          style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: loading ? '#a7f3d0' : '#059669', color: '#fff', fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          {loading ? 'Memuat...' : 'Refresh'}
        </button>
      </div>

      {dir && !error && (
        <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>{dir}</div>
      )}

      {error && (
        <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: 13 }}>{error}</div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#f9fafb', zIndex: 1 }}>
            <tr>
              <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>No</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>Nama File</th>
              <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>Ukuran</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>Terakhir Diubah</th>
              <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>Memuat...</td></tr>
            ) : !error && files.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>Tidak ada file di folder ini</td></tr>
            ) : (
              files.map((f, i) => (
                <tr key={f.name} style={{ background: i % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid #f3f4f6' }}>{i + 1}</td>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid #f3f4f6', wordBreak: 'break-all' }}>{f.name}</td>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid #f3f4f6', textAlign: 'right', whiteSpace: 'nowrap' }}>{formatUkuran(f.size)}</td>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap' }}>{f.modified_at}</td>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid #f3f4f6', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #059669', color: '#059669', fontSize: 11.5, fontWeight: 600, textDecoration: 'none', display: 'inline-block', marginRight: 6 }}
                    >
                      Buka
                    </a>
                    <button
                      type="button"
                      onClick={() => handleHapus(f.name)}
                      disabled={deletingName === f.name}
                      style={{
                        padding: '4px 10px', borderRadius: 6, border: '1px solid #dc2626',
                        background: '#fff', color: '#dc2626', fontSize: 11.5, fontWeight: 600,
                        cursor: deletingName === f.name ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {deletingName === f.name ? 'Menghapus...' : 'Hapus'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && !error && (
        <div style={{ fontSize: 11, color: '#6b7280', textAlign: 'right' }}>{files.length} file</div>
      )}
    </div>
  );
};

// DashboardSection — tahap ini baru "Test Koneksi" (panggil API Generate
// JSON Web Token pakai kredensial yg diatur di Pengaturan) — sisanya
// (statistik dokumen, dll) menyusul kalau menu lain sudah ditentukan.
// JWT Peruri berlaku 24 jam (dikonfirmasi user) — backend (getPeruriJWTCached
// di peruri_handler.go) reuse token tersimpan selama belum kadaluarsa, JADI
// klik tombol ini berulang TIDAK generate token baru tiap kali, cuma
// laporkan token yg lagi dipakai (freshly_generated menandai mana yg baru
// vs reuse).
const DashboardSection: React.FC = () => {
  const [testing, setTesting] = React.useState(false);
  const [result, setResult] = React.useState<{ ok: boolean; jwt?: string; expiredAt?: string; fresh?: boolean; errorMsg?: string } | null>(null);

  const handleTestJwt = async () => {
    setTesting(true);
    setResult(null);
    try {
      const res = await fetch('/api/peruri/test-jwt', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal memanggil API Peruri');
      setResult({ ok: true, jwt: data.jwt, expiredAt: data.expired_at, fresh: data.freshly_generated });
    } catch (err) {
      setResult({ ok: false, errorMsg: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 16, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Test Koneksi — Generate JSON Web Token</div>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
          Panggil API Generate JWT Peruri pakai kredensial yang sudah diatur di menu Pengaturan. Token berlaku 24 jam — dipakai ulang selama belum kadaluarsa, tidak generate baru tiap klik.
        </div>
        <button
          type="button"
          onClick={handleTestJwt}
          disabled={testing}
          style={{
            padding: '9px 20px', borderRadius: 8, border: 'none',
            background: testing ? '#a7f3d0' : '#059669', color: '#ffffff',
            fontSize: 13, fontWeight: 600, cursor: testing ? 'not-allowed' : 'pointer',
          }}
        >
          {testing ? 'Menghubungi...' : 'Generate JWT'}
        </button>

        {result && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: result.ok ? '#059669' : '#dc2626' }}>
              {result.ok
                ? (result.fresh ? 'Token baru berhasil dibuat' : 'Token tersimpan masih berlaku (dipakai ulang)') + (result.expiredAt ? ` — kadaluarsa ${result.expiredAt}` : '')
                : `Gagal: ${result.errorMsg}`}
            </div>
            {result.ok && (
              <pre
                style={{
                  margin: 0, padding: 12, borderRadius: 8, background: '#f9fafb', border: '1px solid #e5e7eb',
                  fontSize: 11.5, color: '#111827', overflowX: 'auto', maxHeight: 320, overflowY: 'auto', wordBreak: 'break-all', whiteSpace: 'pre-wrap',
                }}
              >
                {result.jwt}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

type PeruriTab = 'dashboard' | 'lihat-dokumen' | 'data-pengguna' | 'pengaturan';

const MENU: { key: PeruriTab; label: string; icon: React.ReactNode }[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" />
      </svg>
    ),
  },
  {
    key: 'lihat-dokumen',
    label: 'Lihat Dokumen',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <path d="M14 2v6h6"></path>
        <line x1="9" y1="13" x2="15" y2="13"></line>
        <line x1="9" y1="17" x2="15" y2="17"></line>
      </svg>
    ),
  },
  {
    key: 'data-pengguna',
    label: 'Data Pengguna',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
      </svg>
    ),
  },
];

// Pengaturan — terpisah dari MENU (footer sidebar, sama pola SETTINGS_ITEM
// di SatuSehat.tsx), bukan bagian daftar menu utama yang scroll.
const SETTINGS_ITEM: { key: PeruriTab; label: string; icon: React.ReactNode } = {
  key: 'pengaturan',
  label: 'Pengaturan',
  icon: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
  ),
};

// ── Pengaturan — kredensial & endpoint API gateway PERURI (sandbox), diambil
// persis dari dokumentasi yang diberikan user. Dikelompokkan sesuai kategori
// aslinya (Generate JWT/Certificate/Single/System/Hierarchy/Parallel/Bulk
// Signing/Signing Session/Peruri Tera/Gerber Service). Backend simpan tiap
// field sbg satu baris kode/nilai di peruri_konfigurasi (lihat
// backend/peruri_handler.go) — bukan struct tetap, supaya gampang nambah
// field baru nanti tanpa migrasi kolom.
type PeruriField = { key: string; label: string; defaultValue: string };
type PeruriSection = { title: string; fields: PeruriField[] };

const PERURI_SECTIONS: PeruriSection[] = [
  {
    title: 'Generate JSON Web Token',
    fields: [
      { key: 'JWT_GET_TOKEN', label: 'API Generate JWT', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/jwtSandbox/1.0/getJsonWebToken/v1' },
    ],
  },
  {
    title: 'Generate Certificate',
    fields: [
      { key: 'CERT_ONBOARDING_LINK', label: 'API Generate Onboarding Link', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureOnboarding/1.0/generateOnboardingLink/v1' },
      { key: 'CERT_REGISTRATION', label: 'API Registration', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/registration/v1' },
      { key: 'CERT_VIDEO_VERIFICATION', label: 'API Video Verification', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/videoVerification/v1' },
      { key: 'CERT_VIDEO_VERIFICATION_RENEWAL', label: 'API Video Verification for Renewal', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/videoVerificationForRenewal/v1' },
      { key: 'CERT_SEND_SPECIMEN', label: 'API Send Specimen', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/sendSpeciment/v1' },
      { key: 'CERT_CHECK_BY_EMAIL', label: 'API Check Certificate By Email', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureSession/1.0/checkCertificate/v1' },
      { key: 'CERT_CHECK_BY_KTP', label: 'API Check Certificate By KTP', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/checkCertificateByKTP/v1' },
    ],
  },
  {
    title: 'Single Signing',
    fields: [
      { key: 'SINGLE_SEND_DOCUMENT', label: 'API Send Document', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureSession/1.0/sendDocument/v1' },
      { key: 'SINGLE_SET_SIGNATURE', label: 'API Set Signature', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/setSignature/v1' },
      { key: 'SINGLE_VIEW_DOCUMENT', label: 'API View Document (Unsigned)', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/viewDocument/v1' },
      { key: 'SINGLE_UPDATE_DOCUMENT_PASSWORD', label: 'API Update Document Password', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/updateDocumentPassword/v1' },
      { key: 'SINGLE_SEND_OTP', label: 'API Send OTP', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/sendOtp/v1' },
      { key: 'SINGLE_SIGNING', label: 'API Signing', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/signing/v2' },
      { key: 'SINGLE_DOWNLOAD_DOCUMENT', label: 'API Download Document', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureSession/1.0/downloadDocument/v1' },
      { key: 'SINGLE_CHECK_DOCUMENT_STATUS', label: 'API Check Document Status', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/checkDocumentStatus/v1' },
      { key: 'SINGLE_DELETE_ORDER', label: 'API Delete Order', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/deleteOrder/v1' },
    ],
  },
  {
    title: 'System Signing',
    fields: [
      { key: 'SYSTEM_SET_KEY', label: 'API Set Key', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/setKey/v1' },
      { key: 'SYSTEM_SIGNING', label: 'API Signing', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/signingSystem/v2' },
    ],
  },
  {
    title: 'Hierarchy Signing',
    fields: [
      { key: 'HIERARCHY_SEND_DOCUMENT', label: 'API Send Document', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/sendDocumentTier/v1' },
      { key: 'HIERARCHY_SET_SIGNATURE', label: 'API Set Signature', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/setSignature/v1' },
      { key: 'HIERARCHY_SIGNING', label: 'API Signing', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/signingTier/v2' },
      { key: 'HIERARCHY_DOWNLOAD_DOCUMENT', label: 'API Download Document', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/downloadDocumentTier/v1' },
      { key: 'HIERARCHY_CHECK_ORDER_STATUS', label: 'API Check Order ID Status Per Order Type', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/checkOrderIdStatusPerOrderType/v1' },
    ],
  },
  {
    title: 'Parallel Signing',
    fields: [
      { key: 'PARALLEL_SEND_DOCUMENT', label: 'API Send Document', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/sendDocumentParallel/v1' },
      { key: 'PARALLEL_SET_SIGNATURE', label: 'API Set Signature', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/setSignature/v1' },
      { key: 'PARALLEL_SIGNING', label: 'API Signing', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/signingParallel/v2' },
      { key: 'PARALLEL_DOWNLOAD_DOCUMENT', label: 'API Download Document', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/downloadDocumentParallel/v1' },
      { key: 'PARALLEL_CHECK_ORDER_STATUS', label: 'API Check Order ID Status Per Order Type', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/checkOrderIdStatusPerOrderType/v1' },
    ],
  },
  {
    title: 'Bulk Signing',
    fields: [
      { key: 'BULK_SEND_DOCUMENT', label: 'API Send Document', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/sendDocumentBulk/v1' },
      { key: 'BULK_SEND_OTP', label: 'API Send OTP Bulk', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/sendOtpBulk/v1' },
      { key: 'BULK_SIGNING', label: 'API Signing', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/signingBulk/v2' },
      { key: 'BULK_SIGNING_ASYNC', label: 'API Signing Async', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/signingAsyncBulk/v2' },
    ],
  },
  {
    title: 'Signing Session',
    fields: [
      { key: 'SESSION_INITIATE', label: 'API Session Initiate', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureSession/1.0/sessionInitiate/v1' },
      { key: 'SESSION_VALIDATION', label: 'API Session Validation', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureSession/1.0/sessionValidation/v1' },
      { key: 'SESSION_SEND_DOCUMENT', label: 'API Send Document', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/sendDocument/v1' },
      { key: 'SESSION_SET_SIGNATURE', label: 'API Set Signature', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/setSignature/v1' },
      { key: 'SESSION_SIGNING', label: 'API Signing Session', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureSession/1.0/signingSession/v1' },
    ],
  },
  {
    title: 'Peruri Tera',
    fields: [
      { key: 'TERA_SIGNING', label: 'API Signing', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/signingPeruriTera/v2' },
    ],
  },
  {
    title: 'Gerber Service',
    fields: [
      { key: 'GERBER_ORDER_LIST_BY_UPLOADER', label: 'API Get Parallel/Hierarchy Order List', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/getOrderByUploader/v1' },
      { key: 'GERBER_ORDER_LIST_BY_EMAIL', label: 'API Get Order List', defaultValue: 'https://apgdev.peruri.co.id:19044/gateway/digitalSignatureFullJwtSandbox/1.0/gerber/getOrderListByEmail/v1' },
    ],
  },
];

const pengaturanLabelStyle: React.CSSProperties = { display: 'block', fontSize: 11.5, color: '#6b7280', marginBottom: 5 };
const pengaturanInputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box',
};

const PengaturanSection: React.FC = () => {
  const [apiKey, setApiKey] = React.useState('');
  const [systemId, setSystemId] = React.useState('');
  const [urls, setUrls] = React.useState<Record<string, string>>(
    () => Object.fromEntries(PERURI_SECTIONS.flatMap((s) => s.fields).map((f) => [f.key, f.defaultValue]))
  );
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    fetch('/api/peruri/config')
      .then((res) => (res.ok ? res.json() : {}))
      .then((data: Record<string, string>) => {
        if (cancelled) return;
        if (typeof data.API_KEY === 'string') setApiKey(data.API_KEY);
        if (typeof data.SYSTEM_ID === 'string') setSystemId(data.SYSTEM_ID);
        setUrls((prev) => {
          const next = { ...prev };
          for (const key of Object.keys(next)) {
            if (typeof data[key] === 'string' && data[key] !== '') next[key] = data[key];
          }
          return next;
        });
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const setUrl = (key: string, val: string) => setUrls((prev) => ({ ...prev, [key]: val }));

  const handleSimpan = async () => {
    setSaving(true);
    try {
      const body: Record<string, string> = { API_KEY: apiKey, SYSTEM_ID: systemId, ...urls };
      const res = await fetch('/api/peruri/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan konfigurasi');
      Swal.fire({ icon: 'success', title: 'Tersimpan', text: 'Konfigurasi Peruri berhasil disimpan', confirmButtonColor: '#059669', timer: 1800, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan', confirmButtonColor: '#059669' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, padding: 24 }}>Memuat...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Kredensial */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 16, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Kredensial</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={pengaturanLabelStyle}>x-Gateway-APIKey</label>
            <input type="text" value={apiKey} onChange={(e) => setApiKey(e.target.value)} style={pengaturanInputStyle} placeholder="0fff6fb9-1a7a-4025-b10f-5f7640eff999" />
          </div>
          <div>
            <label style={pengaturanLabelStyle}>System ID</label>
            <input type="text" value={systemId} onChange={(e) => setSystemId(e.target.value)} style={pengaturanInputStyle} placeholder="RSI-IBNUSINA-SIGLI" />
          </div>
        </div>
      </div>

      {/* Endpoint API per kategori */}
      {PERURI_SECTIONS.map((section) => (
        <div key={section.title} style={{ border: '1px solid #e5e7eb', borderRadius: 16, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 12 }}>{section.title}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {section.fields.map((field) => (
              <div key={field.key}>
                <label style={pengaturanLabelStyle}>{field.label}</label>
                <input
                  type="text"
                  value={urls[field.key] ?? ''}
                  onChange={(e) => setUrl(field.key, e.target.value)}
                  style={pengaturanInputStyle}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div style={{ position: 'sticky', bottom: 0, background: '#ffffff', paddingTop: 4 }}>
        <button
          type="button"
          onClick={handleSimpan}
          disabled={saving}
          style={{
            padding: '10px 24px', borderRadius: 8, border: 'none',
            background: saving ? '#a7f3d0' : '#059669', color: '#ffffff',
            fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
        </button>
      </div>
    </div>
  );
};

type PeruriViewProps = {
  onBack?: () => void;
};

export const PeruriView: React.FC<PeruriViewProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = React.useState<PeruriTab>('dashboard');
  const activeLabel = [...MENU, SETTINGS_ITEM].find((m) => m.key === activeTab)?.label || '';

  return (
    <section
      style={{
        background: '#F3F4F6',
        padding: 20,
        height: '100%',
        display: 'flex',
        gap: 16,
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* Sidebar — putih, bukan gradient, persis pola PermintaanResep.tsx */}
      <aside
        style={{
          width: 240,
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: 24,
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          padding: 16,
          boxSizing: 'border-box',
          boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px 20px' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#111827', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2 3 6v6c0 5.25 3.75 9.75 9 11 5.25-1.25 9-5.75 9-11V6z"></path>
              <path d="m9 12 2 2 4-4"></path>
            </svg>
          </div>
          <div style={{ color: '#111827', fontSize: 15, fontWeight: 700, letterSpacing: '0.2px' }}>
            Peruri
          </div>
        </div>

        {/* Menu */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {MENU.map((item) => {
            const active = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveTab(item.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  borderRadius: 12,
                  border: 'none',
                  background: active ? '#059669' : 'transparent',
                  color: active ? '#ffffff' : '#6b7280',
                  fontWeight: 400,
                  fontSize: 13,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = '#f9fafb';
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = 'transparent';
                }}
              >
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Footer — Pengaturan, terpisah dari daftar menu utama */}
        <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 8 }}>
          {(() => {
            const active = activeTab === SETTINGS_ITEM.key;
            return (
              <button
                type="button"
                onClick={() => setActiveTab(SETTINGS_ITEM.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 12,
                  border: 'none',
                  background: active ? '#059669' : 'transparent',
                  color: active ? '#ffffff' : '#6b7280',
                  fontWeight: 400,
                  fontSize: 13,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = '#f9fafb';
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = 'transparent';
                }}
              >
                {SETTINGS_ITEM.icon}
                {SETTINGS_ITEM.label}
              </button>
            );
          })()}
        </div>
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header — langsung di atas background, tanpa card */}
        <div
          style={{
            padding: '0 4px 16px',
            flexShrink: 0,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: 13, color: '#6b7280' }}>
            <span style={{ color: '#111827', fontWeight: 600 }}>Peruri</span> / {activeLabel}
          </div>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid #059669',
                background: '#059669',
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              Tutup
            </button>
          )}
        </div>

        {/* Body */}
        <div
          style={{
            padding: 24,
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            background: '#ffffff',
            borderRadius: 24,
            boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
          }}
        >
          {activeTab === 'dashboard' && <DashboardSection />}
          {activeTab === 'lihat-dokumen' && <LihatDokumenSection />}
          {activeTab === 'data-pengguna' && <AkunPeruriView />}
          {activeTab === 'pengaturan' && <PengaturanSection />}
        </div>
      </div>
    </section>
  );
};
