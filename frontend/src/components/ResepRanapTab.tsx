import React from 'react';
import { localDateStr } from '../utils/date';

type RanapPatientMin = {
  no_rawat: string;
  kd_dokter?: string;
  nm_dokter?: string;
  kd_bangsal?: string;
};

type ObatItem = {
  kode_brng: string;
  nama_brng: string;
  kode_sat: string;
  stok: number;
  no_batch: string;
  no_faktur: string;
  harga_jual: number;
  h_beli: number;
};

type ResepItem = {
  kode_brng: string;
  nama_brng: string;
  kode_sat: string;
  jml: number;
  harga_jual: number;
  h_beli: number;
  total: number;
  aturan: string;
  no_batch: string;
  no_faktur: string;
};

type ResepRanap = {
  no_resep: string;
  tgl_perawatan: string;
  jam: string;
  no_rawat: string;
  kd_dokter: string;
  nm_dokter: string;
  items: ResepItem[];
};

const emptyItem = (): ResepItem => ({
  kode_brng: '', nama_brng: '', kode_sat: '', jml: 1,
  harga_jual: 0, h_beli: 0, total: 0, aturan: '', no_batch: '', no_faktur: '',
});

// --- Drug search inline dropdown ---
const ObatSearchField: React.FC<{
  value: string;
  kdBangsal: string;
  onSelect: (o: ObatItem) => void;
}> = ({ value, kdBangsal, onSelect }) => {
  const [query, setQuery] = React.useState(value);
  const [results, setResults] = React.useState<ObatItem[]>([]);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => { setQuery(value); }, [value]);

  const search = (q: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (q.trim().length < 2) { setResults([]); setOpen(false); return; }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const url = `/api/resep-ranap/obat?kd_bangsal=${encodeURIComponent(kdBangsal)}&search=${encodeURIComponent(q)}`;
        const res = await fetch(url);
        const data: ObatItem[] = await res.json();
        setResults(data);
        setOpen(data.length > 0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <input
        type="text"
        value={query}
        placeholder="Cari nama obat..."
        onChange={(e) => { setQuery(e.target.value); search(e.target.value); }}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
      />
      {loading && (
        <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#9ca3af' }}>...</div>
      )}
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000,
          background: '#fff', border: '1px solid #d1d5db', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)', maxHeight: 220, overflowY: 'auto'
        }}>
          {results.map((o) => (
            <div
              key={`${o.kode_brng}-${o.no_batch}-${o.no_faktur}`}
              onMouseDown={() => { onSelect(o); setQuery(o.nama_brng); setOpen(false); }}
              style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f9ff')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{o.nama_brng}</div>
              <div style={{ fontSize: 11, color: '#6b7280', display: 'flex', gap: 10, marginTop: 2 }}>
                <span>{o.kode_brng}</span>
                <span>Stok: {o.stok} {o.kode_sat}</span>
                <span style={{ color: '#059669' }}>Rp {o.harga_jual.toLocaleString('id-ID')}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// --- Main Tab ---
export const ResepRanapTab: React.FC<{ patient: RanapPatientMin }> = ({ patient }) => {
  const [resepList, setResepList] = React.useState<ResepRanap[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [isAdding, setIsAdding] = React.useState(false);

  // Form state
  const today = localDateStr();
  const nowTime = new Date().toTimeString().slice(0, 5);
  const [tgl, setTgl] = React.useState(today);
  const [jam, setJam] = React.useState(nowTime);
  const [items, setItems] = React.useState<ResepItem[]>([emptyItem()]);
  const [saving, setSaving] = React.useState(false);

  const [aturanList, setAturanList] = React.useState<string[]>([]);

  const fetchResep = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/resep-ranap/list?no_rawat=${encodeURIComponent(patient.no_rawat)}`);
      const data: ResepRanap[] = await res.json();
      setResepList(Array.isArray(data) ? data : []);
    } catch {
      setResepList([]);
    } finally {
      setLoading(false);
    }
  }, [patient.no_rawat]);

  React.useEffect(() => {
    fetchResep();
    fetch('/api/resep-ranap/aturan-pakai')
      .then((r) => r.json())
      .then((d: string[]) => setAturanList(d))
      .catch(() => setAturanList([]));
  }, [fetchResep]);

  const handleSelectObat = (idx: number, o: ObatItem) => {
    setItems((prev) => prev.map((item, i) =>
      i === idx ? {
        ...item,
        kode_brng: o.kode_brng,
        nama_brng: o.nama_brng,
        kode_sat: o.kode_sat,
        harga_jual: o.harga_jual,
        h_beli: o.h_beli,
        total: o.harga_jual * item.jml,
        no_batch: o.no_batch,
        no_faktur: o.no_faktur,
      } : item
    ));
  };

  const updateItem = (idx: number, field: keyof ResepItem, val: string | number) => {
    setItems((prev) => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: val };
      if (field === 'jml' || field === 'harga_jual') {
        updated.total = (field === 'jml' ? Number(val) : updated.jml) * (field === 'harga_jual' ? Number(val) : updated.harga_jual);
      }
      return updated;
    }));
  };

  const handleSave = async () => {
    const validItems = items.filter((it) => it.kode_brng !== '');
    if (validItems.length === 0) {
      alert('Tambahkan minimal satu obat');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        no_rawat: patient.no_rawat,
        tgl_perawatan: tgl,
        jam: jam + ':00',
        kd_dokter: patient.kd_dokter || '',
        kd_bangsal: patient.kd_bangsal || '',
        items: validItems,
      };
      const res = await fetch('/api/resep-ranap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan resep');
      setIsAdding(false);
      setItems([emptyItem()]);
      setTgl(today);
      setJam(nowTime);
      await fetchResep();
    } catch (e: any) {
      alert(e.message || 'Gagal menyimpan resep');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (noResep: string) => {
    const ok = window.confirm(`Hapus resep ${noResep}?`);
    if (!ok) return;
    try {
      const res = await fetch(`/api/resep-ranap?no_resep=${encodeURIComponent(noResep)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus');
      await fetchResep();
    } catch (e: any) {
      alert(e.message || 'Gagal menghapus resep');
    }
  };

  const totalResepBiaya = (items: ResepItem[]) =>
    items.reduce((s, it) => s + (it.total || 0), 0);

  const inputStyle: React.CSSProperties = {
    padding: '7px 10px', borderRadius: 8, border: '1px solid #d1d5db',
    fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box',
  };

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#374151' }}>
          Resep Rawat Inap
        </h4>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#1AB1E5', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
          >
            + Tambah Resep
          </button>
        )}
      </div>

      {/* Add Form */}
      {isAdding && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #d1d5db', padding: 20, marginBottom: 20 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#374151', marginBottom: 14 }}>Resep Baru</div>

          {/* Date & Time */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>Tanggal:</span>
              <input type="date" value={tgl} onChange={(e) => setTgl(e.target.value)}
                style={{ ...inputStyle, width: 150 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>Jam:</span>
              <input type="time" value={jam} onChange={(e) => setJam(e.target.value)}
                style={{ ...inputStyle, width: 120 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>Dokter:</span>
              <span style={{ fontSize: 13, color: '#374151' }}>{patient.nm_dokter || patient.kd_dokter || '-'}</span>
            </div>
            {patient.kd_bangsal && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#6b7280' }}>Bangsal:</span>
                <span style={{ fontSize: 13, color: '#374151' }}>{patient.kd_bangsal}</span>
              </div>
            )}
          </div>

          {/* Items table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb', minWidth: 200 }}>Nama Obat</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb', width: 60 }}>Sat</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb', width: 70 }}>Jml</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb', width: 120 }}>Harga</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb', width: 120 }}>Total</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb', minWidth: 130 }}>Aturan Pakai</th>
                  <th style={{ padding: '8px 4px', borderBottom: '1px solid #e5e7eb', width: 30 }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: '6px 6px 6px 0', verticalAlign: 'top' }}>
                      <ObatSearchField
                        value={item.nama_brng}
                        kdBangsal={patient.kd_bangsal || ''}
                        onSelect={(o) => handleSelectObat(idx, o)}
                      />
                      {item.kode_brng && (
                        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2, paddingLeft: 4 }}>{item.kode_brng}</div>
                      )}
                    </td>
                    <td style={{ padding: '6px 4px', textAlign: 'center', verticalAlign: 'top' }}>
                      <span style={{ fontSize: 12, color: '#6b7280' }}>{item.kode_sat || '-'}</span>
                    </td>
                    <td style={{ padding: '6px 4px', verticalAlign: 'top' }}>
                      <input
                        type="number"
                        min="0.1"
                        step="0.5"
                        value={item.jml}
                        onChange={(e) => updateItem(idx, 'jml', parseFloat(e.target.value) || 0)}
                        style={{ ...inputStyle, width: 65, textAlign: 'center' }}
                      />
                    </td>
                    <td style={{ padding: '6px 4px', verticalAlign: 'top' }}>
                      <input
                        type="number"
                        min="0"
                        value={item.harga_jual}
                        onChange={(e) => updateItem(idx, 'harga_jual', parseFloat(e.target.value) || 0)}
                        style={{ ...inputStyle, width: 115, textAlign: 'right' }}
                      />
                    </td>
                    <td style={{ padding: '6px 4px', textAlign: 'right', verticalAlign: 'top' }}>
                      <span style={{ fontSize: 13, color: '#374151' }}>
                        {item.total.toLocaleString('id-ID')}
                      </span>
                    </td>
                    <td style={{ padding: '6px 4px', verticalAlign: 'top' }}>
                      <input
                        type="text"
                        list={`aturan-${idx}`}
                        value={item.aturan}
                        onChange={(e) => updateItem(idx, 'aturan', e.target.value)}
                        placeholder="cth: 3 x 1"
                        style={{ ...inputStyle, width: '100%' }}
                      />
                      <datalist id={`aturan-${idx}`}>
                        {aturanList.map((a) => <option key={a} value={a} />)}
                      </datalist>
                    </td>
                    <td style={{ padding: '6px 4px', verticalAlign: 'top', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16, padding: '4px 6px' }}
                        title="Hapus baris"
                      >×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add row + totals */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <button
              type="button"
              onClick={() => setItems((prev) => [...prev, emptyItem()])}
              style={{ padding: '6px 14px', borderRadius: 8, border: '1px dashed #d1d5db', background: '#f9fafb', color: '#6b7280', cursor: 'pointer', fontSize: 13 }}
            >
              + Tambah Obat
            </button>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
              Total: Rp {items.reduce((s, it) => s + (it.total || 0), 0).toLocaleString('id-ID')}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16, borderTop: '1px solid #e5e7eb', paddingTop: 14 }}>
            <button
              type="button"
              onClick={() => { setIsAdding(false); setItems([emptyItem()]); }}
              style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#374151', cursor: 'pointer', fontSize: 13 }}
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              style={{ padding: '8px 22px', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500, opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Menyimpan...' : 'Simpan Resep'}
            </button>
          </div>
        </div>
      )}

      {/* Prescription list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Memuat resep...</div>
      ) : resepList.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb' }}>
          Belum ada resep rawat inap
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {resepList.map((resep) => {
            const tglFormatted = resep.tgl_perawatan
              ? (() => { const [y, m, d] = resep.tgl_perawatan.split('-'); return `${d}/${m}/${y}`; })()
              : '-';
            return (
              <div key={resep.no_resep} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                {/* Card header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{resep.no_resep}</span>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>{tglFormatted} • {resep.jam?.slice(0, 5)}</span>
                    {resep.nm_dokter && (
                      <span style={{ fontSize: 12, color: '#7c3aed' }}>{resep.nm_dokter}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#059669' }}>
                      Rp {totalResepBiaya(resep.items).toLocaleString('id-ID')}
                    </span>
                    <button
                      onClick={() => handleDelete(resep.no_resep)}
                      style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #ef4444', background: '#fef2f2', color: '#ef4444', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}
                    >
                      Hapus
                    </button>
                  </div>
                </div>

                {/* Items */}
                <div style={{ padding: '10px 16px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', color: '#9ca3af', fontWeight: 500, paddingBottom: 6, paddingRight: 12 }}>Nama Obat</th>
                        <th style={{ textAlign: 'center', color: '#9ca3af', fontWeight: 500, paddingBottom: 6, width: 50 }}>Jml</th>
                        <th style={{ textAlign: 'center', color: '#9ca3af', fontWeight: 500, paddingBottom: 6, width: 50 }}>Sat</th>
                        <th style={{ textAlign: 'left', color: '#9ca3af', fontWeight: 500, paddingBottom: 6, width: 120 }}>Aturan</th>
                        <th style={{ textAlign: 'right', color: '#9ca3af', fontWeight: 500, paddingBottom: 6, width: 110 }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resep.items.map((item, j) => (
                        <tr key={j}>
                          <td style={{ paddingRight: 12, paddingBottom: 4, color: '#374151', fontWeight: 500 }}>{item.nama_brng}</td>
                          <td style={{ textAlign: 'center', paddingBottom: 4, color: '#6b7280' }}>{item.jml}</td>
                          <td style={{ textAlign: 'center', paddingBottom: 4, color: '#6b7280' }}>{item.kode_sat}</td>
                          <td style={{ paddingBottom: 4, color: '#6b7280' }}>{item.aturan || '-'}</td>
                          <td style={{ textAlign: 'right', paddingBottom: 4, color: '#374151' }}>
                            Rp {(item.total || 0).toLocaleString('id-ID')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
