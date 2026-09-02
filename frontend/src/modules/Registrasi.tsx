import React from 'react';
import Swal from 'sweetalert2';
import { ModalRegistrasi } from '../components/ModalRegistrasi';
import { ModalPengajuanSEP, type SepItem } from '../components/ModalPengajuanSEP';
import { HistoriPelayananBpjsModal } from '../components/HistoriPelayananBpjsModal';
import { SepPrintView } from '../components/SepPrintView';
import { TambahAntreanModal, epochMsToDatetimeLocal, type AntreanFormState } from './TambahAntreanModal';
import { localDateStr } from '../utils/date';

type Patient = {
  no_reg: string;
  no_rawat: string;
  tgl_registrasi: string;
  jam_reg: string;
  kd_dokter: string;
  nm_dokter: string;
  no_rkm_medis: string;
  nm_pasien: string;
  jk: string;
  umur: string;
  nm_poli: string;
  p_jawab: string;
  almt_pj: string;
  hubunganpj: string;
  biaya_reg: number;
  stts_daftar: string;
  png_jawab: string;
  no_tlp: string;
  stts: string;
  status_poli: string;
  kd_poli: string;
  kd_pj: string;
  status_bayar: string;
  no_sep: string | null;
  no_kartu: string | null;
};

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

export const RegistrasiView: React.FC = () => {
  const [searchText, setSearchText] = React.useState<string>('');
  const [showFilterDropdown, setShowFilterDropdown] = React.useState<boolean>(false);
  const [tglDari, setTglDari] = React.useState<string>(localDateStr());
  const [tglSampai, setTglSampai] = React.useState<string>(localDateStr());
  const [activeTab, setActiveTab] = React.useState<'registrasi-awal' | 'rujukaninternal-poli'>('registrasi-awal');
  const [patients, setPatients] = React.useState<Patient[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [hoveredNoRegIndex, setHoveredNoRegIndex] = React.useState<number | null>(null);
  const [selectedPatient, setSelectedPatient] = React.useState<Patient | null>(null);
  const filterDropdownRef = React.useRef<HTMLDivElement>(null);

  // Dropdown "[BPJS] > Cetak SEP / Riwayat Kunjungan" — pola persis dgn
  // dropdown kolom Dokter di RawatJalanView (App.tsx): posisi dihitung dari
  // getBoundingClientRect saat tombol diklik, tutup lewat listener
  // mousedown di luar elemen dropdown-nya.
  const [showBpjsDropdown, setShowBpjsDropdown] = React.useState<string | null>(null);
  const [bpjsDropdownPos, setBpjsDropdownPos] = React.useState<{ top: number; left: number; alignBottom?: boolean } | null>(null);
  const bpjsDropdownRef = React.useRef<HTMLDivElement>(null);
  // historiPelayananPatient — "[BPJS] > Riwayat Kunjungan": histori
  // pelayanan BPJS 90 hari terakhir (live VClaim by No. Kartu), BUKAN
  // riwayat kunjungan pasien lokal.
  const [historiPelayananPatient, setHistoriPelayananPatient] = React.useState<Patient | null>(null);
  // sepPrintNoRawat — "[BPJS] > Lihat SEP": tampilkan Surat Elegibilitas
  // Peserta (SEP) yg SUDAH terbit (hanya aktif kalau patient.no_sep
  // terisi), beda dari "Cetak SEP" yg buka form Input/Update.
  const [sepPrintNoRawat, setSepPrintNoRawat] = React.useState<string | null>(null);
  // sepModal — buka ModalPengajuanSEP (form Input/Update SEP yg sama dgn modul
  // Bridging > SEP): mode 'edit' kalau kunjungan ini SUDAH punya SEP
  // (patient.no_sep terisi, data lengkap di-fetch dulu by no_rawat), mode
  // 'new' kalau belum, prefill dari data baris + mapping DPJP BPJS.
  const [sepModal, setSepModal] = React.useState<{ mode: 'new'; initialData: Partial<SepItem> } | { mode: 'edit'; item: SepItem } | null>(null);
  // antreanModal — "[BPJS] > Tambah Antrean": dipakai staf utk kunjungan yg
  // antrean BPJS-nya gagal/belum sempat dibuat otomatis oleh worker. Prefill
  // diambil dari GET /api/bridging/antrean/prefill/{no_rawat} (reg_periksa +
  // SEP + mapping BPJS + best-effort jadwal dokter HFIS), staf tinggal cek
  // ulang lalu kirim.
  const [antreanModal, setAntreanModal] = React.useState<{ initial: Partial<AntreanFormState>; warning?: string } | null>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (bpjsDropdownRef.current && !bpjsDropdownRef.current.contains(event.target as Node)) {
        setShowBpjsDropdown(null);
      }
    };
    if (showBpjsDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showBpjsDropdown]);

  // handleOpenSep — dipicu "[BPJS] > Cetak SEP". Kalau kunjungan ini sudah
  // punya SEP (patient.no_sep terisi, dari join bridging_sep di
  // /api/registrasi/list), buka ModalPengajuanSEP mode Update dgn data LENGKAP
  // (di-fetch dulu by no_rawat, list utama cuma bawa no_sep-nya saja).
  // Kalau belum, buka mode Input baru, prefill No.Rawat/RM/nama/poli/dokter
  // dari baris + DPJP Layanan hasil lookup Mapping Dokter DPJP VCLAIM
  // (Bridging > Pengaturan) — kalau dokternya belum di-mapping, dibiarkan
  // kosong, staf isi manual (bukan error, mapping memang opsional per dokter).
  const handleOpenSep = async (patient: Patient) => {
    setShowBpjsDropdown(null);
    Swal.fire({ title: 'Memuat data SEP...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
      if (patient.no_sep) {
        const res = await fetch(`/api/bridging/sep/by-no-rawat/${encodeURIComponent(patient.no_rawat)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal mengambil data SEP');
        Swal.close();
        setSepModal({ mode: 'edit', item: data });
        return;
      }

      // Padanan persis setNoRm2() di BPJSDataSEP.java (dipanggil DlgReg.java
      // MnSEPActionPerformed): Poli Tujuan & Dokter DPJP TIDAK diisi
      // langsung dari kode/nama poli-dokter lokal, tapi selalu dicari lewat
      // mapping BPJS (maping_poli_bpjs / maping_dokter_dpjpvclaim) — BPJS
      // butuh kode versi BPJS-nya, bukan kode internal RS. Kalau dokter/poli
      // itu belum di-mapping (Pengaturan > Bridging BPJS), dibiarkan kosong
      // supaya staf sadar perlu mapping dulu, bukan diam-diam terisi kode
      // lokal yang salah format buat BPJS.
      let kdpolitujuan = '';
      let nmpolitujuan = '';
      try {
        const mapPoliRes = await fetch(`/api/bpjs/mapping-poli?q=${encodeURIComponent(patient.kd_poli)}`);
        if (mapPoliRes.ok) {
          const mapPoliData = await mapPoliRes.json();
          const match = (mapPoliData?.list || []).find((m: any) => m.kd_poli === patient.kd_poli);
          if (match) {
            kdpolitujuan = match.kd_poli_bpjs || '';
            nmpolitujuan = match.nm_poli_bpjs || '';
          }
        }
      } catch {
        // Mapping opsional — kalau gagal diambil, staf tetap bisa isi manual.
      }

      let kddpjp = '';
      let nmdpdjp = '';
      try {
        const mapDokterRes = await fetch(`/api/bpjs/mapping-dokter?q=${encodeURIComponent(patient.kd_dokter)}`);
        if (mapDokterRes.ok) {
          const mapDokterData = await mapDokterRes.json();
          const match = (mapDokterData?.list || []).find((m: any) => m.kd_dokter === patient.kd_dokter);
          if (match) {
            kddpjp = match.kd_dokter_bpjs || '';
            nmdpdjp = match.nm_dokter_bpjs || '';
          }
        }
      } catch {
        // Mapping opsional — kalau gagal diambil, staf tetap bisa isi manual.
      }

      Swal.close();
      setSepModal({
        mode: 'new',
        initialData: {
          no_rawat: patient.no_rawat,
          nomr: patient.no_rkm_medis,
          nama_pasien: patient.nm_pasien,
          jkel: patient.jk,
          // No. Kartu BPJS dari master pasien (pasien.no_peserta, diisi staf
          // saat Pendaftaran) — supaya tidak perlu ketik ulang di form SEP.
          no_kartu: patient.no_kartu || '',
          // No. Telp dari master pasien (pasien.no_tlp) — sebelumnya field
          // ini selalu kosong di form SEP walau datanya sudah ada di baris
          // Pendaftaran.
          notelep: patient.no_tlp || '',
          // Pendaftaran = selalu kunjungan rawat jalan (Java kirim literal
          // "2. Ralan" ke setNoRm2 dari MnSEPActionPerformed).
          jnspelayanan: '2',
          kdpolitujuan,
          nmpolitujuan,
          kddpjp,
          nmdpdjp,
        },
      });
    } catch (err) {
      Swal.close();
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    }
  };

  // handleOpenAntrean — dipicu "[BPJS] > Tambah Antrean". Ambil prefill dari
  // reg_periksa/SEP/mapping BPJS (lihat getAntreanPrefillByNoRawat di backend),
  // staf tinggal cek ulang field yang tidak bisa dipastikan otomatis (mis.
  // kalau poli/dokter belum di-mapping) lalu kirim.
  const handleOpenAntrean = async (patient: Patient) => {
    setShowBpjsDropdown(null);
    Swal.fire({ title: 'Menyiapkan data antrean...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
      const res = await fetch(`/api/bridging/antrean/prefill/${encodeURIComponent(patient.no_rawat)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyiapkan data antrean');
      Swal.close();
      // Backend kirim angka mentah (pasienbaru 0/1, kuota/angka sbg number,
      // estimasidilayani epoch ms) — AntreanFormState (form terkontrol
      // TambahAntreanModal) butuh boolean/string, sama seperti yg dipakai
      // openModalFromLocal di AntreanRs.tsx.
      const initial: Partial<AntreanFormState> = {
        kodebooking: data.kodebooking || '',
        no_rawat: data.no_rawat || '',
        jenispasien: data.jenispasien === 'JKN' ? 'JKN' : 'NON JKN',
        nomorkartu: data.nomorkartu || '',
        nik: data.nik || '',
        nohp: data.nohp || '',
        kodepoli: data.kodepoli || '',
        namapoli: data.namapoli || '',
        pasienbaru: data.pasienbaru === 1,
        norm: data.norm || '',
        tanggalperiksa: data.tanggalperiksa || '',
        kodedokter: data.kodedokter || '',
        namadokter: data.namadokter || '',
        jampraktek: data.jampraktek || '',
        jeniskunjungan: Number(data.jeniskunjungan) || 1,
        nomorreferensi: data.nomorreferensi || '',
        nomorantrean: data.nomorantrean || '',
        angkaantrean: data.angkaantrean ? String(data.angkaantrean) : '',
        estimasidilayani: data.estimasidilayani ? epochMsToDatetimeLocal(Number(data.estimasidilayani)) : '',
        sisakuotajkn: data.sisakuotajkn ? String(data.sisakuotajkn) : '',
        kuotajkn: data.kuotajkn ? String(data.kuotajkn) : '',
        sisakuotanonjkn: data.sisakuotanonjkn ? String(data.sisakuotanonjkn) : '',
        kuotanonjkn: data.kuotanonjkn ? String(data.kuotanonjkn) : '',
      };
      setAntreanModal({ initial, warning: data.warning || undefined });
    } catch (err) {
      Swal.close();
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    }
  };

  // Form input states
  const [noRkmMedis, setNoRkmMedis] = React.useState<string>('');
  const [selectedPoli, setSelectedPoli] = React.useState<string>('');
  const [selectedDokter, setSelectedDokter] = React.useState<string>('');
  const [kdPj, setKdPj] = React.useState<string>('');
  const [biayaReg, setBiayaReg] = React.useState<number>(0);
  const [pJawab, setPJawab] = React.useState<string>('');
  const [hubunganPj, setHubunganPj] = React.useState<string>('');
  const [almtPj, setAlmtPj] = React.useState<string>('');
  const [asalRujukan, setAsalRujukan] = React.useState<string>('-');
  const [statusDaftar, setStatusDaftar] = React.useState<string>('Baru');
  const [saving, setSaving] = React.useState<boolean>(false);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);
  const [showModal, setShowModal] = React.useState<boolean>(false);

  // Registration result states (displayed after successful registration)
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

  // Load master data on mount
  React.useEffect(() => {
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
          }
        }
      } catch (err) {
        console.error('Error loading master data:', err);
      }
    };

    loadMasterData();
  }, []);

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
          stts_daftar: statusDaftar
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyimpan pendaftaran');
      }

      // Set registration result for display
      setRegistrationResult({
        no_reg: data.no_reg,
        no_rawat: data.no_rawat,
        tgl_registrasi: data.tgl_registrasi,
        jam_reg: data.jam_reg
      });

      setSuccessMsg(
        `Pendaftaran berhasil! No. Reg: ${data.no_reg} | No. Rawat: ${data.no_rawat} | Biaya: Rp ${data.biaya_reg?.toLocaleString('id-ID') || '0'}`
      );

      // Clear form
      setNoRkmMedis('');
      setSelectedPoli('');
      setSelectedDokter('');
      setBiayaReg(0);
      setPJawab('');
      setHubunganPj('');
      setAlmtPj('');
      setPatient(null);

      // Refresh data registrasi
      fetchPatients();

      // Close modal after 2 seconds
      setTimeout(() => {
        setShowModal(false);
        setSuccessMsg(null);
      }, 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setSaving(false);
    }
  };

  // Fetch data from API
  const fetchPatients = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `/api/registrasi/list?mode=${activeTab}`;
      if (tglDari && tglSampai) {
        url += `&tgl_dari=${tglDari}&tgl_sampai=${tglSampai}`;
      }
      if (searchText) {
        url += `&search=${encodeURIComponent(searchText)}`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Gagal mengambil data registrasi');
      }
      const data = await response.json();
      setPatients(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
      setPatients([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, tglDari, tglSampai, searchText]);

  // Load data on mount and when filters change
  React.useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  // Close dropdown when clicking outside
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

  return (
    <>
      {/* Modal Component */}
      <ModalRegistrasi
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={fetchPatients}
      />

      {/* Content Section — langsung di atas background, tanpa card */}
      <section style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Toolbar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexShrink: 0,
          flexWrap: 'wrap',
          gap: 8
        }}>
          {/* Tab Segmented Control */}
          <div style={{
            display: 'inline-flex',
            background: '#f3f4f6',
            borderRadius: 12,
            padding: 4,
            gap: 4
          }}>
            <button
              type="button"
              onClick={() => setActiveTab('registrasi-awal')}
              style={{
                padding: '6px 24px',
                borderRadius: 8,
                border: activeTab === 'registrasi-awal' ? '1px solid #d1d5db' : 'none',
                background: activeTab === 'registrasi-awal' ? '#ffffff' : 'transparent',
                color: activeTab === 'registrasi-awal' ? '#111827' : '#6b7280',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: activeTab === 'registrasi-awal' ? 500 : 400,
                transition: 'all 0.2s ease',
                boxShadow: activeTab === 'registrasi-awal' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
                whiteSpace: 'nowrap'
              }}
            >
              Registrasi Awal
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('rujukaninternal-poli')}
              style={{
                padding: '6px 24px',
                borderRadius: 8,
                border: activeTab === 'rujukaninternal-poli' ? '1px solid #d1d5db' : 'none',
                background: activeTab === 'rujukaninternal-poli' ? '#ffffff' : 'transparent',
                color: activeTab === 'rujukaninternal-poli' ? '#111827' : '#6b7280',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: activeTab === 'rujukaninternal-poli' ? 500 : 400,
                transition: 'all 0.2s ease',
                boxShadow: activeTab === 'rujukaninternal-poli' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
                whiteSpace: 'nowrap'
              }}
            >
              Rujukan Internal Poli
            </button>
          </div>

          {/* Right Section: Actions + Search Box and Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Registrasi Button */}
            <button
              type="button"
              onClick={() => setShowModal(true)}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: 'none',
                background: '#2563eb',
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                whiteSpace: 'nowrap'
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Registrasi
            </button>

            {/* Edit Button */}
            <button
              type="button"
              onClick={() => {
                if (!selectedPatient) {
                  Swal.fire({
                    icon: 'warning',
                    title: 'Peringatan',
                    text: 'Silakan pilih pasien terlebih dahulu',
                    confirmButtonColor: '#2563eb'
                  });
                  return;
                }
                console.log('Edit patient:', selectedPatient);
                // TODO: Implement edit functionality
              }}
              style={{
                padding: 0,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M21.2799 6.40005L11.7399 15.94C10.7899 16.89 7.96987 17.33 7.33987 16.7C6.70987 16.07 7.13987 13.25 8.08987 12.3L17.6399 2.75002C17.8754 2.49308 18.1605 2.28654 18.4781 2.14284C18.7956 1.99914 19.139 1.92124 19.4875 1.9139C19.8359 1.90657 20.1823 1.96991 20.5056 2.10012C20.8289 2.23033 21.1225 2.42473 21.3686 2.67153C21.6147 2.91833 21.8083 3.21243 21.9376 3.53609C22.0669 3.85976 22.1294 4.20626 22.1211 4.55471C22.1128 4.90316 22.0339 5.24635 21.8894 5.5635C21.7448 5.88065 21.5375 6.16524 21.2799 6.40005V6.40005Z" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M11 4H6C4.93913 4 3.92178 4.42142 3.17163 5.17157C2.42149 5.92172 2 6.93913 2 8V18C2 19.0609 2.42149 20.0783 3.17163 20.8284C3.92178 21.5786 4.93913 22 6 22H17C19.21 22 20 20.2 20 18V13" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {/* Hapus Button */}
            <button
              type="button"
              onClick={async () => {
                if (!selectedPatient) {
                  Swal.fire({
                    icon: 'warning',
                    title: 'Peringatan',
                    text: 'Silakan pilih pasien terlebih dahulu',
                    confirmButtonColor: '#2563eb'
                  });
                  return;
                }

                const result = await Swal.fire({
                  icon: 'warning',
                  title: 'Konfirmasi Hapus',
                  html: `Apakah Anda yakin ingin menghapus data registrasi:<br><strong>${selectedPatient.nm_pasien}</strong><br>(${selectedPatient.no_rawat})?`,
                  showCancelButton: true,
                  confirmButtonColor: '#dc2626',
                  cancelButtonColor: '#6b7280',
                  confirmButtonText: 'Ya, Hapus',
                  cancelButtonText: 'Batal'
                });

                if (result.isConfirmed) {
                  try {
                    const res = await fetch(`/api/registrasi/${selectedPatient.no_rawat}`, { method: 'DELETE' });
                    const data = await res.json();
                    if (!res.ok) {
                      Swal.fire({ icon: 'error', title: 'Gagal', text: data.error || 'Gagal menghapus data', confirmButtonColor: '#2563eb' });
                      return;
                    }
                    Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Data registrasi berhasil dihapus', confirmButtonColor: '#2563eb' });
                    fetchPatients();
                    setSelectedPatient(null);
                  } catch {
                    Swal.fire({ icon: 'error', title: 'Error', text: 'Terjadi kesalahan saat menghapus', confirmButtonColor: '#2563eb' });
                  }
                }
              }}
              style={{
                padding: 0,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="#dc2626" width="20" height="20" viewBox="0 0 24 24">
                <path d="M1,20a1,1,0,0,0,1,1h8a1,1,0,0,0,0-2H3.071A7.011,7.011,0,0,1,10,13a5.044,5.044,0,1,0-3.377-1.337A9.01,9.01,0,0,0,1,20ZM10,5A3,3,0,1,1,7,8,3,3,0,0,1,10,5Zm12.707,9.707L20.414,17l2.293,2.293a1,1,0,1,1-1.414,1.414L19,18.414l-2.293,2.293a1,1,0,0,1-1.414-1.414L17.586,17l-2.293-2.293a1,1,0,0,1,1.414-1.414L19,15.586l2.293-2.293a1,1,0,0,1,1.414,1.414Z"/>
              </svg>
            </button>

            {/* Search Box */}
            <input
              type="text"
              placeholder="Cari pasien..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                fontSize: 12,
                width: 250,
                outline: 'none'
              }}
            />

            {/* Filter Button with Dropdown */}
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M10 8L20 8" stroke="currentColor" strokeLinecap="round" />
                  <path d="M4 16L14 16" stroke="currentColor" strokeLinecap="round" />
                  <ellipse cx="7" cy="8" rx="3" ry="3" transform="rotate(90 7 8)" stroke="currentColor" strokeLinecap="round" />
                  <ellipse cx="17" cy="16" rx="3" ry="3" transform="rotate(90 17 16)" stroke="currentColor" strokeLinecap="round" />
                </svg>
              </button>

              {/* Dropdown Filter */}
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
                    width: 120
                  }}
                >
                  <div style={{ marginBottom: 8 }}>
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
                  <div>
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

        {/* Patient List Table */}
        <div style={{ borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1, minHeight: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
              <tr>
                <th style={{ padding: '8px', textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>No Reg</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. Rawat</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Tgl. Registrasi</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Jam</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. RM</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Nama Pasien</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Poli</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Dokter</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Jenis Bayar</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} style={{ padding: '24px', textAlign: 'center', color: '#6b7280' }}>
                    Memuat data...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={10} style={{ padding: '24px', textAlign: 'center', color: '#dc2626' }}>
                    {error}
                  </td>
                </tr>
              ) : patients.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: '24px', textAlign: 'center', color: '#6b7280' }}>
                    Tidak ada data registrasi
                  </td>
                </tr>
              ) : (
                patients.map((patient, index) => {
                  const isSelected = selectedPatient?.no_rawat === patient.no_rawat;
                  const baseBg = index % 2 === 0 ? '#ffffff' : '#f9fafb';

                  // Format tanggal DD-MM-YYYY
                  const formatDate = (dateStr: string) => {
                    if (!dateStr || dateStr === '0000-00-00') return '-';
                    const date = new Date(dateStr);
                    const day = String(date.getDate()).padStart(2, '0');
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const year = date.getFullYear();
                    return `${day}-${month}-${year}`;
                  };

                  return (
                    <tr
                      key={patient.no_rawat}
                      onClick={() => {
                        setSelectedPatient(patient);
                      }}
                      style={{
                        background: isSelected ? '#dbeafe' : baseBg,
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = '#fef3c7';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = baseBg;
                        }
                      }}
                    >
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                        <button
                          onClick={() => {
                            console.log('Panggil antrian:', patient.no_reg);
                          }}
                          onMouseEnter={() => setHoveredNoRegIndex(index)}
                          onMouseLeave={() => setHoveredNoRegIndex(null)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: 6,
                            border: '1px solid #2563eb',
                            background: hoveredNoRegIndex === index ? '#2563eb' : '#ffffff',
                            color: hoveredNoRegIndex === index ? '#ffffff' : '#2563eb',
                            cursor: 'pointer',
                            fontSize: 11,
                            fontWeight: 600,
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {patient.no_reg}
                        </button>
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontSize: 12, fontWeight: 600, color: '#2563eb' }}>
                        {patient.no_rawat}
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontSize: 12, color: '#374151' }}>
                        {formatDate(patient.tgl_registrasi)}
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontSize: 12, color: '#374151' }}>
                        {patient.jam_reg}
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontSize: 12, fontWeight: 600, color: '#2563eb' }}>
                        {patient.no_rkm_medis}
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                        <div style={{ fontSize: 12, color: '#111827' }}>
                          {patient.nm_pasien} <span style={{ color: '#6b7280' }}>({patient.umur})</span>
                        </div>
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontSize: 12, color: '#374151' }}>
                        {patient.nm_poli}
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontSize: 12, color: '#374151' }}>
                        {patient.nm_dokter}
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontSize: 12, color: '#374151' }}>
                        {patient.png_jawab === 'BPJS' ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ position: 'relative', display: 'inline-block' }}>
                            <button
                              onClick={(e) => {
                                if (showBpjsDropdown === patient.no_rawat) {
                                  setShowBpjsDropdown(null);
                                  setBpjsDropdownPos(null);
                                } else {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const spaceBelow = window.innerHeight - rect.bottom;
                                  if (spaceBelow < 150) {
                                    setBpjsDropdownPos({ top: rect.top, left: rect.left, alignBottom: true });
                                  } else {
                                    setBpjsDropdownPos({ top: rect.bottom, left: rect.left, alignBottom: false });
                                  }
                                  setShowBpjsDropdown(patient.no_rawat);
                                }
                              }}
                              style={{
                                padding: '4px 8px', borderRadius: 2, border: '1px solid #2563eb',
                                background: '#ffffff', color: '#2563eb', cursor: 'pointer',
                                fontSize: 11, fontWeight: 600, transition: 'all 0.2s ease',
                                display: 'flex', alignItems: 'center', gap: 4,
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = '#2563eb'; e.currentTarget.style.color = '#ffffff'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.color = '#2563eb'; }}
                            >
                              BPJS
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="6 9 12 15 18 9"></polyline>
                              </svg>
                            </button>
                            {showBpjsDropdown === patient.no_rawat && bpjsDropdownPos && (
                              <div
                                ref={bpjsDropdownRef}
                                style={{
                                  position: 'fixed', top: bpjsDropdownPos.top, left: bpjsDropdownPos.left,
                                  transform: bpjsDropdownPos.alignBottom ? 'translateY(-100%)' : 'none',
                                  background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 6,
                                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 9999, minWidth: 180,
                                }}
                              >
                                <button
                                  onClick={() => handleOpenSep(patient)}
                                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 12px', border: 'none', background: 'transparent', color: '#374151', fontSize: 12, textAlign: 'left', cursor: 'pointer' }}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = '#dbeafe'; e.currentTarget.style.color = '#2563eb'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#374151'; }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M6 9V2h12v7"></path>
                                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                                    <rect x="6" y="14" width="12" height="8"></rect>
                                  </svg>
                                  <span>Pembuatan SEP</span>
                                </button>
                                <button
                                  onClick={() => { setShowBpjsDropdown(null); setHistoriPelayananPatient(patient); }}
                                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 12px', border: 'none', background: 'transparent', color: '#374151', fontSize: 12, textAlign: 'left', cursor: 'pointer' }}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = '#dbeafe'; e.currentTarget.style.color = '#2563eb'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#374151'; }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                                    <path d="M3 3v5h5"></path>
                                    <path d="M12 7v5l4 2"></path>
                                  </svg>
                                  <span>Riwayat Kunjungan</span>
                                </button>
                                <button
                                  onClick={() => handleOpenAntrean(patient)}
                                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 12px', border: 'none', background: 'transparent', color: '#374151', fontSize: 12, textAlign: 'left', cursor: 'pointer' }}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = '#dbeafe'; e.currentTarget.style.color = '#2563eb'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#374151'; }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M16 3.128a4 4 0 0 1 0 7.744"></path>
                                    <path d="M12 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="9" cy="7" r="4"></circle>
                                    <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                                  </svg>
                                  <span>Tambah Antrean</span>
                                </button>
                              </div>
                            )}
                          </div>
                          {patient.no_sep && (
                            <button
                              onClick={() => setSepPrintNoRawat(patient.no_rawat)}
                              title="Lihat SEP"
                              style={{
                                padding: '4px 8px', borderRadius: 2, border: '1px solid #16a34a',
                                background: '#ffffff', color: '#16a34a', cursor: 'pointer',
                                fontSize: 11, fontWeight: 600, transition: 'all 0.2s ease',
                                display: 'flex', alignItems: 'center', gap: 4,
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = '#16a34a'; e.currentTarget.style.color = '#ffffff'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.color = '#16a34a'; }}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                              </svg>
                            </button>
                          )}
                          </div>
                        ) : (
                          patient.png_jawab || '-'
                        )}
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                        <span style={{ fontSize: 12, color: '#374151' }}>
                          {patient.stts}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {historiPelayananPatient && (
        <HistoriPelayananBpjsModal
          noKartu={historiPelayananPatient.no_kartu || ''}
          namaPasien={historiPelayananPatient.nm_pasien}
          onClose={() => setHistoriPelayananPatient(null)}
        />
      )}
      {sepModal && (
        <ModalPengajuanSEP
          editingItem={sepModal.mode === 'edit' ? sepModal.item : null}
          initialData={sepModal.mode === 'new' ? sepModal.initialData : undefined}
          onClose={() => setSepModal(null)}
          onSaved={fetchPatients}
        />
      )}
      {sepPrintNoRawat && (
        <SepPrintView noRawat={sepPrintNoRawat} onClose={() => setSepPrintNoRawat(null)} />
      )}
      {antreanModal && (
        <TambahAntreanModal
          initial={antreanModal.initial}
          warning={antreanModal.warning}
          onClose={() => setAntreanModal(null)}
        />
      )}
    </>
  );
};
