import React from 'react';
import Swal from 'sweetalert2';

const inputSm: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box' };
const labelSm: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 };

// ── QuestionnaireResponse (Telaah Farmasi) — padanan tampil() + BtnKirim/
// BtnUpdate SatuSehatKirimQRTelaahFarmasi.java. Sumber: telaah_farmasi (form
// telaah resep 8 poin + telaah obat 5 poin, diisi apoteker sblm penyerahan
// obat). Keyed murni no_resep (bukan no_rawat+tgl+jam spt resource lain).
// "Petugas Telaah" = apoteker yg mengisi form (telaah_farmasi.nip), bukan
// dokter peresep. Payload berisi 16+5+3 pertanyaan bersarang — di tabel ini
// cuma ditampilkan ringkasan (jumlah "Tidak" pada telaah resep/obat) supaya
// tabel tidak terlalu lebar; detail lengkap ada di payload yang dikirim.
type QRTelaahFarmasiRow = {
  tgl_registrasi: string; no_rawat: string; no_rm: string; nama_pasien: string; no_ktp_pasien: string;
  nama_petugas: string; no_ktp_petugas: string; id_encounter: string; tgl_peresepan: string; jam_peresepan: string;
  no_resep: string; id_questionresponse: string;
  resep_identifikasi_pasien: string; resep_tepat_obat: string; resep_tepat_dosis: string;
  resep_tepat_cara_pemberian: string; resep_tepat_waktu_pemberian: string;
  resep_ada_tidak_duplikasi_obat: string; resep_interaksi_obat: string; resep_kontra_indikasi_obat: string;
  obat_tepat_pasien: string; obat_tepat_obat: string; obat_tepat_dosis: string;
  obat_tepat_cara_pemberian: string; obat_tepat_waktu_pemberian: string;
};

const todayISO = (): string => new Date().toISOString().slice(0, 10);
const rowKey = (row: QRTelaahFarmasiRow): string => row.no_resep;

const countTidak = (row: QRTelaahFarmasiRow): number => {
  const fields: (keyof QRTelaahFarmasiRow)[] = [
    'resep_identifikasi_pasien', 'resep_tepat_obat', 'resep_tepat_dosis', 'resep_tepat_cara_pemberian',
    'resep_tepat_waktu_pemberian', 'resep_ada_tidak_duplikasi_obat', 'resep_interaksi_obat', 'resep_kontra_indikasi_obat',
    'obat_tepat_pasien', 'obat_tepat_obat', 'obat_tepat_dosis', 'obat_tepat_cara_pemberian', 'obat_tepat_waktu_pemberian',
  ];
  return fields.filter((f) => row[f] === 'Tidak').length;
};

export const QuestionnaireResponseSection: React.FC = () => {
  const [tglDari, setTglDari] = React.useState(todayISO());
  const [tglSampai, setTglSampai] = React.useState(todayISO());
  const [search, setSearch] = React.useState('');
  const [list, setList] = React.useState<QRTelaahFarmasiRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [processing, setProcessing] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const fetchList = React.useCallback(async (dari: string, sampai: string, q: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/satu-sehat/qr-telaah-farmasi?tgl_dari=${dari}&tgl_sampai=${sampai}&q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat daftar QuestionnaireResponse');
      setList(Array.isArray(data.list) ? data.list : []);
      setSelected(new Set());
    } catch (err) {
      setList([]);
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const t = setTimeout(() => fetchList(tglDari, tglSampai, search), 300);
    return () => clearTimeout(t);
  }, [tglDari, tglSampai, search, fetchList]);

  const allSelected = list.length > 0 && list.every((r) => selected.has(rowKey(r)));

  const toggleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(list.map(rowKey)));
  };
  const toggleSelectRow = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const selectedForKirim = list.filter((r) => selected.has(rowKey(r)) && !r.id_questionresponse);
  const selectedForUpdate = list.filter((r) => selected.has(rowKey(r)) && !!r.id_questionresponse);

  const runBulk = async (rows: QRTelaahFarmasiRow[], endpoint: 'send' | 'update', label: string) => {
    setProcessing(true);
    let ok = 0;
    const failed: string[] = [];
    for (const row of rows) {
      try {
        const res = await fetch(`/api/satu-sehat/qr-telaah-farmasi/${endpoint}/${row.no_resep}`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal');
        ok++;
      } catch (err) {
        failed.push(`${row.no_resep} (${row.nama_pasien}): ${err instanceof Error ? err.message : 'Terjadi kesalahan'}`);
      }
    }
    setProcessing(false);

    if (failed.length === 0) {
      Swal.fire({ icon: 'success', title: 'Selesai', text: `${ok} QuestionnaireResponse berhasil di-${label}` });
    } else {
      Swal.fire({ icon: ok > 0 ? 'warning' : 'error', title: 'Selesai dengan catatan', html: `${ok} berhasil, ${failed.length} gagal:<br/><small>${failed.join('<br/>')}</small>` });
    }
    fetchList(tglDari, tglSampai, search);
  };

  const handleKirimTerpilih = async () => {
    if (selectedForKirim.length === 0) return;
    const confirm = await Swal.fire({
      title: `Kirim ${selectedForKirim.length} QuestionnaireResponse ke Satu Sehat?`,
      text: 'Setiap telaah farmasi terpilih (yang belum punya ID QuestionnaireResponse) akan dikirim sebagai resource baru.',
      icon: 'question', showCancelButton: true, confirmButtonText: 'Ya, Kirim', cancelButtonText: 'Batal', confirmButtonColor: '#059669',
    });
    if (!confirm.isConfirmed) return;
    runBulk(selectedForKirim, 'send', 'kirim');
  };

  const handleUpdateTerpilih = async () => {
    if (selectedForUpdate.length === 0) return;
    const confirm = await Swal.fire({
      title: `Perbarui ${selectedForUpdate.length} QuestionnaireResponse di Satu Sehat?`,
      text: 'Setiap telaah farmasi terpilih (yang sudah punya ID QuestionnaireResponse) akan di-PUT ulang dengan data lokal terbaru.',
      icon: 'question', showCancelButton: true, confirmButtonText: 'Ya, Perbarui', cancelButtonText: 'Batal', confirmButtonColor: '#2563eb',
    });
    if (!confirm.isConfirmed) return;
    runBulk(selectedForUpdate, 'update', 'perbarui');
  };

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
            placeholder="No.Rawat, No.RM, nama pasien, No.Resep..."
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
              {['No.Resep', 'Tgl/Jam Resep', 'No.Rawat', 'No.RM', 'Nama Pasien', 'Petugas Telaah', 'ID Encounter', 'Ringkasan Telaah', 'ID QuestionnaireResponse'].map((h) => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>Memuat...</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={10} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>Tidak ada data pada rentang tanggal ini (pastikan Encounter registrasi sudah dikirim, dan form Telaah Farmasi sudah diisi)</td></tr>
            ) : (
              list.map((row) => {
                const key = rowKey(row);
                const tidakCount = countTidak(row);
                return (
                  <tr key={key} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                      <input type="checkbox" checked={selected.has(key)} onChange={() => toggleSelectRow(key)} />
                    </td>
                    <td style={{ padding: '6px 10px', color: '#111827', whiteSpace: 'nowrap' }}>{row.no_resep}</td>
                    <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.tgl_peresepan} {row.jam_peresepan}</td>
                    <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.no_rawat}</td>
                    <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.no_rm}</td>
                    <td style={{ padding: '6px 10px', color: '#111827' }}>{row.nama_pasien}</td>
                    <td style={{ padding: '6px 10px', color: '#374151' }}>{row.nama_petugas}</td>
                    <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>
                      {row.id_encounter ? row.id_encounter : <span style={{ color: '#991b1b' }}>Belum Ada</span>}
                    </td>
                    <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                      {tidakCount === 0 ? (
                        <span style={{ color: '#065f46' }}>13/13 Ya</span>
                      ) : (
                        <span style={{ color: '#991b1b' }}>{tidakCount} poin "Tidak"</span>
                      )}
                    </td>
                    <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                      {row.id_questionresponse ? (
                        <span style={{ padding: '3px 8px', borderRadius: 999, background: '#ecfdf5', color: '#065f46', fontSize: 11, fontWeight: 600 }}>{row.id_questionresponse}</span>
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
