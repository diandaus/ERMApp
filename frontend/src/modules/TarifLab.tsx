import React from 'react';
import Swal from 'sweetalert2';

// TarifLabView — sub-menu "Tarif Lab" di modul Tarif Pelayanan. Padanan
// tabel utama DlgHargaLab.java (Khanza Desktop) method tampil(): daftar
// jns_perawatan_lab INNER JOIN penjab, kolom P|Kode Periksa|Nama
// Pemeriksaan|Jasa Sarana|Paket BHP|J.M. Perujuk|J.M. Dokter|J.M. Petugas|
// K.S.O.|Menejemen|Total Tarif|Jenis Bayar|Kelas|Kategori. Satu baris =
// kombinasi (kd_jenis_prw, kd_pj) — satu pemeriksaan bisa muncul beberapa
// kali kalau tarifnya beda per jenis bayar. Kolom "P" (checkbox) SUDAH
// aktif — centang MULTI baris khusus utk hapus massal ("Hapus Terpilih"),
// BUKAN utk ditampilkan ke modal; centang PERSIS SATU baris lalu klik
// "+ Tambah Tarif Lab" -> modal terbuka mode EDIT terisi data baris itu
// (bukan tambah baru).

type TarifLabRow = {
  kd_jenis_prw: string; nm_perawatan: string;
  bagian_rs: number; bhp: number; tarif_perujuk: number; tarif_tindakan_dokter: number;
  tarif_tindakan_petugas: number; kso: number; menejemen: number; total_byr: number;
  kd_pj: string; png_jawab: string; kelas: string; kategori: string;
};

const inputStyle: React.CSSProperties = {
  padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box', outline: 'none',
};
const th: React.CSSProperties = { padding: '8px 8px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap', background: '#f9fafb', position: 'sticky', top: 0, zIndex: 5 };
const td: React.CSSProperties = { padding: '6px 8px', borderBottom: '1px solid #f3f4f6', fontSize: 12, color: '#374151', whiteSpace: 'nowrap' };

const formatRupiah = (n: number) => n.toLocaleString('id-ID');

// pillInputStyle — input bulat lonjong (border-radius besar), persis
// gambar referensi form "Tambah Tarif Lab" (beda dari inputStyle kotak
// biasa yg dipakai kolom Cari di tabel utama).
const pillInputStyle: React.CSSProperties = {
  flex: 1, minWidth: 0, height: 30, padding: '0 14px', borderRadius: 2, border: '1px solid #9ca3af',
  fontSize: 13, boxSizing: 'border-box', outline: 'none', background: '#ffffff', color: '#111827',
};
const pillReadOnlyStyle: React.CSSProperties = { ...pillInputStyle, background: '#f9fafb', color: '#374151' };

// StepperIcon/SelectStepper — ganti arrow dropdown bawaan browser dgn ikon
// bulat chevron atas-bawah, persis pola PillSelect di ApotekPenerimaan.tsx
// (appearance:none pd <select> + ikon overlay absolute di kanan).
const StepperIcon: React.FC = () => (
  <div
    style={{
      position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
      width: 20, height: 20, borderRadius: 4, background: '#4338ca',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none', flexShrink: 0,
    }}
  >
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 8.5 12 3.5 7 8.5"></polyline>
      <polyline points="7 15.5 12 20.5 17 15.5"></polyline>
    </svg>
  </div>
);
const selectPillStyle: React.CSSProperties = {
  ...pillInputStyle, padding: '0 28px 0 14px', appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer',
};
const SelectStepper: React.FC<{ style?: React.CSSProperties; children: React.ReactNode }> = ({ style, children }) => (
  <div style={{ position: 'relative', display: 'flex', ...style }}>
    {children}
    <StepperIcon />
  </div>
);

// Row — "Label :  (input pill)" sebaris, label rata kanan dgn lebar tetap
// per kolom (leftW utk kolom kiri form, rightW utk kolom kanan — beda krn
// label terpanjang beda per kolom, mis. "Total Biaya Laborat").
const Row: React.FC<{ label: string; width: number; prefix?: string; children: React.ReactNode }> = ({ label, width, prefix, children }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
    <label style={{ width, flexShrink: 0, textAlign: 'right', fontSize: 13, color: '#111827' }}>{label} :</label>
    {prefix && <span style={{ fontSize: 13, color: '#111827', flexShrink: 0 }}>{prefix}</span>}
    {children}
  </div>
);

type PenjabOpsi = { kd_pj: string; nm_pj: string };

const KELAS_OPTIONS = ['-', 'Rawat Jalan', 'Kelas 1', 'Kelas 2', 'Kelas 3', 'Kelas Utama', 'Kelas VIP', 'Kelas VVIP'];

const emptyForm = () => ({
  kd_jenis_prw: '', nm_perawatan: '', kd_pj: '', kelas: '-', kategori: 'PK',
  bagian_rs: '0', bhp: '0', tarif_perujuk: '0', tarif_tindakan_dokter: '0',
  tarif_tindakan_petugas: '0', kso: '0', menejemen: '0',
});

const formFromRow = (row: TarifLabRow) => ({
  kd_jenis_prw: row.kd_jenis_prw, nm_perawatan: row.nm_perawatan, kd_pj: row.kd_pj,
  kelas: row.kelas, kategori: row.kategori,
  bagian_rs: String(row.bagian_rs), bhp: String(row.bhp), tarif_perujuk: String(row.tarif_perujuk),
  tarif_tindakan_dokter: String(row.tarif_tindakan_dokter), tarif_tindakan_petugas: String(row.tarif_tindakan_petugas),
  kso: String(row.kso), menejemen: String(row.menejemen),
});

// ModalTambahTarifLab — form "+ Tambah Tarif Lab", padanan field yg
// ditampilkan tabel utama (kd_jenis_prw jadi PK jns_perawatan_lab, jadi
// WAJIB unik — satu exam yg tarifnya beda per jenis bayar disimpan sbg
// baris terpisah dgn kode beda, persis data existing "101-K.3"/"102-K.2").
// Total Tarif read-only, dihitung live dari 7 komponen biaya (server juga
// menghitung ulang, angka dari form ini cuma utk preview). editRow — kalau
// diisi (persis SATU baris dicentang di kolom "P" lalu klik tombol tambah),
// modal jadi mode EDIT: form terisi data baris itu, Kode Periksa dikunci
// (kd_jenis_prw primary key, tidak boleh diubah lewat sini), submit PUT
// bukan POST.
const ModalTambahTarifLab: React.FC<{ editRow?: TarifLabRow | null; onClose: () => void; onSaved: () => void }> = ({ editRow, onClose, onSaved }) => {
  const isEdit = !!editRow;
  const [form, setForm] = React.useState(editRow ? formFromRow(editRow) : emptyForm());
  const [penjabList, setPenjabList] = React.useState<PenjabOpsi[]>([]);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    fetch('/api/pendaftaran/penjab')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setPenjabList(Array.isArray(data) ? data : []))
      .catch(() => setPenjabList([]));
  }, []);

  const setNum = (field: keyof ReturnType<typeof emptyForm>, value: string) => setForm((p) => ({ ...p, [field]: value }));

  const totalTarif = ['bagian_rs', 'bhp', 'tarif_perujuk', 'tarif_tindakan_dokter', 'tarif_tindakan_petugas', 'kso', 'menejemen']
    .reduce((sum, k) => sum + (Number((form as any)[k]) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.kd_pj) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Pilih Jenis Bayar dulu' });
      return;
    }
    // Kode Periksa DIUBAH di mode edit -> jadi baris BARU (POST), bukan PUT
    // ke kode lama — memudahkan user bikin tarif baru yg mirip: tinggal
    // buka edit baris yg sudah ada, ganti Kode Periksa (+ field lain kalau
    // perlu), klik Simpan, langsung jadi baris baru tanpa isi dari nol.
    // Kode Periksa TETAP SAMA di mode edit -> PUT spt biasa (edit di tempat).
    const kodeBerubah = isEdit && form.kd_jenis_prw.trim() !== editRow!.kd_jenis_prw;
    const jadiEdit = isEdit && !kodeBerubah;
    setSaving(true);
    try {
      const url = jadiEdit ? `/api/tarif-lab/jenis-perawatan/${encodeURIComponent(editRow!.kd_jenis_prw)}` : '/api/tarif-lab/jenis-perawatan';
      const res = await fetch(url, {
        method: jadiEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kd_jenis_prw: form.kd_jenis_prw.trim(),
          nm_perawatan: form.nm_perawatan.trim(),
          kd_pj: form.kd_pj,
          kelas: form.kelas.trim(),
          kategori: form.kategori,
          bagian_rs: Number(form.bagian_rs) || 0,
          bhp: Number(form.bhp) || 0,
          tarif_perujuk: Number(form.tarif_perujuk) || 0,
          tarif_tindakan_dokter: Number(form.tarif_tindakan_dokter) || 0,
          tarif_tindakan_petugas: Number(form.tarif_tindakan_petugas) || 0,
          kso: Number(form.kso) || 0,
          menejemen: Number(form.menejemen) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan');
      await Swal.fire({ icon: 'success', title: 'Berhasil!', text: `Tarif Lab ${jadiEdit ? 'berhasil diperbarui' : 'ditambahkan sebagai baris baru'}`, timer: 1800, showConfirmButton: false });
      onSaved();
      onClose();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#ffffff', borderRadius: 16, padding: 20, maxWidth: 820, width: '95%', maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 400, color: '#111827' }}>{isEdit ? 'Edit Tarif Lab' : 'Tambah Tarif Lab'}</span>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: '50%', border: '1px solid #e5e7eb',
              background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, lineHeight: 1, cursor: 'pointer', color: '#6b7280', padding: 0,
            }}
          >&times;</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,40%) minmax(0,60%)', gap: '10px 24px' }}>
            {/* Kolom kiri */}
            <Row label="Kode Periksa" width={110}>
              <input
                required
                style={pillInputStyle}
                title={isEdit ? 'Ganti kode ini utk simpan sbg baris BARU (bukan edit baris yg sedang dibuka)' : undefined}
                value={form.kd_jenis_prw} onChange={(e) => setForm((p) => ({ ...p, kd_jenis_prw: e.target.value }))}
              />
            </Row>
            <Row label="Nama Pemeriksaan" width={150}>
              <input required style={pillInputStyle} value={form.nm_perawatan} onChange={(e) => setForm((p) => ({ ...p, nm_perawatan: e.target.value }))} />
            </Row>

            <Row label="Jasa Sarana" width={110} prefix="Rp.">
              <input type="number" style={pillInputStyle} value={form.bagian_rs} onChange={(e) => setNum('bagian_rs', e.target.value)} />
            </Row>
            <Row label="K.S.O." width={150} prefix="Rp.">
              <input type="number" style={pillInputStyle} value={form.kso} onChange={(e) => setNum('kso', e.target.value)} />
            </Row>

            <Row label="Paket BHP" width={110} prefix="Rp.">
              <input type="number" style={pillInputStyle} value={form.bhp} onChange={(e) => setNum('bhp', e.target.value)} />
            </Row>
            <Row label="Manajemen" width={150} prefix="Rp.">
              <input type="number" style={pillInputStyle} value={form.menejemen} onChange={(e) => setNum('menejemen', e.target.value)} />
            </Row>

            <Row label="J.M. Dokter" width={110} prefix="Rp.">
              <input type="number" style={pillInputStyle} value={form.tarif_tindakan_dokter} onChange={(e) => setNum('tarif_tindakan_dokter', e.target.value)} />
            </Row>
            <Row label="Total Biaya Laborat" width={150} prefix="Rp.">
              <div style={{ ...pillReadOnlyStyle, fontWeight: 600, display: 'flex', alignItems: 'center' }}>{formatRupiah(totalTarif)}</div>
            </Row>

            <Row label="J.M. Petugas" width={110} prefix="Rp.">
              <input type="number" style={pillInputStyle} value={form.tarif_tindakan_petugas} onChange={(e) => setNum('tarif_tindakan_petugas', e.target.value)} />
            </Row>
            <Row label="Jenis Bayar" width={150}>
              <input readOnly style={{ ...pillReadOnlyStyle, flex: '0 0 70px', textAlign: 'center' }} value={form.kd_pj} />
              <SelectStepper style={{ flex: 1, minWidth: 0 }}>
              <select required style={{ ...selectPillStyle, width: '100%' }} value={form.kd_pj} onChange={(e) => setForm((p) => ({ ...p, kd_pj: e.target.value }))}>
                <option value="">- Pilih -</option>
                {penjabList.map((p) => <option key={p.kd_pj} value={p.kd_pj}>{p.nm_pj}</option>)}
              </select>
              </SelectStepper>
            </Row>

            <Row label="J.M. Perujuk" width={110} prefix="Rp.">
              <input type="number" style={pillInputStyle} value={form.tarif_perujuk} onChange={(e) => setNum('tarif_perujuk', e.target.value)} />
            </Row>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <label style={{ width: 150, flexShrink: 0, textAlign: 'right', fontSize: 13, color: '#111827' }}>Kelas :</label>
              <SelectStepper style={{ flex: '0 0 130px' }}>
              <select style={{ ...selectPillStyle, width: '100%' }} value={form.kelas} onChange={(e) => setForm((p) => ({ ...p, kelas: e.target.value }))}>
                {KELAS_OPTIONS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
              </SelectStepper>
              <label style={{ flexShrink: 0, fontSize: 13, color: '#111827' }}>Kategori :</label>
              <SelectStepper style={{ flex: '0 0 75px' }}>
              <select required style={{ ...selectPillStyle, width: '100%' }} value={form.kategori} onChange={(e) => setForm((p) => ({ ...p, kategori: e.target.value }))}>
                <option value="PK">PK</option>
                <option value="PA">PA</option>
              </select>
              </SelectStepper>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#374151', cursor: 'pointer', fontSize: 12.5, fontWeight: 500 }}>Batal</button>
            <button type="submit" disabled={saving} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: saving ? '#9ca3af' : '#4338ca', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 12.5, fontWeight: 600 }}>
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

type TemplateRow = {
  id_template?: number; localKey: string; kd_jenis_prw: string;
  pemeriksaan: string; satuan: string;
  nilai_rujukan_ld: string; nilai_rujukan_la: string; nilai_rujukan_pd: string; nilai_rujukan_pa: string;
  bagian_rs: number; bhp: number; bagian_perujuk: number; bagian_dokter: number; bagian_laborat: number;
  kso: number; menejemen: number; biaya_item: number; urut: number;
};

const emptyTemplateRow = (kdJenisPrw: string, urut: number): TemplateRow => ({
  localKey: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  kd_jenis_prw: kdJenisPrw,
  pemeriksaan: '', satuan: '',
  nilai_rujukan_ld: '', nilai_rujukan_la: '', nilai_rujukan_pd: '', nilai_rujukan_pa: '',
  bagian_rs: 0, bhp: 0, bagian_perujuk: 0, bagian_dokter: 0, bagian_laborat: 0,
  kso: 0, menejemen: 0, biaya_item: 0, urut,
});

const hitungBiayaItem = (r: TemplateRow) => r.bagian_rs + r.bhp + r.bagian_perujuk + r.bagian_dokter + r.bagian_laborat + r.kso + r.menejemen;

const numInputStyle: React.CSSProperties = {
  width: '100%', padding: '5px 6px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12,
  boxSizing: 'border-box', outline: 'none', textAlign: 'right',
};
const textInputStyle: React.CSSProperties = { ...numInputStyle, textAlign: 'left' };
const tth: React.CSSProperties = { padding: '6px 6px', textAlign: 'left', fontSize: 10.5, fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap', background: '#f9fafb', position: 'sticky', top: 0 };
const ttd: React.CSSProperties = { padding: '3px 6px', borderBottom: '1px solid #f3f4f6' };

// ModalTemplateLaboratorium — padanan DlgTemplateLaboratorium.java: kelola
// parameter (baris) template_laboratorium utk SATU kd_jenis_prw. Dibuka
// dari dropdown "Template Laboratorium" di kolom Nama Pemeriksaan tabel
// utama. Biaya Item read-only (dihitung dari 7 komponen biaya lain, sama
// persis konvensi isCellEditable Java yg mengunci kolom itu).
const ModalTemplateLaboratorium: React.FC<{ row: TarifLabRow; onClose: () => void }> = ({ row, onClose }) => {
  const [rows, setRows] = React.useState<TemplateRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [deletingKey, setDeletingKey] = React.useState<string | null>(null);
  // pendingFocusKey — localKey baris yg baru saja ditambah lewat "+ Tambah
  // Baris", dipakai utk auto-focus ke input Pemeriksaan baris itu begitu
  // render selesai (baris baru belum punya ref sampai DOM-nya jadi, jadi
  // fokusnya dilakukan lewat effect yg jalan setelah `rows` berubah,
  // bukan langsung di dalam addRow).
  const [pendingFocusKey, setPendingFocusKey] = React.useState<string | null>(null);
  const pemeriksaanRefs = React.useRef<Record<string, HTMLInputElement | null>>({});

  React.useEffect(() => {
    if (!pendingFocusKey) return;
    const el = pemeriksaanRefs.current[pendingFocusKey];
    if (el) {
      el.focus();
      el.scrollIntoView({ block: 'center' });
      setPendingFocusKey(null);
    }
  }, [rows, pendingFocusKey]);

  const loadRows = React.useCallback(() => {
    setLoading(true);
    fetch(`/api/tarif-lab/template?kd_jenis_prw=${encodeURIComponent(row.kd_jenis_prw)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: any[]) => setRows((Array.isArray(data) ? data : []).map((d) => ({ ...d, localKey: `db-${d.id_template}` }))))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [row.kd_jenis_prw]);

  React.useEffect(() => { loadRows(); }, [loadRows]);

  const updateRow = (localKey: string, patch: Partial<TemplateRow>) => {
    setRows((prev) => prev.map((r) => (r.localKey === localKey ? { ...r, ...patch } : r)));
  };

  const addRow = () => {
    const newRow = emptyTemplateRow(row.kd_jenis_prw, rows.length + 1);
    setRows((prev) => [...prev, newRow]);
    setPendingFocusKey(newRow.localKey);
  };

  const removeRow = async (r: TemplateRow) => {
    if (!r.id_template) {
      setRows((prev) => prev.filter((x) => x.localKey !== r.localKey));
      return;
    }
    const confirm = await Swal.fire({
      title: 'Hapus Parameter?', text: r.pemeriksaan, icon: 'warning',
      showCancelButton: true, confirmButtonText: 'Hapus', cancelButtonText: 'Batal', confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;
    setDeletingKey(r.localKey);
    try {
      const res = await fetch(`/api/tarif-lab/template/${r.id_template}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus');
      setRows((prev) => prev.filter((x) => x.localKey !== r.localKey));
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setDeletingKey(null);
    }
  };

  const handleSimpanSemua = async () => {
    const kosong = rows.find((r) => !r.pemeriksaan.trim());
    if (kosong) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Nama Pemeriksaan (parameter) wajib diisi di semua baris' });
      return;
    }
    setSaving(true);
    try {
      for (const r of rows) {
        const payload = { ...r, biaya_item: hitungBiayaItem(r) };
        const url = r.id_template ? `/api/tarif-lab/template/${r.id_template}` : '/api/tarif-lab/template';
        const res = await fetch(url, {
          method: r.id_template ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Gagal menyimpan "${r.pemeriksaan}"`);
      }
      await Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Template Laboratorium tersimpan', timer: 1600, showConfirmButton: false });
      loadRows();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#ffffff', zIndex: 1200 }}>
      <div style={{ background: '#ffffff', padding: 20, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 15, color: '#111827' }}>Template Laboratorium</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{row.kd_jenis_prw} &middot; {row.nm_perawatan}</div>
          </div>
          <button
            type="button" onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: '50%', border: '1px solid #e5e7eb',
              background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, lineHeight: 1, cursor: 'pointer', color: '#6b7280', padding: 0,
            }}
          >&times;</button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, margin: '10px 0', flexShrink: 0 }}>
          <button type="button" onClick={addRow} style={{ padding: '7px 14px', borderRadius: 2, border: '1px solid #4338ca', background: '#ffffff', color: '#4338ca', cursor: 'pointer', fontSize: 12.5, fontWeight: 500 }}>
            + Tambah Baris
          </button>
          <button type="button" onClick={handleSimpanSemua} disabled={saving || rows.length === 0} style={{ padding: '7px 16px', borderRadius: 2, border: 'none', background: saving ? '#9ca3af' : '#4338ca', color: '#fff', cursor: saving || rows.length === 0 ? 'not-allowed' : 'pointer', fontSize: 12.5, fontWeight: 600 }}>
            {saving ? 'Menyimpan...' : 'Simpan Semua'}
          </button>
        </div>

        <style>{`.tarif-lab-template-table input:focus { border-color: #4338ca !important; outline: none; }`}</style>
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
          <table className="tarif-lab-template-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ ...tth, minWidth: 160 }}>Pemeriksaan</th>
                <th style={{ ...tth, width: 70 }}>Satuan</th>
                <th style={{ ...tth, width: 90 }}>N.Rujukan L.D.</th>
                <th style={{ ...tth, width: 90 }}>N.Rujukan L.A.</th>
                <th style={{ ...tth, width: 90 }}>N.Rujukan P.D.</th>
                <th style={{ ...tth, width: 90 }}>N.Rujukan P.A.</th>
                <th style={{ ...tth, textAlign: 'right', width: 90 }}>J.S. Rmh Skt</th>
                <th style={{ ...tth, textAlign: 'right', width: 90 }}>Paket BHP</th>
                <th style={{ ...tth, textAlign: 'right', width: 90 }}>J.M. Perujuk</th>
                <th style={{ ...tth, textAlign: 'right', width: 90 }}>J.M. Dokter</th>
                <th style={{ ...tth, textAlign: 'right', width: 90 }}>J.M. Laborat</th>
                <th style={{ ...tth, textAlign: 'right', width: 80 }}>K.S.O.</th>
                <th style={{ ...tth, textAlign: 'right', width: 90 }}>Menejemen</th>
                <th style={{ ...tth, textAlign: 'right', width: 100 }}>Biaya Item</th>
                <th style={{ ...tth, textAlign: 'center', width: 40 }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={15} style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>Memuat...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={15} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>Belum ada parameter — klik "+ Tambah Baris"</td></tr>
              ) : rows.map((r) => (
                <tr key={r.localKey}>
                  <td style={ttd}><input ref={(el) => { pemeriksaanRefs.current[r.localKey] = el; }} style={textInputStyle} value={r.pemeriksaan} onChange={(e) => updateRow(r.localKey, { pemeriksaan: e.target.value })} /></td>
                  <td style={ttd}><input style={textInputStyle} value={r.satuan} onChange={(e) => updateRow(r.localKey, { satuan: e.target.value })} /></td>
                  <td style={ttd}><input style={textInputStyle} value={r.nilai_rujukan_ld} onChange={(e) => updateRow(r.localKey, { nilai_rujukan_ld: e.target.value })} /></td>
                  <td style={ttd}><input style={textInputStyle} value={r.nilai_rujukan_la} onChange={(e) => updateRow(r.localKey, { nilai_rujukan_la: e.target.value })} /></td>
                  <td style={ttd}><input style={textInputStyle} value={r.nilai_rujukan_pd} onChange={(e) => updateRow(r.localKey, { nilai_rujukan_pd: e.target.value })} /></td>
                  <td style={ttd}><input style={textInputStyle} value={r.nilai_rujukan_pa} onChange={(e) => updateRow(r.localKey, { nilai_rujukan_pa: e.target.value })} /></td>
                  <td style={ttd}><input type="number" style={numInputStyle} value={r.bagian_rs} onChange={(e) => updateRow(r.localKey, { bagian_rs: Number(e.target.value) || 0 })} /></td>
                  <td style={ttd}><input type="number" style={numInputStyle} value={r.bhp} onChange={(e) => updateRow(r.localKey, { bhp: Number(e.target.value) || 0 })} /></td>
                  <td style={ttd}><input type="number" style={numInputStyle} value={r.bagian_perujuk} onChange={(e) => updateRow(r.localKey, { bagian_perujuk: Number(e.target.value) || 0 })} /></td>
                  <td style={ttd}><input type="number" style={numInputStyle} value={r.bagian_dokter} onChange={(e) => updateRow(r.localKey, { bagian_dokter: Number(e.target.value) || 0 })} /></td>
                  <td style={ttd}><input type="number" style={numInputStyle} value={r.bagian_laborat} onChange={(e) => updateRow(r.localKey, { bagian_laborat: Number(e.target.value) || 0 })} /></td>
                  <td style={ttd}><input type="number" style={numInputStyle} value={r.kso} onChange={(e) => updateRow(r.localKey, { kso: Number(e.target.value) || 0 })} /></td>
                  <td style={ttd}><input type="number" style={numInputStyle} value={r.menejemen} onChange={(e) => updateRow(r.localKey, { menejemen: Number(e.target.value) || 0 })} /></td>
                  <td style={{ ...ttd, textAlign: 'right', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>{formatRupiah(hitungBiayaItem(r))}</td>
                  <td style={{ ...ttd, textAlign: 'center' }}>
                    <button
                      type="button" onClick={() => removeRow(r)} disabled={deletingKey === r.localKey}
                      title="Hapus baris"
                      style={{ width: 24, height: 24, borderRadius: 4, border: '1px solid #fecaca', background: '#fff', color: '#dc2626', cursor: deletingKey === r.localKey ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export const TarifLabView: React.FC = () => {
  const [search, setSearch] = React.useState('');
  const [rows, setRows] = React.useState<TarifLabRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [showTambah, setShowTambah] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<TarifLabRow | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);
  const [menuKey, setMenuKey] = React.useState<string | null>(null);
  const [menuPos, setMenuPos] = React.useState<{ top: number; left: number; alignBottom?: boolean } | null>(null);
  const [templateRow, setTemplateRow] = React.useState<TarifLabRow | null>(null);
  // copySourceRow — non-null berarti "mode Copy Template" aktif: klik
  // berikutnya di baris Nama Pemeriksaan MANAPUN (kecuali baris sumber
  // sendiri) dianggap sbg pemilihan tujuan, bukan buka dropdown menu spt
  // biasa. Lihat handleCopyTemplate/handleKonfirmasiCopyTarget.
  const [copySourceRow, setCopySourceRow] = React.useState<TarifLabRow | null>(null);
  // checkedKeys — kolom "P", key-nya kd_jenis_prw (primary key jns_perawatan_lab,
  // jadi sudah unik per baris). Centang MULTI baris khusus utk hapus massal;
  // centang PERSIS SATU baris lalu klik "+ Tambah Tarif Lab" -> buka modal
  // mode edit baris itu (lihat editRow di bawah).
  const [checkedKeys, setCheckedKeys] = React.useState<Set<string>>(new Set());
  const [deletingBulk, setDeletingBulk] = React.useState(false);

  React.useEffect(() => {
    setLoading(true);
    setError('');
    const t = setTimeout(() => {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      fetch(`/api/tarif-lab/list?${params}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Gagal memuat daftar Tarif Lab'))))
        .then((data) => { setRows(Array.isArray(data) ? data : []); setCheckedKeys(new Set()); })
        .catch((err) => { setRows([]); setError(err instanceof Error ? err.message : 'Terjadi kesalahan'); })
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [search, reloadKey]);

  const toggleChecked = (kd: string) => {
    setCheckedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(kd)) next.delete(kd); else next.add(kd);
      return next;
    });
  };

  const handleHapusTerpilih = async () => {
    if (checkedKeys.size === 0) return;
    const result = await Swal.fire({
      icon: 'warning', title: 'Hapus Tarif Terpilih?',
      text: `${checkedKeys.size} baris tarif lab akan dihapus permanen.`,
      showCancelButton: true, confirmButtonColor: '#dc2626', cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Hapus', cancelButtonText: 'Batal',
    });
    if (!result.isConfirmed) return;
    setDeletingBulk(true);
    try {
      const res = await fetch('/api/tarif-lab/jenis-perawatan', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kd_jenis_prw: Array.from(checkedKeys) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus');
      setCheckedKeys(new Set());
      setReloadKey((k) => k + 1);
      Swal.fire({ icon: 'success', title: 'Berhasil!', text: `${data.deleted} baris tarif lab dihapus`, timer: 1800, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setDeletingBulk(false);
    }
  };

  // handleCopyTemplate — "Copy Template" di menu dropdown Nama Pemeriksaan:
  // notif konfirmasi dulu (tanpa dropdown pilih tujuan), klik "Salin" ->
  // modal tutup & masuk "mode pilih tujuan" (copySourceRow terisi). User
  // lanjut klik LANGSUNG baris pemeriksaan tujuan di tabel halaman ini
  // (bukan pilih dari dropdown) -> handleKonfirmasiCopyTarget yg eksekusi
  // penyalinannya & tampilkan notif berhasil.
  const handleCopyTemplate = (row: TarifLabRow) => {
    setMenuKey(null);
    setMenuPos(null);
    Swal.fire({
      icon: 'info',
      title: 'Copy Template',
      html: `Silahkan pilih nama pemeriksaan yang mau disalin template <b>${row.nm_perawatan}</b>-nya — klik langsung baris pemeriksaan tujuan di tabel Tarif Lab.`,
      showCancelButton: true,
      confirmButtonText: 'Salin',
      cancelButtonText: 'Batal',
    }).then((result) => {
      if (result.isConfirmed) setCopySourceRow(row);
    });
  };

  // handleKonfirmasiCopyTarget — dipanggil saat user klik baris pemeriksaan
  // TUJUAN sementara mode "copy template" aktif (copySourceRow != null).
  const handleKonfirmasiCopyTarget = async (targetRow: TarifLabRow) => {
    const source = copySourceRow;
    if (!source) return;
    if (source.kd_jenis_prw === targetRow.kd_jenis_prw) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Pilih pemeriksaan lain, bukan sumbernya sendiri' });
      return;
    }
    setCopySourceRow(null);
    try {
      const res = await fetch('/api/tarif-lab/template/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from_kd_jenis_prw: source.kd_jenis_prw, to_kd_jenis_prw: targetRow.kd_jenis_prw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyalin template');
      Swal.fire({ icon: 'success', title: 'Berhasil!', text: `Template berhasil disalin ke "${targetRow.nm_perawatan}"`, timer: 1800, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', minHeight: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Cari Kode / Nama Pemeriksaan / Kelas / Jenis Bayar / Kategori..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...inputStyle, width: 380 }}
        />
        {checkedKeys.size > 0 && (
          <button
            type="button"
            onClick={handleHapusTerpilih}
            disabled={deletingBulk}
            style={{ marginLeft: 'auto', padding: '8px 16px', borderRadius: 2, border: 'none', background: deletingBulk ? '#fca5a5' : '#dc2626', color: '#fff', cursor: deletingBulk ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500 }}
          >
            {deletingBulk ? 'Menghapus...' : `Hapus Terpilih (${checkedKeys.size})`}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            // Centang PERSIS SATU baris -> modal terbuka mode edit terisi
            // data baris itu; selain itu (0 atau >1 dicentang, krn multi
            // dikhususkan utk hapus massal) -> modal tambah baru kosong.
            if (checkedKeys.size === 1) {
              const kd = Array.from(checkedKeys)[0];
              const row = rows.find((r) => r.kd_jenis_prw === kd) || null;
              setEditTarget(row);
            } else {
              setEditTarget(null);
            }
            setShowTambah(true);
          }}
          style={{ marginLeft: checkedKeys.size > 0 ? undefined : 'auto', padding: '8px 16px', borderRadius: 2, border: 'none', background: '#000000', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
        >
          + Tambah Tarif Lab
        </button>
      </div>

      {error && (
        <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: 13 }}>{error}</div>
      )}

      {copySourceRow && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 14px', background: '#ecfdf5', border: '1px dashed #059669', borderRadius: 8, color: '#065f46', fontSize: 12.5 }}>
          <span>Mode Copy Template: klik pemeriksaan tujuan di tabel utk menyalin template <b>{copySourceRow.nm_perawatan}</b>-nya.</span>
          <button
            type="button"
            onClick={() => setCopySourceRow(null)}
            style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #059669', background: '#ffffff', color: '#059669', cursor: 'pointer', fontSize: 12, fontWeight: 500, flexShrink: 0 }}
          >
            Batal
          </button>
        </div>
      )}

      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 10, height: '100%' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 32, textAlign: 'center' }}>P</th>
              <th style={th}>Kode Periksa</th>
              <th style={th}>Nama Pemeriksaan</th>
              <th style={{ ...th, textAlign: 'right' }}>Jasa Sarana</th>
              <th style={{ ...th, textAlign: 'right' }}>Paket BHP</th>
              <th style={{ ...th, textAlign: 'right' }}>J.M. Perujuk</th>
              <th style={{ ...th, textAlign: 'right' }}>J.M. Dokter</th>
              <th style={{ ...th, textAlign: 'right' }}>J.M. Petugas</th>
              <th style={{ ...th, textAlign: 'right' }}>K.S.O.</th>
              <th style={{ ...th, textAlign: 'right' }}>Menejemen</th>
              <th style={{ ...th, textAlign: 'right' }}>Total Tarif</th>
              <th style={th}>Jenis Bayar</th>
              <th style={th}>Kelas</th>
              <th style={th}>Kategori</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={14} style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>Memuat...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={14} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>Tidak ada data Tarif Lab</td></tr>
            ) : rows.map((row, i) => {
              const rowKey = `${row.kd_jenis_prw}-${row.png_jawab}-${i}`;
              return (
              <tr key={rowKey} style={{ background: i % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                <td style={{ ...td, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={checkedKeys.has(row.kd_jenis_prw)}
                    onChange={() => toggleChecked(row.kd_jenis_prw)}
                    style={{ cursor: 'pointer' }}
                  />
                </td>
                <td style={{ ...td, fontFamily: 'monospace', color: '#4338ca' }}>{row.kd_jenis_prw}</td>
                <td style={{ ...td, whiteSpace: 'normal' }}>
                  <button
                    type="button"
                    onClick={(e) => {
                      // Mode "Copy Template" aktif -> klik baris ini artinya
                      // pilih sbg TUJUAN penyalinan, bukan buka dropdown menu
                      // spt biasa.
                      if (copySourceRow) {
                        handleKonfirmasiCopyTarget(row);
                        return;
                      }
                      if (menuKey === rowKey) {
                        setMenuKey(null);
                        setMenuPos(null);
                        return;
                      }
                      const rect = e.currentTarget.getBoundingClientRect();
                      const spaceBelow = window.innerHeight - rect.bottom;
                      // Dropdown tampil ke KANAN tombol (persis pola dropdown
                      // dokter di RawatJalan.tsx) — position:fixed dihitung
                      // dari getBoundingClientRect supaya lepas dari clipping
                      // overflow:auto container tabel, bukan position:absolute
                      // relatif ke <td> spt sebelumnya.
                      if (spaceBelow < 150) {
                        setMenuPos({ top: rect.bottom, left: rect.right + 8, alignBottom: true });
                      } else {
                        setMenuPos({ top: rect.top, left: rect.right + 8, alignBottom: false });
                      }
                      setMenuKey(rowKey);
                    }}
                    style={{
                      width: '100%', textAlign: 'left', padding: '5px 8px', borderRadius: 2,
                      border: copySourceRow ? '1px dashed #059669' : '1px solid #4338ca',
                      background: copySourceRow ? '#ecfdf5' : menuKey === rowKey ? '#4338ca' : '#ffffff',
                      color: copySourceRow ? '#059669' : menuKey === rowKey ? '#ffffff' : '#4338ca',
                      fontWeight: 400, fontSize: 12, cursor: 'pointer',
                    }}
                  >
                    {row.nm_perawatan}
                  </button>
                  {menuKey === rowKey && menuPos && (
                    <>
                      <div style={{ position: 'fixed', inset: 0, zIndex: 20 }} onClick={() => { setMenuKey(null); setMenuPos(null); }} />
                      <div
                        style={{
                          position: 'fixed', top: menuPos.top, left: menuPos.left,
                          transform: menuPos.alignBottom ? 'translateY(-100%)' : 'none', zIndex: 21,
                          background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 4,
                          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.15)', minWidth: 190, overflow: 'hidden',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            // Cara KEDUA masuk mode edit (selain centang "P"
                            // lalu klik "+ Tambah Tarif Lab") — klik langsung
                            // nama pemeriksaan di baris ini, sama tujuan
                            // (buka ModalTambahTarifLab dgn editRow terisi).
                            setMenuKey(null); setMenuPos(null);
                            setEditTarget(row);
                            setShowTambah(true);
                          }}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', borderBottom: '1px solid #f3f4f6', background: '#ffffff', color: '#111827', fontSize: 12.5, cursor: 'pointer' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4338ca" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
                          </svg>
                          Ubah Pemeriksaan
                        </button>
                        <button
                          type="button"
                          onClick={() => { setMenuKey(null); setMenuPos(null); setTemplateRow(row); }}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', borderBottom: '1px solid #f3f4f6', background: '#ffffff', color: '#111827', fontSize: 12.5, cursor: 'pointer' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4338ca" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            <path d="M9 2h6a1 1 0 0 1 1 1v2H8V3a1 1 0 0 1 1-1Z"></path>
                            <path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"></path>
                            <line x1="8" y1="11" x2="16" y2="11"></line>
                            <line x1="8" y1="15" x2="16" y2="15"></line>
                            <line x1="8" y1="19" x2="13" y2="19"></line>
                          </svg>
                          Template Laboratorium
                        </button>
                        <button
                          type="button"
                          onClick={() => { setMenuKey(null); setMenuPos(null); Swal.fire({ icon: 'info', title: 'Segera Hadir', text: 'Fitur Data Sampah akan dikembangkan.' }); }}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', borderBottom: '1px solid #f3f4f6', background: '#ffffff', color: '#111827', fontSize: 12.5, cursor: 'pointer' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4338ca" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                          </svg>
                          Data Sampah
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyTemplate(row)}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: '#ffffff', color: '#111827', fontSize: 12.5, cursor: 'pointer' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4338ca" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                          </svg>
                          Copy Template
                        </button>
                      </div>
                    </>
                  )}
                </td>
                <td style={{ ...td, textAlign: 'right' }}>{formatRupiah(row.bagian_rs)}</td>
                <td style={{ ...td, textAlign: 'right' }}>{formatRupiah(row.bhp)}</td>
                <td style={{ ...td, textAlign: 'right' }}>{formatRupiah(row.tarif_perujuk)}</td>
                <td style={{ ...td, textAlign: 'right' }}>{formatRupiah(row.tarif_tindakan_dokter)}</td>
                <td style={{ ...td, textAlign: 'right' }}>{formatRupiah(row.tarif_tindakan_petugas)}</td>
                <td style={{ ...td, textAlign: 'right' }}>{formatRupiah(row.kso)}</td>
                <td style={{ ...td, textAlign: 'right' }}>{formatRupiah(row.menejemen)}</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 600, color: '#111827' }}>{formatRupiah(row.total_byr)}</td>
                <td style={td}>{row.png_jawab}</td>
                <td style={td}>{row.kelas}</td>
                <td style={td}>{row.kategori}</td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!loading && (
        <div
          style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 4,
            padding: '2px 8px', borderRadius: 10,
            fontSize: 11, color: '#6b7280', pointerEvents: 'none',
          }}
        >
          {rows.length} baris
        </div>
      )}
      </div>

      {showTambah && (
        <ModalTambahTarifLab
          editRow={editTarget}
          onClose={() => { setShowTambah(false); setEditTarget(null); }}
          onSaved={() => { setReloadKey((k) => k + 1); setCheckedKeys(new Set()); }}
        />
      )}

      {templateRow && (
        <ModalTemplateLaboratorium row={templateRow} onClose={() => setTemplateRow(null)} />
      )}
    </div>
  );
};
