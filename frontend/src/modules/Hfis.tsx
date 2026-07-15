import React from 'react';
import Swal from 'sweetalert2';
import { localDateStr } from '../utils/date';

type HfisTab = 'poli' | 'dokter' | 'jadwal-dokter' | 'update-jadwal-dokter' | 'poli-fp' | 'pasien-fp';

const TABS: { key: HfisTab; label: string }[] = [
  { key: 'poli', label: 'Referensi Poli HFIS' },
  { key: 'dokter', label: 'Referensi Dokter HFIS' },
  { key: 'jadwal-dokter', label: 'Referensi Jadwal Dokter HFIS' },
  { key: 'update-jadwal-dokter', label: 'Update Jadwal Dokter' },
  { key: 'poli-fp', label: 'Referensi Poli Finger Print' },
  { key: 'pasien-fp', label: 'Referensi Pasien Finger Print' },
];

const inputStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #d1d5db',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
};

type PoliHfis = {
  nmpoli: string;
  nmsubspesialis: string;
  kdsubspesialis: string;
  kdpoli: string;
};

const ReferensiPoliHfisTab: React.FC = () => {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [list, setList] = React.useState<PoliHfis[]>([]);
  const [keyword, setKeyword] = React.useState('');
  const [loaded, setLoaded] = React.useState(false);

  const fetchList = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/bridging/hfis/referensi/poli');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengambil referensi poli HFIS');
      const items: PoliHfis[] = data.poli?.list ?? [];
      setList(Array.isArray(items) ? items : []);
      setLoaded(true);
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan');
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = keyword.trim()
    ? list.filter((p) => `${p.nmpoli} ${p.nmsubspesialis} ${p.kdsubspesialis} ${p.kdpoli}`.toLowerCase().includes(keyword.toLowerCase()))
    : list;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Masukan kata kunci (opsional)</label>
          <input style={{ ...inputStyle, width: 280 }} value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Nama poli / subspesialis / kode" />
        </div>
        <button
          type="button"
          onClick={fetchList}
          disabled={loading}
          style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: loading ? '#9ca3af' : '#2563eb', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500 }}
        >
          {loading ? 'Memuat...' : 'Cari'}
        </button>
        {error && <span style={{ fontSize: 12, color: '#991b1b', whiteSpace: 'nowrap' }}>{error}</span>}
      </div>

      {loaded && (
        <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'auto', maxHeight: 480 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6' }}>
              <tr>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Kode Poli</th>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Nama Poli</th>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Kode Subspesialis</th>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Nama Subspesialis</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Tidak ada data</td></tr>
              ) : (
                filtered.map((p, i) => (
                  <tr key={`${p.kdpoli}-${p.kdsubspesialis}-${i}`} style={{ background: i % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                    <td style={{ padding: '6px 12px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{p.kdpoli}</td>
                    <td style={{ padding: '6px 12px', borderBottom: '1px solid #e5e7eb', color: '#111827' }}>{p.nmpoli}</td>
                    <td style={{ padding: '6px 12px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{p.kdsubspesialis}</td>
                    <td style={{ padding: '6px 12px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{p.nmsubspesialis}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

type DokterHfis = {
  namadokter: string;
  kodedokter: number;
};

const ReferensiDokterHfisTab: React.FC = () => {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [list, setList] = React.useState<DokterHfis[]>([]);
  const [keyword, setKeyword] = React.useState('');
  const [loaded, setLoaded] = React.useState(false);

  const fetchList = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/bridging/hfis/referensi/dokter');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengambil referensi dokter HFIS');
      const items: DokterHfis[] = data.dokter?.list ?? [];
      setList(Array.isArray(items) ? items : []);
      setLoaded(true);
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan');
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = keyword.trim()
    ? list.filter((d) => `${d.namadokter} ${d.kodedokter}`.toLowerCase().includes(keyword.toLowerCase()))
    : list;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Masukan kata kunci (opsional)</label>
          <input style={{ ...inputStyle, width: 280 }} value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Nama dokter / kode dokter" />
        </div>
        <button
          type="button"
          onClick={fetchList}
          disabled={loading}
          style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: loading ? '#9ca3af' : '#2563eb', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500 }}
        >
          {loading ? 'Memuat...' : 'Cari'}
        </button>
        {error && <span style={{ fontSize: 12, color: '#991b1b', whiteSpace: 'nowrap' }}>{error}</span>}
      </div>

      {loaded && (
        <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'auto', maxHeight: 480 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6' }}>
              <tr>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Kode Dokter</th>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Nama Dokter</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={2} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Tidak ada data</td></tr>
              ) : (
                filtered.map((d, i) => (
                  <tr key={`${d.kodedokter}-${i}`} style={{ background: i % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                    <td style={{ padding: '6px 12px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{d.kodedokter}</td>
                    <td style={{ padding: '6px 12px', borderBottom: '1px solid #e5e7eb', color: '#111827' }}>{d.namadokter}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

type JadwalDokterHfis = {
  kodepoli: string;
  namapoli: string;
  kodesubspesialis: string;
  namasubspesialis: string;
  kodedokter: number;
  namadokter: string;
  hari: number;
  namahari: string;
  jadwal: string;
  kapasitaspasien: number;
  libur: number;
};

const NAMA_HARI: Record<number, string> = {
  1: 'Senin', 2: 'Selasa', 3: 'Rabu', 4: 'Kamis', 5: 'Jumat', 6: 'Sabtu', 7: 'Minggu', 8: 'Hari Libur Nasional',
};

const ReferensiJadwalDokterHfisTab: React.FC = () => {
  const [kodePoli, setKodePoli] = React.useState('');
  const [tanggal, setTanggal] = React.useState(localDateStr());
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [list, setList] = React.useState<JadwalDokterHfis[]>([]);
  const [loaded, setLoaded] = React.useState(false);

  const handleCari = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!kodePoli.trim()) {
      setError('Kode poli wajib diisi');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/bridging/hfis/referensi/jadwal-dokter/${encodeURIComponent(kodePoli.trim())}?tanggal=${tanggal}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengambil jadwal dokter HFIS');
      const items: JadwalDokterHfis[] = data.jadwal_dokter?.list ?? [];
      setList(Array.isArray(items) ? items : []);
      setLoaded(true);
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan');
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <form onSubmit={handleCari} style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Kode Poli *</label>
          <input required style={{ ...inputStyle, width: 160 }} value={kodePoli} onChange={(e) => setKodePoli(e.target.value.toUpperCase())} placeholder="ANA" />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Tanggal</label>
          <input type="date" style={{ ...inputStyle, width: 160 }} value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
        </div>
        <button
          type="submit"
          disabled={loading}
          style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: loading ? '#9ca3af' : '#2563eb', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500 }}
        >
          {loading ? 'Memuat...' : 'Cari'}
        </button>
        {error && <span style={{ fontSize: 12, color: '#991b1b', whiteSpace: 'nowrap' }}>{error}</span>}
      </form>

      {loaded && (
        <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'auto', maxHeight: 480 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6' }}>
              <tr>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Dokter</th>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Poli / Subspesialis</th>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Hari</th>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Jadwal</th>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Kapasitas Pasien</th>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Tidak ada data</td></tr>
              ) : (
                list.map((j, i) => (
                  <tr key={`${j.kodedokter}-${j.hari}-${j.jadwal}-${i}`} style={{ background: i % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                    <td style={{ padding: '6px 12px', borderBottom: '1px solid #e5e7eb', color: '#111827' }}>{j.namadokter}</td>
                    <td style={{ padding: '6px 12px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{j.namapoli} / {j.namasubspesialis}</td>
                    <td style={{ padding: '6px 12px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{j.namahari || NAMA_HARI[j.hari] || j.hari}</td>
                    <td style={{ padding: '6px 12px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{j.jadwal}</td>
                    <td style={{ padding: '6px 12px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{j.kapasitaspasien}</td>
                    <td style={{ padding: '6px 12px', borderBottom: '1px solid #e5e7eb' }}>
                      {j.libur ? (
                        <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>Libur</span>
                      ) : (
                        <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>Praktik</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

type JadwalRow = { hari: string; buka: string; tutup: string };

const HARI_OPTIONS: { value: string; label: string }[] = [
  { value: '1', label: '1 - Senin' },
  { value: '2', label: '2 - Selasa' },
  { value: '3', label: '3 - Rabu' },
  { value: '4', label: '4 - Kamis' },
  { value: '5', label: '5 - Jumat' },
  { value: '6', label: '6 - Sabtu' },
  { value: '7', label: '7 - Minggu' },
  { value: '8', label: '8 - Hari Libur Nasional' },
];

const UpdateJadwalDokterHfisTab: React.FC = () => {
  const [kodePoli, setKodePoli] = React.useState('');
  const [kodeSubspesialis, setKodeSubspesialis] = React.useState('');
  const [kodeDokter, setKodeDokter] = React.useState('');
  const [jadwal, setJadwal] = React.useState<JadwalRow[]>([{ hari: '1', buka: '', tutup: '' }]);
  const [saving, setSaving] = React.useState(false);

  const updateRow = (idx: number, patch: Partial<JadwalRow>) => {
    setJadwal((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/bridging/hfis/jadwal-dokter/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kodepoli: kodePoli.trim(),
          kodesubspesialis: kodeSubspesialis.trim(),
          kodedokter: Number(kodeDokter),
          jadwal,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengirim perubahan jadwal dokter');
      Swal.fire({ icon: 'success', title: 'Terkirim!', text: data.message || 'Perubahan jadwal dokter berhasil dikirim' });
      setJadwal([{ hari: '1', buka: '', tutup: '' }]);
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 640 }}>
      <div style={{ padding: '10px 12px', borderRadius: 10, fontSize: 12, background: '#fefce8', border: '1px solid #fde68a', color: '#854d0e' }}>
        Perubahan jadwal yang berhasil dikirim menunggu aproval BPJS (manual oleh kantor cabang jam 20.01–00.00, atau otomatis oleh sistem H+1 kalau belum diaproval sampai jam 00.00).
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Kode Poli *</label>
          <input required style={inputStyle} value={kodePoli} onChange={(e) => setKodePoli(e.target.value.toUpperCase())} placeholder="ANA" />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Kode Subspesialis *</label>
          <input required style={inputStyle} value={kodeSubspesialis} onChange={(e) => setKodeSubspesialis(e.target.value.toUpperCase())} placeholder="ANA" />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Kode Dokter *</label>
          <input required type="number" style={inputStyle} value={kodeDokter} onChange={(e) => setKodeDokter(e.target.value)} placeholder="12346" />
        </div>
      </div>

      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Jadwal Praktik</div>
        {jadwal.map((row, idx) => (
          <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px auto', gap: 8, marginBottom: 6, alignItems: 'center' }}>
            <select style={inputStyle} value={row.hari} onChange={(e) => updateRow(idx, { hari: e.target.value })}>
              {HARI_OPTIONS.map((h) => (
                <option key={h.value} value={h.value}>{h.label}</option>
              ))}
            </select>
            <input required type="time" style={inputStyle} value={row.buka} onChange={(e) => updateRow(idx, { buka: e.target.value })} />
            <input required type="time" style={inputStyle} value={row.tutup} onChange={(e) => updateRow(idx, { tutup: e.target.value })} />
            <button
              type="button"
              onClick={() => setJadwal((rows) => rows.filter((_, i) => i !== idx))}
              disabled={jadwal.length <= 1}
              style={{ padding: '0 10px', borderRadius: 6, border: '1px solid #dc2626', background: '#fff', color: '#dc2626', cursor: jadwal.length <= 1 ? 'not-allowed' : 'pointer', fontSize: 12 }}
            >
              Hapus
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setJadwal((rows) => [...rows, { hari: '1', buka: '', tutup: '' }])}
          style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #2563eb', background: '#fff', color: '#2563eb', cursor: 'pointer', fontSize: 12 }}
        >
          + Tambah Jadwal
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="submit"
          disabled={saving}
          style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: saving ? '#9ca3af' : '#2563eb', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500 }}
        >
          {saving ? 'Mengirim...' : 'Kirim ke BPJS'}
        </button>
      </div>
    </form>
  );
};

type PoliFpHfis = {
  kodepoli: string;
  namapoli: string;
  kodesubspesialis: string;
  namasubspesialis: string;
};

const ReferensiPoliFpHfisTab: React.FC = () => {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [list, setList] = React.useState<PoliFpHfis[]>([]);
  const [keyword, setKeyword] = React.useState('');
  const [loaded, setLoaded] = React.useState(false);

  const fetchList = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/bridging/hfis/referensi/poli-fp');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengambil referensi poli finger print HFIS');
      const items: PoliFpHfis[] = data.poli_fp?.list ?? [];
      setList(Array.isArray(items) ? items : []);
      setLoaded(true);
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan');
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = keyword.trim()
    ? list.filter((p) => `${p.namapoli} ${p.namasubspesialis} ${p.kodesubspesialis} ${p.kodepoli}`.toLowerCase().includes(keyword.toLowerCase()))
    : list;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ padding: '10px 12px', borderRadius: 10, fontSize: 12, background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af' }}>
        Poli-poli berikut mewajibkan validasi sidik jari sebelum SEP diterbitkan.
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Masukan kata kunci (opsional)</label>
          <input style={{ ...inputStyle, width: 280 }} value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Nama poli / subspesialis / kode" />
        </div>
        <button
          type="button"
          onClick={fetchList}
          disabled={loading}
          style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: loading ? '#9ca3af' : '#2563eb', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500 }}
        >
          {loading ? 'Memuat...' : 'Cari'}
        </button>
        {error && <span style={{ fontSize: 12, color: '#991b1b', whiteSpace: 'nowrap' }}>{error}</span>}
      </div>

      {loaded && (
        <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'auto', maxHeight: 480 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6' }}>
              <tr>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Kode Poli</th>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Nama Poli</th>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Kode Subspesialis</th>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Nama Subspesialis</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Tidak ada data</td></tr>
              ) : (
                filtered.map((p, i) => (
                  <tr key={`${p.kodepoli}-${p.kodesubspesialis}-${i}`} style={{ background: i % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                    <td style={{ padding: '6px 12px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{p.kodepoli}</td>
                    <td style={{ padding: '6px 12px', borderBottom: '1px solid #e5e7eb', color: '#111827' }}>{p.namapoli}</td>
                    <td style={{ padding: '6px 12px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{p.kodesubspesialis}</td>
                    <td style={{ padding: '6px 12px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{p.namasubspesialis}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

type PasienFpHfis = {
  nomorkartu: string;
  nik: string;
  tgllahir: string;
  daftarfp: number;
};

const ReferensiPasienFpHfisTab: React.FC = () => {
  const [jenis, setJenis] = React.useState<'nik' | 'noka'>('noka');
  const [noIdentitas, setNoIdentitas] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<PasienFpHfis | null>(null);

  const handleCari = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!noIdentitas.trim()) {
      setError(jenis === 'nik' ? 'NIK wajib diisi' : 'No. Kartu wajib diisi');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/bridging/hfis/referensi/pasien-fp?jenis=${jenis}&no_identitas=${encodeURIComponent(noIdentitas.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Pasien tidak ditemukan');
      setResult(data.pasien_fp ?? null);
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 560 }}>
      <form onSubmit={handleCari} style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Jenis Identitas</label>
          <select style={{ ...inputStyle, width: 140 }} value={jenis} onChange={(e) => setJenis(e.target.value as 'nik' | 'noka')}>
            <option value="noka">No. Kartu BPJS</option>
            <option value="nik">NIK</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>{jenis === 'nik' ? 'NIK' : 'No. Kartu BPJS'}</label>
          <input required style={{ ...inputStyle, width: 240 }} value={noIdentitas} onChange={(e) => setNoIdentitas(e.target.value)} />
        </div>
        <button
          type="submit"
          disabled={loading}
          style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: loading ? '#9ca3af' : '#2563eb', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500 }}
        >
          {loading ? 'Mencari...' : 'Cari'}
        </button>
        {error && <span style={{ fontSize: 12, color: '#991b1b', whiteSpace: 'nowrap' }}>{error}</span>}
      </form>

      {result && (
        <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <tbody>
              <tr style={{ background: '#ffffff' }}>
                <td style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb', color: '#6b7280', width: '35%' }}>No. Kartu BPJS</td>
                <td style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb', color: '#111827' }}>{result.nomorkartu || '-'}</td>
              </tr>
              <tr style={{ background: '#f9fafb' }}>
                <td style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>NIK</td>
                <td style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb', color: '#111827' }}>{result.nik || '-'}</td>
              </tr>
              <tr style={{ background: '#ffffff' }}>
                <td style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>Tgl Lahir</td>
                <td style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb', color: '#111827' }}>{result.tgllahir || '-'}</td>
              </tr>
              <tr style={{ background: '#f9fafb' }}>
                <td style={{ padding: '8px 12px', color: '#6b7280' }}>Status Finger Print</td>
                <td style={{ padding: '8px 12px' }}>
                  {result.daftarfp ? (
                    <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>Sudah Terdaftar</span>
                  ) : (
                    <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>Belum Terdaftar</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export const HfisView: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<HfisTab>('poli');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
      <div style={{ display: 'inline-flex', background: '#f3f4f6', borderRadius: 12, padding: 4, gap: 4 }}>
        {TABS.map((t) => {
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              style={{
                padding: '6px 24px',
                borderRadius: 8,
                border: active ? '1px solid #2563eb' : '1px solid transparent',
                background: active ? '#ffffff' : 'transparent',
                color: active ? '#2563eb' : '#6b7280',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                transition: 'all 0.2s ease',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'poli' && <ReferensiPoliHfisTab />}
      {activeTab === 'dokter' && <ReferensiDokterHfisTab />}
      {activeTab === 'jadwal-dokter' && <ReferensiJadwalDokterHfisTab />}
      {activeTab === 'update-jadwal-dokter' && <UpdateJadwalDokterHfisTab />}
      {activeTab === 'poli-fp' && <ReferensiPoliFpHfisTab />}
      {activeTab === 'pasien-fp' && <ReferensiPasienFpHfisTab />}
    </div>
  );
};
