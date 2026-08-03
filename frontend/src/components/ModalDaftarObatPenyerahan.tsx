import React from 'react';
import type { ResepRalanRow } from '../modules/PermintaanResep';
import type { ResepItems } from './ModalValidasiObat';

// Panel "Daftar Obat" yang tampil berdampingan (sebelah kiri) dengan
// ModalPenyerahanResep — supaya petugas bisa cek ulang obat apa saja yang
// mau diserahkan sambil ambil foto bukti serah-terima, tanpa perlu tutup
// modal kamera untuk expand baris di tabel. Read-only, pakai endpoint
// items yang sama dengan expand row & ModalValidasiObat, plus data
// alamat/umur pasien dari /api/pendaftaran/pasien untuk header identitas.
type Props = {
  resep: ResepRalanRow;
};

type PasienBrief = {
  alamat: string;
  umur: string;
};

const IdentitasRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ display: 'flex', fontSize: 11.5 }}>
    <div style={{ width: 68, flexShrink: 0, color: '#6b7280' }}>{label}</div>
    <div style={{ width: 10, flexShrink: 0, color: '#6b7280' }}>:</div>
    <div style={{ color: '#111827', fontWeight: 500 }}>{value || '-'}</div>
  </div>
);

export const ModalDaftarObatPenyerahan: React.FC<Props> = ({ resep }) => {
  const [detail, setDetail] = React.useState<ResepItems | null>(null);
  const [pasien, setPasien] = React.useState<PasienBrief | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setDetail(null);
    setPasien(null);
    fetch(`/api/permintaan-resep/ralan/${encodeURIComponent(resep.no_resep)}/items`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch(() => {
        if (!cancelled) setDetail({ no_rawat: '', kd_bangsal: '', nm_bangsal: '', total: 0, ppn: 0, total_ppn: 0, non_racikan: [], racikan: [] });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    fetch(`/api/pendaftaran/pasien/${encodeURIComponent(resep.no_rkm_medis)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setPasien({ alamat: data.alamat || '', umur: data.umur || '' });
      })
      .catch(() => {
        if (!cancelled) setPasien(null);
      });
    return () => {
      cancelled = true;
    };
  }, [resep.no_resep, resep.no_rkm_medis]);

  const isEmpty = !detail || (detail.non_racikan.length === 0 && detail.racikan.length === 0);
  const nama = pasien?.umur ? `${resep.nm_pasien} (${pasien.umur})` : resep.nm_pasien;

  return (
    <div
      style={{ background: '#ffffff', borderRadius: 16, padding: 20, width: 380, maxWidth: '92vw', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 10 }}>Daftar Obat</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <IdentitasRow label="No. Resep" value={resep.no_resep} />
        <IdentitasRow label="No. RM" value={resep.no_rkm_medis} />
        <IdentitasRow label="Nama" value={nama} />
        <IdentitasRow label="Alamat" value={pasien?.alamat || ''} />
      </div>

      <div style={{ borderTop: '1px solid #e5e7eb', margin: '12px 0' }} />

      {loading ? (
        <div style={{ padding: 16, textAlign: 'center', color: '#6b7280', fontSize: 12 }}>Memuat item resep...</div>
      ) : isEmpty ? (
        <div style={{ padding: 16, textAlign: 'center', color: '#6b7280', fontSize: 12 }}>Tidak ada item obat pada resep ini</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {detail!.non_racikan.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Non Racikan</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                <thead>
                  <tr style={{ color: '#6b7280' }}>
                    <th style={{ padding: '3px 6px', textAlign: 'left', width: 22 }}>No.</th>
                    <th style={{ padding: '3px 6px', textAlign: 'left' }}>Nama Obat</th>
                    <th style={{ padding: '3px 6px', textAlign: 'right' }}>Jumlah</th>
                    <th style={{ padding: '3px 6px', textAlign: 'left' }}>Aturan Pakai</th>
                  </tr>
                </thead>
                <tbody>
                  {detail!.non_racikan.map((it, idx) => (
                    <tr key={it.kode_brng}>
                      <td style={{ padding: '3px 6px', color: '#6b7280' }}>{idx + 1}</td>
                      <td style={{ padding: '3px 6px', color: '#111827' }}>{it.nama_brng}</td>
                      <td style={{ padding: '3px 6px', textAlign: 'right', color: '#374151' }}>{it.jml} {it.kode_sat}</td>
                      <td style={{ padding: '3px 6px', color: '#6b7280' }}>{it.aturan_pakai}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {detail!.racikan.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Racikan</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                <thead>
                  <tr style={{ color: '#6b7280' }}>
                    <th style={{ padding: '3px 6px', textAlign: 'left', width: 22 }}>No.</th>
                    <th style={{ padding: '3px 6px', textAlign: 'left' }}>Racikan</th>
                    <th style={{ padding: '3px 6px', textAlign: 'right' }}>Jml</th>
                    <th style={{ padding: '3px 6px', textAlign: 'left' }}>Nama Obat</th>
                    <th style={{ padding: '3px 6px', textAlign: 'left' }}>Aturan Pakai</th>
                  </tr>
                </thead>
                <tbody>
                  {detail!.racikan.map((rc) =>
                    rc.detail.map((d, di) => (
                      <tr key={`${rc.no_racik}-${d.kode_brng}`}>
                        <td style={{ padding: '3px 6px', color: '#6b7280' }}>{di === 0 ? rc.no_racik : ''}</td>
                        <td style={{ padding: '3px 6px', color: '#111827' }}>{di === 0 ? rc.nama_racik : ''}</td>
                        <td style={{ padding: '3px 6px', textAlign: 'right', color: '#374151' }}>{di === 0 ? rc.jml_dr : ''}</td>
                        <td style={{ padding: '3px 6px', color: '#111827' }}>{d.nama_brng}</td>
                        <td style={{ padding: '3px 6px', color: '#6b7280' }}>{rc.aturan_pakai}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
