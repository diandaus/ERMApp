import React from 'react';
import { createPortal } from 'react-dom';
import Swal from 'sweetalert2';

type RujukanInternalModalProps = {
  patient: any;
  onClose: () => void;
  onSuccess?: () => void;
};

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// RujukStepperIcon — pengganti panah dropdown native pada <select>, warna
// sama dgn tombol "Simpan Rujuk Keluar" (#0ea5e9).
const RujukStepperIcon: React.FC = () => (
  <div style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, borderRadius: 4, background: '#0ea5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 8.5 12 3.5 7 8.5"></polyline>
      <polyline points="7 15.5 12 20.5 17 15.5"></polyline>
    </svg>
  </div>
);

export const RujukanInternalModal: React.FC<RujukanInternalModalProps> = ({ patient, onClose, onSuccess }) => {
  const [activeTab, setActiveTab] = React.useState<'internal' | 'keluar'>('internal');

  // Form simpan rujuk keluar
  const [rujukKe, setRujukKe] = React.useState('');
  const [rujukTglBaru, setRujukTglBaru] = React.useState(todayStr());
  const [rujukJamBaru, setRujukJamBaru] = React.useState('');
  const [rujukOtomatisJam, setRujukOtomatisJam] = React.useState(true);
  const [rujukKetDiagnosa, setRujukKetDiagnosa] = React.useState('');
  const [rujukKatRujuk, setRujukKatRujuk] = React.useState('-');
  const [rujukAmbulance, setRujukAmbulance] = React.useState('-');
  const [rujukKeterangan, setRujukKeterangan] = React.useState('');
  const [savingRujuk, setSavingRujuk] = React.useState(false);
  // Default Dokter Perujuk = dokter poli pasien ini (patient.kd_dokter/
  // nm_dokter, sama data yg dipakai Pemeriksaan.tsx) — tetap bisa diganti
  // manual lewat pencarian kalau dokter perujuknya beda dari dokter poli.
  const [rujukKdDokter, setRujukKdDokter] = React.useState(patient.kd_dokter || '');
  const [rujukNmDokter, setRujukNmDokter] = React.useState(patient.nm_dokter || '');
  const [showRujukDokterDropdown, setShowRujukDokterDropdown] = React.useState(false);
  const [searchRujukDokter, setSearchRujukDokter] = React.useState('');
  const rujukDokterSearchWrapperRef = React.useRef<HTMLDivElement>(null);
  const [rujukDokterDropdownPos, setRujukDokterDropdownPos] = React.useState<{ top: number; left: number; width: number } | null>(null);
  const [kdDokter, setKdDokter] = React.useState('');
  const [nmDokter, setNmDokter] = React.useState('');
  const [kdPoli, setKdPoli] = React.useState('');
  const [nmPoli, setNmPoli] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [loadingDokter, setLoadingDokter] = React.useState(false);
  const [loadingPoli, setLoadingPoli] = React.useState(false);

  // State untuk dropdown
  const [showDokterDropdown, setShowDokterDropdown] = React.useState(false);
  const [showPoliDropdown, setShowPoliDropdown] = React.useState(false);
  const [dokterList, setDokterList] = React.useState<any[]>([]);
  const [poliList, setPoliList] = React.useState<any[]>([]);
  const [searchDokter, setSearchDokter] = React.useState('');
  const [searchPoli, setSearchPoli] = React.useState('');

  // Posisi dropdown pencarian poli/dokter — dihitung dari wrapper input lalu
  // di-render via portal ke document.body (position: fixed), agar tidak
  // terpotong oleh overflow:hidden/auto pada card modal.
  const poliSearchWrapperRef = React.useRef<HTMLDivElement>(null);
  const dokterSearchWrapperRef = React.useRef<HTMLDivElement>(null);
  const [poliDropdownPos, setPoliDropdownPos] = React.useState<{ top: number; left: number; width: number } | null>(null);
  const [dokterDropdownPos, setDokterDropdownPos] = React.useState<{ top: number; left: number; width: number } | null>(null);

  // Jam Rujuk otomatis — ikut jam berjalan (update tiap detik) selama
  // checkbox "Otomatis" dicentang; berhenti & bisa diedit manual kalau
  // di-uncheck.
  React.useEffect(() => {
    if (!rujukOtomatisJam) return;
    const updateJam = () => {
      const d = new Date();
      setRujukJamBaru(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`);
    };
    updateJam();
    const interval = setInterval(updateJam, 1000);
    return () => clearInterval(interval);
  }, [rujukOtomatisJam]);

  React.useEffect(() => {
    if (!showPoliDropdown) { setPoliDropdownPos(null); return; }
    const updatePos = () => {
      const rect = poliSearchWrapperRef.current?.getBoundingClientRect();
      if (rect) setPoliDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    };
    updatePos();
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [showPoliDropdown]);

  React.useEffect(() => {
    if (!showDokterDropdown) { setDokterDropdownPos(null); return; }
    const updatePos = () => {
      const rect = dokterSearchWrapperRef.current?.getBoundingClientRect();
      if (rect) setDokterDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    };
    updatePos();
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [showDokterDropdown]);

  // Fetch dokter saat kode dokter berubah atau search
  React.useEffect(() => {
    if (kdDokter.trim()) {
      fetchDokterByKode(kdDokter);
    } else {
      setNmDokter('');
    }
  }, [kdDokter]);

  // Fetch poli saat kode poli berubah atau search
  React.useEffect(() => {
    if (kdPoli.trim()) {
      fetchPoliByKode(kdPoli);
    } else {
      setNmPoli('');
    }
  }, [kdPoli]);

  // Fetch list dokter untuk dropdown
  React.useEffect(() => {
    if (showDokterDropdown) {
      fetchDokterList(searchDokter);
    }
  }, [showDokterDropdown, searchDokter]);

  // Dropdown dokter di form Rujuk Keluar — reuse fetchDokterList/dokterList
  // (aman krn cuma satu tab yg aktif/kelihatan dlm satu waktu).
  React.useEffect(() => {
    if (showRujukDokterDropdown) {
      fetchDokterList(searchRujukDokter);
    }
  }, [showRujukDokterDropdown, searchRujukDokter]);

  React.useEffect(() => {
    if (!showRujukDokterDropdown) { setRujukDokterDropdownPos(null); return; }
    const updatePos = () => {
      const rect = rujukDokterSearchWrapperRef.current?.getBoundingClientRect();
      if (rect) setRujukDokterDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    };
    updatePos();
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [showRujukDokterDropdown]);

  // Fetch list poli untuk dropdown
  React.useEffect(() => {
    if (showPoliDropdown) {
      fetchPoliList(searchPoli);
    }
  }, [showPoliDropdown, searchPoli]);

  const fetchDokterByKode = async (kode: string) => {
    try {
      const response = await fetch(`/api/pendaftaran/dokter/${encodeURIComponent(kode)}`);
      if (response.ok) {
        const data = await response.json();
        setNmDokter(data.nm_dokter || '');
      } else {
        setNmDokter('');
      }
    } catch (err) {
      console.error('Error fetching dokter:', err);
      setNmDokter('');
    }
  };

  const fetchPoliByKode = async (kode: string) => {
    try {
      const response = await fetch(`/api/pendaftaran/poli/${encodeURIComponent(kode)}`);
      if (response.ok) {
        const data = await response.json();
        setNmPoli(data.nm_poli || '');
      } else {
        setNmPoli('');
      }
    } catch (err) {
      console.error('Error fetching poli:', err);
      setNmPoli('');
    }
  };

  const fetchDokterList = async (search: string) => {
    setLoadingDokter(true);
    try {
      const url = search
        ? `/api/pendaftaran/dokter?search=${encodeURIComponent(search)}`
        : '/api/pendaftaran/dokter';
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setDokterList(Array.isArray(data) ? data : []);
      } else {
        setDokterList([]);
      }
    } catch (err) {
      console.error('Error fetching dokter list:', err);
      setDokterList([]);
    } finally {
      setLoadingDokter(false);
    }
  };

  const fetchPoliList = async (search: string) => {
    setLoadingPoli(true);
    try {
      const url = search
        ? `/api/pendaftaran/poli?search=${encodeURIComponent(search)}`
        : '/api/pendaftaran/poli';
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setPoliList(Array.isArray(data) ? data : []);
      } else {
        setPoliList([]);
      }
    } catch (err) {
      console.error('Error fetching poli list:', err);
      setPoliList([]);
    } finally {
      setLoadingPoli(false);
    }
  };

  const handleSimpanRujuk = async () => {
    if (!patient.no_rawat) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Data pasien tidak lengkap!' });
      return;
    }
    if (!rujukKe.trim()) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Tempat Rujuk wajib diisi!' });
      return;
    }
    if (!rujukKdDokter.trim() || !rujukNmDokter.trim()) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Dokter Perujuk wajib diisi!' });
      return;
    }
    setSavingRujuk(true);
    try {
      const res = await fetch('/api/rujuk-keluar/simpan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          no_rawat: patient.no_rawat,
          rujuk_ke: rujukKe.trim(),
          tgl_rujuk: rujukTglBaru,
          jam: rujukOtomatisJam ? '' : rujukJamBaru,
          keterangan_diagnosa: rujukKetDiagnosa.trim(),
          kd_dokter: rujukKdDokter.trim(),
          kat_rujuk: rujukKatRujuk,
          ambulance: rujukAmbulance,
          keterangan: rujukKeterangan.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan rujuk keluar');

      await Swal.fire({ icon: 'success', title: 'Berhasil!', text: data.message || 'Rujuk keluar berhasil disimpan', timer: 2000, showConfirmButton: false });

      // Reset form
      setRujukKe('');
      setRujukTglBaru(todayStr());
      setRujukJamBaru('');
      setRujukKetDiagnosa('');
      setRujukKatRujuk('-');
      setRujukAmbulance('-');
      setRujukKeterangan('');
      setRujukKdDokter('');
      setRujukNmDokter('');
      setSearchRujukDokter('');
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err instanceof Error ? err.message : 'Terjadi kesalahan saat menyimpan rujuk keluar' });
    } finally {
      setSavingRujuk(false);
    }
  };

  const handleSimpan = async () => {
    // Validasi
    if (!patient.no_rawat || !patient.no_rkm_medis || !patient.nm_pasien) {
      Swal.fire({
        icon: 'warning',
        title: 'Peringatan',
        text: 'Data pasien tidak lengkap!',
      });
      return;
    }

    if (!kdDokter.trim() || !nmDokter.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Peringatan',
        text: 'Dokter dituju wajib diisi!',
      });
      return;
    }

    if (!kdPoli.trim() || !nmPoli.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Peringatan',
        text: 'Poliklinik tujuan wajib diisi!',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/rujukan-internal/simpan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          no_rawat: patient.no_rawat,
          kd_dokter: kdDokter.trim(),
          kd_poli: kdPoli.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Gagal menyimpan rujukan internal');
      }

      await Swal.fire({
        icon: 'success',
        title: 'Berhasil!',
        text: data.message || 'Rujukan internal berhasil disimpan',
        timer: 2000,
        showConfirmButton: false,
      });

      // Reset form
      setKdDokter('');
      setNmDokter('');
      setKdPoli('');
      setNmPoli('');
      setSearchDokter('');
      setSearchPoli('');

      // Callback success
      if (onSuccess) {
        onSuccess();
      }

      // Tutup modal
      onClose();
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Gagal!',
        text: err.message || 'Terjadi kesalahan saat menyimpan rujukan internal',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#F3F4F6',
          borderRadius: 20,
          padding: '35px 8px 8px 8px',
          position: 'relative',
          maxWidth: 700,
          width: '85%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            padding: '8px 16px 8px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ color: '#000000', fontSize: 13, fontWeight: 400 }}>Rujuk</span>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}
          >
            &times;
          </button>
        </div>

        {/* White Card Content */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: 16,
            border: '1px solid #d1d5db',
            padding: 12,
            overflowY: 'auto',
            flex: 1,
            minHeight: 0,
          }}
        >
          {/* Segmented Tab */}
          <div style={{ display: 'inline-flex', background: '#f3f4f6', borderRadius: 12, padding: 4, gap: 4, marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => setActiveTab('internal')}
              style={{
                padding: '6px 24px',
                borderRadius: 8,
                border: activeTab === 'internal' ? '1px solid #2563eb' : '1px solid transparent',
                background: activeTab === 'internal' ? '#ffffff' : 'transparent',
                color: activeTab === 'internal' ? '#2563eb' : '#6b7280',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: activeTab === 'internal' ? 600 : 400,
                transition: 'all 0.2s ease',
              }}
            >
              Poli Internal
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('keluar')}
              style={{
                padding: '6px 24px',
                borderRadius: 8,
                border: activeTab === 'keluar' ? '1px solid #2563eb' : '1px solid transparent',
                background: activeTab === 'keluar' ? '#ffffff' : 'transparent',
                color: activeTab === 'keluar' ? '#2563eb' : '#6b7280',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: activeTab === 'keluar' ? 600 : 400,
                transition: 'all 0.2s ease',
              }}
            >
              Rujuk Keluar
            </button>
          </div>

          {activeTab === 'keluar' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Form simpan rujuk keluar baru — langsung tampil di BG modal (bukan card abu-abu terpisah) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 0.75fr 0.85fr auto', gap: 10, alignItems: 'end' }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block', color: '#374151' }}>
                      Tempat Rujuk <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text" value={rujukKe} onChange={(e) => setRujukKe(e.target.value)}
                      placeholder="Nama faskes/RS tujuan"
                      style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box', outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block', color: '#374151' }}>Tgl.Rujuk</label>
                    <input
                      type="date" value={rujukTglBaru} onChange={(e) => setRujukTglBaru(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box', outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block', color: '#374151' }}>Jam Rujuk</label>
                    <input
                      type="time" step="1" value={rujukJamBaru} onChange={(e) => setRujukJamBaru(e.target.value)}
                      disabled={rujukOtomatisJam}
                      style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box', outline: 'none', opacity: rujukOtomatisJam ? 0.6 : 1 }}
                    />
                  </div>
                  <input
                    type="checkbox" checked={rujukOtomatisJam} onChange={(e) => setRujukOtomatisJam(e.target.checked)}
                    title="Otomatis"
                    style={{ cursor: 'pointer', width: 16, height: 16, marginBottom: 10 }}
                  />
                </div>

                <div style={{ position: 'relative' }}>
                  <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block', color: '#374151' }}>
                    Dokter Perujuk <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }} ref={rujukDokterSearchWrapperRef}>
                    <input
                      type="text"
                      value={rujukNmDokter || rujukKdDokter}
                      onChange={(e) => { const v = e.target.value; setRujukKdDokter(v); setSearchRujukDokter(v); setRujukNmDokter(''); }}
                      onFocus={() => setShowRujukDokterDropdown(true)}
                      onBlur={() => setTimeout(() => setShowRujukDokterDropdown(false), 200)}
                      placeholder="Cari dokter..."
                      style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box', outline: 'none' }}
                    />
                    {showRujukDokterDropdown && rujukDokterDropdownPos && createPortal(
                      <div
                        style={{
                          position: 'fixed', top: rujukDokterDropdownPos.top, left: rujukDokterDropdownPos.left, width: rujukDokterDropdownPos.width,
                          maxHeight: 240, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, background: '#ffffff',
                          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', zIndex: 999999,
                        }}
                      >
                        {loadingDokter ? (
                          <div style={{ padding: 16, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>Memuat...</div>
                        ) : dokterList.length === 0 ? (
                          <div style={{ padding: 16, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
                            {rujukKdDokter.length > 0 ? 'Tidak ada hasil pencarian' : 'Ketik untuk mencari dokter...'}
                          </div>
                        ) : (
                          dokterList.map((d, idx) => (
                            <div
                              key={idx}
                              onClick={() => { setRujukKdDokter(d.kd_dokter); setRujukNmDokter(d.nm_dokter); setSearchRujukDokter(''); setShowRujukDokterDropdown(false); }}
                              style={{ padding: '10px 12px', cursor: 'pointer', fontSize: 13, borderBottom: idx < dokterList.length - 1 ? '1px solid #f3f4f6' : 'none' }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = '#f9fafb'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
                            >
                              <div style={{ fontWeight: 500, color: '#111827' }}>{d.nm_dokter}</div>
                              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>Kode: {d.kd_dokter}</div>
                            </div>
                          ))
                        )}
                      </div>,
                      document.body
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block', color: '#374151' }}>Kategori Rujuk</label>
                    <div style={{ position: 'relative' }}>
                      <select
                        value={rujukKatRujuk} onChange={(e) => setRujukKatRujuk(e.target.value)}
                        style={{ width: '100%', padding: '9px 30px 9px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box', outline: 'none', background: '#fff', appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer' }}
                      >
                        <option value="-">-</option>
                        <option value="Bedah">Bedah</option>
                        <option value="Non Bedah">Non Bedah</option>
                        <option value="Kebidanan">Kebidanan</option>
                        <option value="Anak">Anak</option>
                      </select>
                      <RujukStepperIcon />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block', color: '#374151' }}>Ambulance</label>
                    <div style={{ position: 'relative' }}>
                      <select
                        value={rujukAmbulance} onChange={(e) => setRujukAmbulance(e.target.value)}
                        style={{ width: '100%', padding: '9px 30px 9px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box', outline: 'none', background: '#fff', appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer' }}
                      >
                        <option value="-">-</option>
                        <option value="AGD">AGD</option>
                        <option value="SENDIRI">SENDIRI</option>
                        <option value="SWASTA">SWASTA</option>
                      </select>
                      <RujukStepperIcon />
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block', color: '#374151' }}>Keterangan Diagnosa</label>
                  <input
                    type="text" value={rujukKetDiagnosa} onChange={(e) => setRujukKetDiagnosa(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block', color: '#374151' }}>Keterangan</label>
                  <input
                    type="text" value={rujukKeterangan} onChange={(e) => setRujukKeterangan(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box', outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button" onClick={handleSimpanRujuk} disabled={savingRujuk}
                    style={{ padding: '8px 16px', borderRadius: 4, border: 'none', background: savingRujuk ? '#9ca3af' : '#0ea5e9', color: '#fff', cursor: savingRujuk ? 'default' : 'pointer', fontSize: 12, fontWeight: 500 }}
                  >
                    {savingRujuk ? 'Menyimpan...' : 'Simpan Rujuk Keluar'}
                  </button>
                </div>
              </div>

            </div>
          ) : (
        <>
        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* No. Rawat, No. RM, Nama Pasien */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block', color: '#374151' }}>
                No. Rawat
              </label>
              <input
                type="text"
                value={patient.no_rawat || ''}
                readOnly
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  fontSize: 13,
                  background: '#f3f4f6',
                  color: '#6b7280',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block', color: '#374151' }}>
                No. RM
              </label>
              <input
                type="text"
                value={patient.no_rkm_medis || ''}
                readOnly
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  fontSize: 13,
                  background: '#f3f4f6',
                  color: '#6b7280',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block', color: '#374151' }}>
                Nama Pasien
              </label>
              <input
                type="text"
                value={patient.nm_pasien || ''}
                readOnly
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  fontSize: 13,
                  background: '#f3f4f6',
                  color: '#6b7280',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Poli Tujuan */}
          <div style={{ position: 'relative' }}>
            <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block', color: '#374151' }}>
              Poli Tujuan <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }} ref={poliSearchWrapperRef}>
              <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex', alignItems: 'center', zIndex: 1 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1AB1E5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.35-4.35"></path>
                </svg>
              </div>
              <input
                type="text"
                value={nmPoli || kdPoli}
                onChange={(e) => {
                  const value = e.target.value;
                  setKdPoli(value);
                  setSearchPoli(value);
                  setNmPoli(''); // Reset nama saat user mengetik
                }}
                onFocus={() => {
                  setShowPoliDropdown(true);
                }}
                onBlur={() => {
                  setTimeout(() => setShowPoliDropdown(false), 200);
                }}
                placeholder="Cari poliklinik..."
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 38px',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  fontSize: 13,
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
                onFocusCapture={(e) => e.target.style.borderColor = '#1AB1E5'}
                onBlurCapture={(e) => e.target.style.borderColor = '#d1d5db'}
              />
              {/* Dropdown Poli — portal ke document.body agar tidak terpotong overflow modal */}
              {showPoliDropdown && poliDropdownPos && createPortal(
                <div
                  style={{
                    position: 'fixed',
                    top: poliDropdownPos.top,
                    left: poliDropdownPos.left,
                    width: poliDropdownPos.width,
                    maxHeight: 300,
                    overflowY: 'auto',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    background: '#ffffff',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    zIndex: 999999
                  }}
                >
                  {loadingPoli ? (
                    <div style={{ textAlign: 'center', padding: 20, color: '#6b7280' }}>
                      <div style={{
                        display: 'inline-block',
                        width: 20,
                        height: 20,
                        border: '2px solid #f3f4f6',
                        borderTop: '2px solid #1AB1E5',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }}></div>
                    </div>
                  ) : poliList.length === 0 ? (
                    <div style={{ padding: 16, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
                      {kdPoli.length > 0 ? 'Tidak ada hasil pencarian' : 'Ketik untuk mencari poliklinik...'}
                    </div>
                  ) : (
                    poliList.map((p, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setKdPoli(p.kd_poli);
                          setNmPoli(p.nm_poli);
                          setSearchPoli('');
                          setShowPoliDropdown(false);
                        }}
                        style={{
                          padding: '10px 12px',
                          cursor: 'pointer',
                          fontSize: 13,
                          borderBottom: idx < poliList.length - 1 ? '1px solid #f3f4f6' : 'none',
                          transition: 'all 0.2s',
                          background: '#ffffff'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#f9fafb';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#ffffff';
                        }}
                      >
                        <div style={{ fontWeight: 500, color: '#111827' }}>{p.nm_poli}</div>
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>Kode: {p.kd_poli}</div>
                      </div>
                    ))
                  )}
                </div>,
                document.body
              )}
            </div>
          </div>

          {/* Dokter Dituju */}
          <div style={{ position: 'relative' }}>
            <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block', color: '#374151' }}>
              Dokter Dituju <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }} ref={dokterSearchWrapperRef}>
              <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex', alignItems: 'center', zIndex: 1 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1AB1E5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.35-4.35"></path>
                </svg>
              </div>
              <input
                type="text"
                value={nmDokter || kdDokter}
                onChange={(e) => {
                  const value = e.target.value;
                  setKdDokter(value);
                  setSearchDokter(value);
                  setNmDokter(''); // Reset nama saat user mengetik
                }}
                onFocus={() => {
                  setShowDokterDropdown(true);
                }}
                onBlur={() => {
                  setTimeout(() => setShowDokterDropdown(false), 200);
                }}
                placeholder="Cari dokter..."
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 38px',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  fontSize: 13,
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
                onFocusCapture={(e) => e.target.style.borderColor = '#1AB1E5'}
                onBlurCapture={(e) => e.target.style.borderColor = '#d1d5db'}
              />
              {/* Dropdown Dokter — portal ke document.body agar tidak terpotong overflow modal */}
              {showDokterDropdown && dokterDropdownPos && createPortal(
                <div
                  style={{
                    position: 'fixed',
                    top: dokterDropdownPos.top,
                    left: dokterDropdownPos.left,
                    width: dokterDropdownPos.width,
                    maxHeight: 300,
                    overflowY: 'auto',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    background: '#ffffff',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    zIndex: 999999
                  }}
                >
                  {loadingDokter ? (
                    <div style={{ textAlign: 'center', padding: 20, color: '#6b7280' }}>
                      <div style={{
                        display: 'inline-block',
                        width: 20,
                        height: 20,
                        border: '2px solid #f3f4f6',
                        borderTop: '2px solid #1AB1E5',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }}></div>
                    </div>
                  ) : dokterList.length === 0 ? (
                    <div style={{ padding: 16, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
                      {kdDokter.length > 0 ? 'Tidak ada hasil pencarian' : 'Ketik untuk mencari dokter...'}
                    </div>
                  ) : (
                    dokterList.map((d, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setKdDokter(d.kd_dokter);
                          setNmDokter(d.nm_dokter);
                          setSearchDokter('');
                          setShowDokterDropdown(false);
                        }}
                        style={{
                          padding: '10px 12px',
                          cursor: 'pointer',
                          fontSize: 13,
                          borderBottom: idx < dokterList.length - 1 ? '1px solid #f3f4f6' : 'none',
                          transition: 'all 0.2s',
                          background: '#ffffff'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#f9fafb';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#ffffff';
                        }}
                      >
                        <div style={{ fontWeight: 500, color: '#111827' }}>{d.nm_dokter}</div>
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>Kode: {d.kd_dokter}</div>
                      </div>
                    ))
                  )}
                </div>,
                document.body
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '8px 16px', borderRadius: 4, border: '1px solid #d1d5db', background: '#ffffff', color: '#374151', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
            Tutup
          </button>
          <button
            type="button"
            onClick={handleSimpan}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 4, border: 'none', background: '#0ea5e9', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
            {loading ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
        </>
          )}
        </div>
      </div>

      {/* CSS Animation untuk spinner */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

