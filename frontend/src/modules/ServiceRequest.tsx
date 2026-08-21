import React from 'react';
import Swal from 'sweetalert2';

const inputSm: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box' };
const labelSm: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 };

// ── ServiceRequest — padanan SatuSehatKirimServiceRequestRadiologi.java,
// ...LabPK.java, ...LabMB.java. Satu baris = SATU pemeriksaan (bukan satu
// order — satu order radiologi/lab bisa punya banyak pemeriksaan, tiap
// pemeriksaan jadi ServiceRequest sendiri). Hanya pemeriksaan yang SUDAH
// punya Mapping (kode SNOMED CT/LOINC di menu Mapping Radiologi/Mapping Lab)
// yang muncul di sini — persis gating INNER JOIN di tampil() versi Java.
type ServiceRequestRow = {
  no_rawat: string; no_rm: string; nama_pasien: string; nama_dokter: string; id_encounter: string;
  noorder: string; tgl_permintaan: string; jam_permintaan: string; diagnosa_klinis: string;
  id_template?: number; kd_jenis_prw: string; nm_perawatan: string; id_servicerequest: string;
};

type Variant = {
  key: string;
  label: string;
  listUrl: (dari: string, sampai: string, q: string) => string;
  actionUrl: (row: ServiceRequestRow, endpoint: 'send' | 'update') => string;
  rowKey: (row: ServiceRequestRow) => string;
  showTemplate: boolean;
};

const radiologiVariant: Variant = {
  key: 'radiologi',
  label: 'Radiologi',
  listUrl: (dari, sampai, q) => `/api/satu-sehat/servicerequest-radiologi-candidates?tgl_dari=${dari}&tgl_sampai=${sampai}&q=${encodeURIComponent(q)}`,
  actionUrl: (row, endpoint) => `/api/satu-sehat/servicerequest-radiologi/${endpoint}/${row.noorder}?kd_jenis_prw=${encodeURIComponent(row.kd_jenis_prw)}`,
  rowKey: (row) => `${row.noorder}::${row.kd_jenis_prw}`,
  showTemplate: false,
};

const labVariant = (jenis: 'pk' | 'mb', label: string): Variant => ({
  key: `lab-${jenis}`,
  label,
  listUrl: (dari, sampai, q) => `/api/satu-sehat/servicerequest-lab/${jenis}?tgl_dari=${dari}&tgl_sampai=${sampai}&q=${encodeURIComponent(q)}`,
  actionUrl: (row, endpoint) => `/api/satu-sehat/servicerequest-lab/${jenis}/${endpoint}/${row.noorder}?id_template=${row.id_template}&kd_jenis_prw=${encodeURIComponent(row.kd_jenis_prw)}`,
  rowKey: (row) => `${row.noorder}::${row.id_template}::${row.kd_jenis_prw}`,
  showTemplate: true,
});

const VARIANTS: Variant[] = [radiologiVariant, labVariant('pk', 'Lab PK'), labVariant('mb', 'Lab MB')];

const todayISO = (): string => new Date().toISOString().slice(0, 10);

const ServiceRequestTable: React.FC<{ variant: Variant }> = ({ variant }) => {
  const [tglDari, setTglDari] = React.useState(todayISO());
  const [tglSampai, setTglSampai] = React.useState(todayISO());
  const [search, setSearch] = React.useState('');
  const [list, setList] = React.useState<ServiceRequestRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [processing, setProcessing] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const fetchList = React.useCallback(async (dari: string, sampai: string, q: string) => {
    setLoading(true);
    try {
      const res = await fetch(variant.listUrl(dari, sampai, q));
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat daftar ServiceRequest');
      setList(Array.isArray(data.list) ? data.list : []);
      setSelected(new Set());
    } catch (err) {
      setList([]);
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setLoading(false);
    }
  }, [variant]);

  React.useEffect(() => {
    const t = setTimeout(() => fetchList(tglDari, tglSampai, search), 300);
    return () => clearTimeout(t);
  }, [tglDari, tglSampai, search, fetchList]);

  const allSelected = list.length > 0 && list.every((r) => selected.has(variant.rowKey(r)));

  const toggleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(list.map(variant.rowKey)));
  };
  const toggleSelectRow = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const selectedForKirim = list.filter((r) => selected.has(variant.rowKey(r)) && !r.id_servicerequest);
  const selectedForUpdate = list.filter((r) => selected.has(variant.rowKey(r)) && !!r.id_servicerequest);

  const runBulk = async (rows: ServiceRequestRow[], endpoint: 'send' | 'update', label: string) => {
    setProcessing(true);
    let ok = 0;
    const failed: string[] = [];
    for (const row of rows) {
      try {
        const res = await fetch(variant.actionUrl(row, endpoint), { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal');
        ok++;
      } catch (err) {
        failed.push(`${row.noorder} - ${row.nm_perawatan} (${row.nama_pasien}): ${err instanceof Error ? err.message : 'Terjadi kesalahan'}`);
      }
    }
    setProcessing(false);

    if (failed.length === 0) {
      Swal.fire({ icon: 'success', title: 'Selesai', text: `${ok} ServiceRequest berhasil di-${label}` });
    } else {
      Swal.fire({ icon: ok > 0 ? 'warning' : 'error', title: 'Selesai dengan catatan', html: `${ok} berhasil, ${failed.length} gagal:<br/><small>${failed.join('<br/>')}</small>` });
    }
    fetchList(tglDari, tglSampai, search);
  };

  const handleKirimTerpilih = async () => {
    if (selectedForKirim.length === 0) return;
    const confirm = await Swal.fire({
      title: `Kirim ${selectedForKirim.length} ServiceRequest ke Satu Sehat?`,
      text: 'Setiap pemeriksaan terpilih (yang belum punya ID ServiceRequest) akan dikirim sebagai resource baru.',
      icon: 'question', showCancelButton: true, confirmButtonText: 'Ya, Kirim', cancelButtonText: 'Batal', confirmButtonColor: '#059669',
    });
    if (!confirm.isConfirmed) return;
    runBulk(selectedForKirim, 'send', 'kirim');
  };

  const handleUpdateTerpilih = async () => {
    if (selectedForUpdate.length === 0) return;
    const confirm = await Swal.fire({
      title: `Perbarui ${selectedForUpdate.length} ServiceRequest di Satu Sehat?`,
      text: 'Setiap pemeriksaan terpilih (yang sudah punya ID ServiceRequest) akan di-PUT ulang dengan data lokal terbaru.',
      icon: 'question', showCancelButton: true, confirmButtonText: 'Ya, Perbarui', cancelButtonText: 'Batal', confirmButtonColor: '#2563eb',
    });
    if (!confirm.isConfirmed) return;
    runBulk(selectedForUpdate, 'update', 'perbarui');
  };

  const colCount = variant.showTemplate ? 11 : 10;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={labelSm}>Tanggal Dari</label>
          <input type="date" value={tglDari} onChange={(e) => setTglDari(e.target.value)} style={inputSm} />
        </div>
        <div>
          <label style={labelSm}>Tanggal Sampai</label>
          <input type="date" value={tglSampai} onChange={(e) => setTglSampai(e.target.value)} style={inputSm} />
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <label style={labelSm}>Cari</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="No.Rawat, No.RM, nama pasien, pemeriksaan, no.order..."
            style={inputSm}
          />
        </div>
        <button
          type="button"
          onClick={handleKirimTerpilih}
          disabled={selectedForKirim.length === 0 || processing}
          style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: selectedForKirim.length === 0 || processing ? '#9ca3af' : '#059669', color: '#fff', cursor: selectedForKirim.length === 0 || processing ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}
        >
          {processing ? 'Memproses...' : `Kirim Terpilih (${selectedForKirim.length})`}
        </button>
        <button
          type="button"
          onClick={handleUpdateTerpilih}
          disabled={selectedForUpdate.length === 0 || processing}
          style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #2563eb', background: '#ffffff', color: selectedForUpdate.length === 0 || processing ? '#9ca3af' : '#2563eb', cursor: selectedForUpdate.length === 0 || processing ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}
        >
          {processing ? 'Memproses...' : `Update Terpilih (${selectedForUpdate.length})`}
        </button>
      </div>

      <div style={{ borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1, minHeight: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>
              <th style={{ padding: '8px 10px', textAlign: 'center', borderBottom: '1px solid #e5e7eb', width: 60 }}>
                {list.length > 0 && (
                  <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
                )}
              </th>
              {['No.Order', 'Tanggal Permintaan', 'No.Rawat', 'No.RM', 'Nama Pasien', 'Dokter', 'ID Encounter', 'Pemeriksaan', 'ID ServiceRequest'].map((h) => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={colCount} style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>Memuat...</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={colCount} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>Tidak ada pemeriksaan pada rentang tanggal ini (pastikan Encounter registrasi & Mapping pemeriksaan sudah dilakukan)</td></tr>
            ) : (
              list.map((row) => {
                const key = variant.rowKey(row);
                return (
                  <tr key={key} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                      <input type="checkbox" checked={selected.has(key)} onChange={() => toggleSelectRow(key)} />
                    </td>
                    <td style={{ padding: '6px 10px', color: '#111827', whiteSpace: 'nowrap' }}>{row.noorder}</td>
                    <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.tgl_permintaan} {row.jam_permintaan}</td>
                    <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.no_rawat}</td>
                    <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.no_rm}</td>
                    <td style={{ padding: '6px 10px', color: '#111827' }}>{row.nama_pasien}</td>
                    <td style={{ padding: '6px 10px', color: '#374151' }}>{row.nama_dokter}</td>
                    <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>
                      {row.id_encounter ? row.id_encounter : <span style={{ color: '#991b1b' }}>Belum Ada</span>}
                    </td>
                    <td style={{ padding: '6px 10px', color: '#374151' }}>{row.nm_perawatan}</td>
                    <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                      {row.id_servicerequest ? (
                        <span style={{ padding: '3px 8px', borderRadius: 999, background: '#ecfdf5', color: '#065f46', fontSize: 11, fontWeight: 600 }}>{row.id_servicerequest}</span>
                      ) : (
                        <span style={{ padding: '3px 8px', borderRadius: 999, background: '#fef2f2', color: '#991b1b', fontSize: 11, fontWeight: 600 }}>Belum Terkirim</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const ServiceRequestSection: React.FC = () => {
  const [tab, setTab] = React.useState(VARIANTS[0].key);
  const active = VARIANTS.find((v) => v.key === tab) || VARIANTS[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e5e7eb', flexShrink: 0, flexWrap: 'wrap' }}>
        {VARIANTS.map((v) => {
          const isActive = tab === v.key;
          return (
            <button
              key={v.key}
              type="button"
              onClick={() => setTab(v.key)}
              style={{
                padding: '8px 16px', border: 'none',
                borderBottom: isActive ? '2px solid #059669' : '2px solid transparent',
                background: 'transparent', color: isActive ? '#059669' : '#6b7280',
                fontWeight: isActive ? 600 : 400, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {v.label}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <ServiceRequestTable key={active.key} variant={active} />
      </div>
    </div>
  );
};
