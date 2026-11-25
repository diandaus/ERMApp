import React from 'react';
import Swal from 'sweetalert2';

type TemplateCatatan = { id: number; kd_dokter: string; nama_template: string; isi: string };

type CatatanDokterTabProps = {
  patient: any;
};

// CatatanDokterTab — padanan tab "Catatan Dokter" di DlgRawatJalan.java
// (Khanza Desktop): log catatan bebas per kunjungan (tabel
// catatan_perawatan), terpisah dari SOAP/CPPT. Dokter otomatis memakai DPJP
// kunjungan ini (patient.kd_dokter), sama seperti KdDok3 yang di Java
// auto-terisi dari KdDok saat form dibuka — tidak perlu cari dokter manual.
export const CatatanDokterTab: React.FC<CatatanDokterTabProps> = ({ patient }) => {
  const [list, setList] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [catatan, setCatatan] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [templates, setTemplates] = React.useState<TemplateCatatan[]>([]);
  const [loadingTemplate, setLoadingTemplate] = React.useState(false);
  const kdDokter = patient.kd_dokter || '';

  const fetchTemplates = React.useCallback(async () => {
    if (!kdDokter) { setTemplates([]); return; }
    setLoadingTemplate(true);
    try {
      const res = await fetch(`/api/pemeriksaan/template-catatan-dokter?kd_dokter=${encodeURIComponent(kdDokter)}`);
      const data = res.ok ? await res.json() : [];
      setTemplates(Array.isArray(data) ? data : []);
    } catch {
      setTemplates([]);
    } finally {
      setLoadingTemplate(false);
    }
  }, [kdDokter]);

  React.useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const [showTemplateModal, setShowTemplateModal] = React.useState(false);

  // POST template baru (milik DPJP kunjungan ini). true = berhasil.
  const postTemplate = async (nama: string, isi: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/pemeriksaan/template-catatan-dokter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kd_dokter: kdDokter, nama_template: nama.trim(), isi: isi.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Gagal menyimpan template');
      }
      await fetchTemplates();
      return true;
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message || 'Gagal menyimpan template' });
      return false;
    }
  };

  // Jadikan catatan (dari riwayat) sbg template bernama.
  const handleJadikanTemplate = async (isi: string) => {
    if (!isi.trim()) return;
    const { value: nama } = await Swal.fire({
      title: 'Simpan Template',
      input: 'text',
      inputLabel: 'Nama template',
      inputPlaceholder: 'mis. Kontrol 1 minggu',
      showCancelButton: true,
      confirmButtonColor: '#1AB1E5',
      confirmButtonText: 'Simpan',
      cancelButtonText: 'Batal',
      inputValidator: (v) => (!v || !v.trim() ? 'Nama template wajib diisi' : undefined),
    });
    if (!nama) return;
    await postTemplate(String(nama), isi);
  };

  // Pakai template: form kosong -> diisi; sudah ada isi -> ditambahkan di bawahnya.
  const handlePakaiTemplate = (t: TemplateCatatan) => {
    setCatatan((prev) => (prev.trim() ? `${prev.replace(/\s+$/, '')}\n${t.isi}` : t.isi));
  };

  const handleHapusTemplate = async (t: TemplateCatatan): Promise<boolean> => {
    const result = await Swal.fire({
      title: 'Hapus Template?',
      text: `Template "${t.nama_template}" akan dihapus.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
    });
    if (!result.isConfirmed) return false;
    try {
      const res = await fetch(`/api/pemeriksaan/template-catatan-dokter/${t.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Gagal menghapus template');
      await fetchTemplates();
      return true;
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message || 'Gagal menghapus template' });
      return false;
    }
  };

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pemeriksaan/catatan-dokter/${encodeURIComponent(patient.no_rawat)}`);
      const data = res.ok ? await res.json() : [];
      setList(Array.isArray(data) ? data : []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [patient.no_rawat]);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  const handleSimpan = async () => {
    if (!catatan.trim()) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Catatan wajib diisi!' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/pemeriksaan/catatan-dokter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          no_rawat: patient.no_rawat,
          kd_dokter: patient.kd_dokter || '',
          catatan: catatan.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal menyimpan catatan dokter');
      }
      setCatatan('');
      fetchData();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message || 'Terjadi kesalahan' });
    } finally {
      setSaving(false);
    }
  };

  const handleHapus = async (item: any) => {
    const result = await Swal.fire({
      title: 'Hapus Catatan?',
      text: 'Catatan ini akan dihapus permanen.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
    });
    if (!result.isConfirmed) return;
    try {
      const params = new URLSearchParams({
        no_rawat: patient.no_rawat,
        tanggal: item.tanggal,
        jam: item.jam,
        kd_dokter: item.kd_dokter,
      });
      const res = await fetch(`/api/pemeriksaan/catatan-dokter?${params}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Gagal menghapus catatan');
      fetchData();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message || 'Gagal menghapus catatan' });
    }
  };

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
    <div style={{ width: '70%', minWidth: 0 }}>
      {/* Form Tambah Catatan */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 0, padding: 16, background: '#ffffff', marginBottom: 20 }}>
        <textarea
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          placeholder="Tulis catatan dokter untuk kunjungan ini..."
          rows={4}
          style={{
            width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 0,
            fontSize: 13, boxSizing: 'border-box', outline: 'none', resize: 'vertical', fontFamily: 'inherit',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 10 }}>
          <button
            onClick={handleSimpan}
            disabled={saving}
            style={{
              padding: '8px 16px', background: '#1AB1E5', color: '#ffffff',
              border: 'none', borderRadius: 0, fontSize: 13, fontWeight: 400,
              cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1,
              display: 'flex', alignItems: 'center', gap: 6, transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => { if (!saving) e.currentTarget.style.background = '#0891B2'; }}
            onMouseLeave={(e) => { if (!saving) e.currentTarget.style.background = '#1AB1E5'; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            {saving ? 'Menyimpan...' : 'Tambah Catatan'}
          </button>
        </div>
      </div>

      {/* Riwayat Catatan */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
          <div style={{ display: 'inline-block', width: 30, height: 30, border: '3px solid #f3f4f6', borderTop: '3px solid #1AB1E5', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <p style={{ marginTop: 12 }}>Memuat data...</p>
        </div>
      )}

      {!loading && list.length === 0 && (
        <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: 13, border: '1px dashed #e5e7eb', borderRadius: 0 }}>
          Belum ada catatan dokter untuk kunjungan ini
        </div>
      )}

      {!loading && list.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map((item, idx) => (
            <div key={idx} style={{ border: '1px solid #e5e7eb', borderRadius: 0, padding: '10px 14px', background: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
                  {item.tanggal} {item.jam} &middot; {item.nm_dokter || item.kd_dokter}
                </div>
                <div style={{ fontSize: 13, color: '#111827', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{item.catatan}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button
                onClick={() => handleJadikanTemplate(item.catatan || '')}
                style={{ padding: '6px 10px', background: '#1AB1E5', color: 'white', border: 'none', borderRadius: 0, fontSize: 11, fontWeight: 500, cursor: 'pointer', flexShrink: 0 }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#0891B2'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#1AB1E5'}
                title="Simpan catatan ini sebagai template"
              >
                + Jadikan Template
              </button>
              <button
                onClick={() => handleHapus(item)}
                style={{ padding: '6px 10px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 0, fontSize: 11, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#dc2626'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#ef4444'}
                title="Hapus Catatan"
              >
                Hapus
              </button>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>

    {/* Sidebar 30% — card "Template Catatan", gaya sama dgn card
        "Riwayat Kunjungan Terakhir" di tab SOAP (flat, radius 0, font 12). */}
    <div style={{ width: '30%', flexShrink: 0 }}>
      <div style={{ position: 'sticky', top: 0 }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 0, display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 48px)', overflow: 'auto' }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, position: 'sticky', top: 0, background: '#fff' }}>
            <span style={{ fontSize: 12, fontWeight: 400, color: '#111827' }}>Template Catatan</span>
            <button
              type="button"
              onClick={() => setShowTemplateModal(true)}
              title="Lihat detail & tambah template"
              style={{ padding: '4px 8px', borderRadius: 0, border: 'none', background: '#1AB1E5', color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 400 }}
            >
              Detail
            </button>
          </div>
          {loadingTemplate ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>Memuat...</div>
          ) : templates.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '32px 20px', color: '#6b7280' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" /></svg>
              <div style={{ fontSize: 12, textAlign: 'center' }}>Belum ada template. Klik "+ Jadikan Template" pada riwayat catatan atau tambah lewat tombol Detail.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {templates.map((t) => (
                <div key={t.id} style={{ padding: '10px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#111827', fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.nama_template}</span>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => handlePakaiTemplate(t)}
                        title="Masukkan ke form catatan"
                        style={{ padding: '3px 8px', borderRadius: 0, border: '1px solid #1AB1E5', background: '#fff', color: '#1AB1E5', cursor: 'pointer', fontSize: 11 }}
                      >
                        Pakai
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{t.isi}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
      {showTemplateModal && (
        <ModalTemplateCatatan
          templates={templates}
          onClose={() => setShowTemplateModal(false)}
          onPakai={(t) => { handlePakaiTemplate(t); setShowTemplateModal(false); }}
          onHapus={handleHapusTemplate}
          onTambah={postTemplate}
        />
      )}
      <style>{`@keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }`}</style>
    </div>
  );
};

// Modal "Template Catatan" — kiri daftar template, kanan isi lengkap template
// terpilih (Pakai / Hapus) atau form tambah template baru.
type ModalTemplateCatatanProps = {
  templates: TemplateCatatan[];
  onClose: () => void;
  onPakai: (t: TemplateCatatan) => void;
  onHapus: (t: TemplateCatatan) => Promise<boolean>;
  onTambah: (nama: string, isi: string) => Promise<boolean>;
};

const ModalTemplateCatatan: React.FC<ModalTemplateCatatanProps> = ({ templates, onClose, onPakai, onHapus, onTambah }) => {
  // null = mode tambah baru; angka = id template yg sedang dilihat.
  const [selectedId, setSelectedId] = React.useState<number | null>(templates[0]?.id ?? null);
  const [nama, setNama] = React.useState('');
  const [isi, setIsi] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const selected = templates.find((t) => t.id === selectedId) || null;
  const modeTambah = selectedId === null;

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSimpan = async () => {
    if (!nama.trim() || !isi.trim()) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Nama template dan isi wajib diisi!' });
      return;
    }
    setSaving(true);
    const ok = await onTambah(nama, isi);
    setSaving(false);
    if (ok) {
      setNama('');
      setIsi('');
    }
  };

  const btn = (bg: string, fg: string, border: string): React.CSSProperties => ({
    padding: '8px 14px', borderRadius: 0, border: `1px solid ${border}`, background: bg, color: fg, cursor: 'pointer', fontSize: 12, fontWeight: 400,
  });
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 0, fontSize: 13, boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit',
  };

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 0, width: 'min(960px, 100%)', height: 'min(640px, calc(100vh - 32px))', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        {/* Header */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Template Catatan</span>
          <button type="button" onClick={onClose} title="Tutup" style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 20, lineHeight: 1, color: '#6b7280' }}>&times;</button>
        </div>

        <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
          {/* Kiri: daftar template */}
          <div style={{ width: 280, flexShrink: 0, borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ padding: 12, borderBottom: '1px solid #e5e7eb' }}>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                style={{ ...btn(modeTambah ? '#1AB1E5' : '#fff', modeTambah ? '#fff' : '#1AB1E5', '#1AB1E5'), width: '100%' }}
              >
                + Template Baru
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              {templates.length === 0 && (
                <div style={{ padding: 16, fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>Belum ada template</div>
              )}
              {templates.map((t) => {
                const aktif = t.id === selectedId;
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedId(t.id)}
                    style={{
                      padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6',
                      background: aktif ? '#e0f2fe' : '#fff', borderLeft: aktif ? '3px solid #1AB1E5' : '3px solid transparent',
                    }}
                  >
                    <div style={{ fontSize: 13, color: '#111827', fontWeight: aktif ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.nama_template}</div>
                    <div style={{ fontSize: 11, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{t.isi.split('\n')[0]}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Kanan: detail / form tambah */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {modeTambah ? (
              <>
                <div style={{ flex: 1, minHeight: 0, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, color: '#374151', marginBottom: 4 }}>Nama Template</div>
                    <input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="mis. Kontrol 1 minggu" maxLength={100} style={inputStyle} autoFocus />
                  </div>
                  <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: 12, color: '#374151', marginBottom: 4 }}>Isi Template</div>
                    <textarea value={isi} onChange={(e) => setIsi(e.target.value)} placeholder="Tulis isi template catatan..." style={{ ...inputStyle, flex: 1, resize: 'none' }} />
                  </div>
                </div>
                <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button type="button" onClick={handleSimpan} disabled={saving} style={{ ...btn('#1AB1E5', '#fff', '#1AB1E5'), opacity: saving ? 0.7 : 1, cursor: saving ? 'default' : 'pointer' }}>
                    {saving ? 'Menyimpan...' : 'Simpan Template'}
                  </button>
                </div>
              </>
            ) : selected ? (
              <>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', fontSize: 14, fontWeight: 600, color: '#111827' }}>{selected.nama_template}</div>
                <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 16, fontSize: 13, color: '#111827', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {selected.isi}
                </div>
                <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button
                    type="button"
                    onClick={async () => { if (await onHapus(selected)) setSelectedId(templates.find((t) => t.id !== selected.id)?.id ?? null); }}
                    style={btn('#fff', '#ef4444', '#ef4444')}
                  >
                    Hapus
                  </button>
                  <button type="button" onClick={() => onPakai(selected)} style={btn('#1AB1E5', '#fff', '#1AB1E5')}>
                    Pakai
                  </button>
                </div>
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#9ca3af' }}>Pilih template di sebelah kiri</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
