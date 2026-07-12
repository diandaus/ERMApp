import React from 'react';
import { localDateStr } from '../utils/date';
import { PreviewBilling } from '../components/PreviewBilling';

type KlaimItem = {
  no_rawat: string;
  no_rkm_medis: string;
  nm_pasien: string;
  nm_dokter: string;
  diagnosa: string;
  biaya_obat: number;
  biaya_lab: number;
  biaya_radiologi: number;
  billing: number;
  selisih: number;
  klaim_inacbg: number;
};

const formatRupiah = (n: number) => `Rp ${(n || 0).toLocaleString('id-ID')}`;

export const KlaimInacbgView: React.FC = () => {
  const [searchText, setSearchText] = React.useState<string>('');
  const [showFilterDropdown, setShowFilterDropdown] = React.useState<boolean>(false);
  const [showDpjpDropdown, setShowDpjpDropdown] = React.useState<boolean>(false);
  const [tglDari, setTglDari] = React.useState<string>(localDateStr());
  const [tglSampai, setTglSampai] = React.useState<string>(localDateStr());
  const [items, setItems] = React.useState<KlaimItem[]>([]);
  const [dpjpFilter, setDpjpFilter] = React.useState<string>('Semua');
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [editingRow, setEditingRow] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState<string>('');
  const [saving, setSaving] = React.useState<boolean>(false);
  const [previewNoRawat, setPreviewNoRawat] = React.useState<string | null>(null);
  const filterDropdownRef = React.useRef<HTMLDivElement>(null);
  const dpjpDropdownRef = React.useRef<HTMLDivElement>(null);

  const fetchItems = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `/api/klaim-inacbg/list?tgl_dari=${tglDari}&tgl_sampai=${tglSampai}`;
      if (searchText) {
        url += `&search=${encodeURIComponent(searchText)}`;
      }
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Gagal mengambil data klaim INACBG');
      }
      const data = await response.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [tglDari, tglSampai, searchText]);

  React.useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const startEdit = (item: KlaimItem) => {
    setEditingRow(item.no_rawat);
    setEditValue(String(item.klaim_inacbg || ''));
  };

  const cancelEdit = () => {
    setEditingRow(null);
    setEditValue('');
  };

  const saveEdit = async (noRawat: string) => {
    const nilai = parseFloat(editValue.replace(/[^0-9.-]/g, '')) || 0;
    setSaving(true);
    try {
      const response = await fetch('/api/klaim-inacbg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ no_rawat: noRawat, klaim_inacbg: nilai })
      });
      if (!response.ok) {
        throw new Error('Gagal menyimpan klaim INACBG');
      }
      setItems((prev) =>
        prev.map((it) =>
          it.no_rawat === noRawat
            ? { ...it, klaim_inacbg: nilai, selisih: it.billing - nilai }
            : it
        )
      );
      setEditingRow(null);
      setEditValue('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setSaving(false);
    }
  };

  const setBulanIni = () => {
    const now = new Date();
    const awal = new Date(now.getFullYear(), now.getMonth(), 1);
    const akhir = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setTglDari(localDateStr(awal));
    setTglSampai(localDateStr(akhir));
  };

  const setBulanLalu = () => {
    const now = new Date();
    const awal = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const akhir = new Date(now.getFullYear(), now.getMonth(), 0);
    setTglDari(localDateStr(awal));
    setTglSampai(localDateStr(akhir));
  };

  const dpjpOptions = React.useMemo(() => {
    const names = new Set<string>();
    items.forEach((item) => names.add(item.nm_dokter || 'Tanpa DPJP'));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filteredItems = React.useMemo(() => {
    if (dpjpFilter === 'Semua') return items;
    return items.filter((item) => (item.nm_dokter || 'Tanpa DPJP') === dpjpFilter);
  }, [items, dpjpFilter]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setShowFilterDropdown(false);
      }
    };
    if (showFilterDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showFilterDropdown]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dpjpDropdownRef.current && !dpjpDropdownRef.current.contains(event.target as Node)) {
        setShowDpjpDropdown(false);
      }
    };
    if (showDpjpDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showDpjpDropdown]);

  return (
    <section style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexShrink: 0,
          flexWrap: 'wrap',
          gap: 8
        }}
      >
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#374151' }}>Monitoring Biaya Klaim BPJS</h3>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>Tampilkan DPJP:</label>
            <div ref={dpjpDropdownRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setShowDpjpDropdown(!showDpjpDropdown)}
                style={{
                  padding: '6px 16px',
                  borderRadius: 8,
                  border: '1px solid #d1d5db',
                  background: '#ffffff',
                  color: '#374151',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <span>{dpjpFilter}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {showDpjpDropdown && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: 4,
                    padding: 4,
                    background: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    zIndex: 100,
                    minWidth: 180,
                    maxHeight: 240,
                    overflowY: 'auto'
                  }}
                >
                  {['Semua', ...dpjpOptions].map((dokter) => (
                    <div
                      key={dokter}
                      onClick={() => {
                        setDpjpFilter(dokter);
                        setShowDpjpDropdown(false);
                      }}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 6,
                        fontSize: 12,
                        color: dokter === dpjpFilter ? '#2563eb' : '#374151',
                        fontWeight: dokter === dpjpFilter ? 500 : 400,
                        background: dokter === dpjpFilter ? '#eff6ff' : 'transparent',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                      onMouseEnter={(e) => {
                        if (dokter !== dpjpFilter) e.currentTarget.style.background = '#f3f4f6';
                      }}
                      onMouseLeave={(e) => {
                        if (dokter !== dpjpFilter) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      {dokter}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <input
            type="text"
            placeholder="Cari No. RM / Nama Pasien / Nama Dokter"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid #d1d5db',
              fontSize: 12,
              width: 280,
              outline: 'none'
            }}
          />

          <div ref={filterDropdownRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              style={{
                padding: '6px 16px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                background: '#ffffff',
                color: '#374151',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span>Filter</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                  <path d="m6 9 6 6 6-6" />
                </svg>
            </button>

            {showFilterDropdown && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 4,
                  padding: 12,
                  background: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  zIndex: 100,
                  width: 160
                }}
              >
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}></label>
                  <input
                    type="date"
                    value={tglDari}
                    onChange={(e) => setTglDari(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: 6,
                      border: '1px solid #d1d5db',
                      fontSize: 12,
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}></label>
                  <input
                    type="date"
                    value={tglSampai}
                    onChange={(e) => setTglSampai(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: 6,
                      border: '1px solid #d1d5db',
                      fontSize: 12,
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={setBulanIni}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    borderRadius: 6,
                    border: '1px solid #d1d5db',
                    background: '#f3f4f6',
                    color: '#4b5563',
                    fontSize: 12,
                    cursor: 'pointer',
                    marginBottom: 6
                  }}
                >
                  Bulan ini
                </button>
                <button
                  type="button"
                  onClick={setBulanLalu}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    borderRadius: 6,
                    border: '1px solid #d1d5db',
                    background: '#f3f4f6',
                    color: '#4b5563',
                    fontSize: 12,
                    cursor: 'pointer'
                  }}
                >
                  Bulan lalu
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: 12,
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 8,
            color: '#991b1b',
            marginBottom: 16,
            fontSize: 13,
            flexShrink: 0
          }}
        >
          {error}
        </div>
      )}

      {/* Tabel per dokter DPJP */}
      <div style={{ overflow: 'auto', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</div>
        ) : filteredItems.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 12 }}>
            Belum ada data klaim INACBG
          </div>
        ) : (
          groupedByDokter(filteredItems).map(([dokter, list]) => {
            const hasCriticalObat = list.some(
              (item) => item.klaim_inacbg > 0 && item.biaya_obat >= item.klaim_inacbg * 0.3
            );
            const hasWarningObat = list.some(
              (item) =>
                item.klaim_inacbg > 0 &&
                item.biaya_obat >= item.klaim_inacbg * 0.2 &&
                item.biaya_obat < item.klaim_inacbg * 0.3
            );
            return (
            <div key={dokter}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <h4 style={{ display: 'inline-block', margin: 0, padding: '5px 14px', fontSize: 13, fontWeight: 600, color: '#374151', border: '1px solid #d1d5db', borderRadius: 8 }}>{dokter}</h4>
                {hasCriticalObat && (
                  <div
                    style={{
                      padding: '5px 12px',
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: 8,
                      color: '#991b1b',
                      fontSize: 12
                    }}
                  >
                    Biaya obat mencapai diatas 30%
                  </div>
                )}
                {hasWarningObat && (
                  <div
                    style={{
                      padding: '5px 12px',
                      background: '#fefce8',
                      border: '1px solid #fde68a',
                      borderRadius: 8,
                      color: '#854d0e',
                      fontSize: 12
                    }}
                  >
                    Biaya obat mencapai diatas 20%
                  </div>
                )}
              </div>
              <div style={{ borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead style={{ background: '#f3f4f6' }}>
                    <tr>
                      <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. Rawat</th>
                      <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. RM</th>
                      <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Nama Pasien</th>
                      <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Diagnosa</th>
                      <th style={{ padding: '8px', textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Biaya Obat</th>
                      <th style={{ padding: '8px', textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Laboratorium</th>
                      <th style={{ padding: '8px', textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Radiologi</th>
                      <th style={{ padding: '8px', textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Billing</th>
                      <th style={{ padding: '8px', textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Selisih</th>
                      <th style={{ padding: '8px', textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Klaim INACBG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((item, index) => {
                      const baseBg = index % 2 === 0 ? '#ffffff' : '#f9fafb';
                      return (
                        <tr key={item.no_rawat} style={{ background: baseBg }}>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontSize: 12, color: '#374151' }}>
                            {item.no_rawat}
                          </td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontSize: 12, color: '#374151' }}>
                            {item.no_rkm_medis}
                          </td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontSize: 12, color: '#111827' }}>
                            {item.nm_pasien}
                          </td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontSize: 12, color: '#374151' }}>
                            {item.diagnosa || '-'}
                          </td>
                          <td style={{
                            padding: '6px 8px',
                            borderBottom: '1px solid #e5e7eb',
                            fontSize: 12,
                            textAlign: 'right',
                            color: item.klaim_inacbg > 0 && item.biaya_obat >= item.klaim_inacbg * 0.3
                              ? '#dc2626'
                              : item.klaim_inacbg > 0 && item.biaya_obat >= item.klaim_inacbg * 0.2
                                ? '#eab308'
                                : '#374151',
                            fontWeight: item.klaim_inacbg > 0 && item.biaya_obat >= item.klaim_inacbg * 0.2 ? 600 : undefined
                          }}>
                            {formatRupiah(item.biaya_obat)}
                          </td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontSize: 12, color: '#374151', textAlign: 'right' }}>
                            {formatRupiah(item.biaya_lab)}
                          </td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontSize: 12, color: '#374151', textAlign: 'right' }}>
                            {formatRupiah(item.biaya_radiologi)}
                          </td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontSize: 12, color: '#111827', fontWeight: 600, textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                              <span>{formatRupiah(item.billing)}</span>
                              <button
                                type="button"
                                onClick={() => setPreviewNoRawat(item.no_rawat)}
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: 4,
                                  border: '1px solid #2563eb',
                                  background: '#ffffff',
                                  color: '#2563eb',
                                  fontSize: 11,
                                  fontWeight: 500,
                                  cursor: 'pointer'
                                }}
                              >
                                Lihat
                              </button>
                            </div>
                          </td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontSize: 12, color: item.selisih < 0 ? '#16a34a' : '#dc2626', fontWeight: 600, textAlign: 'right' }}>
                            {item.selisih < 0 ? '+' : '-'}{formatRupiah(Math.abs(item.selisih))}
                          </td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontSize: 12, textAlign: 'right' }}>
                            {editingRow === item.no_rawat ? (
                              <input
                                type="number"
                                autoFocus
                                value={editValue}
                                disabled={saving}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={() => saveEdit(item.no_rawat)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    (e.target as HTMLInputElement).blur();
                                  } else if (e.key === 'Escape') {
                                    cancelEdit();
                                  }
                                }}
                                style={{
                                  width: 110,
                                  padding: '3px 6px',
                                  borderRadius: 4,
                                  border: '1px solid #2563eb',
                                  fontSize: 12,
                                  textAlign: 'right',
                                  outline: 'none'
                                }}
                              />
                            ) : (
                              <span
                                onClick={() => startEdit(item)}
                                title="Klik untuk edit"
                                style={{ color: '#16a34a', fontWeight: 600, cursor: 'pointer', borderBottom: '1px dashed #16a34a' }}
                              >
                                {formatRupiah(item.klaim_inacbg)}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            );
          })
        )}
      </div>

      {previewNoRawat && (
        <PreviewBilling noRawat={previewNoRawat} onClose={() => setPreviewNoRawat(null)} />
      )}
    </section>
  );
};

// Kelompokkan data klaim per dokter DPJP — satu tabel per dokter, jumlah tabel
// mengikuti berapa banyak dokter DPJP berbeda yang muncul di data rawat inap.
function groupedByDokter(items: KlaimItem[]): [string, KlaimItem[]][] {
  const map = new Map<string, KlaimItem[]>();
  items.forEach((item) => {
    const key = item.nm_dokter || 'Tanpa DPJP';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  });
  return Array.from(map.entries());
}
