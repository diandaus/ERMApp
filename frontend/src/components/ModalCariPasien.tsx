import React from 'react';
import Swal from 'sweetalert2';
import { localDateStr } from '../utils/date';

type Pasien = {
  no_rkm_medis: string;
  nm_pasien: string;
  jk: string;
  alamat: string;
  tgl_lahir: string;
  no_ktp?: string;
  tmp_lahir?: string;
  nm_ibu?: string;
  gol_darah?: string;
  pekerjaan?: string;
  stts_nikah?: string;
  agama?: string;
  tgl_daftar?: string;
  no_tlp?: string;
  umur?: string;
  pnd?: string;
  keluarga?: string;
  namakeluarga?: string;
  png_jawab?: string;
  no_peserta?: string;
  pekerjaanpj?: string;
  alamatpj?: string;
  nip?: string;
  email?: string;
  cacat_fisik?: string;
  status?: string;
};

interface ModalCariPasienProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (pasien: Pasien) => void;
}

export const ModalCariPasien: React.FC<ModalCariPasienProps> = ({ isOpen, onClose, onSelect }) => {
  // Tab state
  const [activeTab, setActiveTab] = React.useState<'input' | 'data'>('input');

  // Search pasien states (for Data Pasien tab)
  const [pasienList, setPasienList] = React.useState<Pasien[]>([]);
  const [searchPasien, setSearchPasien] = React.useState<string>('');
  const [loadingPasien, setLoadingPasien] = React.useState<boolean>(false);
  const [selectedPasien, setSelectedPasien] = React.useState<Pasien | null>(null);
  const [openDropdownNoRM, setOpenDropdownNoRM] = React.useState<string | null>(null);
  const [dropdownPos, setDropdownPos] = React.useState<{ top: number; left: number; alignBottom: boolean } | null>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Input Pasien form states
  const [noRkmMedis, setNoRkmMedis] = React.useState<string>('');
  const [autoNoRM, setAutoNoRM] = React.useState<boolean>(true);
  const [nmPasien, setNmPasien] = React.useState<string>('');
  const [jk, setJk] = React.useState<string>('');
  const [golDarah, setGolDarah] = React.useState<string>('-');
  const [tmpLahir, setTmpLahir] = React.useState<string>('');
  const [tglLahir, setTglLahir] = React.useState<string>('');
  const [pendidikan, setPendidikan] = React.useState<string>('-');
  const [namaIbu, setNamaIbu] = React.useState<string>('');
  const [pngJawab, setPngJawab] = React.useState<string>('DIRI SENDIRI');
  const [namaPJ, setNamaPJ] = React.useState<string>('');
  const [pekerjaanPJ, setPekerjaanPJ] = React.useState<string>('');
  const [sukuBangsa, setSukuBangsa] = React.useState<string>('');
  const [bahasaDipakai, setBahasaDipakai] = React.useState<string>('');
  const [cacatFisik, setCacatFisik] = React.useState<string>('');

  const [agama, setAgama] = React.useState<string>('ISLAM');
  const [sttsNikah, setSttsNikah] = React.useState<string>('MENIKAH');
  const [askes, setAskes] = React.useState<string>('-');
  const [asuransi, setAsuransi] = React.useState<string>('-');
  const [noPeserta, setNoPeserta] = React.useState<string>('');
  const [email, setEmail] = React.useState<string>('');
  const [noTelp, setNoTelp] = React.useState<string>('');
  const [pertamaDaftar, setPertamaDaftar] = React.useState<string>(localDateStr());
  const [pekerjaan, setPekerjaan] = React.useState<string>('');
  const [noKTP, setNoKTP] = React.useState<string>('');
  const [alamatPasien, setAlamatPasien] = React.useState<string>('');
  const [kelurahan, setKelurahan] = React.useState<string>('');
  const [kecamatan, setKecamatan] = React.useState<string>('');
  const [kabupaten, setKabupaten] = React.useState<string>('');
  const [propinsi, setPropinsi] = React.useState<string>('');
  const [alamatPJ, setAlamatPJ] = React.useState<string>('');
  const [kelurahanPJ, setKelurahanPJ] = React.useState<string>('');
  const [kecamatanPJ, setKecamatanPJ] = React.useState<string>('');
  const [kabupatenPJ, setKabupatenPJ] = React.useState<string>('');
  const [propinsiPJ, setPropinsiPJ] = React.useState<string>('');
  const [instansiPasien, setInstansiPasien] = React.useState<string>('');
  const [nipNRP, setNipNRP] = React.useState<string>('');

  // Fetch pasien from API (for Data Pasien tab)
  const fetchPasien = React.useCallback(async () => {
    setLoadingPasien(true);
    try {
      const url = `/api/pendaftaran/pasien/list?search=${encodeURIComponent(searchPasien)}&limit=100`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('Gagal mengambil data pasien');
      }
      const data: Pasien[] = await res.json();
      setPasienList(data);
    } catch (e) {
      console.error('Error fetching pasien:', e);
      setPasienList([]);
    } finally {
      setLoadingPasien(false);
    }
  }, [searchPasien]);

  // Load data when tab opens and debounce search
  React.useEffect(() => {
    if (!isOpen || activeTab !== 'data') return;

    const timer = setTimeout(() => {
      fetchPasien();
    }, searchPasien ? 500 : 0); // No delay on initial load

    return () => clearTimeout(timer);
  }, [searchPasien, isOpen, activeTab, fetchPasien]);

  // Reset when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      setActiveTab('input');
      setSearchPasien('');
      setPasienList([]);
      setSelectedPasien(null);
      setOpenDropdownNoRM(null);
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdownNoRM(null);
        setDropdownPos(null);
      }
    };

    if (openDropdownNoRM) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [openDropdownNoRM]);

  // Format date to DD-MM-YYYY
  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr || dateStr === '0000-00-00') return '-';
    try {
      const date = new Date(dateStr);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch (e) {
      return '-';
    }
  };

  // Calculate age from birth date
  const calculateAge = (tglLahir: string) => {
    if (!tglLahir || tglLahir === '0000-00-00') return '-';
    const birth = new Date(tglLahir);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return `${age} th`;
  };

  // Calculate age details (year, month, day)
  const calculateAgeDetails = () => {
    if (!tglLahir) return { years: 0, months: 0, days: 0 };
    const birth = new Date(tglLahir);
    const today = new Date();

    let years = today.getFullYear() - birth.getFullYear();
    let months = today.getMonth() - birth.getMonth();
    let days = today.getDate() - birth.getDate();

    if (days < 0) {
      months--;
      const lastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      days += lastMonth.getDate();
    }

    if (months < 0) {
      years--;
      months += 12;
    }

    return { years, months, days };
  };

  const age = calculateAgeDetails();

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
        zIndex: 10000
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#F3F4F6',
          borderRadius: 20,
          padding: '35px 8px 8px 8px',
          position: 'relative',
          width: '95%',
          maxWidth: 1400,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Title */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: '12px 20px',
          color: '#000000',
          fontSize: 13,
          fontWeight: 400,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>Data Pasien</span>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 20,
              cursor: 'pointer',
              color: '#6b7280',
              padding: 0,
              width: 24,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ×
          </button>
        </div>

        {/* White Card Content */}
        <div style={{
          background: '#ffffff',
          borderRadius: 16,
          border: '1px solid #d1d5db',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          overflow: 'hidden'
        }}>
          {/* Tabs */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: 12
          }}>
            <div style={{
              display: 'flex',
              background: '#F3F4F6',
              borderRadius: 12,
              padding: 4,
              gap: 4
            }}>
            <button
              type="button"
              onClick={() => {
                setActiveTab('input');
                setSelectedPasien(null);
              }}
              style={{
                padding: '6px 24px',
                borderRadius: 8,
                border: activeTab === 'input' ? '1px solid #d1d5db' : 'none',
                background: activeTab === 'input' ? '#ffffff' : 'transparent',
                color: activeTab === 'input' ? '#111827' : '#6b7280',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: activeTab === 'input' ? 500 : 400,
                transition: 'all 0.2s ease',
                boxShadow: activeTab === 'input' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none'
              }}
            >
              Input Pasien
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('data');
                setSelectedPasien(null);
              }}
              style={{
                padding: '6px 24px',
                borderRadius: 8,
                border: activeTab === 'data' ? '1px solid #d1d5db' : 'none',
                background: activeTab === 'data' ? '#ffffff' : 'transparent',
                color: activeTab === 'data' ? '#111827' : '#6b7280',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: activeTab === 'data' ? 500 : 400,
                transition: 'all 0.2s ease',
                boxShadow: activeTab === 'data' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none'
              }}
            >
              Data Pasien
            </button>
            </div>
          </div>

          {activeTab === 'input' ? (
            // INPUT PASIEN TAB
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
              <form>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  {/* KOLOM KIRI */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* No. Rekam Medis */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ fontSize: 12, minWidth: '140px', textAlign: 'right' }}>No.Rekam Medis :</label>
                      <input
                        type="text"
                        value={noRkmMedis}
                        onChange={(e) => setNoRkmMedis(e.target.value)}
                        disabled={autoNoRM}
                        placeholder="Auto generate"
                        style={{
                          flex: 1,
                          maxWidth: '200px',
                          padding: '6px 10px',
                          borderRadius: 8,
                          border: '1px solid #d1d5db',
                          fontSize: 12,
                          outline: 'none',
                          background: autoNoRM ? '#f9fafb' : '#fff'
                        }}
                      />
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={autoNoRM}
                          onChange={(e) => setAutoNoRM(e.target.checked)}
                          style={{ width: 18, height: 18, cursor: 'pointer' }}
                        />
                        Auto
                      </label>
                    </div>

                    {/* Nama Pasien */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ fontSize: 12, minWidth: '140px', textAlign: 'right' }}>Nama Pasien :</label>
                      <input
                        type="text"
                        value={nmPasien}
                        onChange={(e) => setNmPasien(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          borderRadius: 8,
                          border: '1px solid #d1d5db',
                          fontSize: 12,
                          outline: 'none'
                        }}
                      />
                    </div>

                    {/* J.K. & Gol. Darah */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ fontSize: 12, minWidth: '140px', textAlign: 'right' }}>J.K. :</label>
                      <select
                        value={jk}
                        onChange={(e) => setJk(e.target.value)}
                        style={{
                          width: '150px',
                          padding: '6px 10px',
                          borderRadius: 8,
                          border: '1px solid #d1d5db',
                          fontSize: 12,
                          outline: 'none'
                        }}
                      >
                        <option value="">-</option>
                        <option value="L">LAKI-LAKI</option>
                        <option value="P">PEREMPUAN</option>
                      </select>
                      <label style={{ fontSize: 12, marginLeft: '16px' }}>Gol. Darah :</label>
                      <select
                        value={golDarah}
                        onChange={(e) => setGolDarah(e.target.value)}
                        style={{
                          width: '100px',
                          padding: '6px 10px',
                          borderRadius: 8,
                          border: '1px solid #d1d5db',
                          fontSize: 12,
                          outline: 'none'
                        }}
                      >
                        <option value="-">-</option>
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="AB">AB</option>
                        <option value="O">O</option>
                      </select>
                    </div>

                    {/* Tmp/Tgl. Lahir */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ fontSize: 12, minWidth: '140px', textAlign: 'right' }}>Tmp/Tgl. Lahir :</label>
                      <input
                        type="text"
                        value={tmpLahir}
                        onChange={(e) => setTmpLahir(e.target.value)}
                        placeholder="Tempat Lahir"
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          borderRadius: 8,
                          border: '1px solid #d1d5db',
                          fontSize: 12,
                          outline: 'none'
                        }}
                      />
                      <input
                        type="date"
                        value={tglLahir}
                        onChange={(e) => setTglLahir(e.target.value)}
                        style={{
                          width: '150px',
                          padding: '6px 10px',
                          borderRadius: 8,
                          border: '1px solid #d1d5db',
                          fontSize: 12,
                          outline: 'none'
                        }}
                      />
                    </div>

                    {/* Umur & Pendidikan */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ fontSize: 12, minWidth: '140px', textAlign: 'right' }}>Umur :</label>
                      <input
                        type="number"
                        value={age.years}
                        readOnly
                        style={{
                          width: '50px',
                          padding: '6px 10px',
                          borderRadius: 8,
                          border: '1px solid #d1d5db',
                          fontSize: 12,
                          outline: 'none',
                          background: '#f9fafb'
                        }}
                      />
                      <span style={{ fontSize: 11 }}>Th</span>
                      <input
                        type="number"
                        value={age.months}
                        readOnly
                        style={{
                          width: '50px',
                          padding: '6px 10px',
                          borderRadius: 8,
                          border: '1px solid #d1d5db',
                          fontSize: 12,
                          outline: 'none',
                          background: '#f9fafb'
                        }}
                      />
                      <span style={{ fontSize: 11 }}>Bl</span>
                      <input
                        type="number"
                        value={age.days}
                        readOnly
                        style={{
                          width: '50px',
                          padding: '6px 10px',
                          borderRadius: 8,
                          border: '1px solid #d1d5db',
                          fontSize: 12,
                          outline: 'none',
                          background: '#f9fafb'
                        }}
                      />
                      <span style={{ fontSize: 11 }}>Hr</span>
                      <label style={{ fontSize: 12, marginLeft: '8px' }}>Pendidikan :</label>
                      <select
                        value={pendidikan}
                        onChange={(e) => setPendidikan(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          borderRadius: 8,
                          border: '1px solid #d1d5db',
                          fontSize: 12,
                          outline: 'none'
                        }}
                      >
                        <option value="-">-</option>
                        <option value="SD">SD</option>
                        <option value="SMP">SMP</option>
                        <option value="SMA">SMA</option>
                        <option value="D3">D3</option>
                        <option value="S1">S1</option>
                        <option value="S2">S2</option>
                        <option value="S3">S3</option>
                      </select>
                    </div>

                    {/* Nama Ibu */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ fontSize: 12, minWidth: '140px', textAlign: 'right' }}>Nama Ibu :</label>
                      <input
                        type="text"
                        value={namaIbu}
                        onChange={(e) => setNamaIbu(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          borderRadius: 8,
                          border: '1px solid #d1d5db',
                          fontSize: 12,
                          outline: 'none'
                        }}
                      />
                    </div>

                    {/* Png. Jawab */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ fontSize: 12, minWidth: '140px', textAlign: 'right' }}>Png. Jawab :</label>
                      <select
                        value={pngJawab}
                        onChange={(e) => setPngJawab(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          borderRadius: 8,
                          border: '1px solid #d1d5db',
                          fontSize: 12,
                          outline: 'none'
                        }}
                      >
                        <option value="DIRI SENDIRI">DIRI SENDIRI</option>
                        <option value="AYAH">AYAH</option>
                        <option value="IBU">IBU</option>
                        <option value="SUAMI">SUAMI</option>
                        <option value="ISTRI">ISTRI</option>
                        <option value="ANAK">ANAK</option>
                        <option value="KELUARGA">KELUARGA</option>
                      </select>
                    </div>

                    {/* Nama P.J. */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ fontSize: 12, minWidth: '140px', textAlign: 'right' }}>Nama P.J. :</label>
                      <input
                        type="text"
                        value={namaPJ}
                        onChange={(e) => setNamaPJ(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          borderRadius: 8,
                          border: '1px solid #d1d5db',
                          fontSize: 12,
                          outline: 'none'
                        }}
                      />
                    </div>

                    {/* Pekerjaan P.J. */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ fontSize: 12, minWidth: '140px', textAlign: 'right' }}>Pekerjaan P.J. :</label>
                      <input
                        type="text"
                        value={pekerjaanPJ}
                        onChange={(e) => setPekerjaanPJ(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          borderRadius: 8,
                          border: '1px solid #d1d5db',
                          fontSize: 12,
                          outline: 'none'
                        }}
                      />
                    </div>

                    {/* Suku/Bangsa */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ fontSize: 12, minWidth: '140px', textAlign: 'right' }}>Suku/Bangsa :</label>
                      <input
                        type="text"
                        value={sukuBangsa}
                        onChange={(e) => setSukuBangsa(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          borderRadius: 8,
                          border: '1px solid #d1d5db',
                          fontSize: 12,
                          outline: 'none'
                        }}
                      />
                    </div>

                    {/* Bahasa Dipakai */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ fontSize: 12, minWidth: '140px', textAlign: 'right' }}>Bahasa Dipakai :</label>
                      <input
                        type="text"
                        value={bahasaDipakai}
                        onChange={(e) => setBahasaDipakai(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          borderRadius: 8,
                          border: '1px solid #d1d5db',
                          fontSize: 12,
                          outline: 'none'
                        }}
                      />
                    </div>

                    {/* Cacat Fisik */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ fontSize: 12, minWidth: '140px', textAlign: 'right' }}>Cacat Fisik :</label>
                      <input
                        type="text"
                        value={cacatFisik}
                        onChange={(e) => setCacatFisik(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          borderRadius: 8,
                          border: '1px solid #d1d5db',
                          fontSize: 12,
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>

                  {/* KOLOM KANAN */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Agama & Stts. Nikah */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ fontSize: 12, minWidth: '100px', textAlign: 'right' }}>Agama :</label>
                      <select
                        value={agama}
                        onChange={(e) => setAgama(e.target.value)}
                        style={{
                          width: '150px',
                          padding: '6px 10px',
                          borderRadius: 8,
                          border: '1px solid #d1d5db',
                          fontSize: 12,
                          outline: 'none'
                        }}
                      >
                        <option value="ISLAM">ISLAM</option>
                        <option value="KRISTEN">KRISTEN</option>
                        <option value="KATOLIK">KATOLIK</option>
                        <option value="HINDU">HINDU</option>
                        <option value="BUDHA">BUDHA</option>
                        <option value="KONGHUCU">KONGHUCU</option>
                      </select>
                      <label style={{ fontSize: 12, marginLeft: '16px' }}>Stts. Nikah :</label>
                      <select
                        value={sttsNikah}
                        onChange={(e) => setSttsNikah(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          borderRadius: 8,
                          border: '1px solid #d1d5db',
                          fontSize: 12,
                          outline: 'none'
                        }}
                      >
                        <option value="BELUM MENIKAH">BELUM MENIKAH</option>
                        <option value="MENIKAH">MENIKAH</option>
                        <option value="CERAI">CERAI</option>
                        <option value="JANDA">JANDA</option>
                        <option value="DUDHA">DUDHA</option>
                      </select>
                    </div>

                    {/* Askes/Asuransi */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ fontSize: 12, minWidth: '100px', textAlign: 'right' }}>Askes/Asuransi :</label>
                      <input
                        type="text"
                        value={askes}
                        onChange={(e) => setAskes(e.target.value)}
                        style={{
                          width: '120px',
                          padding: '6px 10px',
                          borderRadius: 8,
                          border: '1px solid #d1d5db',
                          fontSize: 12,
                          outline: 'none'
                        }}
                      />
                      <input
                        type="text"
                        value={asuransi}
                        onChange={(e) => setAsuransi(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          borderRadius: 8,
                          border: '1px solid #d1d5db',
                          fontSize: 12,
                          outline: 'none'
                        }}
                      />
                    </div>

                    {/* No.Peserta & Email */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ fontSize: 12, minWidth: '100px', textAlign: 'right' }}>No.Peserta :</label>
                      <input
                        type="text"
                        value={noPeserta}
                        onChange={(e) => setNoPeserta(e.target.value)}
                        style={{
                          width: '150px',
                          padding: '6px 10px',
                          borderRadius: 8,
                          border: '1px solid #d1d5db',
                          fontSize: 12,
                          outline: 'none'
                        }}
                      />
                      <label style={{ fontSize: 12, marginLeft: '8px' }}>Email :</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          borderRadius: 8,
                          border: '1px solid #d1d5db',
                          fontSize: 12,
                          outline: 'none'
                        }}
                      />
                    </div>

                    {/* No.Telp & Pertama Daftar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ fontSize: 12, minWidth: '100px', textAlign: 'right' }}>No.Telp :</label>
                      <input
                        type="text"
                        value={noTelp}
                        onChange={(e) => setNoTelp(e.target.value)}
                        style={{
                          width: '150px',
                          padding: '6px 10px',
                          borderRadius: 8,
                          border: '1px solid #d1d5db',
                          fontSize: 12,
                          outline: 'none'
                        }}
                      />
                      <label style={{ fontSize: 12, marginLeft: '8px' }}>Pertama Daftar :</label>
                      <input
                        type="date"
                        value={pertamaDaftar}
                        onChange={(e) => setPertamaDaftar(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          borderRadius: 8,
                          border: '1px solid #d1d5db',
                          fontSize: 12,
                          outline: 'none'
                        }}
                      />
                    </div>

                    {/* Pekerjaan & No.KTP/SIM */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ fontSize: 12, minWidth: '100px', textAlign: 'right' }}>Pekerjaan :</label>
                      <input
                        type="text"
                        value={pekerjaan}
                        onChange={(e) => setPekerjaan(e.target.value)}
                        style={{
                          width: '150px',
                          padding: '6px 10px',
                          borderRadius: 8,
                          border: '1px solid #d1d5db',
                          fontSize: 12,
                          outline: 'none'
                        }}
                      />
                      <label style={{ fontSize: 12, marginLeft: '8px' }}>No.KTP/SIM :</label>
                      <input
                        type="text"
                        value={noKTP}
                        onChange={(e) => setNoKTP(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          borderRadius: 8,
                          border: '1px solid #d1d5db',
                          fontSize: 12,
                          outline: 'none'
                        }}
                      />
                    </div>

                    {/* Alamat Pasien */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <label style={{ fontSize: 12, minWidth: '100px', textAlign: 'right', paddingTop: '8px' }}>Alamat Pasien :</label>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <input
                          type="text"
                          value={alamatPasien}
                          onChange={(e) => setAlamatPasien(e.target.value)}
                          placeholder="Alamat lengkap"
                          style={{
                            width: '96%',
                            padding: '6px 10px',
                            borderRadius: 8,
                            border: '1px solid #d1d5db',
                            fontSize: 12,
                            outline: 'none'
                          }}
                        />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                          <input
                            type="text"
                            value={kelurahan}
                            onChange={(e) => setKelurahan(e.target.value)}
                            placeholder="Kelurahan"
                            style={{
                              padding: '6px 10px',
                              borderRadius: 8,
                              border: '1px solid #d1d5db',
                              fontSize: 12,
                              outline: 'none'
                            }}
                          />
                          <input
                            type="text"
                            value={kecamatan}
                            onChange={(e) => setKecamatan(e.target.value)}
                            placeholder="Kecamatan"
                            style={{
                              padding: '6px 10px',
                              borderRadius: 8,
                              border: '1px solid #d1d5db',
                              fontSize: 12,
                              outline: 'none'
                            }}
                          />
                          <input
                            type="text"
                            value={kabupaten}
                            onChange={(e) => setKabupaten(e.target.value)}
                            placeholder="Kabupaten"
                            style={{
                              padding: '6px 10px',
                              borderRadius: 8,
                              border: '1px solid #d1d5db',
                              fontSize: 12,
                              outline: 'none'
                            }}
                          />
                          <input
                            type="text"
                            value={propinsi}
                            onChange={(e) => setPropinsi(e.target.value)}
                            placeholder="Propinsi"
                            style={{
                              padding: '6px 10px',
                              borderRadius: 8,
                              border: '1px solid #d1d5db',
                              fontSize: 12,
                              outline: 'none'
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Alamat P.J. */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <label style={{ fontSize: 12, minWidth: '100px', textAlign: 'right', paddingTop: '8px' }}>Alamat P.J. :</label>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <input
                          type="text"
                          value={alamatPJ}
                          onChange={(e) => setAlamatPJ(e.target.value)}
                          placeholder="Alamat lengkap"
                          style={{
                            width: '96%',
                            padding: '6px 10px',
                            borderRadius: 8,
                            border: '1px solid #d1d5db',
                            fontSize: 12,
                            outline: 'none'
                          }}
                        />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                          <input
                            type="text"
                            value={kelurahanPJ}
                            onChange={(e) => setKelurahanPJ(e.target.value)}
                            placeholder="Kelurahan"
                            style={{
                              padding: '6px 10px',
                              borderRadius: 8,
                              border: '1px solid #d1d5db',
                              fontSize: 12,
                              outline: 'none'
                            }}
                          />
                          <input
                            type="text"
                            value={kecamatanPJ}
                            onChange={(e) => setKecamatanPJ(e.target.value)}
                            placeholder="Kecamatan"
                            style={{
                              padding: '6px 10px',
                              borderRadius: 8,
                              border: '1px solid #d1d5db',
                              fontSize: 12,
                              outline: 'none'
                            }}
                          />
                          <input
                            type="text"
                            value={kabupatenPJ}
                            onChange={(e) => setKabupatenPJ(e.target.value)}
                            placeholder="Kabupaten"
                            style={{
                              padding: '6px 10px',
                              borderRadius: 8,
                              border: '1px solid #d1d5db',
                              fontSize: 12,
                              outline: 'none'
                            }}
                          />
                          <input
                            type="text"
                            value={propinsiPJ}
                            onChange={(e) => setPropinsiPJ(e.target.value)}
                            placeholder="Propinsi"
                            style={{
                              padding: '6px 10px',
                              borderRadius: 8,
                              border: '1px solid #d1d5db',
                              fontSize: 12,
                              outline: 'none'
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Instansi Pasien & NIP/NRP */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ fontSize: 12, minWidth: '100px', textAlign: 'right' }}>Instansi Pasien :</label>
                      <input
                        type="text"
                        value={instansiPasien}
                        onChange={(e) => setInstansiPasien(e.target.value)}
                        style={{
                          width: '200px',
                          padding: '6px 10px',
                          borderRadius: 8,
                          border: '1px solid #d1d5db',
                          fontSize: 12,
                          outline: 'none'
                        }}
                      />
                      <label style={{ fontSize: 12, marginLeft: '8px' }}>NIP/NRP :</label>
                      <input
                        type="text"
                        value={nipNRP}
                        onChange={(e) => setNipNRP(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          borderRadius: 8,
                          border: '1px solid #d1d5db',
                          fontSize: 12,
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      // Reset semua field form
                      setNoRkmMedis('');
                      setAutoNoRM(true);
                      setNmPasien('');
                      setJk('');
                      setGolDarah('-');
                      setTmpLahir('');
                      setTglLahir('');
                      setPendidikan('-');
                      setNamaIbu('');
                      setPngJawab('DIRI SENDIRI');
                      setNamaPJ('');
                      setPekerjaanPJ('');
                      setSukuBangsa('');
                      setBahasaDipakai('');
                      setCacatFisik('');
                      setAgama('ISLAM');
                      setSttsNikah('MENIKAH');
                      setAskes('-');
                      setAsuransi('-');
                      setNoPeserta('');
                      setEmail('');
                      setNoTelp('');
                      setPertamaDaftar(localDateStr());
                      setPekerjaan('');
                      setNoKTP('');
                      setAlamatPasien('');
                      setKelurahan('');
                      setKecamatan('');
                      setKabupaten('');
                      setPropinsi('');
                      setAlamatPJ('');
                      setKelurahanPJ('');
                      setKecamatanPJ('');
                      setKabupatenPJ('');
                      setPropinsiPJ('');
                      setInstansiPasien('');
                      setNipNRP('');
                    }}
                    style={{
                      padding: '8px 24px',
                      borderRadius: 8,
                      border: 'none',
                      background: '#16a34a',
                      color: '#ffffff',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 500
                    }}
                  >
                    Baru
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    style={{
                      padding: '8px 24px',
                      borderRadius: 8,
                      border: 'none',
                      background: '#dc2626',
                      color: '#ffffff',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 500
                    }}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    style={{
                      padding: '8px 24px',
                      borderRadius: 8,
                      border: 'none',
                      background: '#2563eb',
                      color: '#ffffff',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 500
                    }}
                  >
                    Simpan
                  </button>
                </div>
              </form>
            </div>
          ) : (
            // DATA PASIEN TAB (Search existing patients)
            <>
              {/* Search Box and Action Buttons */}
              <div style={{ padding: '0 0 12px 0', display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
                <input
                  type="text"
                  placeholder="Cari pasien (No. RM, Nama, KTP, dll)..."
                  value={searchPasien}
                  onChange={(e) => setSearchPasien(e.target.value)}
                  autoFocus
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: '1px solid #d1d5db',
                    fontSize: 12,
                    width: 250,
                    outline: 'none'
                  }}
                />
                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    title="Edit"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!selectedPasien) {
                        alert('Silakan pilih pasien terlebih dahulu');
                        return;
                      }

                      // Load data pasien ke form
                      setNoRkmMedis(selectedPasien.no_rkm_medis);
                      setAutoNoRM(false);
                      setNmPasien(selectedPasien.nm_pasien);
                      setJk(selectedPasien.jk);
                      setGolDarah(selectedPasien.gol_darah || '-');
                      setTmpLahir(selectedPasien.tmp_lahir || '');

                      // Format tanggal lahir ke YYYY-MM-DD
                      if (selectedPasien.tgl_lahir && selectedPasien.tgl_lahir !== '0000-00-00') {
                        const tglLahirDate = new Date(selectedPasien.tgl_lahir);
                        setTglLahir(localDateStr(tglLahirDate));
                      } else {
                        setTglLahir('');
                      }

                      setPendidikan(selectedPasien.pnd || '-');
                      setNamaIbu(selectedPasien.nm_ibu || '');
                      setPngJawab(selectedPasien.png_jawab || 'DIRI SENDIRI');
                      setNamaPJ(selectedPasien.namakeluarga || '');
                      setPekerjaanPJ(selectedPasien.pekerjaanpj || '');
                      setCacatFisik(selectedPasien.cacat_fisik || '');
                      setAgama(selectedPasien.agama || 'ISLAM');
                      setSttsNikah(selectedPasien.stts_nikah || 'MENIKAH');
                      setNoPeserta(selectedPasien.no_peserta || '');
                      setEmail(selectedPasien.email || '');
                      setNoTelp(selectedPasien.no_tlp || '');

                      // Format tanggal daftar
                      if (selectedPasien.tgl_daftar && selectedPasien.tgl_daftar !== '0000-00-00') {
                        const tglDaftarDate = new Date(selectedPasien.tgl_daftar);
                        setPertamaDaftar(localDateStr(tglDaftarDate));
                      }

                      setPekerjaan(selectedPasien.pekerjaan || '');
                      setNoKTP(selectedPasien.no_ktp || '');
                      setAlamatPasien(selectedPasien.alamat || '');
                      setAlamatPJ(selectedPasien.alamatpj || '');
                      setNipNRP(selectedPasien.nip || '');

                      // Field yang tidak ada di data API, set ke default
                      setSukuBangsa('');
                      setBahasaDipakai('');
                      setAskes('-');
                      setAsuransi('-');
                      setKelurahan('');
                      setKecamatan('');
                      setKabupaten('');
                      setPropinsi('');
                      setKelurahanPJ('');
                      setKecamatanPJ('');
                      setKabupatenPJ('');
                      setPropinsiPJ('');
                      setInstansiPasien('');

                      // Pindah ke tab input
                      setActiveTab('input');
                    }}
                    onMouseDown={(e) => {
                      e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
                    }}
                    onMouseUp={(e) => {
                      e.currentTarget.style.background = '#ffffff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#ffffff';
                    }}
                    style={{
                      padding: '8px',
                      borderRadius: 8,
                      border: '0px solid #d1d5db',
                      background: '#ffffff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background 0.15s ease'
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20px" height="20px" viewBox="0 0 24 24" fill="none">
                      <path d="M21.2799 6.40005L11.7399 15.94C10.7899 16.89 7.96987 17.33 7.33987 16.7C6.70987 16.07 7.13987 13.25 8.08987 12.3L17.6399 2.75002C17.8754 2.49308 18.1605 2.28654 18.4781 2.14284C18.7956 1.99914 19.139 1.92124 19.4875 1.9139C19.8359 1.90657 20.1823 1.96991 20.5056 2.10012C20.8289 2.23033 21.1225 2.42473 21.3686 2.67153C21.6147 2.91833 21.8083 3.21243 21.9376 3.53609C22.0669 3.85976 22.1294 4.20626 22.1211 4.55471C22.1128 4.90316 22.0339 5.24635 21.8894 5.5635C21.7448 5.88065 21.5375 6.16524 21.2799 6.40005V6.40005Z" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M11 4H6C4.93913 4 3.92178 4.42142 3.17163 5.17157C2.42149 5.92172 2 6.93913 2 8V18C2 19.0609 2.42149 20.0783 3.17163 20.8284C3.92178 21.5786 4.93913 22 6 22H17C19.21 22 20 20.2 20 18V13" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <button
                    type="button"
                    title="Hapus"
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!selectedPasien) {
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
                        html: `Apakah Anda yakin ingin menghapus data pasien:<br><strong>${selectedPasien.nm_pasien}</strong><br>(${selectedPasien.no_rkm_medis})?`,
                        showCancelButton: true,
                        confirmButtonColor: '#dc2626',
                        cancelButtonColor: '#6b7280',
                        confirmButtonText: 'Ya, Hapus',
                        cancelButtonText: 'Batal'
                      });

                      if (result.isConfirmed) {
                        // TODO: Implement delete API call
                        Swal.fire({
                          icon: 'success',
                          title: 'Berhasil',
                          text: 'Data pasien berhasil dihapus',
                          confirmButtonColor: '#2563eb'
                        });
                        // Refresh data after delete
                        fetchPasien();
                        setSelectedPasien(null);
                      }
                    }}
                    onMouseDown={(e) => {
                      e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
                    }}
                    onMouseUp={(e) => {
                      e.currentTarget.style.background = '#ffffff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#ffffff';
                    }}
                    style={{
                      padding: '8px',
                      borderRadius: 8,
                      border: '0px solid #dc2626',
                      background: '#ffffff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background 0.15s ease'
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="#dc2626" width="20px" height="20px" viewBox="0 0 24 24">
                      <path d="M1,20a1,1,0,0,0,1,1h8a1,1,0,0,0,0-2H3.071A7.011,7.011,0,0,1,10,13a5.044,5.044,0,1,0-3.377-1.337A9.01,9.01,0,0,0,1,20ZM10,5A3,3,0,1,1,7,8,3,3,0,0,1,10,5Zm12.707,9.707L20.414,17l2.293,2.293a1,1,0,1,1-1.414,1.414L19,18.414l-2.293,2.293a1,1,0,0,1-1.414-1.414L17.586,17l-2.293-2.293a1,1,0,0,1,1.414-1.414L19,15.586l2.293-2.293a1,1,0,0,1,1.414,1.414Z"/>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Table Pasien */}
              <div style={{ flex: 1, overflow: 'auto' }}>
                {loadingPasien ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                    Memuat data pasien...
                  </div>
                ) : pasienList.length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                    {searchPasien ? 'Pasien tidak ditemukan' : 'Tidak ada data pasien'}
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
                      <tr>
                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', minWidth: '80px' }}>No.R.M</th>
                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', minWidth: '150px' }}>Nama Pasien</th>
                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', minWidth: '120px' }}>No.KTP/SIM</th>
                        <th style={{ padding: '8px', textAlign: 'center', borderBottom: '2px solid #e5e7eb', minWidth: '60px' }}>J.K.</th>
                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', minWidth: '100px' }}>Tmp.Lahir</th>
                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', minWidth: '90px' }}>Tgl.Lahir</th>
                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', minWidth: '120px' }}>Nama Ibu</th>
                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', minWidth: '200px' }}>Alamat</th>
                        <th style={{ padding: '8px', textAlign: 'center', borderBottom: '2px solid #e5e7eb', minWidth: '50px' }}>G.D.</th>
                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', minWidth: '100px' }}>Pekerjaan</th>
                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', minWidth: '100px' }}>Stts.Nikah</th>
                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', minWidth: '80px' }}>Agama</th>
                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', minWidth: '90px' }}>Tgl.Daftar</th>
                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', minWidth: '100px' }}>No.Telp/HP</th>
                        <th style={{ padding: '8px', textAlign: 'center', borderBottom: '2px solid #e5e7eb', minWidth: '100px' }}>Umur</th>
                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', minWidth: '80px' }}>Pendidikan</th>
                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', minWidth: '100px' }}>Keluarga</th>
                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', minWidth: '120px' }}>Nama Keluarga</th>
                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', minWidth: '120px' }}>Asuransi/Askes</th>
                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', minWidth: '100px' }}>No.Peserta</th>
                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', minWidth: '100px' }}>Pekerjaan P.J.</th>
                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', minWidth: '150px' }}>Alamat P.J.</th>
                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', minWidth: '100px' }}>NIP/NRP</th>
                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', minWidth: '150px' }}>Email</th>
                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', minWidth: '100px' }}>Cacat Fisik</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pasienList.map((pasien, index) => {
                        const isSelected = selectedPasien?.no_rkm_medis === pasien.no_rkm_medis;
                        return (
                        <tr
                          key={pasien.no_rkm_medis}
                          onClick={() => {
                            setSelectedPasien(pasien);
                          }}
                          onDoubleClick={() => {
                            onSelect(pasien);
                            onClose();
                          }}
                          style={{
                            background: isSelected ? '#dbeafe' : (index % 2 === 0 ? '#ffffff' : '#f9fafb'),
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
                              e.currentTarget.style.background = index % 2 === 0 ? '#ffffff' : '#f9fafb';
                            }
                          }}
                        >
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (openDropdownNoRM === pasien.no_rkm_medis) {
                                    setOpenDropdownNoRM(null);
                                    setDropdownPos(null);
                                  } else {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const spaceBelow = window.innerHeight - rect.bottom;

                                    if (spaceBelow < 250) {
                                      setDropdownPos({
                                        top: rect.bottom,
                                        left: rect.right + 8,
                                        alignBottom: true
                                      });
                                    } else {
                                      setDropdownPos({
                                        top: rect.top,
                                        left: rect.right + 8,
                                        alignBottom: false
                                      });
                                    }
                                    setOpenDropdownNoRM(pasien.no_rkm_medis);
                                  }
                                }}
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: 6,
                                  border: '1px solid #2563eb',
                                  background: '#ffffff',
                                  color: '#2563eb',
                                  cursor: 'pointer',
                                  fontSize: 11,
                                  fontWeight: 500,
                                  transition: 'all 0.2s ease',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = '#2563eb';
                                  e.currentTarget.style.color = '#ffffff';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = '#ffffff';
                                  e.currentTarget.style.color = '#2563eb';
                                }}
                              >
                                {pasien.no_rkm_medis}
                                {openDropdownNoRM === pasien.no_rkm_medis ? (
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="9 18 15 12 9 6"></polyline>
                                  </svg>
                                ) : (
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                  </svg>
                                )}
                              </button>
                              {openDropdownNoRM === pasien.no_rkm_medis && dropdownPos && (
                                <div
                                  ref={dropdownRef}
                                  style={{
                                    position: 'fixed',
                                    top: dropdownPos.top,
                                    left: dropdownPos.left,
                                    transform: dropdownPos.alignBottom ? 'translateY(-100%)' : 'none',
                                    background: '#ffffff',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: 8,
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                    zIndex: 9999,
                                    minWidth: 220
                                  }}
                                >
                                  {[
                                    'Riwayat Perawatan',
                                    'Catatan untuk Pasien',
                                    'Gabungkan Data RM'
                                  ].map((label, idx) => (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        alert(`${label}: ${pasien.no_rkm_medis}`);
                                        setOpenDropdownNoRM(null);
                                        setDropdownPos(null);
                                      }}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        width: '100%',
                                        padding: '10px 12px',
                                        border: 'none',
                                        background: 'transparent',
                                        color: '#374151',
                                        fontSize: 12,
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease'
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.background = '#dbeafe';
                                        e.currentTarget.style.color = '#2563eb';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'transparent';
                                        e.currentTarget.style.color = '#374151';
                                      }}
                                    >
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                        <polyline points="14 2 14 8 20 8"></polyline>
                                        <line x1="16" y1="13" x2="8" y2="13"></line>
                                        <line x1="16" y1="17" x2="8" y2="17"></line>
                                        <polyline points="10 9 9 9 8 9"></polyline>
                                      </svg>
                                      <span>{label}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{pasien.nm_pasien}</td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{pasien.no_ktp || '-'}</td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>{pasien.jk}</td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{pasien.tmp_lahir || '-'}</td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{formatDate(pasien.tgl_lahir)}</td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{pasien.nm_ibu || '-'}</td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{pasien.alamat}</td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>{pasien.gol_darah || '-'}</td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{pasien.pekerjaan || '-'}</td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{pasien.stts_nikah || '-'}</td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{pasien.agama || '-'}</td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{formatDate(pasien.tgl_daftar)}</td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{pasien.no_tlp || '-'}</td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>{pasien.umur || '-'}</td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{pasien.pnd || '-'}</td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{pasien.keluarga || '-'}</td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{pasien.namakeluarga || '-'}</td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{pasien.png_jawab || '-'}</td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{pasien.no_peserta || '-'}</td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{pasien.pekerjaanpj || '-'}</td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{pasien.alamatpj || '-'}</td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{pasien.nip || '-'}</td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{pasien.email || '-'}</td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{pasien.cacat_fisik || '-'}</td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
