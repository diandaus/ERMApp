import React from 'react';

type DisplaySettingsType = {
  id?: number;
  nama_rs: string;
  logo_url: string;
  video_url: string;
  login_wallpaper_url: string;
  running_text_poli: string;
  running_text_apotek: string;
  background_color_poli: string;
  background_color_apotek: string;
  polling_interval: number;
  tts_enabled: boolean;
  tts_rate: number;
  tts_pitch: number;
  tts_volume: number;
};

type TabKey = 'umum' | 'poli' | 'apotek' | 'tts';

// ─── Reusable field components ────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 500, color: '#374151', marginBottom: 5 }}>
      {children}
    </div>
  );
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>{children}</div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  borderRadius: 8,
  border: '1px solid #d1d5db',
  fontSize: 12,
  color: '#111827',
  outline: 'none',
  boxSizing: 'border-box',
  background: '#fff',
};

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{
        width: 40, height: 22, borderRadius: 11,
        background: checked ? '#2563eb' : '#d1d5db',
        position: 'relative', cursor: 'pointer',
        transition: 'background 0.2s', flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute',
        top: 2, left: checked ? 20 : 2,
        width: 18, height: 18, borderRadius: '50%',
        background: '#fff', transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
      }} />
    </div>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '16px 0 12px' }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>
        {label}
      </div>
      <div style={{ flex: 1, height: 1, background: '#f3f4f6' }} />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const DEFAULTS: DisplaySettingsType = {
  nama_rs: 'PUSKESMAS PIDIE',
  logo_url: '',
  video_url: '',
  login_wallpaper_url: '',
  running_text_poli: 'SELAMAT DATANG DI RUMAH SAKIT',
  running_text_apotek: 'HARAP MENUNGGU PANGGILAN NOMOR ANTRIAN ANDA',
  background_color_poli: '#1565c0',
  background_color_apotek: '#000000',
  polling_interval: 3,
  tts_enabled: true,
  tts_rate: 0.85,
  tts_pitch: 1.0,
  tts_volume: 1.0,
};

export const DisplaySettingsView: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const [activeTab, setActiveTab] = React.useState<TabKey>('umum');
  const [data, setData] = React.useState<DisplaySettingsType>(DEFAULTS);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [logoPreview, setLogoPreview] = React.useState('');
  const [logoUploading, setLogoUploading] = React.useState(false);
  const [wallpaperPreview, setWallpaperPreview] = React.useState('');
  const [wallpaperUploading, setWallpaperUploading] = React.useState(false);
  const [toast, setToast] = React.useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const videoFileRef = React.useRef<HTMLInputElement>(null);
  const wallpaperFileRef = React.useRef<HTMLInputElement>(null);

  const showToast = (type: 'ok' | 'err', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const set = <K extends keyof DisplaySettingsType>(key: K, val: DisplaySettingsType[K]) =>
    setData(prev => ({ ...prev, [key]: val }));

  // ── Fetch ──
  const fetchSettings = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/display');
      if (res.ok) {
        const d: DisplaySettingsType = await res.json();
        setData(d);
        if (d.logo_url) setLogoPreview(d.logo_url);
        if (d.login_wallpaper_url) setWallpaperPreview(d.login_wallpaper_url);
      } else {
        setData(DEFAULTS);
      }
    } catch {
      setData(DEFAULTS);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { fetchSettings(); }, [fetchSettings]);

  // ── Save ──
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/display', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        showToast('ok', 'Pengaturan berhasil disimpan');
      } else {
        const e = await res.json();
        showToast('err', e.error || 'Gagal menyimpan');
      }
    } catch {
      showToast('err', 'Gagal menyimpan pengaturan');
    } finally {
      setSaving(false);
    }
  };

  // ── Logo upload ──
  const handleLogoFile = async (file: File) => {
    if (!file.type.startsWith('image/')) { showToast('err', 'Hanya file gambar yang diperbolehkan'); return; }
    if (file.size / 1024 / 1024 >= 5) { showToast('err', 'Ukuran file maksimal 5MB'); return; }
    const reader = new FileReader();
    reader.onload = (e) => setLogoPreview(e.target?.result as string);
    reader.readAsDataURL(file);
    setLogoUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      if (res.ok) {
        const d = await res.json();
        const url = d.url || '';
        set('logo_url', url);
        setLogoPreview(url);
        showToast('ok', 'Logo berhasil diupload');
      } else {
        showToast('err', 'Gagal upload logo');
      }
    } catch { showToast('err', 'Gagal upload logo'); }
    finally { setLogoUploading(false); }
  };

  // ── Wallpaper upload ──
  const handleWallpaperFile = async (file: File) => {
    if (!file.type.startsWith('image/')) { showToast('err', 'Hanya file gambar yang diperbolehkan'); return; }
    if (file.size / 1024 / 1024 >= 8) { showToast('err', 'Ukuran file maksimal 8MB'); return; }
    const reader = new FileReader();
    reader.onload = (e) => setWallpaperPreview(e.target?.result as string);
    reader.readAsDataURL(file);
    setWallpaperUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      if (res.ok) {
        const d = await res.json();
        const url = d.url || '';
        set('login_wallpaper_url', url);
        setWallpaperPreview(url);
        showToast('ok', 'Wallpaper berhasil diupload');
      } else {
        showToast('err', 'Gagal upload wallpaper');
      }
    } catch { showToast('err', 'Gagal upload wallpaper'); }
    finally { setWallpaperUploading(false); }
  };

  // ── Video upload ──
  const handleVideoFile = async (file: File) => {
    if (!file.type.startsWith('video/')) { showToast('err', 'Hanya file video yang diperbolehkan'); return; }
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      if (res.ok) {
        const d = await res.json();
        set('video_url', d.url || '');
        showToast('ok', 'Video berhasil diupload');
      } else {
        showToast('err', 'Gagal upload video');
      }
    } catch { showToast('err', 'Gagal upload video'); }
  };

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'umum',  label: 'Umum' },
    { key: 'poli',  label: 'Display Poli' },
    { key: 'apotek',label: 'Display Apotek' },
    { key: 'tts',   label: 'Text-to-Speech' },
  ];

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
        Memuat pengaturan...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Toast */}
      {toast && (
        <div style={{
          margin: '0 0 10px 0',
          padding: '8px 12px',
          borderRadius: 8,
          fontSize: 12,
          background: toast.type === 'ok' ? '#ecfdf3' : '#fef2f2',
          color: toast.type === 'ok' ? '#166534' : '#b91c1c',
          border: `1px solid ${toast.type === 'ok' ? '#bbf7d0' : '#fecaca'}`,
        }}>
          {toast.type === 'ok' ? '✓' : '⚠'} {toast.msg}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'inline-flex', background: '#f3f4f6', borderRadius: 12, padding: 4, gap: 4, marginBottom: 14 }}>
        {tabs.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            style={{
              padding: '5px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 12,
              fontWeight: activeTab === t.key ? 500 : 400,
              border: activeTab === t.key ? '1px solid #d1d5db' : 'none',
              background: activeTab === t.key ? '#ffffff' : 'transparent',
              color: activeTab === t.key ? '#111827' : '#6b7280',
              boxShadow: activeTab === t.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Umum ── */}
      {activeTab === 'umum' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Nama RS */}
            <div>
              <FieldLabel>Nama Rumah Sakit / Puskesmas</FieldLabel>
              <input
                style={inputStyle}
                value={data.nama_rs}
                onChange={e => set('nama_rs', e.target.value)}
                placeholder="Contoh: PUSKESMAS PIDIE"
              />
            </div>
            {/* Polling interval */}
            <div>
              <FieldLabel>Interval Polling (detik)</FieldLabel>
              <input
                type="number"
                style={inputStyle}
                value={data.polling_interval}
                min={1} max={60}
                onChange={e => set('polling_interval', Number(e.target.value))}
              />
              <FieldHint>Seberapa sering display refresh data dari server</FieldHint>
            </div>
          </div>

          <SectionDivider label="Media Display" />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Logo */}
            <div>
              <FieldLabel>Logo Rumah Sakit</FieldLabel>

              {/* Drop zone */}
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#2563eb'; }}
                onDragLeave={e => { e.currentTarget.style.borderColor = '#d1d5db'; }}
                onDrop={e => {
                  e.preventDefault();
                  e.currentTarget.style.borderColor = '#d1d5db';
                  const f = e.dataTransfer.files[0];
                  if (f) handleLogoFile(f);
                }}
                style={{
                  border: '1px dashed #d1d5db', borderRadius: 8, padding: 12,
                  textAlign: 'center', cursor: 'pointer', marginBottom: 6,
                  background: '#f9fafb', transition: 'border-color 0.15s',
                  minHeight: 80, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" style={{ maxHeight: 72, maxWidth: '100%', objectFit: 'contain', borderRadius: 4 }} />
                ) : (
                  <div>
                    <div style={{ fontSize: 20, marginBottom: 4 }}>🖼️</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{logoUploading ? 'Mengupload...' : 'Klik atau drag file logo'}</div>
                    <div style={{ fontSize: 10, color: '#d1d5db', marginTop: 2 }}>JPG, PNG — maks 5MB</div>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoFile(f); }} />

              {/* URL input */}
              <div style={{ display: 'flex', gap: 4 }}>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  value={logoPreview.startsWith('data:') ? '' : logoPreview}
                  onChange={e => { setLogoPreview(e.target.value); set('logo_url', e.target.value); }}
                  placeholder="Atau masukkan URL logo..."
                />
                {logoPreview && (
                  <button
                    type="button"
                    onClick={() => { setLogoPreview(''); set('logo_url', ''); }}
                    style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #fecaca', background: '#fff', color: '#dc2626', fontSize: 12, cursor: 'pointer' }}
                    title="Hapus logo"
                  >✕</button>
                )}
              </div>
              <FieldHint>Ditampilkan di header display antrian</FieldHint>
            </div>

            {/* Video */}
            <div>
              <FieldLabel>Video URL</FieldLabel>
              <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  value={data.video_url}
                  onChange={e => set('video_url', e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                />
                <button
                  type="button"
                  onClick={() => videoFileRef.current?.click()}
                  style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  Upload
                </button>
              </div>
              <input ref={videoFileRef} type="file" accept="video/*" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleVideoFile(f); }} />
              <FieldHint>Video/iklan yang ditampilkan di layar display (YouTube atau file lokal)</FieldHint>
            </div>
          </div>

          <SectionDivider label="Halaman Login" />

          <div>
            <FieldLabel>Wallpaper Halaman Login</FieldLabel>

            {/* Drop zone */}
            <div
              onClick={() => wallpaperFileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#2563eb'; }}
              onDragLeave={e => { e.currentTarget.style.borderColor = '#d1d5db'; }}
              onDrop={e => {
                e.preventDefault();
                e.currentTarget.style.borderColor = '#d1d5db';
                const f = e.dataTransfer.files[0];
                if (f) handleWallpaperFile(f);
              }}
              style={{
                border: '1px dashed #d1d5db', borderRadius: 8, padding: 12,
                textAlign: 'center', cursor: 'pointer', marginBottom: 6,
                background: wallpaperPreview ? `center/cover no-repeat url(${wallpaperPreview})` : '#f9fafb',
                transition: 'border-color 0.15s',
                minHeight: 140, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {!wallpaperPreview && (
                <div>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>🖼️</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>{wallpaperUploading ? 'Mengupload...' : 'Klik atau drag file wallpaper'}</div>
                  <div style={{ fontSize: 10, color: '#d1d5db', marginTop: 2 }}>JPG, PNG — maks 8MB</div>
                </div>
              )}
            </div>
            <input ref={wallpaperFileRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleWallpaperFile(f); }} />

            {/* URL input */}
            <div style={{ display: 'flex', gap: 4 }}>
              <input
                style={{ ...inputStyle, flex: 1 }}
                value={wallpaperPreview.startsWith('data:') ? '' : wallpaperPreview}
                onChange={e => { setWallpaperPreview(e.target.value); set('login_wallpaper_url', e.target.value); }}
                placeholder="Atau masukkan URL wallpaper..."
              />
              {wallpaperPreview && (
                <button
                  type="button"
                  onClick={() => { setWallpaperPreview(''); set('login_wallpaper_url', ''); }}
                  style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #fecaca', background: '#fff', color: '#dc2626', fontSize: 12, cursor: 'pointer' }}
                  title="Hapus wallpaper"
                >✕</button>
              )}
            </div>
            <FieldHint>Ditampilkan sebagai latar belakang halaman login. Kosongkan untuk memakai latar default.</FieldHint>
          </div>
        </div>
      )}

      {/* ── Tab: Display Poli ── */}
      {activeTab === 'poli' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 16 }}>
          <div>
            <FieldLabel>Running Text Poli</FieldLabel>
            <textarea
              style={{ ...inputStyle, minHeight: 90, resize: 'vertical', fontFamily: 'inherit' }}
              value={data.running_text_poli}
              onChange={e => set('running_text_poli', e.target.value)}
              placeholder="SELAMAT DATANG DI RUMAH SAKIT - SILAHKAN MENUNGGU PANGGILAN"
            />
            <FieldHint>Teks yang berjalan di bagian bawah display antrian poli</FieldHint>
          </div>
          <div>
            <FieldLabel>Warna Background</FieldLabel>
            <input
              type="color"
              value={data.background_color_poli}
              onChange={e => set('background_color_poli', e.target.value)}
              style={{ width: '100%', height: 80, borderRadius: 8, border: '1px solid #d1d5db', cursor: 'pointer', padding: 4 }}
            />
            <div style={{
              marginTop: 6, padding: '8px 12px', borderRadius: 8,
              background: data.background_color_poli,
              color: '#fff', textAlign: 'center', fontSize: 11, fontWeight: 600,
            }}>
              Preview
            </div>
            <input
              style={{ ...inputStyle, marginTop: 6, textAlign: 'center', fontFamily: 'monospace', fontSize: 11 }}
              value={data.background_color_poli}
              onChange={e => set('background_color_poli', e.target.value)}
            />
          </div>
        </div>
      )}

      {/* ── Tab: Display Apotek ── */}
      {activeTab === 'apotek' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 16 }}>
          <div>
            <FieldLabel>Running Text Apotek</FieldLabel>
            <textarea
              style={{ ...inputStyle, minHeight: 90, resize: 'vertical', fontFamily: 'inherit' }}
              value={data.running_text_apotek}
              onChange={e => set('running_text_apotek', e.target.value)}
              placeholder="HARAP MENUNGGU PANGGILAN NOMOR ANTRIAN ANDA - TERIMA KASIH"
            />
            <FieldHint>Teks yang berjalan di bagian bawah display antrian apotek</FieldHint>
          </div>
          <div>
            <FieldLabel>Warna Background</FieldLabel>
            <input
              type="color"
              value={data.background_color_apotek}
              onChange={e => set('background_color_apotek', e.target.value)}
              style={{ width: '100%', height: 80, borderRadius: 8, border: '1px solid #d1d5db', cursor: 'pointer', padding: 4 }}
            />
            <div style={{
              marginTop: 6, padding: '8px 12px', borderRadius: 8,
              background: data.background_color_apotek,
              color: '#fff', textAlign: 'center', fontSize: 11, fontWeight: 600,
            }}>
              Preview
            </div>
            <input
              style={{ ...inputStyle, marginTop: 6, textAlign: 'center', fontFamily: 'monospace', fontSize: 11 }}
              value={data.background_color_apotek}
              onChange={e => set('background_color_apotek', e.target.value)}
            />
          </div>
        </div>
      )}

      {/* ── Tab: TTS ── */}
      {activeTab === 'tts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr', gap: 16, alignItems: 'start' }}>
            {/* Aktif toggle */}
            <div>
              <FieldLabel>Status TTS</FieldLabel>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 3 }}>
                <Toggle checked={data.tts_enabled} onChange={v => set('tts_enabled', v)} />
                <span style={{ fontSize: 12, color: data.tts_enabled ? '#16a34a' : '#6b7280' }}>
                  {data.tts_enabled ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>
            </div>

            {/* Rate */}
            <div>
              <FieldLabel>Kecepatan Bicara</FieldLabel>
              <input
                type="number"
                style={inputStyle}
                value={data.tts_rate}
                min={0.5} max={2.0} step={0.05}
                onChange={e => set('tts_rate', Number(e.target.value))}
              />
              <FieldHint>0.5 = lambat · 1.0 = normal · 2.0 = cepat</FieldHint>
            </div>

            {/* Pitch */}
            <div>
              <FieldLabel>Nada Suara</FieldLabel>
              <input
                type="number"
                style={inputStyle}
                value={data.tts_pitch}
                min={0.5} max={2.0} step={0.05}
                onChange={e => set('tts_pitch', Number(e.target.value))}
              />
              <FieldHint>0.5 = rendah · 1.0 = normal · 2.0 = tinggi</FieldHint>
            </div>

            {/* Volume */}
            <div>
              <FieldLabel>Volume</FieldLabel>
              <input
                type="number"
                style={inputStyle}
                value={data.tts_volume}
                min={0.0} max={1.0} step={0.1}
                onChange={e => set('tts_volume', Number(e.target.value))}
              />
              <FieldHint>0.0 = senyap · 1.0 = maksimal</FieldHint>
            </div>
          </div>

          {/* Tips box */}
          <div style={{ padding: '10px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#1d4ed8', marginBottom: 5 }}>Tips Pengaturan TTS</div>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: '#1d4ed8', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <li>Gunakan rate <strong>0.85</strong> untuk kecepatan yang nyaman didengar</li>
              <li>Pitch <strong>1.0</strong> menghasilkan suara yang natural</li>
              <li>Volume <strong>1.0</strong> untuk suara maksimal di area terbuka</li>
            </ul>
          </div>
        </div>
      )}

      {/* Bottom center actions */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20, paddingTop: 16, borderTop: '1px solid #f3f4f6' }}>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M19 12H5M5 12L12 19M5 12L12 5"/></svg>
            Kembali
          </button>
        )}
        <button
          type="button"
          onClick={fetchSettings}
          style={{ padding: '7px 20px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 12, cursor: 'pointer' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
        >
          Reset
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{ padding: '7px 24px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          {saving ? 'Menyimpan...' : 'Simpan'}
        </button>
      </div>
    </div>
  );
};
