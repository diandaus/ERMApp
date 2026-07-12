import React from 'react';
import { ModalCariDokter } from './ModalCariDokter';
import { ModalCariPoli } from './ModalCariPoli';
import { ModalCariCaraBayar } from './ModalCariCaraBayar';
import { ModalCariPasien } from './ModalCariPasien';
import { localDateStr } from '../utils/date';

type Poli = {
  kd_poli: string;
  nm_poli: string;
  registrasi?: number;
};

type Dokter = {
  kd_dokter: string;
  nm_dokter: string;
};

type Penjab = {
  kd_pj: string;
  nm_pj: string;
};

type PatientBrief = {
  no_rkm_medis: string;
  nm_pasien: string;
  alamat: string;
  jk: string;
  tgl_lahir: string;
};

interface ModalRegistrasiProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ModalRegistrasi: React.FC<ModalRegistrasiProps> = ({ isOpen, onClose, onSuccess }) => {
  // Form input states
  const [noReg, setNoReg] = React.useState<string>('');
  const [autoNoReg, setAutoNoReg] = React.useState<boolean>(true);
  const [noRawat, setNoRawat] = React.useState<string>('');
  const [tglReg, setTglReg] = React.useState<string>(localDateStr());
  const [jamReg, setJamReg] = React.useState<string>('');
  const [useAutoTime, setUseAutoTime] = React.useState<boolean>(true);
  const [noRkmMedis, setNoRkmMedis] = React.useState<string>('');
  const [selectedPoli, setSelectedPoli] = React.useState<string>('');
  const [nmPoli, setNmPoli] = React.useState<string>('');
  const [ruanganPoli, setRuanganPoli] = React.useState<string>('');
  const [selectedDokter, setSelectedDokter] = React.useState<string>('');
  const [nmDokter, setNmDokter] = React.useState<string>('');
  const [kdPj, setKdPj] = React.useState<string>('');
  const [nmPj, setNmPj] = React.useState<string>('');
  const [noKartu, setNoKartu] = React.useState<string>('');
  const [biayaReg, setBiayaReg] = React.useState<number>(0);
  const [pJawab, setPJawab] = React.useState<string>('');
  const [hubunganPj, setHubunganPj] = React.useState<string>('');
  const [almtPj, setAlmtPj] = React.useState<string>('');
  const [asalRujukan, setAsalRujukan] = React.useState<string>('-');
  const [statusDaftar, setStatusDaftar] = React.useState<string>('Baru');
  const [saving, setSaving] = React.useState<boolean>(false);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Registration result states
  const [registrationResult, setRegistrationResult] = React.useState<{
    no_reg: string;
    no_rawat: string;
    tgl_registrasi: string;
    jam_reg: string;
  } | null>(null);

  // Master data states
  const [poli, setPoli] = React.useState<Poli[]>([]);
  const [dokter, setDokter] = React.useState<Dokter[]>([]);
  const [penjab, setPenjab] = React.useState<Penjab[]>([]);

  // Patient data states
  const [patient, setPatient] = React.useState<PatientBrief | null>(null);
  const [patientLoading, setPatientLoading] = React.useState<boolean>(false);
  const [patientError, setPatientError] = React.useState<string | null>(null);

  // Modal states
  const [showModalDokter, setShowModalDokter] = React.useState<boolean>(false);
  const [showModalPoli, setShowModalPoli] = React.useState<boolean>(false);
  const [showModalCaraBayar, setShowModalCaraBayar] = React.useState<boolean>(false);
  const [showModalPasien, setShowModalPasien] = React.useState<boolean>(false);

  // Auto-update current time
  React.useEffect(() => {
    if (useAutoTime) {
      const updateTime = () => {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        setJamReg(`${hours}:${minutes}:${seconds}`);
      };

      updateTime();
      const interval = setInterval(updateTime, 1000);
      return () => clearInterval(interval);
    }
  }, [useAutoTime]);

  // Auto-generate No. Reg berdasarkan kombinasi poli + dokter
  React.useEffect(() => {
    if (!autoNoReg) return;
    if (!tglReg || !isOpen) return;

    const generateNoReg = async () => {
      try {
        const response = await fetch('/api/registrasi/generate-noreg', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tgl_registrasi: tglReg,
            kd_dokter: selectedDokter,
            kd_poli: selectedPoli,
            base_no_reg: '',
            urut_no_reg: selectedDokter && selectedPoli ? 'dokter + poli' : 'global'
          })
        });

        if (response.ok) {
          const data = await response.json();
          setNoReg(data.no_reg);
        }
      } catch (err) {
        console.error('Error generating No. Reg:', err);
      }
    };

    generateNoReg();
  }, [tglReg, selectedDokter, selectedPoli, autoNoReg, isOpen]);

  // Auto-generate No. Rawat based on date
  React.useEffect(() => {
    const generateNoRawat = async () => {
      if (!tglReg || !isOpen) {
        return;
      }

      try {
        const response = await fetch('/api/registrasi/generate-norawat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tgl_registrasi: tglReg
          })
        });

        if (response.ok) {
          const data = await response.json();
          setNoRawat(data.no_rawat);
        }
      } catch (err) {
        console.error('Error generating No. Rawat:', err);
      }
    };

    generateNoRawat();
  }, [tglReg, isOpen]);

  // Load master data and generate No. Rawat on modal open
  React.useEffect(() => {
    if (isOpen) {
      const loadMasterData = async () => {
        try {
          const [poliRes, dokterRes, penjabRes] = await Promise.all([
            fetch('/api/pendaftaran/poli'),
            fetch('/api/pendaftaran/dokter'),
            fetch('/api/pendaftaran/penjab')
          ]);

          if (poliRes.ok && dokterRes.ok && penjabRes.ok) {
            const [poliData, dokterData, penjabData] = await Promise.all([
              poliRes.json(),
              dokterRes.json(),
              penjabRes.json()
            ]);

            setPoli(Array.isArray(poliData) ? poliData : []);
            setDokter(Array.isArray(dokterData) ? dokterData : []);
            setPenjab(Array.isArray(penjabData) ? penjabData : []);

            // Set default penjab
            if (Array.isArray(penjabData) && penjabData.length > 0) {
              setKdPj(penjabData[0].kd_pj);
              setNmPj(penjabData[0].nm_pj);
            }
          }
        } catch (err) {
          console.error('Error loading master data:', err);
        }
      };

      const generateInitialNoRawat = async () => {
        try {
          const response = await fetch('/api/registrasi/generate-norawat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tgl_registrasi: tglReg
            })
          });

          if (response.ok) {
            const data = await response.json();
            setNoRawat(data.no_rawat);
          }
        } catch (err) {
          console.error('Error generating initial No. Rawat:', err);
        }
      };

      loadMasterData();
      generateInitialNoRawat();
    }
  }, [isOpen, tglReg]);

  // Update biaya_reg when poli is selected
  React.useEffect(() => {
    const fetchBiayaReg = async () => {
      if (!selectedPoli) {
        setBiayaReg(0);
        return;
      }
      try {
        const res = await fetch(`/api/pendaftaran/poli/${selectedPoli}`);
        if (res.ok) {
          const data: Poli = await res.json();
          setBiayaReg(data.registrasi || 0);
        }
      } catch (err) {
        console.error('Error fetching biaya:', err);
      }
    };
    fetchBiayaReg();
  }, [selectedPoli]);

  // Fetch patient by No RM
  const fetchPatient = async (no: string) => {
    setPatient(null);
    setPatientError(null);
    if (!no) {
      return;
    }
    setPatientLoading(true);
    try {
      const res = await fetch(`/api/pendaftaran/pasien/${encodeURIComponent(no)}`);
      if (res.status === 404) {
        setPatientError('Pasien tidak ditemukan');
        return;
      }
      if (!res.ok) {
        throw new Error('Gagal mengambil data pasien');
      }
      const data: PatientBrief = await res.json();
      setPatient(data);
    } catch (e) {
      setPatientError(e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setPatientLoading(false);
    }
  };

  // Reset form when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      // Reset all fields
      setNoReg('');
      setNoRawat('');
      setTglReg(localDateStr());
      setJamReg('');
      setUseAutoTime(true);
      setNoRkmMedis('');
      setSelectedPoli('');
      setNmPoli('');
      setRuanganPoli('');
      setSelectedDokter('');
      setNmDokter('');
      setKdPj('');
      setNmPj('');
      setNoKartu('');
      setBiayaReg(0);
      setPJawab('');
      setHubunganPj('');
      setAlmtPj('');
      setAsalRujukan('-');
      setStatusDaftar('Baru');
      setAutoNoReg(true);
      setPatient(null);
      setPatientError(null);
      setSuccessMsg(null);
      setError(null);
      setRegistrationResult(null);
    }
  }, [isOpen]);

  // Submit registrasi
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!noRkmMedis || !selectedPoli || !selectedDokter || !kdPj) {
      setError('Lengkapi No. RM, Poli, Dokter, dan Cara Bayar.');
      return;
    }

    if (!patient) {
      setError('Data pasien belum valid. Mohon cek No. RM terlebih dahulu.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/pendaftaran/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          no_rkm_medis: noRkmMedis,
          kd_poli: selectedPoli,
          kd_dokter: selectedDokter,
          kd_pj: kdPj,
          p_jawab: pJawab,
          hubunganpj: hubunganPj,
          almt_pj: almtPj,
          stts_daftar: statusDaftar,
          tgl_registrasi: tglReg,
          jam_reg: jamReg,
          no_kartu: noKartu,
          no_reg: noReg
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyimpan pendaftaran');
      }

      setSuccessMsg(
        `Pendaftaran berhasil! No. Reg: ${data.no_reg} | No. Rawat: ${data.no_rawat} | Biaya: Rp ${data.biaya_reg?.toLocaleString('id-ID') || '0'}`
      );

      // Call parent success callback
      onSuccess();

      // Close modal after 1.5 seconds
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

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
        padding: 20
      }}
      onClick={onClose}
    >
      {/* Modal Content */}
      <div
        style={{
          background: '#F3F4F6',
          borderRadius: 20,
          //padding default untuk semua modal
          padding: '35px 8px 8px 8px',
          position: 'relative',
          maxWidth: 1000,
          width: '85%',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 12,
            right: 16,
            background: 'transparent',
            border: 'none',
            fontSize: 24,
            cursor: 'pointer',
            color: '#6b7280',
            padding: 0,
            lineHeight: 1
          }}
        >
          ×
        </button>

        {/* Header Title */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: '12px 20px',
          color: '#000000',
          fontSize: 13,
          fontWeight: 400
        }}>
          Input Pendaftaran Baru
        </div>

        {/* White Card Content */}
        <div style={{
          background: '#ffffff',
          borderRadius: 16,
          border: '1px solid #d1d5db',
          padding: '12px 12px 12px 12px',
        }}>
          {/* Success Message */}
          {successMsg && (
            <div style={{
              padding: '10px 12px',
              borderRadius: 8,
              background: '#ecfdf3',
              color: '#166534',
              fontSize: 12,
              marginBottom: 12
            }}>
              {successMsg}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div style={{
              padding: '10px 12px',
              borderRadius: 8,
              background: '#fef2f2',
              color: '#b91c1c',
              fontSize: 12,
              marginBottom: 12
            }}>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* 2 Column Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* LEFT COLUMN */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* 1. No. Reg */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, marginBottom: 4, color: '#374151', fontWeight: 500 }}>
                    No. Reg. :
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="text"
                      value={noReg}
                      onChange={(e) => !autoNoReg && setNoReg(e.target.value)}
                      readOnly={autoNoReg}
                      placeholder="001"
                      title={autoNoReg ? 'Auto: berdasarkan poli + dokter' : 'Manual'}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: 12,
                        border: '1px solid #d1d5db',
                        fontSize: 13,
                        outline: 'none',
                        background: autoNoReg ? '#f3f4f6' : '#fff',
                        color: autoNoReg ? '#6b7280' : '#111827',
                      }}
                    />
                    <input
                      type="checkbox"
                      checked={autoNoReg}
                      onChange={(e) => setAutoNoReg(e.target.checked)}
                      title="Centang untuk generate otomatis berdasarkan poli + dokter"
                      style={{ width: 18, height: 18, cursor: 'pointer' }}
                    />
                  </div>
                </div>

                {/* 2. No. Rawat */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, marginBottom: 4, color: '#374151', fontWeight: 500 }}>
                    No. Rawat :
                  </label>
                  <input
                    type="text"
                    value={noRawat}
                    onChange={(e) => setNoRawat(e.target.value)}
                    placeholder="2024/01/01/000001"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 12,
                      border: '1px solid #d1d5db',
                      fontSize: 13,
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* 3. Tgl. Reg + Jam */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, marginBottom: 4, color: '#374151', fontWeight: 500 }}>
                    Tgl. Reg. :
                  </label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="date"
                      value={tglReg}
                      onChange={(e) => setTglReg(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '8px 10px',
                        borderRadius: 12,
                        border: '1px solid #d1d5db',
                        fontSize: 13,
                        outline: 'none'
                      }}
                    />
                    <span style={{ fontSize: 11, color: '#374151', whiteSpace: 'nowrap' }}>Jam :</span>
                    <input
                      type="time"
                      value={jamReg}
                      onChange={(e) => {
                        setJamReg(e.target.value);
                        setUseAutoTime(false);
                      }}
                      step="1"
                      style={{
                        padding: '8px 10px',
                        borderRadius: 12,
                        border: '1px solid #d1d5db',
                        fontSize: 13,
                        outline: 'none'
                      }}
                    />
                    <input
                      type="checkbox"
                      checked={useAutoTime}
                      onChange={(e) => setUseAutoTime(e.target.checked)}
                      style={{ width: 18, height: 18, cursor: 'pointer' }}
                      title="Gunakan waktu saat ini"
                    />
                  </div>
                </div>

                {/* 4. Dr Dituju */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, marginBottom: 4, color: '#374151', fontWeight: 500 }}>
                    Dr Dituju :
                  </label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="text"
                      value={selectedDokter}
                      onChange={(e) => {
                        setSelectedDokter(e.target.value);
                        const found = dokter.find(d => d.kd_dokter === e.target.value);
                        setNmDokter(found ? found.nm_dokter : '');
                      }}
                      placeholder="Kode"
                      style={{
                        width: '28%',
                        padding: '8px 10px',
                        borderRadius: 12,
                        border: '1px solid #d1d5db',
                        fontSize: 13,
                        outline: 'none'
                      }}
                    />
                    <input
                      type="text"
                      value={nmDokter}
                      readOnly
                      placeholder="Nama dokter"
                      style={{
                        flex: 1,
                        padding: '8px 10px',
                        borderRadius: 12,
                        border: '1px solid #d1d5db',
                        fontSize: 13,
                        outline: 'none',
                        background: '#f9fafb',
                        color: '#374151'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowModalDokter(true)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 12,
                        border: '1px solid #d1d5db',
                        background: '#fff',
                        cursor: 'pointer',
                        fontSize: 13,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="Pilih dokter"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 28 28">
                        <g stroke="none" strokeWidth="1" fill="none" fillRule="evenodd">
                          <g transform="translate(-258.000000, -933.000000)" fill="#000000">
                            <path d="M269,944 C269.001,943.445 268.555,942.999 268,943 C267.445,943.001 267.001,943.445 267,944 L267,951 C267,951.555 267.445,952.001 268,952 L275,952 C275.555,951.999 275.999,951.556 276,951 C276.001,950.444 275.555,949.999 275,950 L270.509,950 L285.293,935.217 C285.684,934.826 285.684,934.192 285.293,933.802 C284.902,933.412 284.269,933.412 283.879,933.802 L269,948.681 L269,944 L269,944 Z M284,946 L284,957 C284,958.087 283.086,959 282,959 L261.935,959.033 C260.848,959.033 259.967,958.152 259.967,957.065 L260,937 C260,935.913 260.914,935 262,935 L273,935 L273,933 L262,933 C259.827,933 258,935.221 258,937.394 L258,957.065 C258,959.238 259.762,961 261.935,961 L281.606,961 C283.779,961 286,959.173 286,957 L286,946 L284,946 L284,946 Z"></path>
                          </g>
                        </g>
                      </svg>
                    </button>
                  </div>
                </div>

                {/* 5. Unit */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, marginBottom: 4, color: '#374151', fontWeight: 500 }}>
                    Unit :
                  </label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="text"
                      value={selectedPoli}
                      onChange={(e) => {
                        setSelectedPoli(e.target.value);
                        const found = poli.find(p => p.kd_poli === e.target.value);
                        setNmPoli(found ? found.nm_poli : '');
                      }}
                      placeholder="Kode"
                      style={{
                        width: '23%',
                        padding: '8px 10px',
                        borderRadius: 12,
                        border: '1px solid #d1d5db',
                        fontSize: 13,
                        outline: 'none'
                      }}
                    />
                    <input
                      type="text"
                      value={nmPoli}
                      readOnly
                      placeholder="Nama poli"
                      style={{
                        flex: 1,
                        padding: '8px 10px',
                        borderRadius: 12,
                        border: '1px solid #d1d5db',
                        fontSize: 13,
                        outline: 'none',
                        background: '#f9fafb',
                        color: '#374151'
                      }}
                    />
                    <input
                      type="text"
                      value={biayaReg}
                      readOnly
                      placeholder="Biaya"
                      style={{
                        width: '27%',
                        padding: '8px 10px',
                        borderRadius: 12,
                        border: '1px solid #d1d5db',
                        fontSize: 13,
                        outline: 'none',
                        background: '#f9fafb',
                        color: '#374151'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowModalPoli(true)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 12,
                        border: '1px solid #d1d5db',
                        background: '#fff',
                        cursor: 'pointer',
                        fontSize: 13,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="Pilih unit"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 28 28">
                        <g stroke="none" strokeWidth="1" fill="none" fillRule="evenodd">
                          <g transform="translate(-258.000000, -933.000000)" fill="#000000">
                            <path d="M269,944 C269.001,943.445 268.555,942.999 268,943 C267.445,943.001 267.001,943.445 267,944 L267,951 C267,951.555 267.445,952.001 268,952 L275,952 C275.555,951.999 275.999,951.556 276,951 C276.001,950.444 275.555,949.999 275,950 L270.509,950 L285.293,935.217 C285.684,934.826 285.684,934.192 285.293,933.802 C284.902,933.412 284.269,933.412 283.879,933.802 L269,948.681 L269,944 L269,944 Z M284,946 L284,957 C284,958.087 283.086,959 282,959 L261.935,959.033 C260.848,959.033 259.967,958.152 259.967,957.065 L260,937 C260,935.913 260.914,935 262,935 L273,935 L273,933 L262,933 C259.827,933 258,935.221 258,937.394 L258,957.065 C258,959.238 259.762,961 261.935,961 L281.606,961 C283.779,961 286,959.173 286,957 L286,946 L284,946 L284,946 Z"></path>
                          </g>
                        </g>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* 1. No. Rekam Medik */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, marginBottom: 4, color: '#374151', fontWeight: 500 }}>
                    No.Rekam Medik :
                  </label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="text"
                      value={noRkmMedis}
                      onChange={(e) => setNoRkmMedis(e.target.value)}
                      onBlur={() => fetchPatient(noRkmMedis.trim())}
                      placeholder="No. RM"
                      style={{
                        width: '30%',
                        padding: '8px 10px',
                        borderRadius: 12,
                        border: '1px solid #d1d5db',
                        fontSize: 13,
                        outline: 'none'
                      }}
                    />
                    <input
                      type="text"
                      value={patient?.nm_pasien || ''}
                      readOnly
                      placeholder="Nama Pasien"
                      style={{
                        flex: 1,
                        padding: '8px 10px',
                        borderRadius: 12,
                        border: '1px solid #d1d5db',
                        fontSize: 13,
                        outline: 'none',
                        background: '#f9fafb',
                        color: '#374151'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowModalPasien(true)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 12,
                        border: '1px solid #d1d5db',
                        background: '#fff',
                        cursor: 'pointer',
                        fontSize: 13,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="Cari pasien"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 28 28">
                        <g stroke="none" strokeWidth="1" fill="none" fillRule="evenodd">
                          <g transform="translate(-258.000000, -933.000000)" fill="#000000">
                            <path d="M269,944 C269.001,943.445 268.555,942.999 268,943 C267.445,943.001 267.001,943.445 267,944 L267,951 C267,951.555 267.445,952.001 268,952 L275,952 C275.555,951.999 275.999,951.556 276,951 C276.001,950.444 275.555,949.999 275,950 L270.509,950 L285.293,935.217 C285.684,934.826 285.684,934.192 285.293,933.802 C284.902,933.412 284.269,933.412 283.879,933.802 L269,948.681 L269,944 L269,944 Z M284,946 L284,957 C284,958.087 283.086,959 282,959 L261.935,959.033 C260.848,959.033 259.967,958.152 259.967,957.065 L260,937 C260,935.913 260.914,935 262,935 L273,935 L273,933 L262,933 C259.827,933 258,935.221 258,937.394 L258,957.065 C258,959.238 259.762,961 261.935,961 L281.606,961 C283.779,961 286,959.173 286,957 L286,946 L284,946 L284,946 Z"></path>
                          </g>
                        </g>
                      </svg>
                    </button>
                  </div>
                </div>

                {/* 2. Penanggung Jawab & Hubungan (sebaris) */}
                <div style={{ display: 'flex', gap: 8 }}>
                  {/* Penanggung Jawab */}
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 11, marginBottom: 4, color: '#374151', fontWeight: 500 }}>
                      Penanggung Jawab :
                    </label>
                    <input
                      type="text"
                      value={pJawab}
                      onChange={(e) => setPJawab(e.target.value)}
                      placeholder="Nama penanggung jawab"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 12,
                        border: '1px solid #d1d5db',
                        fontSize: 13,
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {/* Hubungan */}
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 11, marginBottom: 4, color: '#374151', fontWeight: 500 }}>
                      Hubungan :
                    </label>
                    <input
                      type="text"
                      value={hubunganPj}
                      onChange={(e) => setHubunganPj(e.target.value)}
                      placeholder="Hubungan"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 12,
                        border: '1px solid #d1d5db',
                        fontSize: 13,
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                {/* 3. Alamat P.J. & Status (sebaris) */}
                <div style={{ display: 'flex', gap: 8 }}>
                  {/* Alamat P.J. */}
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 11, marginBottom: 4, color: '#374151', fontWeight: 500 }}>
                      Alamat P.J. :
                    </label>
                    <input
                      type="text"
                      value={almtPj}
                      onChange={(e) => setAlmtPj(e.target.value)}
                      placeholder="Alamat penanggung jawab"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 12,
                        border: '1px solid #d1d5db',
                        fontSize: 13,
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {/* Status */}
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 11, marginBottom: 4, color: '#374151', fontWeight: 500 }}>
                      Status :
                    </label>
                    <input
                      type="text"
                      value={statusDaftar}
                      onChange={(e) => setStatusDaftar(e.target.value)}
                      placeholder="Status"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 12,
                        border: '1px solid #d1d5db',
                        fontSize: 13,
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                {/* 4. Jenis Bayar & No. Ka (sebaris) */}
                <div style={{ display: 'flex', gap: 8 }}>
                  {/* Jenis Bayar */}
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 11, marginBottom: 4, color: '#374151', fontWeight: 500 }}>
                      Jenis Bayar :
                    </label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type="text"
                        value={nmPj}
                        readOnly
                        placeholder="Jenis pembayaran"
                        style={{
                          flex: 1,
                          padding: '8px 10px',
                          borderRadius: 12,
                          border: '1px solid #d1d5db',
                          fontSize: 13,
                          outline: 'none',
                          background: '#f9fafb',
                          color: '#374151'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowModalCaraBayar(true)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 12,
                          border: '1px solid #d1d5db',
                          background: '#fff',
                          cursor: 'pointer',
                          fontSize: 13,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="Pilih jenis bayar"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 28 28">
                          <g stroke="none" strokeWidth="1" fill="none" fillRule="evenodd">
                            <g transform="translate(-258.000000, -933.000000)" fill="#000000">
                              <path d="M269,944 C269.001,943.445 268.555,942.999 268,943 C267.445,943.001 267.001,943.445 267,944 L267,951 C267,951.555 267.445,952.001 268,952 L275,952 C275.555,951.999 275.999,951.556 276,951 C276.001,950.444 275.555,949.999 275,950 L270.509,950 L285.293,935.217 C285.684,934.826 285.684,934.192 285.293,933.802 C284.902,933.412 284.269,933.412 283.879,933.802 L269,948.681 L269,944 L269,944 Z M284,946 L284,957 C284,958.087 283.086,959 282,959 L261.935,959.033 C260.848,959.033 259.967,958.152 259.967,957.065 L260,937 C260,935.913 260.914,935 262,935 L273,935 L273,933 L262,933 C259.827,933 258,935.221 258,937.394 L258,957.065 C258,959.238 259.762,961 261.935,961 L281.606,961 C283.779,961 286,959.173 286,957 L286,946 L284,946 L284,946 Z"></path>
                            </g>
                          </g>
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* No. Ka */}
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 11, marginBottom: 4, color: '#374151', fontWeight: 500 }}>
                      No. Ka :
                    </label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type="text"
                        value={noKartu}
                        onChange={(e) => setNoKartu(e.target.value)}
                        placeholder="Nomor kartu"
                        style={{
                          flex: 1,
                          padding: '8px 10px',
                          borderRadius: 12,
                          border: '1px solid #d1d5db',
                          fontSize: 13,
                          outline: 'none'
                        }}
                      />
                      <button
                        type="button"
                        style={{
                          padding: '8px 12px',
                          borderRadius: 12,
                          border: '1px solid #d1d5db',
                          background: '#fff',
                          cursor: 'pointer',
                          fontSize: 13,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="Edit nomor kartu"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 28 28">
                          <g stroke="none" strokeWidth="1" fill="none" fillRule="evenodd">
                            <g transform="translate(-258.000000, -933.000000)" fill="#000000">
                              <path d="M269,944 C269.001,943.445 268.555,942.999 268,943 C267.445,943.001 267.001,943.445 267,944 L267,951 C267,951.555 267.445,952.001 268,952 L275,952 C275.555,951.999 275.999,951.556 276,951 C276.001,950.444 275.555,949.999 275,950 L270.509,950 L285.293,935.217 C285.684,934.826 285.684,934.192 285.293,933.802 C284.902,933.412 284.269,933.412 283.879,933.802 L269,948.681 L269,944 L269,944 Z M284,946 L284,957 C284,958.087 283.086,959 282,959 L261.935,959.033 C260.848,959.033 259.967,958.152 259.967,957.065 L260,937 C260,935.913 260.914,935 262,935 L273,935 L273,933 L262,933 C259.827,933 258,935.221 258,937.394 L258,957.065 C258,959.238 259.762,961 261.935,961 L281.606,961 C283.779,961 286,959.173 286,957 L286,946 L284,946 L284,946 Z"></path>
                            </g>
                          </g>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                {/* 8. Asal Rujukan */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, marginBottom: 4, color: '#374151', fontWeight: 500 }}>
                    Asal Rujukan :
                  </label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="text"
                      value={asalRujukan}
                      onChange={(e) => setAsalRujukan(e.target.value)}
                      placeholder="Asal rujukan pasien"
                      style={{
                        flex: 1,
                        padding: '8px 10px',
                        borderRadius: 12,
                        border: '1px solid #d1d5db',
                        fontSize: 13,
                        outline: 'none'
                      }}
                    />
                    <button
                      type="button"
                      style={{
                        padding: '8px 12px',
                        borderRadius: 12,
                        border: '1px solid #d1d5db',
                        background: '#fff',
                        cursor: 'pointer',
                        fontSize: 13,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="Pilih asal rujukan"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 28 28">
                        <g stroke="none" strokeWidth="1" fill="none" fillRule="evenodd">
                          <g transform="translate(-258.000000, -933.000000)" fill="#000000">
                            <path d="M269,944 C269.001,943.445 268.555,942.999 268,943 C267.445,943.001 267.001,943.445 267,944 L267,951 C267,951.555 267.445,952.001 268,952 L275,952 C275.555,951.999 275.999,951.556 276,951 C276.001,950.444 275.555,949.999 275,950 L270.509,950 L285.293,935.217 C285.684,934.826 285.684,934.192 285.293,933.802 C284.902,933.412 284.269,933.412 283.879,933.802 L269,948.681 L269,944 L269,944 Z M284,946 L284,957 C284,958.087 283.086,959 282,959 L261.935,959.033 C260.848,959.033 259.967,958.152 259.967,957.065 L260,937 C260,935.913 260.914,935 262,935 L273,935 L273,933 L262,933 C259.827,933 258,935.221 258,937.394 L258,957.065 C258,959.238 259.762,961 261.935,961 L281.606,961 C283.779,961 286,959.173 286,957 L286,946 L284,946 L284,946 Z"></path>
                          </g>
                        </g>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#dc2626',
                  color: '#ffffff',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 500
                }}
              >
                Tutup
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: saving ? '#9ca3af' : '#2563eb',
                  color: '#ffffff',
                  cursor: saving ? 'default' : 'pointer',
                  fontSize: 12,
                  fontWeight: 500
                }}
              >
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Modal Pilih Dokter */}
      <ModalCariDokter
        isOpen={showModalDokter}
        onClose={() => setShowModalDokter(false)}
        onSelect={(kode, nama) => {
          setSelectedDokter(kode);
          setNmDokter(nama);
        }}
      />

      {/* Modal Pilih Poli */}
      <ModalCariPoli
        isOpen={showModalPoli}
        onClose={() => setShowModalPoli(false)}
        onSelect={(kode, nama) => {
          setSelectedPoli(kode);
          setNmPoli(nama);
        }}
      />

      {/* Modal Pilih Cara Bayar */}
      <ModalCariCaraBayar
        isOpen={showModalCaraBayar}
        onClose={() => setShowModalCaraBayar(false)}
        onSelect={(kode, nama) => {
          setKdPj(kode);
          setNmPj(nama);
        }}
      />

      {/* Modal Cari Pasien */}
      <ModalCariPasien
        isOpen={showModalPasien}
        onClose={() => setShowModalPasien(false)}
        onSelect={(pasien) => {
          setNoRkmMedis(pasien.no_rkm_medis);
          setPatient({
            no_rkm_medis: pasien.no_rkm_medis,
            nm_pasien: pasien.nm_pasien,
            alamat: pasien.alamat,
            jk: pasien.jk,
            tgl_lahir: pasien.tgl_lahir
          });

          // Set data penanggung jawab
          setPJawab(pasien.namakeluarga || '');
          setHubunganPj(pasien.keluarga || '');
          setAlmtPj(pasien.alamatpj || '');
          setStatusDaftar(pasien.status || 'Baru');
          setNoKartu(pasien.no_peserta || '');
        }}
      />
    </div>
  );
};
