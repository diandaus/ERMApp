import React from 'react';
import Swal from 'sweetalert2';
import { ModalityWorklistSection } from './ModalityWorklist';

// OrthancBridgingSection — isi tab "Orthanc" di Bridging.tsx (sebelumnya
// placeholder "akan dikembangkan nanti"). Menyatukan SEMUA hal yg
// berhubungan langsung dgn Orthanc sendiri (bukan Satu Sehat) yg
// sebelumnya tersebar/tidak ada UI-nya sama sekali:
// - "Koneksi" — URL/Username/Password Orthanc + registrasi DICOM Router
//   (dulu nempel di tab Satu Sehat > Konfigurasi, padahal Orthanc adalah
//   PACS bersama yg dipakai lintas modul, bukan spesifik Satu Sehat).
// - "Modality Worklist" — kirim MWL/ACSN + browser instance DICOM (dulu
//   nempel di menu Satu Sehat, dipindah full krn murni interaksi Orthanc
//   REST API, tidak menyentuh apa pun punya Satu Sehat).
// - "Mapping Modality" — set Modality DICOM (US/DX/CR/dst) per jenis
//   pemeriksaan radiologi, dipakai tag "Modality" saat kirim ke MWL.
// "Imaging Study" (kirim status resource ke FHIR Satu Sehat) SENGAJA
// TETAP di tab Satu Sehat — itu murni pelacakan pengiriman resource FHIR,
// tidak memanggil Orthanc REST API sama sekali.
type OrthancTab = 'koneksi' | 'mwl' | 'mapping';

const inputSm: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#fff',
};
const labelSm: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 };

// ─── Sub-tab: Koneksi ────────────────────────────────────────────────────────
//
// Field orthanc_url/orthanc_user/orthanc_pass/dicom_router_* disimpan di
// TABEL YANG SAMA (satu_sehat_konfigurasi) & endpoint YANG SAMA
// (/api/satu-sehat/config) dgn field OAuth2 Satu Sehat (org_id, client_id,
// dst) — backend (saveConfigSatuSehat) menimpa SEMUA field non-password
// tanpa syarat dari body yg dikirim, jadi field OAuth2 Satu Sehat WAJIB
// ikut di-fetch & dikirim balik APA ADANYA di sini (walau tidak
// ditampilkan/diedit di tab ini) — kalau tidak, submit dari tab ini akan
// mengosongkan org_id/client_id dkk milik tab Satu Sehat > Konfigurasi.
type FullConfigForm = {
  org_id: string; client_id: string; client_secret: string;
  auth_url: string; fhir_url: string; is_production: boolean;
  orthanc_url: string; orthanc_user: string; orthanc_pass: string;
  dicom_router_name: string; dicom_router_host: string; dicom_router_port: string; dicom_router_aet: string;
};

const KoneksiSection: React.FC = () => {
  const [form, setForm] = React.useState<FullConfigForm>({
    org_id: '', client_id: '', client_secret: '', auth_url: '', fhir_url: '', is_production: false,
    orthanc_url: '', orthanc_user: '', orthanc_pass: '',
    dicom_router_name: '', dicom_router_host: '', dicom_router_port: '', dicom_router_aet: '',
  });
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [registering, setRegistering] = React.useState(false);

  const fetchConfig = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/satu-sehat/config');
      const data = await res.json();
      setForm({
        org_id: data.org_id || '', client_id: data.client_id || '', client_secret: data.client_secret || '',
        auth_url: data.auth_url || '', fhir_url: data.fhir_url || '', is_production: !!data.is_production,
        orthanc_url: data.orthanc_url || '', orthanc_user: data.orthanc_user || '', orthanc_pass: data.orthanc_pass || '',
        dicom_router_name: data.dicom_router_name || '', dicom_router_host: data.dicom_router_host || '',
        dicom_router_port: data.dicom_router_port || '', dicom_router_aet: data.dicom_router_aet || '',
      });
    } catch {
      // biarkan form kosong kalau gagal fetch
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void fetchConfig(); }, [fetchConfig]);

  const set = (key: keyof FullConfigForm, val: string) => setForm((prev) => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/satu-sehat/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan konfigurasi');
      Swal.fire({ icon: 'success', title: 'Tersimpan', text: 'Koneksi Orthanc berhasil disimpan', timer: 1500, showConfirmButton: false });
      fetchConfig();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await fetch('/api/orthanc/test-connection');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Koneksi gagal');
      Swal.fire({ icon: 'success', title: 'Koneksi Berhasil', text: `${data.name || 'Orthanc'} — versi ${data.version || '-'}` });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Koneksi Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setTesting(false);
    }
  };

  const handleRegisterRouter = async () => {
    if (!form.dicom_router_name.trim() || !form.dicom_router_host.trim() || !form.dicom_router_aet.trim()) {
      Swal.fire({ icon: 'warning', title: 'Data belum lengkap', text: 'Nama, Host, dan AET DICOM Router wajib diisi (simpan dulu sebelum daftarkan)' });
      return;
    }
    setRegistering(true);
    try {
      const res = await fetch('/api/satu-sehat/dicom/register-router', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mendaftarkan DICOM Router');
      Swal.fire({ icon: 'success', title: 'Berhasil', text: data.message || `DICOM Router '${form.dicom_router_name}' terdaftar di Orthanc` });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setRegistering(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>Memuat...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Koneksi Orthanc PACS</div>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
          Satu instance Orthanc dipakai bersama lintas modul (Modality Worklist, kirim DICOM ke Satu Sehat, foto Orthanc di
          hasil Radiologi). Modality (mesin CT/USG/X-Ray) push hasil scan ke sini.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelSm}>Orthanc URL</label>
            <input type="text" value={form.orthanc_url} onChange={(e) => set('orthanc_url', e.target.value)} style={inputSm} placeholder="http://192.168.1.10:8042" />
          </div>
          <div>
            <label style={labelSm}>Orthanc Username</label>
            <input type="text" value={form.orthanc_user} onChange={(e) => set('orthanc_user', e.target.value)} style={inputSm} />
          </div>
          <div>
            <label style={labelSm}>Orthanc Password</label>
            <input
              type="password"
              value={form.orthanc_pass}
              onChange={(e) => set('orthanc_pass', e.target.value)}
              style={inputSm}
              placeholder={form.orthanc_pass === '***' ? 'Sudah tersimpan — isi ulang untuk mengganti' : ''}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button" disabled={saving} onClick={handleSave}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: saving ? '#9ca3af' : '#059669', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500 }}
          >
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
          <button
            type="button" disabled={testing} onClick={handleTest}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #2563eb', background: '#fff', color: testing ? '#9ca3af' : '#2563eb', cursor: testing ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500 }}
          >
            {testing ? 'Menguji...' : 'Test Koneksi'}
          </button>
        </div>
      </div>

      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 4 }}>DICOM Router Satu Sehat</div>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
          Isi persis sesuai yang sudah didaftarkan di dashboard provider Satu Sehat, lalu simpan dan klik "Daftarkan DICOM
          Router" supaya Orthanc tahu ke mana harus meneruskan studi (menu Satu Sehat &gt; Imaging Study &gt; "Kirim via
          DICOM Router").
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <div>
            <label style={labelSm}>Nama Modality (bebas, label lokal)</label>
            <input type="text" value={form.dicom_router_name} onChange={(e) => set('dicom_router_name', e.target.value)} style={inputSm} placeholder="DICOM_ROUTER" />
          </div>
          <div>
            <label style={labelSm}>AET DICOM Router</label>
            <input type="text" value={form.dicom_router_aet} onChange={(e) => set('dicom_router_aet', e.target.value)} style={inputSm} placeholder="DICOMROUTER" />
          </div>
          <div>
            <label style={labelSm}>Host DICOM Router</label>
            <input type="text" value={form.dicom_router_host} onChange={(e) => set('dicom_router_host', e.target.value)} style={inputSm} />
          </div>
          <div>
            <label style={labelSm}>Port DICOM Router</label>
            <input type="text" value={form.dicom_router_port} onChange={(e) => set('dicom_router_port', e.target.value)} style={inputSm} placeholder="11112" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button" disabled={saving} onClick={handleSave}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: saving ? '#9ca3af' : '#059669', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500 }}
          >
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
          <button
            type="button" disabled={registering} onClick={handleRegisterRouter}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #2563eb', background: '#fff', color: registering ? '#9ca3af' : '#2563eb', cursor: registering ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500 }}
          >
            {registering ? 'Mendaftarkan...' : 'Daftarkan DICOM Router ke Orthanc'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Sub-tab: Mapping Modality ───────────────────────────────────────────────
//
// Tiap jenis pemeriksaan radiologi (kd_jenis_prw) bisa diberi Modality Code
// DICOM (US, DX, CR, dst, kolom modality_code di erm_mapping_radiologi).
// Nilai ini dipakai 2 tempat:
// 1. Tag "Modality" saat bikin entri Modality Worklist ke Orthanc
//    (mwl_handler.go, sendToMWL) — dgn ini, modality kedua (mis. USG) bisa
//    query worklist & cuma melihat entri pemeriksaannya sendiri (filter by
//    Modality), terpisah dari modality pertama (CR) yg selama ini dipakai.
// 2. Coding.display di payload ImagingStudy Satu Sehat
//    (buildImagingStudyPayload di satu_sehat_handler.go) — default
//    'DX'/'Digital Radiography' kalau belum diisi.
// Default SEMUA pemeriksaan kalau belum di-mapping = 'DX' (Digital
// Radiography) — jadi sub-tab ini cuma perlu disentuh utk pemeriksaan yg
// modality-nya BUKAN DX (mis. USG Kandungan -> 'US').
type MappingRadiologiRow = {
  kd_jenis_prw: string;
  nm_perawatan: string;
  code: string;
  system: string;
  display: string;
  modality_code: string;
  modality_display: string;
};

const MODALITY_OPTIONS: { code: string; display: string; label: string }[] = [
  { code: '', display: '', label: '(Default — DX / Digital Radiography)' },
  { code: 'DX', display: 'Digital Radiography', label: 'DX — Digital Radiography' },
  { code: 'CR', display: 'Computed Radiography', label: 'CR — Computed Radiography' },
  { code: 'US', display: 'Ultrasonography', label: 'US — Ultrasonography (USG)' },
  { code: 'MG', display: 'Mammography', label: 'MG — Mammography' },
  { code: 'CT', display: 'Computed Tomography', label: 'CT — Computed Tomography' },
  { code: 'MR', display: 'Magnetic Resonance', label: 'MR — Magnetic Resonance' },
  { code: 'OT', display: 'Other', label: 'OT — Other' },
];

const MappingModalitySection: React.FC = () => {
  const [list, setList] = React.useState<MappingRadiologiRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [savingKd, setSavingKd] = React.useState<string | null>(null);
  // edits — modality_code per baris yg SEDANG diubah di dropdown tapi belum
  // disimpan (keyed kd_jenis_prw) — tombol Simpan cuma aktif kalau nilainya
  // beda dari yg tersimpan (row.modality_code).
  const [edits, setEdits] = React.useState<Record<string, string>>({});

  const loadList = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/satu-sehat/mapping/radiologi');
      const data = await res.json();
      setList(Array.isArray(data) ? data : []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void loadList(); }, [loadList]);

  // Ada ratusan jenis pemeriksaan radiologi aktif di data produksi — tabel
  // TIDAK dirender sama sekali sebelum user mengetik pencarian, spy tidak
  // nge-lag & tidak membanjiri layar dgn baris yg tidak relevan.
  const q = search.trim().toLowerCase();
  const filtered = q
    ? list.filter((r) => r.nm_perawatan.toLowerCase().includes(q) || r.kd_jenis_prw.toLowerCase().includes(q)).slice(0, 100)
    : [];

  const handleSave = async (row: MappingRadiologiRow) => {
    const newCode = edits[row.kd_jenis_prw] ?? row.modality_code;
    const opt = MODALITY_OPTIONS.find((o) => o.code === newCode);
    setSavingKd(row.kd_jenis_prw);
    try {
      const res = await fetch(`/api/satu-sehat/mapping/radiologi/${encodeURIComponent(row.kd_jenis_prw)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // code/system/display (LOINC, sumber aslinya menu "Mapping
          // Radiologi" Satu Sehat) dikirim balik APA ADANYA — sub-tab ini
          // cuma menyentuh modality_code/modality_display, tidak boleh menimpa.
          code: row.code, system: row.system, display: row.display,
          modality_code: newCode, modality_display: opt?.display || '',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan mapping modality');
      setList((prev) => prev.map((r) => (r.kd_jenis_prw === row.kd_jenis_prw ? { ...r, modality_code: newCode, modality_display: opt?.display || '' } : r)));
      setEdits((prev) => { const next = { ...prev }; delete next[row.kd_jenis_prw]; return next; });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setSavingKd(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600, color: '#111827' }}>Mapping Modality Radiologi</h3>
        <p style={{ margin: 0, fontSize: 12.5, color: '#6b7280', lineHeight: 1.5 }}>
          Tentukan Modality DICOM (mis. <strong>US</strong> utk USG) per jenis pemeriksaan — dipakai saat mengirim ke Modality
          Worklist Orthanc supaya alat yg query worklist cuma melihat pemeriksaannya sendiri. Pemeriksaan yg belum di-mapping
          otomatis dianggap <strong>DX</strong> (Digital Radiography).
        </p>
      </div>

      <input
        type="text" value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="Cari nama/kode pemeriksaan (mis. USG Kandungan)..." style={{ ...inputSm, width: 340 }}
      />

      {loading ? (
        <div style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>Memuat...</div>
      ) : !q ? (
        <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13, border: '1px dashed #d1d5db', borderRadius: 10 }}>
          Ketik nama atau kode pemeriksaan di atas untuk mencari.
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13, border: '1px dashed #d1d5db', borderRadius: 10 }}>
          Tidak ada pemeriksaan yang cocok dengan "{search}".
        </div>
      ) : (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#111827', borderBottom: '1px solid #e5e7eb' }}>Kode</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#111827', borderBottom: '1px solid #e5e7eb' }}>Nama Pemeriksaan</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#111827', borderBottom: '1px solid #e5e7eb' }}>Modality</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#111827', borderBottom: '1px solid #e5e7eb' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, idx) => {
                const currentCode = edits[row.kd_jenis_prw] ?? row.modality_code;
                const dirty = currentCode !== row.modality_code;
                return (
                  <tr key={row.kd_jenis_prw} style={{ borderTop: idx === 0 ? 'none' : '1px solid #f3f4f6' }}>
                    <td style={{ padding: '8px 16px', color: '#6b7280', fontFamily: 'monospace', fontSize: 12 }}>{row.kd_jenis_prw}</td>
                    <td style={{ padding: '8px 16px', color: '#374151' }}>{row.nm_perawatan}</td>
                    <td style={{ padding: '8px 16px' }}>
                      <select
                        value={currentCode}
                        onChange={(e) => setEdits((prev) => ({ ...prev, [row.kd_jenis_prw]: e.target.value }))}
                        style={{ ...inputSm, padding: '6px 8px', width: 260 }}
                      >
                        {MODALITY_OPTIONS.map((o) => (
                          <option key={o.code} value={o.code}>{o.label}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '8px 16px' }}>
                      <button
                        type="button" onClick={() => handleSave(row)} disabled={!dirty || savingKd === row.kd_jenis_prw}
                        style={{
                          padding: '6px 14px', borderRadius: 6, border: 'none',
                          background: !dirty ? '#e5e7eb' : savingKd === row.kd_jenis_prw ? '#9ca3af' : '#2563eb',
                          color: !dirty ? '#9ca3af' : '#fff',
                          cursor: !dirty || savingKd === row.kd_jenis_prw ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600,
                        }}
                      >
                        {savingKd === row.kd_jenis_prw ? 'Menyimpan...' : 'Simpan'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ─── Halaman utama tab Orthanc ───────────────────────────────────────────────
//
// Shell sidebar fullscreen, PERSIS pola BridgingBpjsView/SatuSehatView/
// PeruriView (dibuka fullscreen dari Bridging.tsx, position:fixed inset:0
// dibungkus di sana) — gradient ungu spy visualnya beda dari BPJS (biru),
// Satu Sehat (hijau), Peruri (putih). "Koneksi" ditaruh sbg item footer
// terpisah (pola "Pengaturan" di 3 modul lain) krn isinya memang murni
// konfigurasi, sementara Modality Worklist & Mapping Modality adalah
// menu/fitur utamanya.
const MENU: { key: OrthancTab; label: string; icon: React.ReactNode }[] = [
  {
    key: 'mwl',
    label: 'Modality Worklist',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"></rect>
        <line x1="3" y1="10" x2="21" y2="10"></line>
        <line x1="8" y1="14" x2="16" y2="14"></line>
        <line x1="8" y1="18" x2="13" y2="18"></line>
      </svg>
    ),
  },
  {
    key: 'mapping',
    label: 'Mapping Modality',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"></rect>
        <circle cx="9" cy="9" r="2"></circle>
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path>
      </svg>
    ),
  },
];

const SETTINGS_ITEM: { key: OrthancTab; label: string; icon: React.ReactNode } = {
  key: 'koneksi',
  label: 'Koneksi',
  icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
  ),
};

type OrthancBridgingViewProps = {
  onBack?: () => void;
};

export const OrthancBridgingView: React.FC<OrthancBridgingViewProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = React.useState<OrthancTab>('mwl');
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
      {/* Sidebar */}
      <aside
        style={{
          width: 240,
          background: 'linear-gradient(135deg, #3a8bc4 0%, #459ed7 100%)',
          borderRadius: 24,
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          padding: 16,
          boxSizing: 'border-box',
          boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px 20px' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"></rect>
              <circle cx="9" cy="9" r="2"></circle>
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path>
            </svg>
          </div>
          <div style={{ color: '#ffffff', fontSize: 15, fontWeight: 700, letterSpacing: '0.2px' }}>
            Orthanc
          </div>
        </div>

        {/* Menu — pola scrollbar auto-hide sama dgn BridgingBpjs.tsx/SatuSehat.tsx. */}
        <nav className="orthanc-sidebar-nav" style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0, overflowY: 'auto' }}>
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
                  background: active ? 'rgba(255,255,255,0.22)' : 'transparent',
                  color: active ? '#ffffff' : 'rgba(255,255,255,0.8)',
                  fontWeight: active ? 600 : 400,
                  fontSize: 13,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
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

        {/* Footer — Koneksi, terpisah dari daftar menu utama (pola
            "Pengaturan" di BridgingBpjs.tsx/SatuSehat.tsx/Peruri.tsx). */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 8 }}>
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
                  background: active ? 'rgba(255,255,255,0.22)' : 'transparent',
                  color: active ? '#ffffff' : 'rgba(255,255,255,0.8)',
                  fontWeight: active ? 600 : 400,
                  fontSize: 13,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
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
            <span style={{ color: '#2f7bb5', fontWeight: 600 }}>Bridging</span> / {activeLabel}
          </div>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid #2f7bb5',
                background: '#2f7bb5',
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
          {activeTab === 'koneksi' && <KoneksiSection />}
          {activeTab === 'mwl' && <ModalityWorklistSection />}
          {activeTab === 'mapping' && <MappingModalitySection />}
        </div>
      </div>

      <style>{`
        .orthanc-sidebar-nav { scrollbar-width: none; -ms-overflow-style: none; }
        .orthanc-sidebar-nav::-webkit-scrollbar { width: 6px; }
        .orthanc-sidebar-nav::-webkit-scrollbar-track { background: transparent; }
        .orthanc-sidebar-nav::-webkit-scrollbar-thumb { background: transparent; border-radius: 10px; }
        .orthanc-sidebar-nav:hover { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.35) transparent; }
        .orthanc-sidebar-nav:hover::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.35); }
      `}</style>
    </section>
  );
};
