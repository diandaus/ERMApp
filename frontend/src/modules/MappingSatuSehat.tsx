import React from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type SubMenu = 'radiologi' | 'laboratorium' | 'obat';

type MappingRow = {
  kd_jenis_prw: string;
  nm_perawatan: string;
  code: string;
  system: string;
  display: string;
  sampel_code: string;
  sampel_system: string;
  sampel_display: string;
};

type LoincItem = {
  loinc_num: string;
  long_common_name: string;
  short_name: string;
  component: string;
  class: string;
  scale_typ: string;
  status: string;
};

type MappingForm = {
  code: string;
  system: string;
  display: string;
  sampel_code: string;
  sampel_system: string;
  sampel_display: string;
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const TH: React.CSSProperties = {
  padding: '8px 12px', textAlign: 'left', fontSize: 11,
  fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb',
  whiteSpace: 'nowrap', background: '#f9fafb',
};

const TD: React.CSSProperties = {
  padding: '8px 12px', fontSize: 12, borderBottom: '1px solid #f3f4f6',
  verticalAlign: 'middle',
};

// ─── LOINC Search Dropdown ────────────────────────────────────────────────────

function LoincSearchBox({ value, display, onChange, defaultQuery }: {
  value: string;
  display: string;
  onChange: (code: string, display: string, system: string) => void;
  defaultQuery?: string;
}) {
  const [query, setQuery] = React.useState(defaultQuery || '');
  const [results, setResults] = React.useState<LoincItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState('');
  const ref = React.useRef<HTMLDivElement>(null);

  const search = async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/mapping/loinc/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error'); setResults([]); return; }
      setResults(data.results || []);
      setOpen(true);
    } catch {
      setError('Gagal menghubungi server');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    const t = setTimeout(() => { if (query) search(query); }, 400);
    return () => clearTimeout(t);
  }, [query]);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {value && (
        <div style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 10, background: '#dcfce7', color: '#16a34a', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
            {value}
          </span>
          <span style={{ fontSize: 10, color: '#6b7280', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {display}
          </span>
          <button onClick={() => onChange('', '', '')}
            style={{ border: 'none', background: 'none', color: '#dc2626', fontSize: 12, cursor: 'pointer', padding: '0 2px' }}>✕</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 4 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={value ? 'Cari ulang...' : 'Cari nama prosedur...'}
          style={{
            flex: 1, padding: '5px 10px', borderRadius: 7, fontSize: 12,
            border: '1px solid #d1d5db', outline: 'none', minWidth: 180,
          }}
        />
        {loading && <span style={{ fontSize: 11, color: '#9ca3af', alignSelf: 'center' }}>⏳</span>}
      </div>

      {error && <div style={{ fontSize: 10, color: '#dc2626', marginTop: 2 }}>{error}</div>}

      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: '#fff', border: '1px solid #d1d5db', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)', maxHeight: 280, overflowY: 'auto',
          marginTop: 2,
        }}>
          {results.map((r, i) => (
            <div key={i}
              onClick={() => {
                onChange(r.loinc_num, r.long_common_name || r.short_name, 'http://loinc.org');
                setQuery('');
                setOpen(false);
              }}
              style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f0f9ff')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', minWidth: 70 }}>{r.loinc_num}</span>
                <span style={{ fontSize: 10, background: '#f3f4f6', color: '#6b7280', padding: '1px 5px', borderRadius: 4 }}>{r.class}</span>
                {r.status !== 'ACTIVE' && (
                  <span style={{ fontSize: 9, background: '#fef3c7', color: '#d97706', padding: '1px 5px', borderRadius: 4 }}>{r.status}</span>
                )}
              </div>
              <div style={{ fontSize: 12, color: '#111827', marginTop: 2, lineHeight: 1.3 }}>{r.long_common_name || r.short_name}</div>
              {r.component && (
                <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>{r.component} · {r.scale_typ}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Add Mapping Modal ────────────────────────────────────────────────────────

function AddMappingModal({ onClose, onSaved }: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [step, setStep] = React.useState<1 | 2>(1);
  const [search, setSearch] = React.useState('');
  const [procedures, setProcedures] = React.useState<MappingRow[]>([]);
  const [loadingProc, setLoadingProc] = React.useState(false);
  const [selected, setSelected] = React.useState<MappingRow | null>(null);
  const [form, setForm] = React.useState<MappingForm>({
    code: '', system: 'http://loinc.org', display: '',
    sampel_code: '', sampel_system: 'http://loinc.org', sampel_display: '',
  });
  const [saving, setSaving] = React.useState(false);
  const [savedOk, setSavedOk] = React.useState(false);
  const [totalAll, setTotalAll] = React.useState(0);

  const fetchProcedures = async (q: string) => {
    setLoadingProc(true);
    try {
      const res = await fetch(`/api/mapping/radiologi?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      const rows: MappingRow[] = data.list || [];
      // unmapped first, then alphabetical
      rows.sort((a, b) => {
        if (!a.code && b.code) return -1;
        if (a.code && !b.code) return 1;
        return a.nm_perawatan.localeCompare(b.nm_perawatan);
      });
      setProcedures(rows);
      if (!q) setTotalAll(data.total || rows.length);
    } finally {
      setLoadingProc(false);
    }
  };

  // Initial load — fetch all
  React.useEffect(() => { fetchProcedures(''); }, []);

  // Debounced server-side search
  React.useEffect(() => {
    const t = setTimeout(() => fetchProcedures(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const handleSelectProcedure = (row: MappingRow) => {
    setSelected(row);
    setForm({
      code: row.code || '',
      system: row.system || 'http://loinc.org',
      display: row.display || '',
      sampel_code: row.sampel_code || '',
      sampel_system: row.sampel_system || 'http://loinc.org',
      sampel_display: row.sampel_display || '',
    });
    setStep(2);
  };

  const handleLoincChange = (code: string, display: string, system: string) => {
    if (!code) {
      setForm(prev => ({ ...prev, code: '', display: '', system: 'http://loinc.org' }));
      return;
    }
    setForm(prev => ({
      code,
      system: system || 'http://loinc.org',
      display,
      sampel_code: prev.sampel_code || code,
      sampel_system: prev.sampel_system || system || 'http://loinc.org',
      sampel_display: prev.sampel_display || display,
    }));
  };

  const handleSave = async () => {
    if (!selected || !form.code) return;
    setSaving(true);
    try {
      const payload = {
        ...selected,
        code: form.code,
        system: form.system,
        display: form.display,
        sampel_code: form.sampel_code || form.code,
        sampel_system: form.sampel_system || form.system,
        sampel_display: form.sampel_display || form.display,
      };
      const res = await fetch(`/api/mapping/radiologi/${selected.kd_jenis_prw}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setSavedOk(true);
        onSaved();
        setTimeout(onClose, 900);
      }
    } finally {
      setSaving(false);
    }
  };

  const fieldRows: { label: string; field: keyof MappingForm }[] = [
    { label: 'code',           field: 'code' },
    { label: 'system',         field: 'system' },
    { label: 'display',        field: 'display' },
    { label: 'sampel_code',    field: 'sampel_code' },
    { label: 'sampel_system',  field: 'sampel_system' },
    { label: 'sampel_display', field: 'sampel_display' },
  ];

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16,
      }}
    >
      <div style={{
        background: '#fff', borderRadius: 14, width: '100%', maxWidth: 580,
        boxShadow: '0 20px 48px rgba(0,0,0,0.2)', display: 'flex',
        flexDirection: 'column', maxHeight: '90vh',
      }}>

        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #e5e7eb',
          display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
              {step === 1 ? '📋 Pilih Jenis Pemeriksaan' : '🔬 Isi Mapping LOINC'}
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>Langkah {step} dari 2</div>
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {[1, 2].map(s => (
              <div key={s} style={{
                width: 32, height: 4, borderRadius: 2,
                background: s <= step ? '#2563eb' : '#e5e7eb',
                transition: 'background 0.25s',
              }} />
            ))}
          </div>
          <button onClick={onClose} style={{
            border: 'none', background: 'none', fontSize: 20, cursor: 'pointer',
            color: '#9ca3af', padding: '0 4px', lineHeight: 1,
          }}>×</button>
        </div>

        {/* ── Step 1: Procedure List ── */}
        {step === 1 && (
          <>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cari nama atau kode pemeriksaan..."
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 8,
                  border: '1px solid #d1d5db', fontSize: 12, outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ overflowY: 'auto', flex: 1 }}>
              {loadingProc ? (
                <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Memuat...</div>
              ) : procedures.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                  Tidak ada hasil untuk "<strong>{search}</strong>"
                </div>
              ) : procedures.map(p => (
                <div
                  key={p.kd_jenis_prw}
                  onClick={() => handleSelectProcedure(p)}
                  style={{
                    padding: '10px 20px', cursor: 'pointer',
                    borderBottom: '1px solid #f9fafb',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f0f9ff')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.nm_perawatan}
                    </div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
                      Kode: {p.kd_jenis_prw}
                    </div>
                  </div>
                  {p.code ? (
                    <span style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 10,
                      background: '#dcfce7', color: '#16a34a', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0,
                    }}>
                      ✓ {p.code}
                    </span>
                  ) : (
                    <span style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 10,
                      background: '#fef3c7', color: '#d97706', whiteSpace: 'nowrap', flexShrink: 0,
                    }}>
                      Belum
                    </span>
                  )}
                  <span style={{ color: '#d1d5db', fontSize: 18, flexShrink: 0 }}>›</span>
                </div>
              ))}
            </div>

            <div style={{
              padding: '10px 20px', borderTop: '1px solid #f3f4f6',
              fontSize: 11, color: '#9ca3af', flexShrink: 0,
            }}>
              {procedures.length} ditampilkan · {totalAll} total pemeriksaan
            </div>
          </>
        )}

        {/* ── Step 2: LOINC Mapping Form ── */}
        {step === 2 && selected && (
          <>
            <div style={{ overflowY: 'auto', flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Selected procedure info */}
              <div style={{
                background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8,
                padding: '10px 14px',
              }}>
                <div style={{ fontSize: 10, color: '#0284c7', fontWeight: 600, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Jenis Pemeriksaan Dipilih
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0c4a6e' }}>{selected.nm_perawatan}</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>Kode: <strong>{selected.kd_jenis_prw}</strong></div>
              </div>

              {/* LOINC Search */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  Cari Kode LOINC
                  <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 400 }}>
                    — otomatis mencari berdasarkan nama pemeriksaan
                  </span>
                </div>
                <LoincSearchBox
                  value={form.code}
                  display={form.display}
                  onChange={handleLoincChange}
                  defaultQuery={selected.nm_perawatan}
                />
              </div>

              {/* Fields preview — shown when code is filled */}
              {form.code ? (
                <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 10 }}>
                    Data yang akan disimpan ke{' '}
                    <code style={{ background: '#e5e7eb', padding: '1px 5px', borderRadius: 3, fontSize: 10 }}>
                      satu_sehat_mapping_radiologi
                    </code>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {fieldRows.map(({ label, field }) => {
                      const val = form[field] || (field.startsWith('sampel_')
                        ? form[field.replace('sampel_', '') as keyof MappingForm]
                        : '');
                      return (
                        <div key={label} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                          <div style={{
                            fontSize: 10, fontFamily: 'monospace', color: '#6b7280',
                            minWidth: 120, paddingTop: 3, flexShrink: 0,
                          }}>
                            {label}
                          </div>
                          <div style={{ flex: 1 }}>
                            <input
                              value={form[field] || ''}
                              onChange={e => setForm(prev => ({ ...prev, [field]: e.target.value }))}
                              placeholder={field.startsWith('sampel_') ? `(default: ${val || '—'})` : ''}
                              style={{
                                width: '100%', padding: '4px 8px', borderRadius: 5,
                                border: '1px solid #e5e7eb', fontSize: 11,
                                background: form[field] ? '#fff' : '#f9fafb',
                                color: '#111827', boxSizing: 'border-box',
                                fontFamily: field === 'system' || field === 'sampel_system' ? 'monospace' : 'inherit',
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 10 }}>
                    Field <code>sampel_*</code> otomatis terisi sama dengan field utama jika dikosongkan.
                  </div>
                </div>
              ) : (
                <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 12, background: '#f9fafb', borderRadius: 8 }}>
                  Pilih kode LOINC dari hasil pencarian di atas — semua field akan terisi otomatis
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{
              padding: '12px 20px', borderTop: '1px solid #e5e7eb',
              display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0,
            }}>
              <button onClick={() => { setStep(1); setSavedOk(false); }} style={{
                padding: '7px 16px', borderRadius: 7, border: '1px solid #d1d5db',
                background: '#fff', color: '#374151', fontSize: 12, cursor: 'pointer',
              }}>
                ← Kembali
              </button>
              <div style={{ flex: 1 }} />
              <button onClick={onClose} style={{
                padding: '7px 16px', borderRadius: 7, border: '1px solid #d1d5db',
                background: '#fff', color: '#374151', fontSize: 12, cursor: 'pointer',
              }}>
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={!form.code || saving || savedOk}
                style={{
                  padding: '7px 20px', borderRadius: 7, border: 'none', fontSize: 12,
                  cursor: form.code && !saving && !savedOk ? 'pointer' : 'not-allowed',
                  background: savedOk ? '#16a34a' : form.code ? '#2563eb' : '#e5e7eb',
                  color: form.code ? '#fff' : '#9ca3af', fontWeight: 600,
                  transition: 'background 0.2s',
                }}
              >
                {saving ? 'Menyimpan...' : savedOk ? '✓ Tersimpan!' : 'Simpan Mapping'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Mapping Radiologi ────────────────────────────────────────────────────────

// Diekspor krn dipakai ulang sbg tab "Mapping Tindakan Radiologi" di dalam
// Pengaturan Satu Sehat (SatuSehat.tsx) — komponen ini sudah lengkap &
// teruji (search/filter/edit/simpan + kredensial LOINC), jadi reuse
// langsung alih2 duplikasi ~300 baris logic yg sama.
export function MappingRadiologi() {
  const [list, setList] = React.useState<MappingRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [keyword, setKeyword] = React.useState('');
  const [filter, setFilter] = React.useState<'semua' | 'sudah' | 'belum'>('semua');
  const [saving, setSaving] = React.useState<Set<string>>(new Set());
  const [saved, setSaved] = React.useState<Set<string>>(new Set());
  const [edits, setEdits] = React.useState<Record<string, Partial<MappingRow>>>({});
  const [summary, setSummary] = React.useState({ total: 0, sudah: 0, belum: 0 });
  const [showAddModal, setShowAddModal] = React.useState(false);

  // LOINC credentials
  const [loincUser, setLoincUser] = React.useState('');
  const [loincPass, setLoincPass] = React.useState('');
  const [loincOk, setLoincOk] = React.useState(false);
  const [savingCreds, setSavingCreds] = React.useState(false);
  const [showCredsForm, setShowCredsForm] = React.useState(false);

  const fetchList = async (q = '') => {
    setLoading(true);
    try {
      const res = await fetch(`/api/mapping/radiologi?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setList(data.list || []);
      setSummary({ total: data.total || 0, sudah: data.sudah || 0, belum: data.belum || 0 });
    } finally {
      setLoading(false);
    }
  };

  const fetchLoincConfig = async () => {
    const res = await fetch('/api/mapping/loinc/config');
    const data = await res.json();
    setLoincUser(data.loinc_username || '');
    setLoincOk(!!data.loinc_password_ok);
  };

  React.useEffect(() => {
    fetchList();
    fetchLoincConfig();
  }, []);

  const saveCredentials = async () => {
    setSavingCreds(true);
    try {
      await fetch('/api/mapping/loinc/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loinc_username: loincUser, loinc_password: loincPass }),
      });
      setLoincOk(true);
      setLoincPass('');
      setShowCredsForm(false);
    } finally {
      setSavingCreds(false);
    }
  };

  const getEdit = (row: MappingRow): MappingRow => ({ ...row, ...edits[row.kd_jenis_prw] });

  const handleSave = async (kd: string) => {
    const row = getEdit(list.find(r => r.kd_jenis_prw === kd)!);
    setSaving(prev => new Set(prev).add(kd));
    try {
      const res = await fetch(`/api/mapping/radiologi/${kd}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(row),
      });
      if (res.ok) {
        setSaved(prev => new Set(prev).add(kd));
        setTimeout(() => setSaved(prev => { const s = new Set(prev); s.delete(kd); return s; }), 2000);
        fetchList(keyword);
      }
    } finally {
      setSaving(prev => { const s = new Set(prev); s.delete(kd); return s; });
    }
  };

  const handleDelete = async (kd: string) => {
    if (!confirm('Hapus mapping untuk ' + kd + '?')) return;
    await fetch(`/api/mapping/radiologi/${kd}`, { method: 'DELETE' });
    fetchList(keyword);
  };

  const filtered = list.filter(r => {
    if (filter === 'sudah') return r.code !== '';
    if (filter === 'belum') return r.code === '';
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* LOINC Credentials */}
      <div style={{
        background: loincOk ? '#f0fdf4' : '#fffbeb',
        border: `1px solid ${loincOk ? '#bbf7d0' : '#fde68a'}`,
        borderRadius: 10, padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: loincOk ? '#16a34a' : '#d97706' }}>
          {loincOk ? '✓ LOINC API Terhubung' : '⚠ LOINC API belum dikonfigurasi'}
        </span>
        {loincOk && loincUser && (
          <span style={{ fontSize: 11, color: '#6b7280' }}>({loincUser})</span>
        )}
        <button onClick={() => setShowCredsForm(v => !v)}
          style={{ marginLeft: 'auto', padding: '4px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer', border: '1px solid #d1d5db', background: '#fff', color: '#374151' }}>
          {showCredsForm ? 'Tutup' : loincOk ? 'Ubah Kredensial' : 'Masukkan Kredensial'}
        </button>
      </div>

      {showCredsForm && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Username LOINC</div>
            <input value={loincUser} onChange={e => setLoincUser(e.target.value)}
              placeholder="email@example.com"
              style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 12, width: 220 }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Password LOINC</div>
            <input type="password" value={loincPass} onChange={e => setLoincPass(e.target.value)}
              placeholder={loincOk ? '(tidak diubah)' : 'Password'}
              style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 12, width: 200 }} />
          </div>
          <button onClick={saveCredentials} disabled={savingCreds || !loincUser}
            style={{ padding: '6px 16px', borderRadius: 7, border: 'none', background: '#2563eb', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>
            {savingCreds ? 'Menyimpan...' : 'Simpan'}
          </button>
          <div style={{ fontSize: 10, color: '#6b7280', width: '100%' }}>
            Daftar akun gratis di <strong>loinc.org</strong> → My LOINC → API Access
          </div>
        </div>
      )}

      {/* Toolbar: Summary + Filter + Search + Tambah */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {([
            { k: 'semua', label: `Semua (${summary.total})`, color: '#374151', bg: '#f3f4f6' },
            { k: 'sudah', label: `Sudah (${summary.sudah})`, color: '#16a34a', bg: '#dcfce7' },
            { k: 'belum', label: `Belum (${summary.belum})`, color: '#d97706', bg: '#fef3c7' },
          ] as const).map(f => (
            <button key={f.k} onClick={() => setFilter(f.k)} style={{
              padding: '4px 12px', borderRadius: 20, fontSize: 11, cursor: 'pointer',
              fontWeight: filter === f.k ? 600 : 400,
              border: filter === f.k ? `1px solid ${f.color}` : '1px solid #e5e7eb',
              background: filter === f.k ? f.bg : '#fff',
              color: filter === f.k ? f.color : '#6b7280',
            }}>{f.label}</button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          <input value={keyword} onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchList(keyword)}
            placeholder="Cari nama pemeriksaan..."
            style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 12, width: 200 }} />
          <button onClick={() => fetchList(keyword)} disabled={loading}
            style={{ padding: '5px 14px', borderRadius: 7, border: 'none', background: '#64748b', color: '#fff', fontSize: 12, cursor: 'pointer' }}>
            {loading ? '⏳' : 'Cari'}
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              padding: '5px 16px', borderRadius: 7, border: 'none',
              background: '#2563eb', color: '#fff', fontSize: 12,
              cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            <span style={{ fontSize: 14, lineHeight: 1 }}>+</span> Tambah
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {summary.total > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, height: 6, borderRadius: 4, background: '#f3f4f6', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 4,
              background: 'linear-gradient(90deg, #16a34a, #22c55e)',
              width: `${Math.round((summary.sudah / summary.total) * 100)}%`,
              transition: 'width 0.5s',
            }} />
          </div>
          <span style={{ fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap' }}>
            {Math.round((summary.sudah / summary.total) * 100)}% selesai
          </span>
        </div>
      )}

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', maxHeight: '60vh', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}>
              <tr>
                <th style={TH}>Kode</th>
                <th style={TH}>Nama Pemeriksaan</th>
                <th style={{ ...TH, minWidth: 280 }}>Cari & Pilih Kode LOINC</th>
                <th style={TH}>Kode LOINC</th>
                <th style={TH}>Display</th>
                <th style={TH}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>Tidak ada data</td></tr>
              ) : filtered.map(row => {
                const ed = getEdit(row);
                const isSaved = saved.has(row.kd_jenis_prw);
                const isSaving = saving.has(row.kd_jenis_prw);
                const hasMapping = !!row.code;
                const isEdited = !!edits[row.kd_jenis_prw];

                return (
                  <tr key={row.kd_jenis_prw} style={{ background: isSaved ? '#f0fdf4' : hasMapping ? '#fff' : '#fffbeb' }}>
                    <td style={{ ...TD, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>
                      {row.kd_jenis_prw}
                    </td>
                    <td style={{ ...TD, maxWidth: 200 }}>
                      <div style={{ fontWeight: 500, color: '#111827' }}>{row.nm_perawatan}</div>
                      {hasMapping && (
                        <div style={{ fontSize: 10, color: '#16a34a', marginTop: 2 }}>✓ sudah mapping</div>
                      )}
                    </td>
                    <td style={{ ...TD, minWidth: 280 }}>
                      <LoincSearchBox
                        value={ed.code || ''}
                        display={ed.display || ''}
                        onChange={(code, display, system) => {
                          setEdits(prev => ({
                            ...prev,
                            [row.kd_jenis_prw]: {
                              ...prev[row.kd_jenis_prw],
                              code, display, system,
                              sampel_code: code,
                              sampel_system: system,
                              sampel_display: display,
                            },
                          }));
                        }}
                      />
                    </td>
                    <td style={{ ...TD, fontFamily: 'monospace', color: '#2563eb', whiteSpace: 'nowrap' }}>
                      {ed.code || <span style={{ color: '#d1d5db' }}>—</span>}
                    </td>
                    <td style={{ ...TD, maxWidth: 200, color: '#374151' }}>
                      <div style={{ fontSize: 11 }}>{ed.display || <span style={{ color: '#d1d5db' }}>—</span>}</div>
                      {ed.system && (
                        <div style={{ fontSize: 9, color: '#9ca3af' }}>{ed.system}</div>
                      )}
                    </td>
                    <td style={{ ...TD, whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => handleSave(row.kd_jenis_prw)}
                          disabled={isSaving || (!ed.code && !isEdited)}
                          style={{
                            padding: '4px 10px', borderRadius: 6, border: 'none', fontSize: 11,
                            cursor: ed.code ? 'pointer' : 'not-allowed', fontWeight: 500,
                            background: isSaved ? '#16a34a' : ed.code ? '#2563eb' : '#e5e7eb',
                            color: ed.code ? '#fff' : '#9ca3af',
                          }}>
                          {isSaving ? '...' : isSaved ? '✓' : 'Simpan'}
                        </button>
                        {row.code && (
                          <button onClick={() => handleDelete(row.kd_jenis_prw)}
                            style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #fecaca', background: '#fff', color: '#dc2626', fontSize: 11, cursor: 'pointer' }}>
                            ✕
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ fontSize: 11, color: '#9ca3af' }}>
        Data disimpan ke tabel <code>satu_sehat_mapping_radiologi</code> · {filtered.length} ditampilkan dari {summary.total} total
      </div>

      {/* Add Mapping Modal */}
      {showAddModal && (
        <AddMappingModal
          onClose={() => setShowAddModal(false)}
          onSaved={() => fetchList(keyword)}
        />
      )}
    </div>
  );
}

// ─── Placeholder sub-menus ────────────────────────────────────────────────────

function ComingSoon({ label }: { label: string }) {
  return (
    <div style={{ padding: 48, textAlign: 'center', color: '#9ca3af' }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>🚧</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>{label}</div>
      <div style={{ fontSize: 12, marginTop: 4 }}>Segera tersedia</div>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export const MappingSatuSehatView: React.FC = () => {
  const [activeMenu, setActiveMenu] = React.useState<SubMenu>('radiologi');

  const menus: { key: SubMenu; label: string; icon: string }[] = [
    { key: 'radiologi',    icon: '🩻', label: 'Radiologi' },
    { key: 'laboratorium', icon: '🧪', label: 'Laboratorium' },
    { key: 'obat',         icon: '💊', label: 'Obat' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%' }}>

      {/* Header */}
      <div style={{ padding: '16px 20px 0', borderBottom: '1px solid #e5e7eb', background: '#fff' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 12 }}>
          🗂️ Mapping Satu Sehat
        </div>
        <div style={{ display: 'flex', gap: 2 }}>
          {menus.map(m => (
            <button key={m.key} onClick={() => setActiveMenu(m.key)} style={{
              padding: '8px 20px', borderRadius: '8px 8px 0 0', fontSize: 12, cursor: 'pointer',
              border: '1px solid #e5e7eb',
              borderBottom: activeMenu === m.key ? '1px solid #fff' : '1px solid #e5e7eb',
              background: activeMenu === m.key ? '#fff' : '#f9fafb',
              color: activeMenu === m.key ? '#2563eb' : '#6b7280',
              fontWeight: activeMenu === m.key ? 600 : 400,
              marginBottom: activeMenu === m.key ? -1 : 0,
            }}>
              {m.icon} {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: 20, overflowY: 'auto' }}>
        {activeMenu === 'radiologi'    && <MappingRadiologi />}
        {activeMenu === 'laboratorium' && <ComingSoon label="Mapping Laboratorium Satu Sehat" />}
        {activeMenu === 'obat'         && <ComingSoon label="Mapping Obat Satu Sehat" />}
      </div>
    </div>
  );
};
