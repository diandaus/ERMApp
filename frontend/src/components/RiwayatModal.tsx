import React from 'react';

type RiwayatModalProps = {
  patient: any;
  onClose: () => void;
};

export const RiwayatModal: React.FC<RiwayatModalProps> = ({ patient, onClose }) => {
  const [legacy, setLegacy] = React.useState<any>(null);
  const [riwayatPerawatanList, setRiwayatPerawatanList] = React.useState<any[]>([]);
  const [expandedPerawatan, setExpandedPerawatan] = React.useState<Set<string>>(new Set());
  const [detailPerPerawatan, setDetailPerPerawatan] = React.useState<Map<string, any>>(new Map());
  const [triase, setTriase] = React.useState<any>(null);
  const [asuhanMedis, setAsuhanMedis] = React.useState<any[]>([]);
  const [asuhanKeperawatanIGD, setAsuhanKeperawatanIGD] = React.useState<any>(null);
  const [pemeriksaanRalan, setPemeriksaanRalan] = React.useState<any[]>([]);
  const [pemeriksaanRanap, setPemeriksaanRanap] = React.useState<any[]>([]);
  const [laboratorium, setLaboratorium] = React.useState<any>(null);
  const [radiologi, setRadiologi] = React.useState<any>(null);
  const [tindakanRalan, setTindakanRalan] = React.useState<any>(null);
  const [tindakanRanap, setTindakanRanap] = React.useState<any>(null);
  const [kamarInap, setKamarInap] = React.useState<any[]>([]);
  const [obat, setObat] = React.useState<any>(null);
  const [resepPulang, setResepPulang] = React.useState<any[]>([]);
  const [biaya, setBiaya] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  // Function to fetch detail data for a specific perawatan
  const fetchDetailForPerawatan = async (noRawat: string) => {
    // Check if detail already fetched
    if (detailPerPerawatan.has(noRawat)) {
      return;
    }

    try {
      const detail: any = {};

      // Fetch triase IGD data (wildcard route - no need to encode /)
      const triaseResponse = await fetch(`/api/triase-igd/${noRawat}`);
      if (triaseResponse.ok) {
        detail.triase = await triaseResponse.json();
      }

      // Fetch asuhan medis IGD data (wildcard route - no need to encode /)
      const asuhanResponse = await fetch(`/api/asuhan-medis-igd/${noRawat}`);
      if (asuhanResponse.ok) {
        const asuhanData = await asuhanResponse.json();
        detail.asuhanMedis = Array.isArray(asuhanData) ? asuhanData : [];
      }

      // Fetch pemeriksaan rawat jalan (SOAP) data (wildcard route - no need to encode /)
      const pemeriksaanResponse = await fetch(`/api/pemeriksaan-ralan/${noRawat}`);
      if (pemeriksaanResponse.ok) {
        const pemeriksaanData = await pemeriksaanResponse.json();
        detail.pemeriksaanRalan = Array.isArray(pemeriksaanData) ? pemeriksaanData : [];
      }

      // Fetch pemeriksaan rawat inap (SOAP) data (wildcard route - no need to encode /)
      const ranapResponse = await fetch(`/api/pemeriksaan-ranap/${noRawat}`);
      if (ranapResponse.ok) {
        const ranapData = await ranapResponse.json();
        detail.pemeriksaanRanap = Array.isArray(ranapData) ? ranapData : [];
      }

      // Fetch asuhan keperawatan IGD data (wildcard route - no need to encode /)
      const asuhanKepResponse = await fetch(`/api/asuhan-keperawatan-igd/${noRawat}`);
      if (asuhanKepResponse.ok) {
        detail.asuhanKeperawatanIGD = await asuhanKepResponse.json();
      }

      // Fetch laboratorium data (wildcard route - no need to encode /)
      const labResponse = await fetch(`/api/laboratorium/${noRawat}`);
      if (labResponse.ok) {
        detail.laboratorium = await labResponse.json();
      }

      // Fetch radiologi data (wildcard route - no need to encode /)
      const radResponse = await fetch(`/api/radiologi-data/${noRawat}`);
      if (radResponse.ok) {
        detail.radiologi = await radResponse.json();
      }

      // Fetch tindakan rawat jalan data (wildcard route - no need to encode /)
      const tindakanResponse = await fetch(`/api/tindakan-ralan/${noRawat}`);
      if (tindakanResponse.ok) {
        detail.tindakanRalan = await tindakanResponse.json();
      }

      // Fetch tindakan rawat inap data (wildcard route - no need to encode /)
      const tindakanRanapResponse = await fetch(`/api/tindakan-ranap/${noRawat}`);
      if (tindakanRanapResponse.ok) {
        detail.tindakanRanap = await tindakanRanapResponse.json();
      }

      // Fetch kamar inap data (wildcard route - no need to encode /)
      const kamarResponse = await fetch(`/api/kamar-inap/${noRawat}`);
      if (kamarResponse.ok) {
        const kamarData = await kamarResponse.json();
        detail.kamarInap = Array.isArray(kamarData) ? kamarData : [];
      }

      // Fetch obat data (wildcard route - no need to encode /)
      const obatResponse = await fetch(`/api/obat-data/${noRawat}`);
      if (obatResponse.ok) {
        detail.obat = await obatResponse.json();
      }

      // Fetch resep pulang data (wildcard route - no need to encode /)
      const resepResponse = await fetch(`/api/resep-pulang/${noRawat}`);
      if (resepResponse.ok) {
        const resepData = await resepResponse.json();
        detail.resepPulang = Array.isArray(resepData) ? resepData : [];
      }

      // Fetch biaya data (wildcard route - no need to encode /)
      const biayaResponse = await fetch(`/api/biaya/${noRawat}`);
      if (biayaResponse.ok) {
        detail.biaya = await biayaResponse.json();
      }

      // Save detail to Map
      setDetailPerPerawatan(prev => {
        const newMap = new Map(prev);
        newMap.set(noRawat, detail);
        return newMap;
      });

      // Also update global state for backward compatibility (use first expanded)
      if (expandedPerawatan.has(noRawat) && Array.from(expandedPerawatan)[0] === noRawat) {
        setTriase(detail.triase);
        setAsuhanMedis(detail.asuhanMedis || []);
        setPemeriksaanRalan(detail.pemeriksaanRalan || []);
        setPemeriksaanRanap(detail.pemeriksaanRanap || []);
        setAsuhanKeperawatanIGD(detail.asuhanKeperawatanIGD);
        setLaboratorium(detail.laboratorium);
        setRadiologi(detail.radiologi);
        setTindakanRalan(detail.tindakanRalan);
        setTindakanRanap(detail.tindakanRanap);
        setKamarInap(detail.kamarInap || []);
        setObat(detail.obat);
        setResepPulang(detail.resepPulang || []);
        setBiaya(detail.biaya);
      }
    } catch (err) {
      console.error('Error fetching detail perawatan:', err);
    }
  };

  // Function to toggle expand/collapse perawatan
  const togglePerawatan = async (noRawat: string) => {
    const newExpanded = new Set(expandedPerawatan);
    if (newExpanded.has(noRawat)) {
      newExpanded.delete(noRawat);
    } else {
      newExpanded.add(noRawat);
      // Fetch detail when expanding
      await fetchDetailForPerawatan(noRawat);
    }
    setExpandedPerawatan(newExpanded);
  };

  // Fetch legacy data when modal opens
  React.useEffect(() => {
    const fetchData = async () => {
      if (!patient?.no_rkm_medis && !patient?.no_rawat) {
        setError('Data pasien tidak lengkap');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');

        // Fetch riwayat perawatan (5 terakhir)
        if (patient?.no_rkm_medis) {
          const response = await fetch(`/api/riwayat-perawatan/${encodeURIComponent(patient.no_rkm_medis)}`);
          if (!response.ok) {
            throw new Error('Gagal memuat riwayat perawatan');
          }
          const data = await response.json();
          console.log('Data riwayat perawatan dari API:', data);
          console.log('Apakah array?', Array.isArray(data));
          console.log('Jumlah data:', data?.length);
          
          if (Array.isArray(data) && data.length > 0) {
            console.log('Item pertama:', data[0]);
            console.log('Keys dari item pertama:', Object.keys(data[0]));
            setRiwayatPerawatanList(data);
            // Set legacy untuk backward compatibility (gunakan perawatan terbaru)
            setLegacy(data[0]);
            // Auto-expand semua perawatan
            const allNoRawat = data.map((p: any) => p.no_rawat);
            setExpandedPerawatan(new Set(allNoRawat));
            
            // Fetch detail untuk semua perawatan sekaligus
            for (const perawatan of data) {
              if (perawatan.no_rawat) {
                await fetchDetailForPerawatan(perawatan.no_rawat);
              }
            }
          } else {
            setRiwayatPerawatanList([]);
            setLegacy(data);
            // Backward compatibility: jika bukan array, fetch detail menggunakan patient.no_rawat
            if (patient?.no_rawat) {
              await fetchDetailForPerawatan(patient.no_rawat);
            }
          }
        } else if (patient?.no_rawat) {
          // Backward compatibility: jika tidak ada no_rkm_medis, fetch detail menggunakan patient.no_rawat
          await fetchDetailForPerawatan(patient.no_rawat);
        }
      } catch (err: any) {
        console.error('Error fetching data:', err);
        setError(err.message || 'Gagal memuat data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [patient?.no_rkm_medis, patient?.no_rawat]);

  const formatRupiah = (amount: number | string): string => {
    if (!amount) return '0';
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('id-ID').format(numAmount);
  };

  const getLabResultClass = (keterangan: string): React.CSSProperties => {
    if (!keterangan || typeof keterangan !== 'string') return {};
    switch (keterangan.toLowerCase()) {
      case 'l':
        return { color: '#0d6efd' };
      case 'h':
        return { color: '#dc3545' };
      case 't':
        return { fontWeight: 'bold' };
      default:
        return {};
    }
  };

  const getTriaseColor = (triaseData: any): string => {
    if (!triaseData) return '#969696';
    if (triaseData.skala1 && triaseData.skala1.length > 0) return '#AA0000';
    if (triaseData.skala2 && triaseData.skala2.length > 0) return '#FF0000';
    if (triaseData.skala3 && triaseData.skala3.length > 0) return '#C8C800';
    if (triaseData.skala4 && triaseData.skala4.length > 0) return '#00AA00';
    if (triaseData.skala5 && triaseData.skala5.length > 0) return '#969696';
    return '#969696';
  };

  const handleImageError = (event: React.SyntheticEvent<HTMLImageElement>) => {
    event.currentTarget.src =
      'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="450" height="450"%3E%3Crect width="450" height="450" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="20" fill="%23999"%3EGambar tidak dapat dimuat%3C/text%3E%3C/svg%3E';
    event.currentTarget.style.cursor = 'default';
  };

  const renderNewlines = (text: string) => {
    if (!text) return text;
    return text.split('\n').map((line, index, arr) => (
      <React.Fragment key={index}>
        {line}
        {index < arr.length - 1 && <br />}
      </React.Fragment>
    ));
  };

  const cardStyle: React.CSSProperties = {
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  };

  const tableStyle: React.CSSProperties = {
    width: '100%',
    fontSize: 13,
    borderCollapse: 'collapse',
    border: '1px solid #e5e7eb'
  };

  const tdStyle: React.CSSProperties = {
    padding: 8,
    borderBottom: '1px solid #e5e7eb'
  };

  // Function to render Triase Primer
  const renderTriasePrimer = (triasePrimer: any) => {
    if (!triasePrimer) return null;

    // Determine keputusan color based on skala
    let keputusanColor = '#969696'; // default
    if (triasePrimer.skala1 && triasePrimer.skala1.length > 0) {
      keputusanColor = '#AA0000';
    } else if (triasePrimer.skala2 && triasePrimer.skala2.length > 0) {
      keputusanColor = '#FF0000';
    }

    return (
      <div style={cardStyle}>
        <div style={{ background: '#ffffff', color: '#374151', borderBottom: '1px solid #e5e7eb', padding: '12px 16px' }}>
          <h6 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#AA0000' }}>
            🚨 TRIASE IGD - Primer (Zona Merah)
          </h6>
        </div>
        <div style={{ padding: 16 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <tbody>
                <tr>
                  <td style={{ ...tdStyle, width: '30%', fontWeight: 600 }}>Cara Masuk</td>
                  <td style={tdStyle}>{triasePrimer.cara_masuk}</td>
                </tr>
                <tr>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>Transportasi</td>
                  <td style={tdStyle}>{triasePrimer.alat_transportasi}</td>
                </tr>
                <tr>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>Alasan Kedatangan</td>
                  <td style={tdStyle}>{triasePrimer.alasan_kedatangan}</td>
                </tr>
                <tr>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>Keterangan Kedatangan</td>
                  <td style={tdStyle}>{triasePrimer.keterangan_kedatangan}</td>
                </tr>
                <tr>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>Macam Kasus</td>
                  <td style={tdStyle}>{triasePrimer.macam_kasus}</td>
                </tr>
                <tr>
                  <td
                    colSpan={2}
                    style={{ ...tdStyle, background: '#f3f4f6', textAlign: 'center', fontWeight: 600 }}
                  >
                    Triase Primer
                  </td>
                </tr>
                <tr>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>Keluhan Utama</td>
                  <td style={tdStyle}>{renderNewlines(triasePrimer.keluhan_utama)}</td>
                </tr>
                <tr>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>Tanda Vital</td>
                  <td style={tdStyle}>
                    Suhu (C): {triasePrimer.suhu}, Nyeri: {triasePrimer.nyeri}, Tensi:{' '}
                    {triasePrimer.tekanan_darah}, Nadi(/menit): {triasePrimer.nadi}, Saturasi
                    O²(%): {triasePrimer.saturasi_o2}, Respirasi(/menit):{' '}
                    {triasePrimer.pernapasan}
                  </td>
                </tr>
                <tr>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>Kebutuhan Khusus</td>
                  <td style={tdStyle}>{triasePrimer.kebutuhan_khusus}</td>
                </tr>
                {/* Skala 1 - Immediate/Segera */}
                {triasePrimer.skala1 && triasePrimer.skala1.length > 0 && (
                  <>
                    <tr>
                      <td style={{ ...tdStyle, background: '#f3f4f6', textAlign: 'center', fontWeight: 600 }}>
                        Pemeriksaan
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          textAlign: 'center',
                          background: '#AA0000',
                          color: 'white',
                          fontWeight: 600
                        }}
                      >
                        Immediate/Segera
                      </td>
                    </tr>
                    {triasePrimer.skala1.map((pemeriksaan: any, pIndex: number) => (
                      <tr key={`s1-${pIndex}`}>
                        <td style={tdStyle}>{pemeriksaan.nama_pemeriksaan}</td>
                        <td style={{ ...tdStyle, background: '#AA0000', color: 'white' }}>
                          {pemeriksaan.details?.map((detail: any, dIndex: number) => (
                            <div key={`s1d-${dIndex}`}>• {detail.pengkajian_skala1}</div>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </>
                )}
                {/* Skala 2 - Emergensi */}
                {triasePrimer.skala2 && triasePrimer.skala2.length > 0 && (
                  <>
                    <tr>
                      <td style={{ ...tdStyle, background: '#f3f4f6', textAlign: 'center', fontWeight: 600 }}>
                        Pemeriksaan
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          textAlign: 'center',
                          background: '#FF0000',
                          color: 'white',
                          fontWeight: 600
                        }}
                      >
                        Emergensi
                      </td>
                    </tr>
                    {triasePrimer.skala2.map((pemeriksaan: any, pIndex: number) => (
                      <tr key={`s2-${pIndex}`}>
                        <td style={tdStyle}>{pemeriksaan.nama_pemeriksaan}</td>
                        <td style={{ ...tdStyle, background: '#FF0000', color: 'white' }}>
                          {pemeriksaan.details?.map((detail: any, dIndex: number) => (
                            <div key={`s2d-${dIndex}`}>• {detail.pengkajian_skala2}</div>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </>
                )}
                <tr>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>Plan/Keputusan</td>
                  <td style={{ ...tdStyle, background: keputusanColor, color: 'white' }}>
                    Zona Merah {triasePrimer.plan}
                  </td>
                </tr>
                <tr>
                  <td
                    colSpan={2}
                    style={{ ...tdStyle, background: '#f3f4f6', textAlign: 'center', fontWeight: 600 }}
                  >
                    Petugas Triase Primer
                  </td>
                </tr>
                <tr>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>Tanggal & Jam</td>
                  <td style={tdStyle}>{triasePrimer.tanggaltriase}</td>
                </tr>
                <tr>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>Catatan</td>
                  <td style={tdStyle}>{triasePrimer.catatan}</td>
                </tr>
                <tr>
                  <td style={{ ...tdStyle, fontWeight: 600, borderBottom: 'none' }}>Dokter/Petugas IGD</td>
                  <td style={{ ...tdStyle, borderBottom: 'none' }}>
                    {triasePrimer.nik} - {triasePrimer.nama}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // Function to render Triase Sekunder
  const renderTriaseSekunder = (triaseSekunder: any) => {
    if (!triaseSekunder) return null;

    // Determine keputusan color based on skala
    let keputusanColor = '#969696'; // default
    if (triaseSekunder.skala3 && triaseSekunder.skala3.length > 0) {
      keputusanColor = '#C8C800';
    } else if (triaseSekunder.skala4 && triaseSekunder.skala4.length > 0) {
      keputusanColor = '#00AA00';
    } else if (triaseSekunder.skala5 && triaseSekunder.skala5.length > 0) {
      keputusanColor = '#969696';
    }

    return (
      <div style={cardStyle}>
        <div style={{ background: '#ffffff', color: '#374151', borderBottom: '1px solid #e5e7eb', padding: '12px 16px' }}>
          <h6 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#C8C800' }}>🚨 Triase Gawat Darurat - Sekunder</h6>
        </div>
        <div style={{ padding: 16 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <tbody>
                <tr>
                  <td style={{ ...tdStyle, width: '30%', fontWeight: 600 }}>Cara Masuk</td>
                  <td style={tdStyle}>{triaseSekunder.cara_masuk}</td>
                </tr>
                <tr>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>Transportasi</td>
                  <td style={tdStyle}>{triaseSekunder.alat_transportasi}</td>
                </tr>
                <tr>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>Alasan Kedatangan</td>
                  <td style={tdStyle}>{triaseSekunder.alasan_kedatangan}</td>
                </tr>
                <tr>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>Keterangan Kedatangan</td>
                  <td style={tdStyle}>{triaseSekunder.keterangan_kedatangan}</td>
                </tr>
                <tr>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>Macam Kasus</td>
                  <td style={tdStyle}>{triaseSekunder.macam_kasus}</td>
                </tr>
                <tr>
                  <td
                    colSpan={2}
                    style={{ ...tdStyle, background: '#f3f4f6', textAlign: 'center', fontWeight: 600 }}
                  >
                    Triase Sekunder
                  </td>
                </tr>
                <tr>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>Anamnesa Singkat</td>
                  <td style={tdStyle}>{renderNewlines(triaseSekunder.anamnesa_singkat)}</td>
                </tr>
                <tr>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>Tanda Vital</td>
                  <td style={tdStyle}>
                    Suhu (C): {triaseSekunder.suhu}, Nyeri: {triaseSekunder.nyeri}, Tensi:{' '}
                    {triaseSekunder.tekanan_darah}, Nadi(/menit): {triaseSekunder.nadi},
                    Saturasi O²(%): {triaseSekunder.saturasi_o2}, Respirasi(/menit):{' '}
                    {triaseSekunder.pernapasan}
                  </td>
                </tr>
                {/* Skala 3 - Urgensi */}
                {triaseSekunder.skala3 && triaseSekunder.skala3.length > 0 && (
                  <>
                    <tr>
                      <td style={{ ...tdStyle, background: '#f3f4f6', textAlign: 'center', fontWeight: 600 }}>
                        Pemeriksaan
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          textAlign: 'center',
                          background: '#C8C800',
                          color: 'white',
                          fontWeight: 600
                        }}
                      >
                        Urgensi
                      </td>
                    </tr>
                    {triaseSekunder.skala3.map((pemeriksaan: any, pIndex: number) => (
                      <tr key={`s3-${pIndex}`}>
                        <td style={tdStyle}>{pemeriksaan.nama_pemeriksaan}</td>
                        <td style={{ ...tdStyle, background: '#C8C800', color: 'white' }}>
                          {pemeriksaan.details?.map((detail: any, dIndex: number) => (
                            <div key={`s3d-${dIndex}`}>• {detail.pengkajian_skala3}</div>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </>
                )}
                {/* Skala 4 - Semi Urgensi */}
                {triaseSekunder.skala4 && triaseSekunder.skala4.length > 0 && (
                  <>
                    <tr>
                      <td style={{ ...tdStyle, background: '#f3f4f6', textAlign: 'center', fontWeight: 600 }}>
                        Pemeriksaan
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          textAlign: 'center',
                          background: '#00AA00',
                          color: 'white',
                          fontWeight: 600
                        }}
                      >
                        Semi Urgensi/Urgensi Rendah
                      </td>
                    </tr>
                    {triaseSekunder.skala4.map((pemeriksaan: any, pIndex: number) => (
                      <tr key={`s4-${pIndex}`}>
                        <td style={tdStyle}>{pemeriksaan.nama_pemeriksaan}</td>
                        <td style={{ ...tdStyle, background: '#00AA00', color: 'white' }}>
                          {pemeriksaan.details?.map((detail: any, dIndex: number) => (
                            <div key={`s4d-${dIndex}`}>• {detail.pengkajian_skala4}</div>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </>
                )}
                {/* Skala 5 - Non Urgensi */}
                {triaseSekunder.skala5 && triaseSekunder.skala5.length > 0 && (
                  <>
                    <tr>
                      <td style={{ ...tdStyle, background: '#f3f4f6', textAlign: 'center', fontWeight: 600 }}>
                        Pemeriksaan
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          textAlign: 'center',
                          background: '#969696',
                          color: 'white',
                          fontWeight: 600
                        }}
                      >
                        Non Urgensi
                      </td>
                    </tr>
                    {triaseSekunder.skala5.map((pemeriksaan: any, pIndex: number) => (
                      <tr key={`s5-${pIndex}`}>
                        <td style={tdStyle}>{pemeriksaan.nama_pemeriksaan}</td>
                        <td style={{ ...tdStyle, background: '#969696', color: 'white' }}>
                          {pemeriksaan.details?.map((detail: any, dIndex: number) => (
                            <div key={`s5d-${dIndex}`}>• {detail.pengkajian_skala5}</div>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </>
                )}
                <tr>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>Plan/Keputusan</td>
                  <td
                    style={{ ...tdStyle, background: keputusanColor, color: 'white' }}
                  >
                    {triaseSekunder.plan}
                  </td>
                </tr>
                <tr>
                  <td
                    colSpan={2}
                    style={{ ...tdStyle, background: '#f3f4f6', textAlign: 'center', fontWeight: 600 }}
                  >
                    Petugas Triase Sekunder
                  </td>
                </tr>
                <tr>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>Tanggal & Jam</td>
                  <td style={tdStyle}>{triaseSekunder.tanggaltriase}</td>
                </tr>
                <tr>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>Catatan</td>
                  <td style={tdStyle}>{triaseSekunder.catatan}</td>
                </tr>
                <tr>
                  <td style={{ ...tdStyle, fontWeight: 600, borderBottom: 'none' }}>Dokter/Petugas IGD</td>
                  <td style={{ ...tdStyle, borderBottom: 'none' }}>
                    {triaseSekunder.nik} - {triaseSekunder.nama}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // Function to render Pemeriksaan Rawat Inap (SOAP)
  const renderPemeriksaanRanap = (pemeriksaanList: any[]) => {
    if (!pemeriksaanList || pemeriksaanList.length === 0) return null;

    return (
      <div style={cardStyle}>
        <div style={{ background: '#ffffff', color: '#374151', borderBottom: '1px solid #e5e7eb', padding: '12px 16px' }}>
          <h6 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#6f42c1' }}>🛏️ Pemeriksaan Rawat Inap (SOAP)</h6>
        </div>
        <div style={{ padding: 16 }}>
          {pemeriksaanList.map((item: any, index: number) => (
            <div key={index} style={{ marginBottom: 16 }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                  <tbody>
                    <tr style={{ background: '#f3f4f6' }}>
                      <td style={{ ...tdStyle, width: '5%', textAlign: 'center', fontWeight: 600 }}>No.</td>
                      <td style={{ ...tdStyle, width: '15%', fontWeight: 600 }}>Tanggal</td>
                      <td colSpan={6} style={{ ...tdStyle, width: '50%', fontWeight: 600 }}>
                        Dokter/Paramedis
                      </td>
                      <td colSpan={3} style={{ ...tdStyle, width: '30%', fontWeight: 600 }}>
                        Profesi/Jabatan/Departemen
                      </td>
                    </tr>
                    <tr>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{index + 1}</td>
                      <td style={tdStyle}>
                        {item.tgl_perawatan} {item.jam_rawat}
                      </td>
                      <td colSpan={6} style={tdStyle}>
                        {item.nip} - {item.nama}
                      </td>
                      <td colSpan={3} style={tdStyle}>
                        {item.jbtn}
                      </td>
                    </tr>
                    {item.keluhan && (
                      <tr>
                        <td colSpan={2} style={tdStyle}></td>
                        <td colSpan={2} style={{ ...tdStyle, fontWeight: 600 }}>
                          Subjek
                        </td>
                        <td colSpan={6} style={tdStyle}>
                          {renderNewlines(item.keluhan)}
                        </td>
                      </tr>
                    )}
                    {item.pemeriksaan && (
                      <tr>
                        <td colSpan={2} style={tdStyle}></td>
                        <td colSpan={2} style={{ ...tdStyle, fontWeight: 600 }}>
                          Objek
                        </td>
                        <td colSpan={6} style={tdStyle}>
                          {renderNewlines(item.pemeriksaan)}
                        </td>
                      </tr>
                    )}
                    <tr style={{ background: '#f3f4f6' }}>
                      <td colSpan={2} style={tdStyle}></td>
                      <td style={{ ...tdStyle, width: '9%', textAlign: 'center', fontWeight: 600 }}>
                        Suhu(C)
                      </td>
                      <td style={{ ...tdStyle, width: '9%', textAlign: 'center', fontWeight: 600 }}>Tensi</td>
                      <td style={{ ...tdStyle, width: '9%', textAlign: 'center', fontWeight: 600 }}>
                        Nadi(/mnt)
                      </td>
                      <td style={{ ...tdStyle, width: '9%', textAlign: 'center', fontWeight: 600 }}>
                        Resp(/mnt)
                      </td>
                      <td style={{ ...tdStyle, width: '9%', textAlign: 'center', fontWeight: 600 }}>
                        Tinggi(Cm)
                      </td>
                      <td style={{ ...tdStyle, width: '9%', textAlign: 'center', fontWeight: 600 }}>
                        Berat(Kg)
                      </td>
                      <td style={{ ...tdStyle, width: '9%', textAlign: 'center', fontWeight: 600 }}>
                        SpO2(%)
                      </td>
                      <td style={{ ...tdStyle, width: '9%', textAlign: 'center', fontWeight: 600 }}>
                        GCS(E,V,M)
                      </td>
                      <td style={{ ...tdStyle, width: '9%', textAlign: 'center', fontWeight: 600 }}>
                        Kesadaran
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={2} style={tdStyle}></td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{item.suhu_tubuh}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{item.tensi}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{item.nadi}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{item.respirasi}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{item.tinggi}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{item.berat}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{item.spo2}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{item.gcs}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{item.kesadaran}</td>
                    </tr>
                    {item.alergi && (
                      <tr>
                        <td colSpan={2} style={tdStyle}></td>
                        <td colSpan={2} style={{ ...tdStyle, fontWeight: 600 }}>
                          Alergi
                        </td>
                        <td colSpan={6} style={tdStyle}>
                          : {item.alergi}
                        </td>
                      </tr>
                    )}
                    {item.penilaian && (
                      <tr>
                        <td colSpan={2} style={tdStyle}></td>
                        <td colSpan={2} style={{ ...tdStyle, fontWeight: 600 }}>
                          Asesmen
                        </td>
                        <td colSpan={6} style={tdStyle}>
                          : {renderNewlines(item.penilaian)}
                        </td>
                      </tr>
                    )}
                    {item.rtl && (
                      <tr>
                        <td colSpan={2} style={tdStyle}></td>
                        <td colSpan={2} style={{ ...tdStyle, fontWeight: 600 }}>
                          Plan
                        </td>
                        <td colSpan={6} style={tdStyle}>
                          : {renderNewlines(item.rtl)}
                        </td>
                      </tr>
                    )}
                    {item.instruksi && (
                      <tr>
                        <td colSpan={2} style={tdStyle}></td>
                        <td colSpan={2} style={{ ...tdStyle, fontWeight: 600 }}>
                          Inst/Impl
                        </td>
                        <td colSpan={6} style={tdStyle}>
                          : {renderNewlines(item.instruksi)}
                        </td>
                      </tr>
                    )}
                    {item.evaluasi && (
                      <tr>
                        <td colSpan={2} style={{ ...tdStyle, borderBottom: 'none' }}></td>
                        <td colSpan={2} style={{ ...tdStyle, fontWeight: 600, borderBottom: 'none' }}>
                          Evaluasi
                        </td>
                        <td colSpan={6} style={{ ...tdStyle, borderBottom: 'none' }}>
                          : {renderNewlines(item.evaluasi)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {index < pemeriksaanList.length - 1 && (
                <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid #e5e7eb' }} />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Function untuk render Asuhan Keperawatan IGD
  const renderAsuhanKeperawatanIGD = (data: any) => {
    if (!data) return null;

    return (
      <div style={{
        marginTop: '20px',
        border: '1px solid #ddd',
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
        {/* Header Card */}
        <div style={{
          background: '#ffffff',
          color: '#374151',
          borderBottom: '1px solid #e5e7eb',
          padding: '12px 15px',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span style={{ fontSize: '20px' }}>🩺</span>
          <span style={{ color: '#17a2b8' }}>PENGKAJIAN AWAL KEPERAWATAN IGD</span>
        </div>

        {/* Content */}
        <div style={{ padding: '15px' }}>
          {/* YANG MELAKUKAN PENGKAJIAN */}
          <div style={{ 
            marginBottom: '15px',
            padding: '10px',
            background: '#f8f9fa',
            borderRadius: '5px'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#17a2b8' }}>
              YANG MELAKUKAN PENGKAJIAN
            </div>
            <table style={{ width: '100%', fontSize: '14px' }}>
              <tbody>
                <tr>
                  <td width="33%">Tanggal: {data.tanggal}</td>
                  <td width="33%">Petugas: {data.nip} {data.nama_petugas}</td>
                  <td width="33%">Informasi didapat dari: {data.informasi}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* I. RIWAYAT KESEHATAN PASIEN */}
          <div style={{ marginBottom: '15px' }}>
            <div style={{ 
              fontWeight: 'bold', 
              marginBottom: '8px',
              color: '#17a2b8',
              borderBottom: '2px solid #17a2b8',
              paddingBottom: '5px'
            }}>
              I. RIWAYAT KESEHATAN PASIEN
            </div>
            <table style={{ width: '100%', fontSize: '14px' }}>
              <tbody>
                <tr>
                  <td colSpan={2} style={{ padding: '5px', borderBottom: '1px solid #eee' }}>
                    <strong>Riwayat Penyakit Sekarang:</strong><br />
                    <div dangerouslySetInnerHTML={{ __html: data.keluhan_utama.replace(/(\r\n|\r|\n)/g, '<br>') }} />
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} style={{ padding: '5px', borderBottom: '1px solid #eee' }}>
                    <strong>Riwayat Penyakit Dahulu:</strong><br />
                    <div dangerouslySetInnerHTML={{ __html: data.rpd.replace(/(\r\n|\r|\n)/g, '<br>') }} />
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} style={{ padding: '5px', borderBottom: '1px solid #eee' }}>
                    <strong>Riwayat Penggunaan Obat:</strong><br />
                    <div dangerouslySetInnerHTML={{ __html: data.rpo.replace(/(\r\n|\r|\n)/g, '<br>') }} />
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} style={{ padding: '5px' }}>
                    <strong>Status Kehamilan:</strong> {data.status_kehamilan}
                    {data.para && `, Para: ${data.para}`}
                    {data.abortus && `, Abortus: ${data.abortus}`}
                    {data.gravida && `, Gravida: ${data.gravida}`}
                    {data.hpht && `, HPHT: ${data.hpht}`}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* II. PEMERIKSAAN FISIK */}
          <div style={{ marginBottom: '15px' }}>
            <div style={{ 
              fontWeight: 'bold', 
              marginBottom: '8px',
              color: '#17a2b8',
              borderBottom: '2px solid #17a2b8',
              paddingBottom: '5px'
            }}>
              II. PEMERIKSAAN FISIK
            </div>
            <table style={{ width: '100%', fontSize: '14px' }}>
              <tbody>
                <tr>
                  <td width="33%" style={{ padding: '5px', borderBottom: '1px solid #eee' }}>
                    Tekanan Intrakranial: {data.tekanan}
                  </td>
                  <td width="33%" style={{ padding: '5px', borderBottom: '1px solid #eee' }}>
                    Pupil: {data.pupil}
                  </td>
                  <td width="33%" style={{ padding: '5px', borderBottom: '1px solid #eee' }}>
                    Neurosensorik / Muskuloskeletal: {data.neurosensorik}
                  </td>
                </tr>
                <tr>
                  <td width="33%" style={{ padding: '5px', borderBottom: '1px solid #eee' }}>
                    Integumen: {data.integumen}
                  </td>
                  <td width="33%" style={{ padding: '5px', borderBottom: '1px solid #eee' }}>
                    Turgor Kulit: {data.turgor}
                  </td>
                  <td width="33%" style={{ padding: '5px', borderBottom: '1px solid #eee' }}>
                    Edema: {data.edema}
                  </td>
                </tr>
                <tr>
                  <td width="33%" style={{ padding: '5px', borderBottom: '1px solid #eee' }}>
                    Mukosa Mulut: {data.mukosa}
                  </td>
                  <td width="33%" style={{ padding: '5px', borderBottom: '1px solid #eee' }}>
                    Perdarahan: {data.perdarahan}
                    {data.jumlah_perdarahan && `, Jumlah: ${data.jumlah_perdarahan} cc`}
                    {data.warna_perdarahan && `, Warna: ${data.warna_perdarahan}`}
                  </td>
                  <td width="33%" style={{ padding: '5px', borderBottom: '1px solid #eee' }}>
                    Intoksikasi: {data.intoksikasi}
                  </td>
                </tr>
                <tr>
                  <td colSpan={3} style={{ padding: '5px', fontWeight: 'bold' }}>
                    Eliminasi:
                  </td>
                </tr>
                <tr>
                  <td width="33%" style={{ padding: '5px 5px 5px 20px', borderBottom: '1px solid #eee' }}>
                    BAB: Frekuensi: {data.bab} X/{data.xbab}
                  </td>
                  <td width="33%" style={{ padding: '5px', borderBottom: '1px solid #eee' }}>
                    Konsistensi: {data.kbab}
                  </td>
                  <td width="33%" style={{ padding: '5px', borderBottom: '1px solid #eee' }}>
                    Warna: {data.wbab}
                  </td>
                </tr>
                <tr>
                  <td width="33%" style={{ padding: '5px 5px 5px 20px' }}>
                    BAK: Frekuensi: {data.bak} X/{data.xbak}
                  </td>
                  <td width="33%" style={{ padding: '5px' }}>
                    Warna: {data.wbak}
                  </td>
                  <td width="33%" style={{ padding: '5px' }}>
                    Lain-lain: {data.lbak}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* III. RIWAYAT PSIKOLOGIS - SOSIAL - EKONOMI - BUDAYA - SPIRITUAL */}
          <div style={{ marginBottom: '15px' }}>
            <div style={{ 
              fontWeight: 'bold', 
              marginBottom: '8px',
              color: '#17a2b8',
              borderBottom: '2px solid #17a2b8',
              paddingBottom: '5px'
            }}>
              III. RIWAYAT PSIKOLOGIS - SOSIAL - EKONOMI - BUDAYA - SPIRITUAL
            </div>
            <table style={{ width: '100%', fontSize: '14px' }}>
              <tbody>
                <tr>
                  <td width="50%" style={{ padding: '5px', borderBottom: '1px solid #eee' }}>
                    Kondisi Psikologis
                  </td>
                  <td width="50%" style={{ padding: '5px', borderBottom: '1px solid #eee' }}>
                    : {data.psikologis}
                  </td>
                </tr>
                <tr>
                  <td width="50%" style={{ padding: '5px', borderBottom: '1px solid #eee' }}>
                    Gangguan Jiwa Di Masa Lalu
                  </td>
                  <td width="50%" style={{ padding: '5px', borderBottom: '1px solid #eee' }}>
                    : {data.jiwa}
                  </td>
                </tr>
                <tr>
                  <td width="50%" style={{ padding: '5px', borderBottom: '1px solid #eee' }}>
                    Adakah Perilaku
                  </td>
                  <td width="50%" style={{ padding: '5px', borderBottom: '1px solid #eee' }}>
                    : {data.perilaku}
                    {data.dilaporkan && `, Dilaporkan Ke: ${data.dilaporkan}`}
                    {data.sebutkan && `, Sebutkan: ${data.sebutkan}`}
                  </td>
                </tr>
                <tr>
                  <td width="50%" style={{ padding: '5px', borderBottom: '1px solid #eee' }}>
                    Hubungan Pasien Dengan Anggota Keluarga
                  </td>
                  <td width="50%" style={{ padding: '5px', borderBottom: '1px solid #eee' }}>
                    : {data.hubungan}
                  </td>
                </tr>
                <tr>
                  <td width="50%" style={{ padding: '5px', borderBottom: '1px solid #eee' }}>
                    Tinggal Dengan
                  </td>
                  <td width="50%" style={{ padding: '5px', borderBottom: '1px solid #eee' }}>
                    : {data.tinggal_dengan}
                    {data.ket_tinggal && `, ${data.ket_tinggal}`}
                  </td>
                </tr>
                <tr>
                  <td width="50%" style={{ padding: '5px', borderBottom: '1px solid #eee' }}>
                    Kepercayaan / Budaya / Nilai-nilai Khusus Yang Perlu Diperhatikan
                  </td>
                  <td width="50%" style={{ padding: '5px', borderBottom: '1px solid #eee' }}>
                    : {data.budaya}
                    {data.ket_budaya && `, ${data.ket_budaya}`}
                  </td>
                </tr>
                <tr>
                  <td width="50%" style={{ padding: '5px', borderBottom: '1px solid #eee' }}>
                    Pendidikan Penanggung Jawab
                  </td>
                  <td width="50%" style={{ padding: '5px', borderBottom: '1px solid #eee' }}>
                    : {data.pendidikan_pj}
                    {data.ket_pendidikan_pj && `, ${data.ket_pendidikan_pj}`}
                  </td>
                </tr>
                <tr>
                  <td width="50%" style={{ padding: '5px' }}>
                    Edukasi Diberikan Kepada
                  </td>
                  <td width="50%" style={{ padding: '5px' }}>
                    : {data.edukasi}
                    {data.ket_edukasi && `, ${data.ket_edukasi}`}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* IV. PENGKAJIAN FUNGSI */}
          <div style={{ marginBottom: '15px' }}>
            <div style={{ 
              fontWeight: 'bold', 
              marginBottom: '8px',
              color: '#17a2b8',
              borderBottom: '2px solid #17a2b8',
              paddingBottom: '5px'
            }}>
              IV. PENGKAJIAN FUNGSI
            </div>
            <table style={{ width: '100%', fontSize: '14px' }}>
              <tbody>
                <tr>
                  <td width="42%" style={{ padding: '5px' }}>
                    Kemampuan Aktifitas Sehari-hari: {data.kemampuan}
                  </td>
                  <td width="20%" style={{ padding: '5px' }}>
                    Aktifitas: {data.aktifitas}
                  </td>
                  <td width="38%" style={{ padding: '5px' }}>
                    Alat Bantu: {data.alat_bantu}
                    {data.ket_bantu && `, ${data.ket_bantu}`}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* V. SKALA NYERI */}
          <div style={{ marginBottom: '15px' }}>
            <div style={{ 
              fontWeight: 'bold', 
              marginBottom: '8px',
              color: '#17a2b8',
              borderBottom: '2px solid #17a2b8',
              paddingBottom: '5px'
            }}>
              V. SKALA NYERI
            </div>
            <table style={{ width: '100%', fontSize: '14px' }}>
              <tbody>
                <tr>
                  <td width="50%" style={{ padding: '5px', borderBottom: '1px solid #eee' }}>
                    Tingkat Nyeri: {data.nyeri}, Waktu / Durasi: {data.durasi} Menit
                  </td>
                  <td width="50%" style={{ padding: '5px', borderBottom: '1px solid #eee' }}>
                    Penyebab: {data.provokes}
                    {data.ket_provokes && `, ${data.ket_provokes}`}
                  </td>
                </tr>
                <tr>
                  <td width="50%" style={{ padding: '5px', borderBottom: '1px solid #eee' }}>
                    Kualitas: {data.quality}
                    {data.ket_quality && `, ${data.ket_quality}`}
                  </td>
                  <td width="50%" style={{ padding: '5px', borderBottom: '1px solid #eee' }}>
                    Severity: Skala Nyeri {data.skala_nyeri}
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} style={{ padding: '5px', fontWeight: 'bold' }}>
                    Wilayah:
                  </td>
                </tr>
                <tr>
                  <td width="50%" style={{ padding: '5px 5px 5px 20px', borderBottom: '1px solid #eee' }}>
                    Lokasi: {data.lokasi}
                  </td>
                  <td width="50%" style={{ padding: '5px', borderBottom: '1px solid #eee' }}>
                    Menyebar: {data.menyebar}
                  </td>
                </tr>
                <tr>
                  <td width="50%" style={{ padding: '5px' }}>
                    Nyeri hilang bila: {data.nyeri_hilang}
                    {data.ket_nyeri && `, ${data.ket_nyeri}`}
                  </td>
                  <td width="50%" style={{ padding: '5px' }}>
                    Diberitahukan pada dokter? {data.pada_dokter}
                    {data.ket_dokter && `, Jam: ${data.ket_dokter}`}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* VI. PENGKAJIAN RESIKO JATUH */}
          <div style={{ marginBottom: '15px' }}>
            <div style={{ 
              fontWeight: 'bold', 
              marginBottom: '8px',
              color: '#17a2b8',
              borderBottom: '2px solid #17a2b8',
              paddingBottom: '5px'
            }}>
              VI. PENGKAJIAN RESIKO JATUH (GET UP AND GO)
            </div>
            <table style={{ width: '100%', fontSize: '14px' }}>
              <tbody>
                <tr>
                  <td colSpan={2} style={{ padding: '5px', fontWeight: 'bold' }}>
                    a. Cara Berjalan:
                  </td>
                </tr>
                <tr>
                  <td width="75%" style={{ padding: '5px 5px 5px 20px', borderBottom: '1px solid #eee' }}>
                    1. Tidak seimbang / sempoyongan / limbung
                  </td>
                  <td width="25%" style={{ padding: '5px', borderBottom: '1px solid #eee' }}>
                    : {data.berjalan_a}
                  </td>
                </tr>
                <tr>
                  <td width="75%" style={{ padding: '5px 5px 5px 20px', borderBottom: '1px solid #eee' }}>
                    2. Jalan dengan menggunakan alat bantu (kruk, tripot, kursi roda, orang lain)
                  </td>
                  <td width="25%" style={{ padding: '5px', borderBottom: '1px solid #eee' }}>
                    : {data.berjalan_b}
                  </td>
                </tr>
                <tr>
                  <td width="75%" style={{ padding: '5px', borderBottom: '1px solid #eee' }}>
                    b. Menopang saat akan duduk, tampak memegang pinggiran kursi atau meja / benda lain sebagai penopang
                  </td>
                  <td width="25%" style={{ padding: '5px', borderBottom: '1px solid #eee' }}>
                    : {data.berjalan_c}
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} style={{ padding: '5px' }}>
                    Hasil: {data.hasil} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                    Dilaporkan kepada dokter? {data.lapor}
                    {data.ket_lapor && ` Jam dilaporkan: ${data.ket_lapor}`}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* MASALAH & RENCANA KEPERAWATAN */}
          <div style={{ marginBottom: '15px' }}>
            <table style={{ 
              width: '100%', 
              fontSize: '14px',
              border: '1px solid #ddd',
              borderCollapse: 'collapse'
            }}>
              <thead>
                <tr>
                  <th style={{ 
                    width: '50%', 
                    padding: '10px', 
                    background: '#FFFAF8',
                    border: '1px solid #ddd',
                    textAlign: 'center'
                  }}>
                    MASALAH KEPERAWATAN
                  </th>
                  <th style={{ 
                    width: '50%', 
                    padding: '10px', 
                    background: '#FFFAF8',
                    border: '1px solid #ddd',
                    textAlign: 'center'
                  }}>
                    RENCANA KEPERAWATAN
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ 
                    padding: '10px', 
                    border: '1px solid #ddd',
                    verticalAlign: 'top'
                  }}>
                    {data.masalah_keperawatan && data.masalah_keperawatan.length > 0 ? (
                      data.masalah_keperawatan.map((masalah: string, idx: number) => (
                        <div key={idx}>{masalah}<br /></div>
                      ))
                    ) : (
                      '-'
                    )}
                  </td>
                  <td style={{ 
                    padding: '10px', 
                    border: '1px solid #ddd',
                    verticalAlign: 'top'
                  }}>
                    {data.rencana_keperawatan && data.rencana_keperawatan.length > 0 ? (
                      data.rencana_keperawatan.map((rencana: string, idx: number) => (
                        <div key={idx}>{rencana}<br /></div>
                      ))
                    ) : (
                      '-'
                    )}
                    {data.rencana && (
                      <div style={{ marginTop: '10px' }}>
                        <div dangerouslySetInnerHTML={{ __html: data.rencana.replace(/(\r\n|\r|\n)/g, '<br>') }} />
                      </div>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // Function to render Pemeriksaan Rawat Jalan (SOAP)
  // Function untuk render Laboratorium
  const renderLaboratorium = (labData: any) => {
    if (!labData) return null;

    const hasLabPKMB = labData.lab_pkmb && labData.lab_pkmb.length > 0;
    const hasLabPA = labData.lab_pa && labData.lab_pa.length > 0;

    if (!hasLabPKMB && !hasLabPA) return null;

    return (
      <>
        {/* LAB PK & MB */}
        {hasLabPKMB && (
          <div style={{
            marginTop: '20px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <div style={{
              background: '#ffffff',
              color: '#374151',
              borderBottom: '1px solid #e5e7eb',
              padding: '12px 15px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span style={{ fontSize: '20px' }}>🔬</span>
              <span style={{ color: '#20c997' }}>PEMERIKSAAN LABORATORIUM PK & MB</span>
            </div>

            <div style={{ padding: '15px' }}>
              <table style={{ 
                width: '100%', 
                fontSize: '13px',
                border: '1px solid #ddd',
                borderCollapse: 'collapse'
              }}>
                <thead>
                  <tr style={{ background: '#FFFAF8' }}>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '4%' }}>No.</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '15%' }}>Tanggal</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '10%' }}>Kode</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '26%' }}>Nama Pemeriksaan</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '18%' }}>Dokter PJ</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '17%' }}>Petugas</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '10%' }}>Biaya</th>
                  </tr>
                </thead>
                <tbody>
                  {labData.lab_pkmb.map((group: any, groupIdx: number) => (
                    <React.Fragment key={groupIdx}>
                      {(group.items || []).map((item: any, itemIdx: number) => (
                        <React.Fragment key={`${groupIdx}-${itemIdx}`}>
                          {/* Main Row */}
                          <tr>
                            <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>
                              {itemIdx === 0 ? groupIdx + 1 : ''}
                            </td>
                            <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                              {itemIdx === 0 ? `${group.tgl_periksa} ${group.jam}` : ''}
                            </td>
                            <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.kd_jenis_prw}</td>
                            <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.nm_perawatan}</td>
                            <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.nm_dokter}</td>
                            <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.nama_petugas}</td>
                            <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>
                              {item.biaya.toLocaleString('id-ID')}
                            </td>
                          </tr>

                          {/* Detail Items */}
                          {item.detail_items && item.detail_items.length > 0 && (
                            <>
                              <tr style={{ background: '#FFFAF8' }}>
                                <td style={{ border: '1px solid #ddd', padding: '8px' }} colSpan={3}></td>
                                <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>
                                  Detail Pemeriksaan
                                </td>
                                <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>
                                  Hasil
                                </td>
                                <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>
                                  Nilai Rujukan
                                </td>
                                <td style={{ border: '1px solid #ddd', padding: '8px' }}></td>
                              </tr>
                              {item.detail_items.map((detail: any, detailIdx: number) => {
                                let nilaiStyle: React.CSSProperties = {};
                                const ket = detail.keterangan?.toLowerCase() || '';
                                
                                if (ket === 'l') {
                                  nilaiStyle = { color: '#0000FF' }; // Low - Blue
                                } else if (ket === 'h') {
                                  nilaiStyle = { color: '#FF0000' }; // High - Red
                                } else if (ket === 't') {
                                  nilaiStyle = { fontWeight: 'bold' }; // Title - Bold
                                }

                                return (
                                  <tr key={detailIdx}>
                                    <td style={{ border: '1px solid #ddd', padding: '8px' }} colSpan={3}></td>
                                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>{detail.pemeriksaan}</td>
                                    <td style={{ border: '1px solid #ddd', padding: '8px', ...nilaiStyle }}>
                                      <div dangerouslySetInnerHTML={{ 
                                        __html: detail.nilai.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/(\r\n|\r|\n)/g, '<br>') 
                                      }} /> {detail.satuan}
                                    </td>
                                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                                      <div dangerouslySetInnerHTML={{ 
                                        __html: detail.nilai_rujukan.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/(\r\n|\r|\n)/g, '<br>') 
                                      }} />
                                    </td>
                                    <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>
                                      {detail.biaya_item.toLocaleString('id-ID')}
                                    </td>
                                  </tr>
                                );
                              })}
                            </>
                          )}

                          {/* Kesan & Saran (only for last item in group) */}
                          {itemIdx === group.items.length - 1 && (item.kesan || item.saran) && (
                            <>
                              {item.kesan && (
                                <tr>
                                  <td style={{ border: '1px solid #ddd', padding: '8px' }}></td>
                                  <td style={{ border: '1px solid #ddd', padding: '8px', fontWeight: 'bold' }}>Kesan</td>
                                  <td style={{ border: '1px solid #ddd', padding: '8px' }} colSpan={5}>: {item.kesan}</td>
                                </tr>
                              )}
                              {item.saran && (
                                <tr>
                                  <td style={{ border: '1px solid #ddd', padding: '8px' }}></td>
                                  <td style={{ border: '1px solid #ddd', padding: '8px', fontWeight: 'bold' }}>Saran</td>
                                  <td style={{ border: '1px solid #ddd', padding: '8px' }} colSpan={5}>: {item.saran}</td>
                                </tr>
                              )}
                            </>
                          )}
                        </React.Fragment>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* LAB PA */}
        {hasLabPA && (
          <div style={{
            marginTop: '20px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <div style={{
              background: '#ffffff',
              color: '#374151',
              borderBottom: '1px solid #e5e7eb',
              padding: '12px 15px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span style={{ fontSize: '20px' }}>🔬</span>
              <span style={{ color: '#fd7e14' }}>PEMERIKSAAN LABORATORIUM PA (Patologi Anatomi)</span>
            </div>

            <div style={{ padding: '15px' }}>
              <table style={{ 
                width: '100%', 
                fontSize: '13px',
                border: '1px solid #ddd',
                borderCollapse: 'collapse'
              }}>
                <thead>
                  <tr style={{ background: '#FFFAF8' }}>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '4%' }}>No.</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '15%' }}>Tanggal</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '10%' }}>Kode</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '26%' }}>Nama Pemeriksaan</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '18%' }}>Dokter PJ</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '17%' }}>Petugas</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '10%' }}>Biaya</th>
                  </tr>
                </thead>
                <tbody>
                  {labData.lab_pa.map((item: any, idx: number) => (
                    <React.Fragment key={idx}>
                      <tr>
                        <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{idx + 1}</td>
                        <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.tgl_periksa} {item.jam}</td>
                        <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.kd_jenis_prw}</td>
                        <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.nm_perawatan}</td>
                        <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.nm_dokter}</td>
                        <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.nama_petugas}</td>
                        <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>
                          {item.biaya.toLocaleString('id-ID')}
                        </td>
                      </tr>
                      {(item.diagnosa_klinik || item.makroskopik || item.mikroskopik || item.kesimpulan || item.kesan) && (
                        <>
                          {item.diagnosa_klinik && (
                            <tr>
                              <td style={{ border: '1px solid #ddd', padding: '8px' }}></td>
                              <td style={{ border: '1px solid #ddd', padding: '8px' }}></td>
                              <td style={{ border: '1px solid #ddd', padding: '8px', fontWeight: 'bold' }}>Diagnosa Klinis</td>
                              <td style={{ border: '1px solid #ddd', padding: '8px' }} colSpan={4}>: {item.diagnosa_klinik}</td>
                            </tr>
                          )}
                          {item.makroskopik && (
                            <tr>
                              <td style={{ border: '1px solid #ddd', padding: '8px' }}></td>
                              <td style={{ border: '1px solid #ddd', padding: '8px' }}></td>
                              <td style={{ border: '1px solid #ddd', padding: '8px', fontWeight: 'bold' }}>Makroskopik</td>
                              <td style={{ border: '1px solid #ddd', padding: '8px' }} colSpan={4}>: {item.makroskopik}</td>
                            </tr>
                          )}
                          {item.mikroskopik && (
                            <tr>
                              <td style={{ border: '1px solid #ddd', padding: '8px' }}></td>
                              <td style={{ border: '1px solid #ddd', padding: '8px' }}></td>
                              <td style={{ border: '1px solid #ddd', padding: '8px', fontWeight: 'bold' }}>Mikroskopik</td>
                              <td style={{ border: '1px solid #ddd', padding: '8px' }} colSpan={4}>: {item.mikroskopik}</td>
                            </tr>
                          )}
                          {item.kesimpulan && (
                            <tr>
                              <td style={{ border: '1px solid #ddd', padding: '8px' }}></td>
                              <td style={{ border: '1px solid #ddd', padding: '8px' }}></td>
                              <td style={{ border: '1px solid #ddd', padding: '8px', fontWeight: 'bold' }}>Kesimpulan</td>
                              <td style={{ border: '1px solid #ddd', padding: '8px' }} colSpan={4}>: {item.kesimpulan}</td>
                            </tr>
                          )}
                          {item.kesan && (
                            <tr>
                              <td style={{ border: '1px solid #ddd', padding: '8px' }}></td>
                              <td style={{ border: '1px solid #ddd', padding: '8px' }}></td>
                              <td style={{ border: '1px solid #ddd', padding: '8px', fontWeight: 'bold' }}>Kesan</td>
                              <td style={{ border: '1px solid #ddd', padding: '8px' }} colSpan={4}>: {item.kesan}</td>
                            </tr>
                          )}
                          {item.photo && (
                            <tr>
                              <td style={{ border: '1px solid #ddd', padding: '8px' }}></td>
                              <td style={{ border: '1px solid #ddd', padding: '8px' }}></td>
                              <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }} colSpan={5}>
                                <div style={{ marginTop: '10px' }}>
                                  <a 
                                    href={`/labpa/${item.photo}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    style={{ color: '#007bff', textDecoration: 'none' }}
                                  >
                                    <img 
                                      src={`/labpa/${item.photo}`} 
                                      alt="Gambar PA" 
                                      style={{ maxWidth: '450px', maxHeight: '450px', border: '1px solid #ddd' }}
                                    />
                                  </a>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </>
    );
  };

  // Function untuk render Radiologi
  const renderRadiologi = (radData: any) => {
    if (!radData) return null;

    const hasPemeriksaan = radData.pemeriksaan && radData.pemeriksaan.length > 0;
    const hasHasil = radData.hasil && radData.hasil.length > 0;
    const hasGambar = radData.gambar && radData.gambar.length > 0;

    if (!hasPemeriksaan && !hasHasil && !hasGambar) return null;

    return (
      <>
        {/* PEMERIKSAAN RADIOLOGI */}
        {hasPemeriksaan && (
          <div style={{
            marginTop: '20px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <div style={{
              background: '#ffffff',
              color: '#374151',
              borderBottom: '1px solid #e5e7eb',
              padding: '12px 15px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span style={{ fontSize: '20px' }}>📷</span>
              <span style={{ color: '#6610f2' }}>PEMERIKSAAN RADIOLOGI</span>
            </div>

            <div style={{ padding: '15px' }}>
              <table style={{ 
                width: '100%', 
                fontSize: '13px',
                border: '1px solid #ddd',
                borderCollapse: 'collapse'
              }}>
                <thead>
                  <tr style={{ background: '#FFFAF8' }}>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '4%' }}>No.</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '15%' }}>Tanggal</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '10%' }}>Kode</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '26%' }}>Nama Pemeriksaan</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '18%' }}>Dokter PJ</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '17%' }}>Petugas</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '10%' }}>Biaya</th>
                  </tr>
                </thead>
                <tbody>
                  {radData.pemeriksaan.map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.tgl_periksa} {item.jam}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.kd_jenis_prw}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                        {item.nm_perawatan}
                        {item.proyeksi && (
                          <>
                            <br />
                            <span style={{ fontSize: '12px', color: '#666' }}>{item.proyeksi}</span>
                          </>
                        )}
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.nm_dokter}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.nama_petugas}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>
                        {item.biaya.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* HASIL RADIOLOGI */}
        {hasHasil && (
          <div style={{
            marginTop: '20px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <div style={{
              background: '#ffffff',
              color: '#374151',
              borderBottom: '1px solid #e5e7eb',
              padding: '12px 15px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span style={{ fontSize: '20px' }}>📝</span>
              <span style={{ color: '#e83e8c' }}>BACAAN / HASIL RADIOLOGI</span>
            </div>

            <div style={{ padding: '15px' }}>
              <table style={{ 
                width: '100%', 
                fontSize: '13px',
                border: '1px solid #ddd',
                borderCollapse: 'collapse'
              }}>
                <thead>
                  <tr style={{ background: '#FFFAF8' }}>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '4%' }}>No.</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '15%' }}>Tanggal</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '81%' }}>Hasil Pemeriksaan</th>
                  </tr>
                </thead>
                <tbody>
                  {radData.hasil.map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.tgl_periksa} {item.jam}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                        <div dangerouslySetInnerHTML={{ 
                          __html: item.hasil.replace(/(\r\n|\r|\n)/g, '<br>') 
                        }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* GAMBAR RADIOLOGI */}
        {hasGambar && (
          <div style={{
            marginTop: '20px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <div style={{
              background: '#ffffff',
              color: '#374151',
              borderBottom: '1px solid #e5e7eb',
              padding: '12px 15px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span style={{ fontSize: '20px' }}>🖼️</span>
              <span style={{ color: '#20c997' }}>GAMBAR RADIOLOGI</span>
            </div>

            <div style={{ padding: '15px' }}>
              <table style={{ 
                width: '100%', 
                fontSize: '13px',
                border: '1px solid #ddd',
                borderCollapse: 'collapse'
              }}>
                <thead>
                  <tr style={{ background: '#FFFAF8' }}>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '4%' }}>No.</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '15%' }}>Tanggal</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '81%' }}>Gambar Radiologi</th>
                  </tr>
                </thead>
                <tbody>
                  {radData.gambar.map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', verticalAlign: 'top' }}>
                        {idx + 1}
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', verticalAlign: 'top' }}>
                        {item.tgl_periksa} {item.jam}
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>
                        <div style={{ marginTop: '10px' }}>
                          <a 
                            href={`/radiologi/${item.lokasi_gambar}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ color: '#007bff', textDecoration: 'none' }}
                          >
                            <img 
                              src={`/radiologi/${item.lokasi_gambar}`} 
                              alt="Gambar Radiologi" 
                              style={{ maxWidth: '450px', maxHeight: '450px', border: '1px solid #ddd' }}
                            />
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </>
    );
  };

  // Function untuk render Tindakan Rawat Jalan
  const renderTindakanRalan = (tindakanData: any) => {
    if (!tindakanData) return null;

    const hasDokter = tindakanData.tindakan_dokter && tindakanData.tindakan_dokter.length > 0;
    const hasParamedis = tindakanData.tindakan_paramedis && tindakanData.tindakan_paramedis.length > 0;
    const hasDokterParamedis = tindakanData.tindakan_dokter_paramedis && tindakanData.tindakan_dokter_paramedis.length > 0;

    if (!hasDokter && !hasParamedis && !hasDokterParamedis) return null;

    return (
      <>
        {/* TINDAKAN RAWAT JALAN DOKTER */}
        {hasDokter && (
          <div style={{
            marginTop: '20px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <div style={{
              background: '#ffffff',
              color: '#374151',
              borderBottom: '1px solid #e5e7eb',
              padding: '12px 15px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span style={{ fontSize: '20px' }}>👨‍⚕️</span>
              <span style={{ color: '#007bff' }}>TINDAKAN RAWAT JALAN DOKTER</span>
            </div>

            <div style={{ padding: '15px' }}>
              <table style={{ 
                width: '100%', 
                fontSize: '13px',
                border: '1px solid #ddd',
                borderCollapse: 'collapse'
              }}>
                <thead>
                  <tr style={{ background: '#FFFAF8' }}>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '4%' }}>No.</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '15%' }}>Tanggal</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '10%' }}>Kode</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '41%' }}>Nama Tindakan/Perawatan</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '20%' }}>Dokter</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '10%' }}>Biaya</th>
                  </tr>
                </thead>
                <tbody>
                  {tindakanData.tindakan_dokter.map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.tgl_perawatan} {item.jam_rawat}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.kd_jenis_prw}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.nm_perawatan}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.nm_dokter}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>
                        {item.biaya_rawat.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TINDAKAN RAWAT JALAN PARAMEDIS */}
        {hasParamedis && (
          <div style={{
            marginTop: '20px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <div style={{
              background: '#ffffff',
              color: '#374151',
              borderBottom: '1px solid #e5e7eb',
              padding: '12px 15px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span style={{ fontSize: '20px' }}>👩‍⚕️</span>
              <span style={{ color: '#28a745' }}>TINDAKAN RAWAT JALAN PARAMEDIS</span>
            </div>

            <div style={{ padding: '15px' }}>
              <table style={{ 
                width: '100%', 
                fontSize: '13px',
                border: '1px solid #ddd',
                borderCollapse: 'collapse'
              }}>
                <thead>
                  <tr style={{ background: '#FFFAF8' }}>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '4%' }}>No.</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '15%' }}>Tanggal</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '10%' }}>Kode</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '41%' }}>Nama Tindakan/Perawatan</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '20%' }}>Paramedis</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '10%' }}>Biaya</th>
                  </tr>
                </thead>
                <tbody>
                  {tindakanData.tindakan_paramedis.map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.tgl_perawatan} {item.jam_rawat}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.kd_jenis_prw}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.nm_perawatan}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.nama_paramedis}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>
                        {item.biaya_rawat.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TINDAKAN RAWAT JALAN DOKTER & PARAMEDIS */}
        {hasDokterParamedis && (
          <div style={{
            marginTop: '20px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <div style={{
              background: '#ffffff',
              color: '#374151',
              borderBottom: '1px solid #e5e7eb',
              padding: '12px 15px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span style={{ fontSize: '20px' }}>👥</span>
              <span style={{ color: '#ffc107' }}>TINDAKAN RAWAT JALAN DOKTER & PARAMEDIS</span>
            </div>

            <div style={{ padding: '15px' }}>
              <table style={{ 
                width: '100%', 
                fontSize: '13px',
                border: '1px solid #ddd',
                borderCollapse: 'collapse'
              }}>
                <thead>
                  <tr style={{ background: '#FFFAF8' }}>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '4%' }}>No.</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '15%' }}>Tanggal</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '10%' }}>Kode</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '27%' }}>Nama Tindakan/Perawatan</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '17%' }}>Dokter</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '17%' }}>Paramedis</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '10%' }}>Biaya</th>
                  </tr>
                </thead>
                <tbody>
                  {tindakanData.tindakan_dokter_paramedis.map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.tgl_perawatan} {item.jam_rawat}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.kd_jenis_prw}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.nm_perawatan}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.nm_dokter}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.nama_paramedis}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>
                        {item.biaya_rawat.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </>
    );
  };

  // Function untuk render Tindakan Rawat Inap
  const renderTindakanRanap = (tindakanData: any) => {
    if (!tindakanData) return null;

    const hasDokter = tindakanData.tindakan_dokter && tindakanData.tindakan_dokter.length > 0;
    const hasParamedis = tindakanData.tindakan_paramedis && tindakanData.tindakan_paramedis.length > 0;
    const hasDokterParamedis = tindakanData.tindakan_dokter_paramedis && tindakanData.tindakan_dokter_paramedis.length > 0;

    if (!hasDokter && !hasParamedis && !hasDokterParamedis) return null;

    return (
      <>
        {/* TINDAKAN RAWAT INAP DOKTER */}
        {hasDokter && (
          <div style={{
            marginTop: '20px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <div style={{
              background: '#ffffff',
              color: '#374151',
              borderBottom: '1px solid #e5e7eb',
              padding: '12px 15px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span style={{ fontSize: '20px' }}>👨‍⚕️</span>
              <span style={{ color: '#6f42c1' }}>TINDAKAN RAWAT INAP DOKTER</span>
            </div>

            <div style={{ padding: '15px' }}>
              <table style={{ 
                width: '100%', 
                fontSize: '13px',
                border: '1px solid #ddd',
                borderCollapse: 'collapse'
              }}>
                <thead>
                  <tr style={{ background: '#FFFAF8' }}>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '4%' }}>No.</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '15%' }}>Tanggal</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '10%' }}>Kode</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '41%' }}>Nama Tindakan/Perawatan</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '20%' }}>Dokter</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '10%' }}>Biaya</th>
                  </tr>
                </thead>
                <tbody>
                  {tindakanData.tindakan_dokter.map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.tgl_perawatan} {item.jam_rawat}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.kd_jenis_prw}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.nm_perawatan}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.nm_dokter}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>
                        {item.biaya_rawat.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TINDAKAN RAWAT INAP PARAMEDIS */}
        {hasParamedis && (
          <div style={{
            marginTop: '20px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <div style={{
              background: '#ffffff',
              color: '#374151',
              borderBottom: '1px solid #e5e7eb',
              padding: '12px 15px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span style={{ fontSize: '20px' }}>👩‍⚕️</span>
              <span style={{ color: '#dc3545' }}>TINDAKAN RAWAT INAP PARAMEDIS</span>
            </div>

            <div style={{ padding: '15px' }}>
              <table style={{ 
                width: '100%', 
                fontSize: '13px',
                border: '1px solid #ddd',
                borderCollapse: 'collapse'
              }}>
                <thead>
                  <tr style={{ background: '#FFFAF8' }}>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '4%' }}>No.</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '15%' }}>Tanggal</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '10%' }}>Kode</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '41%' }}>Nama Tindakan/Perawatan</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '20%' }}>Paramedis</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '10%' }}>Biaya</th>
                  </tr>
                </thead>
                <tbody>
                  {tindakanData.tindakan_paramedis.map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.tgl_perawatan} {item.jam_rawat}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.kd_jenis_prw}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.nm_perawatan}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.nama_paramedis}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>
                        {item.biaya_rawat.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TINDAKAN RAWAT INAP DOKTER & PARAMEDIS */}
        {hasDokterParamedis && (
          <div style={{
            marginTop: '20px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <div style={{
              background: '#ffffff',
              color: '#374151',
              borderBottom: '1px solid #e5e7eb',
              padding: '12px 15px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span style={{ fontSize: '20px' }}>👥</span>
              <span style={{ color: '#17a2b8' }}>TINDAKAN RAWAT INAP DOKTER & PARAMEDIS</span>
            </div>

            <div style={{ padding: '15px' }}>
              <table style={{ 
                width: '100%', 
                fontSize: '13px',
                border: '1px solid #ddd',
                borderCollapse: 'collapse'
              }}>
                <thead>
                  <tr style={{ background: '#FFFAF8' }}>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '4%' }}>No.</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '15%' }}>Tanggal</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '10%' }}>Kode</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '27%' }}>Nama Tindakan/Perawatan</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '17%' }}>Dokter</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '17%' }}>Paramedis</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '10%' }}>Biaya</th>
                  </tr>
                </thead>
                <tbody>
                  {tindakanData.tindakan_dokter_paramedis.map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.tgl_perawatan} {item.jam_rawat}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.kd_jenis_prw}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.nm_perawatan}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.nm_dokter}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.nama_paramedis}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>
                        {item.biaya_rawat.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </>
    );
  };

  // Function untuk render Kamar Inap
  const renderKamarInap = (kamarList: any[]) => {
    if (!kamarList || kamarList.length === 0) return null;

    return (
      <div style={{
        marginTop: '20px',
        border: '1px solid #ddd',
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
        <div style={{
          background: '#ffffff',
          color: '#374151',
          borderBottom: '1px solid #e5e7eb',
          padding: '12px 15px',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span style={{ fontSize: '20px' }}>🏥</span>
          <span style={{ color: '#fd7e14' }}>PENGGUNAAN KAMAR</span>
        </div>

        <div style={{ padding: '15px' }}>
          <table style={{ 
            width: '100%', 
            fontSize: '13px',
            border: '1px solid #ddd',
            borderCollapse: 'collapse'
          }}>
            <thead>
              <tr style={{ background: '#FFFAF8' }}>
                <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '4%' }}>No.</th>
                <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '15%' }}>Tanggal Masuk</th>
                <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '15%' }}>Tanggal Keluar</th>
                <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '10%' }}>Lama Inap</th>
                <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '36%' }}>Kamar</th>
                <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '10%' }}>Status</th>
                <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '10%' }}>Biaya</th>
              </tr>
            </thead>
            <tbody>
              {kamarList.map((item: any, idx: number) => (
                <tr key={idx}>
                  <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{idx + 1}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.tgl_masuk} {item.jam_masuk}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.tgl_keluar} {item.jam_keluar}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{item.lama} hari</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.kd_kamar}, {item.nm_bangsal}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.stts_pulang}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>
                    {item.ttl_biaya.toLocaleString('id-ID')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Function untuk render Pemberian Obat
  const renderObat = (obatData: any) => {
    if (!obatData) return null;

    const hasPemberianObat = obatData.pemberian_obat && obatData.pemberian_obat.length > 0;
    const hasReturObat = obatData.retur_obat && obatData.retur_obat.length > 0;

    if (!hasPemberianObat && !hasReturObat) return null;

    return (
      <>
        {/* PEMBERIAN OBAT/BHP/ALKES */}
        {hasPemberianObat && (
          <div style={{
            marginTop: '20px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <div style={{
              background: '#ffffff',
              color: '#374151',
              borderBottom: '1px solid #e5e7eb',
              padding: '12px 15px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span style={{ fontSize: '20px' }}>💊</span>
              <span style={{ color: '#28a745' }}>PEMBERIAN OBAT / BHP / ALKES</span>
            </div>

            <div style={{ padding: '15px' }}>
              <table style={{ 
                width: '100%', 
                fontSize: '13px',
                border: '1px solid #ddd',
                borderCollapse: 'collapse'
              }}>
                <thead>
                  <tr style={{ background: '#FFFAF8' }}>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '4%' }}>No.</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '15%' }}>Tanggal</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '10%' }}>Kode</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '35%' }}>Nama Obat/BHP/Alkes</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '10%' }}>Jumlah</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '16%' }}>Aturan Pakai</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '10%' }}>Biaya</th>
                  </tr>
                </thead>
                <tbody>
                  {obatData.pemberian_obat.map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.tgl_perawatan} {item.jam}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.kode_brng}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.nama_brng}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>
                        {item.jml} {item.kode_sat}
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.aturan_pakai || '-'}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>
                        {item.total.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* RETUR OBAT */}
        {hasReturObat && (
          <div style={{
            marginTop: '20px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <div style={{
              background: '#ffffff',
              color: '#374151',
              borderBottom: '1px solid #e5e7eb',
              padding: '12px 15px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span style={{ fontSize: '20px' }}>🔄</span>
              <span style={{ color: '#dc3545' }}>RETUR OBAT</span>
            </div>

            <div style={{ padding: '15px' }}>
              <table style={{ 
                width: '100%', 
                fontSize: '13px',
                border: '1px solid #ddd',
                borderCollapse: 'collapse'
              }}>
                <thead>
                  <tr style={{ background: '#FFFAF8' }}>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '4%' }}>No.</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '10%' }}>Kode</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '66%' }}>Nama Obat/BHP/Alkes</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '10%' }}>Jumlah</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '10%' }}>Biaya</th>
                  </tr>
                </thead>
                <tbody>
                  {obatData.retur_obat.map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.kode_brng}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.nama_brng}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>
                        {item.jumlah} {item.kode_sat}
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>
                        {item.total.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </>
    );
  };

  // Function untuk render Resep Pulang
  const renderResepPulang = (resepList: any[]) => {
    if (!resepList || resepList.length === 0) return null;

    return (
      <div style={{
        marginTop: '20px',
        border: '1px solid #ddd',
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
        <div style={{
          background: '#ffffff',
          color: '#374151',
          borderBottom: '1px solid #e5e7eb',
          padding: '12px 15px',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span style={{ fontSize: '20px' }}>💊</span>
          <span style={{ color: '#6610f2' }}>RESEP PULANG</span>
        </div>

        <div style={{ padding: '15px' }}>
          <table style={{ 
            width: '100%', 
            fontSize: '13px',
            border: '1px solid #ddd',
            borderCollapse: 'collapse'
          }}>
            <thead>
              <tr style={{ background: '#FFFAF8' }}>
                <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '4%' }}>No.</th>
                <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '10%' }}>Kode</th>
                <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '50%' }}>Nama Obat/BHP/Alkes</th>
                <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '16%' }}>Dosis</th>
                <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '10%' }}>Jumlah</th>
                <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '10%' }}>Biaya</th>
              </tr>
            </thead>
            <tbody>
              {resepList.map((item: any, idx: number) => (
                <tr key={idx}>
                  <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{idx + 1}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.kode_brng}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.nama_brng}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.dosis}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>
                    {item.jml_barang} {item.kode_sat}
                  </td>
                  <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>
                    {item.total.toLocaleString('id-ID')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Function untuk render Ringkasan Biaya
  const renderBiaya = (biayaData: any) => {
    if (!biayaData) return null;

    const hasPPNObat = biayaData.ppn_obat && biayaData.ppn_obat > 0;
    const hasTambahanBiaya = biayaData.tambahan_biaya && biayaData.tambahan_biaya.length > 0;
    const hasPotonganBiaya = biayaData.potongan_biaya && biayaData.potongan_biaya.length > 0;

    if (!hasPPNObat && !hasTambahanBiaya && !hasPotonganBiaya) return null;

    return (
      <>
        {/* PPN OBAT */}
        {hasPPNObat && (
          <div style={{
            marginTop: '20px',
            padding: '15px',
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#374151' }}>PPN Obat</span>
              <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#374151' }}>
                Rp {biayaData.ppn_obat.toLocaleString('id-ID')}
              </span>
            </div>
          </div>
        )}

        {/* TAMBAHAN BIAYA */}
        {hasTambahanBiaya && (
          <div style={{
            marginTop: '20px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <div style={{
              background: '#ffffff',
              color: '#374151',
              borderBottom: '1px solid #e5e7eb',
              padding: '12px 15px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span style={{ fontSize: '20px' }}>➕</span>
              <span style={{ color: '#17a2b8' }}>TAMBAHAN BIAYA</span>
            </div>

            <div style={{ padding: '15px' }}>
              <table style={{ 
                width: '100%', 
                fontSize: '13px',
                border: '1px solid #ddd',
                borderCollapse: 'collapse'
              }}>
                <thead>
                  <tr style={{ background: '#FFFAF8' }}>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '4%' }}>No.</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '85%' }}>Nama Tambahan</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '1%' }}></th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '10%' }}>Biaya</th>
                  </tr>
                </thead>
                <tbody>
                  {biayaData.tambahan_biaya.map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.nama_biaya}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}></td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>
                        {item.besar_biaya.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* POTONGAN BIAYA */}
        {hasPotonganBiaya && (
          <div style={{
            marginTop: '20px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <div style={{
              background: '#ffffff',
              color: '#374151',
              borderBottom: '1px solid #e5e7eb',
              padding: '12px 15px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span style={{ fontSize: '20px' }}>➖</span>
              <span style={{ color: '#dc3545' }}>POTONGAN BIAYA</span>
            </div>

            <div style={{ padding: '15px' }}>
              <table style={{ 
                width: '100%', 
                fontSize: '13px',
                border: '1px solid #ddd',
                borderCollapse: 'collapse'
              }}>
                <thead>
                  <tr style={{ background: '#FFFAF8' }}>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '4%' }}>No.</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '85%' }}>Nama Potongan</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '1%' }}></th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '10%' }}>Biaya</th>
                  </tr>
                </thead>
                <tbody>
                  {biayaData.potongan_biaya.map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.nama_pengurangan}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}></td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', color: '#dc3545' }}>
                        {item.besar_pengurangan.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </>
    );
  };

  const renderPemeriksaanRalan = (pemeriksaanList: any[]) => {
    if (!pemeriksaanList || pemeriksaanList.length === 0) return null;

    return (
      <div style={cardStyle}>
        <div style={{ background: '#ffffff', color: '#374151', borderBottom: '1px solid #e5e7eb', padding: '12px 16px' }}>
          <h6 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#0d6efd' }}>📋 Pemeriksaan Rawat Jalan (SOAP)</h6>
        </div>
        <div style={{ padding: 16 }}>
          {pemeriksaanList.map((item: any, index: number) => (
            <div key={index} style={{ marginBottom: 16 }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                  <tbody>
                    <tr style={{ background: '#f3f4f6' }}>
                      <td style={{ ...tdStyle, width: '5%', textAlign: 'center', fontWeight: 600 }}>No.</td>
                      <td style={{ ...tdStyle, width: '15%', fontWeight: 600 }}>Tanggal</td>
                      <td colSpan={7} style={{ ...tdStyle, width: '53%', fontWeight: 600 }}>
                        Dokter/Paramedis
                      </td>
                      <td colSpan={3} style={{ ...tdStyle, width: '27%', fontWeight: 600 }}>
                        Profesi/Jabatan/Departemen
                      </td>
                    </tr>
                    <tr>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{index + 1}</td>
                      <td style={tdStyle}>
                        {item.tgl_perawatan} {item.jam_rawat}
                      </td>
                      <td colSpan={7} style={tdStyle}>
                        {item.nip} - {item.nama}
                      </td>
                      <td colSpan={3} style={tdStyle}>
                        {item.jbtn}
                      </td>
                    </tr>
                    {item.keluhan && (
                      <tr>
                        <td colSpan={2} style={tdStyle}></td>
                        <td colSpan={2} style={{ ...tdStyle, fontWeight: 600 }}>
                          Subjek
                        </td>
                        <td colSpan={8} style={tdStyle}>
                          {renderNewlines(item.keluhan)}
                        </td>
                      </tr>
                    )}
                    {item.pemeriksaan && (
                      <tr>
                        <td colSpan={2} style={tdStyle}></td>
                        <td colSpan={2} style={{ ...tdStyle, fontWeight: 600 }}>
                          Objek
                        </td>
                        <td colSpan={8} style={tdStyle}>
                          {renderNewlines(item.pemeriksaan)}
                        </td>
                      </tr>
                    )}
                    <tr style={{ background: '#f3f4f6' }}>
                      <td colSpan={2} style={tdStyle}></td>
                      <td style={{ ...tdStyle, width: '8%', textAlign: 'center', fontWeight: 600 }}>
                        Suhu(C)
                      </td>
                      <td style={{ ...tdStyle, width: '8%', textAlign: 'center', fontWeight: 600 }}>Tensi</td>
                      <td style={{ ...tdStyle, width: '8%', textAlign: 'center', fontWeight: 600 }}>
                        Nadi(/mnt)
                      </td>
                      <td style={{ ...tdStyle, width: '8%', textAlign: 'center', fontWeight: 600 }}>
                        Resp(/mnt)
                      </td>
                      <td style={{ ...tdStyle, width: '8%', textAlign: 'center', fontWeight: 600 }}>
                        Tinggi(Cm)
                      </td>
                      <td style={{ ...tdStyle, width: '8%', textAlign: 'center', fontWeight: 600 }}>
                        Berat(Kg)
                      </td>
                      <td style={{ ...tdStyle, width: '8%', textAlign: 'center', fontWeight: 600 }}>
                        SpO2(%)
                      </td>
                      <td style={{ ...tdStyle, width: '8%', textAlign: 'center', fontWeight: 600 }}>
                        GCS(E,V,M)
                      </td>
                      <td style={{ ...tdStyle, width: '8%', textAlign: 'center', fontWeight: 600 }}>
                        Kesadaran
                      </td>
                      <td style={{ ...tdStyle, width: '8%', textAlign: 'center', fontWeight: 600 }}>
                        L.P.(Cm)
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={2} style={tdStyle}></td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{item.suhu_tubuh}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{item.tensi}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{item.nadi}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{item.respirasi}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{item.tinggi}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{item.berat}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{item.spo2}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{item.gcs}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{item.kesadaran}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{item.lingkar_perut}</td>
                    </tr>
                    {item.alergi && (
                      <tr>
                        <td colSpan={2} style={tdStyle}></td>
                        <td colSpan={2} style={{ ...tdStyle, fontWeight: 600 }}>
                          Alergi
                        </td>
                        <td colSpan={8} style={tdStyle}>
                          : {item.alergi}
                        </td>
                      </tr>
                    )}
                    {item.penilaian && (
                      <tr>
                        <td colSpan={2} style={tdStyle}></td>
                        <td colSpan={2} style={{ ...tdStyle, fontWeight: 600 }}>
                          Asesmen
                        </td>
                        <td colSpan={8} style={tdStyle}>
                          : {renderNewlines(item.penilaian)}
                        </td>
                      </tr>
                    )}
                    {item.rtl && (
                      <tr>
                        <td colSpan={2} style={tdStyle}></td>
                        <td colSpan={2} style={{ ...tdStyle, fontWeight: 600 }}>
                          Plan
                        </td>
                        <td colSpan={8} style={tdStyle}>
                          : {renderNewlines(item.rtl)}
                        </td>
                      </tr>
                    )}
                    {item.instruksi && (
                      <tr>
                        <td colSpan={2} style={tdStyle}></td>
                        <td colSpan={2} style={{ ...tdStyle, fontWeight: 600 }}>
                          Inst/Impl
                        </td>
                        <td colSpan={8} style={tdStyle}>
                          : {renderNewlines(item.instruksi)}
                        </td>
                      </tr>
                    )}
                    {item.evaluasi && (
                      <tr>
                        <td colSpan={2} style={{ ...tdStyle, borderBottom: 'none' }}></td>
                        <td colSpan={2} style={{ ...tdStyle, fontWeight: 600, borderBottom: 'none' }}>
                          Evaluasi
                        </td>
                        <td colSpan={8} style={{ ...tdStyle, borderBottom: 'none' }}>
                          : {renderNewlines(item.evaluasi)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {index < pemeriksaanList.length - 1 && (
                <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid #e5e7eb' }} />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Function to render Asuhan Medis IGD
  const renderAsuhanMedisIGD = (asuhanList: any[]) => {
    if (!asuhanList || asuhanList.length === 0) return null;

    return (
      <div style={cardStyle}>
        <div style={{ background: '#ffffff', color: '#374151', borderBottom: '1px solid #e5e7eb', padding: '12px 16px' }}>
          <h6 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#0d6efd' }}>🚑 AWAL MEDIS IGD</h6>
        </div>
        <div style={{ padding: 16 }}>
          {asuhanList.map((item: any, index: number) => (
            <div key={index} style={{ marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
                <div>
                  <strong>Tanggal:</strong> {item.tanggal}
                </div>
                <div>
                  <strong>Dokter:</strong> {item.kd_dokter} - {item.nm_dokter}
                </div>
                <div>
                  <strong>Anamnesis:</strong> {item.anamnesis}
                  {item.hubungan ? ', ' + item.hubungan : ''}
                </div>
              </div>
              <div
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 12
                }}
              >
                <h6 style={{ color: '#0d6efd', marginBottom: 12, fontSize: 14 }}>I. RIWAYAT KESEHATAN</h6>
                <div style={{ marginBottom: 8 }}>
                  <strong>Keluhan Utama:</strong>
                  <br />
                  {renderNewlines(item.keluhan_utama)}
                </div>
                <div style={{ marginBottom: 8 }}>
                  <strong>Riwayat Penyakit Sekarang:</strong>
                  <br />
                  {renderNewlines(item.rps)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                  <div>
                    <strong>Riwayat Penyakit Dahulu:</strong>
                    <br />
                    {renderNewlines(item.rpd)}
                  </div>
                  <div>
                    <strong>Riwayat Alergi:</strong>
                    <br />
                    {item.alergi}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginTop: 8 }}>
                  <div>
                    <strong>Riwayat Penyakit Keluarga:</strong>
                    <br />
                    {renderNewlines(item.rpk)}
                  </div>
                  <div>
                    <strong>Riwayat Penggunaan Obat:</strong>
                    <br />
                    {renderNewlines(item.rpo)}
                  </div>
                </div>
              </div>
              <div
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 12
                }}
              >
                <h6 style={{ color: '#0d6efd', marginBottom: 12, fontSize: 14 }}>II. PEMERIKSAAN FISIK</h6>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 8 }}>
                  <div>
                    <strong>Keadaan Umum:</strong> {item.keadaan}
                  </div>
                  <div>
                    <strong>Kesadaran:</strong> {item.kesadaran}
                  </div>
                  <div>
                    <strong>GCS(E,V,M):</strong> {item.gcs}
                  </div>
                  <div>
                    <strong>TB:</strong> {item.tb} cm
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 8 }}>
                  <div>
                    <strong>BB:</strong> {item.bb} kg
                  </div>
                  <div>
                    <strong>TD:</strong> {item.td} mmHg
                  </div>
                  <div>
                    <strong>Nadi:</strong> {item.nadi} x/menit
                  </div>
                  <div>
                    <strong>RR:</strong> {item.rr} x/menit
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 8 }}>
                  <div>
                    <strong>Suhu:</strong> {item.suhu} °C
                  </div>
                  <div>
                    <strong>SpO2:</strong> {item.spo} %
                  </div>
                  <div>
                    <strong>Kepala:</strong> {item.kepala}
                  </div>
                  <div>
                    <strong>Mata:</strong> {item.mata}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 8 }}>
                  <div>
                    <strong>Gigi & Mulut:</strong> {item.gigi}
                  </div>
                  <div>
                    <strong>Leher:</strong> {item.leher}
                  </div>
                  <div>
                    <strong>Thoraks:</strong> {item.thoraks}
                  </div>
                  <div>
                    <strong>Abdomen:</strong> {item.abdomen}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  <div>
                    <strong>Genital & Anus:</strong> {item.genital}
                  </div>
                  <div>
                    <strong>Ekstremitas:</strong> {item.ekstremitas}
                  </div>
                  <div>
                    <strong>Keterangan Fisik:</strong> {item.ket_fisik}
                  </div>
                </div>
              </div>
              <div
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 12
                }}
              >
                <h6 style={{ color: '#0d6efd', marginBottom: 12, fontSize: 14 }}>III. STATUS LOKALIS</h6>
                <div style={{ textAlign: 'center', marginBottom: 12 }}>
                  <img
                    src="/asuhan-medis-igd/semua.png"
                    alt="Gambar Lokalis"
                    style={{ maxWidth: '600px', width: '100%', height: 'auto' }}
                    onError={handleImageError}
                  />
                </div>
                <div>
                  <strong>Keterangan:</strong>
                  <br />
                  {renderNewlines(item.ket_lokalis)}
                </div>
              </div>
              <div
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 12
                }}
              >
                <h6 style={{ color: '#0d6efd', marginBottom: 12, fontSize: 14 }}>IV. PEMERIKSAAN PENUNJANG</h6>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  <div>
                    <strong>EKG:</strong>
                    <br />
                    {renderNewlines(item.ekg)}
                  </div>
                  <div>
                    <strong>Radiologi:</strong>
                    <br />
                    {renderNewlines(item.rad)}
                  </div>
                  <div>
                    <strong>Laborat:</strong>
                    <br />
                    {renderNewlines(item.lab)}
                  </div>
                </div>
              </div>
              <div
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 12
                }}
              >
                <h6 style={{ color: '#0d6efd', marginBottom: 12, fontSize: 14 }}>V. DIAGNOSIS/ASESMEN</h6>
                <div>{renderNewlines(item.diagnosis)}</div>
              </div>
              <div
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 12
                }}
              >
                <h6 style={{ color: '#0d6efd', marginBottom: 12, fontSize: 14 }}>VI. TATALAKSANA</h6>
                <div>{renderNewlines(item.tata)}</div>
              </div>
              {index < asuhanList.length - 1 && (
                <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid #e5e7eb' }} />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        overflowY: 'auto',
        padding: '20px 0'
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 16,
          width: '95%',
          maxWidth: 1400,
          maxHeight: '95vh',
          overflow: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
          margin: '20px auto'
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            background: '#ffffff',
            padding: '20px 24px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 10
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#111827' }}>
            Detail Riwayat Perawatan
          </h2>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid #17a2b8',
              background: '#17a2b8',
              color: '#ffffff',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500
            }}
          >
            Tutup
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: 24 }}>
          {/* Loading State */}
          {loading && (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <div
                style={{
                  display: 'inline-block',
                  width: 50,
                  height: 50,
                  border: '5px solid #f3f4f6',
                  borderTop: '5px solid #1AB1E5',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}
              ></div>
              <p style={{ marginTop: 20, color: '#6b7280', fontSize: 14 }}>Memuat riwayat perawatan...</p>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div
              style={{
                padding: 20,
                background: '#fee2e2',
                border: '1px solid #fca5a5',
                borderRadius: 8,
                color: '#991b1b',
                textAlign: 'center'
              }}
            >
              <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Gagal Memuat Data</div>
              <div style={{ fontSize: 13 }}>{error}</div>
            </div>
          )}

          {/* Content - only show when data is loaded */}
          {!loading && !error && (legacy || triase || asuhanMedis.length > 0 || asuhanKeperawatanIGD || pemeriksaanRalan.length > 0 || pemeriksaanRanap.length > 0 || laboratorium || radiologi || tindakanRalan || tindakanRanap || kamarInap.length > 0 || obat || resepPulang.length > 0) && (
            <div className="riwayat-legacy-card">
            {/* Tampilkan Triase IGD jika ada */}
            {triase && (triase.triase_primer || triase.triase_sekunder) && (
              <>
                {renderTriasePrimer(triase.triase_primer)}
                {renderTriaseSekunder(triase.triase_sekunder)}
              </>
            )}
            
            {/* Tampilkan Asuhan Medis IGD jika ada */}
            {asuhanMedis && asuhanMedis.length > 0 && renderAsuhanMedisIGD(asuhanMedis)}
            
            {/* Tampilkan Asuhan Keperawatan IGD jika ada */}
            {asuhanKeperawatanIGD && renderAsuhanKeperawatanIGD(asuhanKeperawatanIGD)}
            
            {/* Tampilkan Pemeriksaan Rawat Jalan (SOAP) jika ada */}
            {pemeriksaanRalan && pemeriksaanRalan.length > 0 && renderPemeriksaanRalan(pemeriksaanRalan)}
            
            {/* Tampilkan Pemeriksaan Rawat Inap (SOAP) jika ada */}
            {pemeriksaanRanap && pemeriksaanRanap.length > 0 && renderPemeriksaanRanap(pemeriksaanRanap)}
            
            {/* Tampilkan Laboratorium jika ada */}
            {laboratorium && renderLaboratorium(laboratorium)}
            
            {/* Tampilkan Radiologi jika ada */}
            {radiologi && renderRadiologi(radiologi)}
            
            {/* Tampilkan Tindakan Rawat Jalan jika ada */}
            {tindakanRalan && renderTindakanRalan(tindakanRalan)}
            
            {/* Tampilkan Tindakan Rawat Inap jika ada */}
            {tindakanRanap && renderTindakanRanap(tindakanRanap)}
            
            {/* Tampilkan Kamar Inap jika ada */}
            {kamarInap && kamarInap.length > 0 && renderKamarInap(kamarInap)}
            
            {/* Tampilkan Pemberian Obat jika ada */}
            {obat && renderObat(obat)}
            
            {/* Tampilkan Resep Pulang jika ada */}
            {resepPulang && resepPulang.length > 0 && renderResepPulang(resepPulang)}
            
            {/* Tampilkan Ringkasan Biaya */}
            {biaya && renderBiaya(biaya)}
            
            {/* Tampilkan List 5 Perawatan Terakhir (Selalu Tampil) */}
            {riwayatPerawatanList.length > 0 && (
              <div style={{ marginTop: 24 }}>
                {riwayatPerawatanList.map((perawatan: any, index: number) => {
                  return (
                    <div key={perawatan.no_rawat} style={{ marginBottom: 24 }}>
                      {/* Content Perawatan - Langsung Tampil */}
                      <div
                        style={{
                          marginTop: 8,
                          padding: 20,
                          background: '#ffffff',
                          border: '2px solid #1AB1E5',
                          borderRadius: '8px',
                          boxShadow: '0 2px 4px rgba(26, 177, 229, 0.1)',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.boxShadow = '0 4px 8px rgba(26, 177, 229, 0.2)';
                          e.currentTarget.style.borderColor = '#0891B2';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.boxShadow = '0 2px 4px rgba(26, 177, 229, 0.1)';
                          e.currentTarget.style.borderColor = '#1AB1E5';
                        }}
                      >
                        {/* Info Perawatan */}
                        <div style={{ marginBottom: 20, padding: 16, background: '#e0f2fe', borderRadius: 8, borderBottom: '1px solid #1AB1E5' }}>
                          <table style={tableStyle}>
                            <tbody>
                              <tr>
                                <td style={{ ...tdStyle, width: '30%', fontWeight: 600 }}>No. Rawat</td>
                                <td style={tdStyle}>{perawatan.no_rawat}</td>
                              </tr>
                              <tr>
                                <td style={{ ...tdStyle, fontWeight: 600 }}>Tanggal Kunjungan</td>
                                <td style={tdStyle}>{perawatan.tgl_registrasi} {perawatan.jam_reg}</td>
                              </tr>
                              <tr>
                                <td style={{ ...tdStyle, fontWeight: 600 }}>Poliklinik</td>
                                <td style={tdStyle}>{perawatan.nm_poli || '-'}</td>
                              </tr>
                              <tr>
                                <td style={{ ...tdStyle, fontWeight: 600 }}>Dokter</td>
                                <td style={tdStyle}>{perawatan.nm_dokter || '-'}</td>
                              </tr>
                              <tr>
                                <td style={{ ...tdStyle, fontWeight: 600 }}>Status Lanjut</td>
                                <td style={tdStyle}>{perawatan.status_lanjut || '-'}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        {/* Detail Perawatan - Langsung Tampil */}
                          {(() => {
                            const detail = detailPerPerawatan.get(perawatan.no_rawat);
                            if (!detail) {
                              return (
                                <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
                                  <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
                                  <div>Memuat detail perawatan...</div>
                                </div>
                              );
                            }
                            return (
                              <>
                                {/* Tampilkan Triase IGD jika ada */}
                                {detail.triase && (detail.triase.triase_primer || detail.triase.triase_sekunder) && (
                                  <>
                                    {renderTriasePrimer(detail.triase.triase_primer)}
                                    {renderTriaseSekunder(detail.triase.triase_sekunder)}
                                  </>
                                )}
                                
                                {/* Tampilkan Asuhan Medis IGD jika ada */}
                                {detail.asuhanMedis && detail.asuhanMedis.length > 0 && renderAsuhanMedisIGD(detail.asuhanMedis)}
                                
                                {/* Tampilkan Asuhan Keperawatan IGD jika ada */}
                                {detail.asuhanKeperawatanIGD && renderAsuhanKeperawatanIGD(detail.asuhanKeperawatanIGD)}
                                
                                {/* Tampilkan Pemeriksaan Rawat Jalan (SOAP) jika ada */}
                                {detail.pemeriksaanRalan && detail.pemeriksaanRalan.length > 0 && renderPemeriksaanRalan(detail.pemeriksaanRalan)}
                                
                                {/* Tampilkan Pemeriksaan Rawat Inap (SOAP) jika ada */}
                                {detail.pemeriksaanRanap && detail.pemeriksaanRanap.length > 0 && renderPemeriksaanRanap(detail.pemeriksaanRanap)}
                                
                                {/* Tampilkan Laboratorium jika ada */}
                                {detail.laboratorium && renderLaboratorium(detail.laboratorium)}
                                
                                {/* Tampilkan Radiologi jika ada */}
                                {detail.radiologi && renderRadiologi(detail.radiologi)}
                                
                                {/* Tampilkan Tindakan Rawat Jalan jika ada */}
                                {detail.tindakanRalan && renderTindakanRalan(detail.tindakanRalan)}
                                
                                {/* Tampilkan Tindakan Rawat Inap jika ada */}
                                {detail.tindakanRanap && renderTindakanRanap(detail.tindakanRanap)}
                                
                                {/* Tampilkan Kamar Inap jika ada */}
                                {detail.kamarInap && detail.kamarInap.length > 0 && renderKamarInap(detail.kamarInap)}
                                
                                {/* Tampilkan Pemberian Obat jika ada */}
                                {detail.obat && renderObat(detail.obat)}
                                
                                {/* Tampilkan Resep Pulang jika ada */}
                                {detail.resepPulang && detail.resepPulang.length > 0 && renderResepPulang(detail.resepPulang)}
                                
                                {/* Tampilkan Ringkasan Biaya */}
                                {detail.biaya && renderBiaya(detail.biaya)}
                              </>
                            );
                          })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            {/* Check if data is array (list of visits) - Legacy mode */}
            {riwayatPerawatanList.length === 0 && Array.isArray(legacy) && legacy.length > 0 ? (
              <div>
                <h5 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: '#374151' }}>
                  📋 Riwayat Kunjungan Pasien ({legacy.length} kunjungan)
                </h5>
                {legacy.map((visit: any, index: number) => (
                  <div key={index} style={cardStyle}>
                    <div style={{ background: '#ffffff', color: '#374151', borderBottom: '1px solid #e5e7eb', padding: '12px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h6 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
                          🏥 Kunjungan #{index + 1} - {visit.tgl_registrasi} {visit.jam_reg}
                        </h6>
                        <span style={{
                          background: visit.stts === 'Sudah' ? '#10b981' : '#f59e0b',
                          padding: '4px 12px',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600
                        }}>
                          {visit.stts === 'Sudah' ? 'Sudah Periksa' : 'Belum Periksa'}
                        </span>
                      </div>
                    </div>
                    <div style={{ padding: 16 }}>
                      <table style={tableStyle}>
                        <tbody>
                          <tr>
                            <td style={{ ...tdStyle, width: '30%', fontWeight: 600 }}>No. Rawat</td>
                            <td style={tdStyle}>{visit.no_rawat}</td>
                          </tr>
                          <tr>
                            <td style={{ ...tdStyle, fontWeight: 600 }}>Tanggal & Jam</td>
                            <td style={tdStyle}>{visit.tgl_registrasi} • {visit.jam_reg}</td>
                          </tr>
                          <tr>
                            <td style={{ ...tdStyle, fontWeight: 600 }}>Poliklinik</td>
                            <td style={tdStyle}>{visit.nm_poli}</td>
                          </tr>
                          <tr>
                            <td style={{ ...tdStyle, fontWeight: 600 }}>Dokter</td>
                            <td style={tdStyle}>{visit.nm_dokter}</td>
                          </tr>
                          <tr>
                            <td style={{ ...tdStyle, fontWeight: 600 }}>Status Lanjut</td>
                            <td style={tdStyle}>{visit.status_lanjut}</td>
                          </tr>
                          <tr>
                            <td style={{ ...tdStyle, fontWeight: 600 }}>Cara Bayar</td>
                            <td style={tdStyle}>{visit.png_jawab}</td>
                          </tr>
                          {visit.diagnosa && (
                            <tr>
                              <td style={{ ...tdStyle, fontWeight: 600 }}>Diagnosa</td>
                              <td style={tdStyle}>{visit.diagnosa}</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            ) : legacy && typeof legacy === 'object' && !Array.isArray(legacy) ? (
              /* Original detailed view for object-based data */
              <div>
            {/* Triase IGD Primer - Old structure, now handled by new endpoint */}
            {legacy.triase_primer && false && (
              <div style={cardStyle}>
                <div style={{ background: '#ffffff', color: '#374151', borderBottom: '1px solid #e5e7eb', padding: '12px 16px' }}>
                  <h6 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
                    🚨 Triase Gawat Darurat - Primer (Zona Merah)
                  </h6>
                </div>
                <div style={{ padding: 16 }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={tableStyle}>
                      <tbody>
                        <tr>
                          <td style={{ ...tdStyle, width: '30%', fontWeight: 600 }}>Cara Masuk</td>
                          <td style={tdStyle}>{legacy.triase_primer.cara_masuk}</td>
                        </tr>
                        <tr>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>Transportasi</td>
                          <td style={tdStyle}>{legacy.triase_primer.alat_transportasi}</td>
                        </tr>
                        <tr>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>Alasan Kedatangan</td>
                          <td style={tdStyle}>{legacy.triase_primer.alasan_kedatangan}</td>
                        </tr>
                        <tr>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>Keterangan Kedatangan</td>
                          <td style={tdStyle}>{legacy.triase_primer.keterangan_kedatangan}</td>
                        </tr>
                        <tr>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>Macam Kasus</td>
                          <td style={tdStyle}>{legacy.triase_primer.macam_kasus}</td>
                        </tr>
                        <tr>
                          <td
                            colSpan={2}
                            style={{ ...tdStyle, background: '#f3f4f6', textAlign: 'center', fontWeight: 600 }}
                          >
                            Triase Primer
                          </td>
                        </tr>
                        <tr>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>Keluhan Utama</td>
                          <td style={tdStyle}>{renderNewlines(legacy.triase_primer.keluhan_utama)}</td>
                        </tr>
                        <tr>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>Tanda Vital</td>
                          <td style={tdStyle}>
                            Suhu (C): {legacy.triase_primer.suhu}, Nyeri: {legacy.triase_primer.nyeri}, Tensi:{' '}
                            {legacy.triase_primer.tekanan_darah}, Nadi(/menit): {legacy.triase_primer.nadi}, Saturasi
                            O²(%): {legacy.triase_primer.saturasi_o2}, Respirasi(/menit):{' '}
                            {legacy.triase_primer.pernapasan}
                          </td>
                        </tr>
                        <tr>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>Kebutuhan Khusus</td>
                          <td style={tdStyle}>{legacy.triase_primer.kebutuhan_khusus}</td>
                        </tr>
                        {/* Skala 1 - Immediate/Segera */}
                        {legacy.triase_primer.skala1 && legacy.triase_primer.skala1.length > 0 && (
                          <>
                            <tr>
                              <td style={{ ...tdStyle, background: '#f3f4f6', textAlign: 'center', fontWeight: 600 }}>
                                Pemeriksaan
                              </td>
                              <td
                                style={{
                                  ...tdStyle,
                                  textAlign: 'center',
                                  background: '#AA0000',
                                  color: 'white',
                                  fontWeight: 600
                                }}
                              >
                                Immediate/Segera
                              </td>
                            </tr>
                            {legacy.triase_primer.skala1.map((pemeriksaan: any, pIndex: number) => (
                              <tr key={`s1-${pIndex}`}>
                                <td style={tdStyle}>{pemeriksaan.nama_pemeriksaan}</td>
                                <td style={{ ...tdStyle, background: '#AA0000', color: 'white' }}>
                                  {pemeriksaan.details?.map((detail: any, dIndex: number) => (
                                    <div key={`s1d-${dIndex}`}>• {detail.pengkajian_skala1}</div>
                                  ))}
                                </td>
                              </tr>
                            ))}
                          </>
                        )}
                        {/* Skala 2 - Emergensi */}
                        {legacy.triase_primer.skala2 && legacy.triase_primer.skala2.length > 0 && (
                          <>
                            <tr>
                              <td style={{ ...tdStyle, background: '#f3f4f6', textAlign: 'center', fontWeight: 600 }}>
                                Pemeriksaan
                              </td>
                              <td
                                style={{
                                  ...tdStyle,
                                  textAlign: 'center',
                                  background: '#FF0000',
                                  color: 'white',
                                  fontWeight: 600
                                }}
                              >
                                Emergensi
                              </td>
                            </tr>
                            {legacy.triase_primer.skala2.map((pemeriksaan: any, pIndex: number) => (
                              <tr key={`s2-${pIndex}`}>
                                <td style={tdStyle}>{pemeriksaan.nama_pemeriksaan}</td>
                                <td style={{ ...tdStyle, background: '#FF0000', color: 'white' }}>
                                  {pemeriksaan.details?.map((detail: any, dIndex: number) => (
                                    <div key={`s2d-${dIndex}`}>• {detail.pengkajian_skala2}</div>
                                  ))}
                                </td>
                              </tr>
                            ))}
                          </>
                        )}
                        <tr>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>Plan/Keputusan</td>
                          <td style={{ ...tdStyle, background: getTriaseColor(legacy.triase_primer), color: 'white' }}>
                            Zona Merah {legacy.triase_primer.plan}
                          </td>
                        </tr>
                        <tr>
                          <td
                            colSpan={2}
                            style={{ ...tdStyle, background: '#f3f4f6', textAlign: 'center', fontWeight: 600 }}
                          >
                            Petugas Triase Primer
                          </td>
                        </tr>
                        <tr>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>Tanggal & Jam</td>
                          <td style={tdStyle}>{legacy.triase_primer.tanggaltriase}</td>
                        </tr>
                        <tr>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>Catatan</td>
                          <td style={tdStyle}>{legacy.triase_primer.catatan}</td>
                        </tr>
                        <tr>
                          <td style={{ ...tdStyle, fontWeight: 600, borderBottom: 'none' }}>Dokter/Petugas IGD</td>
                          <td style={{ ...tdStyle, borderBottom: 'none' }}>
                            {legacy.triase_primer.nik} - {legacy.triase_primer.nama}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Triase IGD Sekunder - Old structure, now handled by new endpoint */}
            {legacy.triase_sekunder && false && (
              <div style={cardStyle}>
                <div style={{ background: '#ffffff', color: '#374151', borderBottom: '1px solid #e5e7eb', padding: '12px 16px' }}>
                  <h6 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#C8C800' }}>🚨 Triase Gawat Darurat - Sekunder</h6>
                </div>
                <div style={{ padding: 16 }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={tableStyle}>
                      <tbody>
                        <tr>
                          <td style={{ ...tdStyle, width: '30%', fontWeight: 600 }}>Cara Masuk</td>
                          <td style={tdStyle}>{legacy.triase_sekunder.cara_masuk}</td>
                        </tr>
                        <tr>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>Transportasi</td>
                          <td style={tdStyle}>{legacy.triase_sekunder.alat_transportasi}</td>
                        </tr>
                        <tr>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>Alasan Kedatangan</td>
                          <td style={tdStyle}>{legacy.triase_sekunder.alasan_kedatangan}</td>
                        </tr>
                        <tr>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>Keterangan Kedatangan</td>
                          <td style={tdStyle}>{legacy.triase_sekunder.keterangan_kedatangan}</td>
                        </tr>
                        <tr>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>Macam Kasus</td>
                          <td style={tdStyle}>{legacy.triase_sekunder.macam_kasus}</td>
                        </tr>
                        <tr>
                          <td
                            colSpan={2}
                            style={{ ...tdStyle, background: '#f3f4f6', textAlign: 'center', fontWeight: 600 }}
                          >
                            Triase Sekunder
                          </td>
                        </tr>
                        <tr>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>Anamnesa Singkat</td>
                          <td style={tdStyle}>{renderNewlines(legacy.triase_sekunder.anamnesa_singkat)}</td>
                        </tr>
                        <tr>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>Tanda Vital</td>
                          <td style={tdStyle}>
                            Suhu (C): {legacy.triase_sekunder.suhu}, Nyeri: {legacy.triase_sekunder.nyeri}, Tensi:{' '}
                            {legacy.triase_sekunder.tekanan_darah}, Nadi(/menit): {legacy.triase_sekunder.nadi},
                            Saturasi O²(%): {legacy.triase_sekunder.saturasi_o2}, Respirasi(/menit):{' '}
                            {legacy.triase_sekunder.pernapasan}
                          </td>
                        </tr>
                        {/* Skala 3 - Urgensi */}
                        {legacy.triase_sekunder.skala3 && legacy.triase_sekunder.skala3.length > 0 && (
                          <>
                            <tr>
                              <td style={{ ...tdStyle, background: '#f3f4f6', textAlign: 'center', fontWeight: 600 }}>
                                Pemeriksaan
                              </td>
                              <td
                                style={{
                                  ...tdStyle,
                                  textAlign: 'center',
                                  background: '#C8C800',
                                  color: 'white',
                                  fontWeight: 600
                                }}
                              >
                                Urgensi
                              </td>
                            </tr>
                            {legacy.triase_sekunder.skala3.map((pemeriksaan: any, pIndex: number) => (
                              <tr key={`s3-${pIndex}`}>
                                <td style={tdStyle}>{pemeriksaan.nama_pemeriksaan}</td>
                                <td style={{ ...tdStyle, background: '#C8C800', color: 'white' }}>
                                  {pemeriksaan.details?.map((detail: any, dIndex: number) => (
                                    <div key={`s3d-${dIndex}`}>• {detail.pengkajian_skala3}</div>
                                  ))}
                                </td>
                              </tr>
                            ))}
                          </>
                        )}
                        {/* Skala 4 - Semi Urgensi */}
                        {legacy.triase_sekunder.skala4 && legacy.triase_sekunder.skala4.length > 0 && (
                          <>
                            <tr>
                              <td style={{ ...tdStyle, background: '#f3f4f6', textAlign: 'center', fontWeight: 600 }}>
                                Pemeriksaan
                              </td>
                              <td
                                style={{
                                  ...tdStyle,
                                  textAlign: 'center',
                                  background: '#00AA00',
                                  color: 'white',
                                  fontWeight: 600
                                }}
                              >
                                Semi Urgensi/Urgensi Rendah
                              </td>
                            </tr>
                            {legacy.triase_sekunder.skala4.map((pemeriksaan: any, pIndex: number) => (
                              <tr key={`s4-${pIndex}`}>
                                <td style={tdStyle}>{pemeriksaan.nama_pemeriksaan}</td>
                                <td style={{ ...tdStyle, background: '#00AA00', color: 'white' }}>
                                  {pemeriksaan.details?.map((detail: any, dIndex: number) => (
                                    <div key={`s4d-${dIndex}`}>• {detail.pengkajian_skala4}</div>
                                  ))}
                                </td>
                              </tr>
                            ))}
                          </>
                        )}
                        {/* Skala 5 - Non Urgensi */}
                        {legacy.triase_sekunder.skala5 && legacy.triase_sekunder.skala5.length > 0 && (
                          <>
                            <tr>
                              <td style={{ ...tdStyle, background: '#f3f4f6', textAlign: 'center', fontWeight: 600 }}>
                                Pemeriksaan
                              </td>
                              <td
                                style={{
                                  ...tdStyle,
                                  textAlign: 'center',
                                  background: '#969696',
                                  color: 'white',
                                  fontWeight: 600
                                }}
                              >
                                Non Urgensi
                              </td>
                            </tr>
                            {legacy.triase_sekunder.skala5.map((pemeriksaan: any, pIndex: number) => (
                              <tr key={`s5-${pIndex}`}>
                                <td style={tdStyle}>{pemeriksaan.nama_pemeriksaan}</td>
                                <td style={{ ...tdStyle, background: '#969696', color: 'white' }}>
                                  {pemeriksaan.details?.map((detail: any, dIndex: number) => (
                                    <div key={`s5d-${dIndex}`}>• {detail.pengkajian_skala5}</div>
                                  ))}
                                </td>
                              </tr>
                            ))}
                          </>
                        )}
                        <tr>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>Plan/Keputusan</td>
                          <td
                            style={{ ...tdStyle, background: getTriaseColor(legacy.triase_sekunder), color: 'white' }}
                          >
                            {legacy.triase_sekunder.plan}
                          </td>
                        </tr>
                        <tr>
                          <td
                            colSpan={2}
                            style={{ ...tdStyle, background: '#f3f4f6', textAlign: 'center', fontWeight: 600 }}
                          >
                            Petugas Triase Sekunder
                          </td>
                        </tr>
                        <tr>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>Tanggal & Jam</td>
                          <td style={tdStyle}>{legacy.triase_sekunder.tanggaltriase}</td>
                        </tr>
                        <tr>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>Catatan</td>
                          <td style={tdStyle}>{legacy.triase_sekunder.catatan}</td>
                        </tr>
                        <tr>
                          <td style={{ ...tdStyle, fontWeight: 600, borderBottom: 'none' }}>Dokter/Petugas IGD</td>
                          <td style={{ ...tdStyle, borderBottom: 'none' }}>
                            {legacy.triase_sekunder.nik} - {legacy.triase_sekunder.nama}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Asuhan Medis IGD */}
            {legacy.asuhan_medis_igd && legacy.asuhan_medis_igd.length > 0 && (
              <div style={cardStyle}>
                <div style={{ background: '#ffffff', color: '#374151', borderBottom: '1px solid #e5e7eb', padding: '12px 16px' }}>
                  <h6 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#0d6efd' }}>🚑 Pengkajian Awal Medis IGD</h6>
                </div>
                <div style={{ padding: 16 }}>
                  {legacy.asuhan_medis_igd.map((item: any, index: number) => (
                    <div key={index} style={{ marginBottom: 16 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
                        <div>
                          <strong>Tanggal:</strong> {item.tanggal}
                        </div>
                        <div>
                          <strong>Dokter:</strong> {item.kd_dokter} - {item.nm_dokter}
                        </div>
                        <div>
                          <strong>Anamnesis:</strong> {item.anamnesis}
                          {item.hubungan ? ', ' + item.hubungan : ''}
                        </div>
                      </div>
                      <div
                        style={{
                          border: '1px solid #e5e7eb',
                          borderRadius: 8,
                          padding: 12,
                          marginBottom: 12
                        }}
                      >
                        <h6 style={{ color: '#0d6efd', marginBottom: 12, fontSize: 14 }}>I. RIWAYAT KESEHATAN</h6>
                        <div style={{ marginBottom: 8 }}>
                          <strong>Keluhan Utama:</strong>
                          <br />
                          {item.keluhan_utama}
                        </div>
                        <div style={{ marginBottom: 8 }}>
                          <strong>Riwayat Penyakit Sekarang:</strong>
                          <br />
                          {item.rps}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                          <div>
                            <strong>Riwayat Penyakit Dahulu:</strong>
                            <br />
                            {item.rpd}
                          </div>
                          <div>
                            <strong>Riwayat Alergi:</strong>
                            <br />
                            {item.alergi}
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginTop: 8 }}>
                          <div>
                            <strong>Riwayat Penyakit Keluarga:</strong>
                            <br />
                            {item.rpk}
                          </div>
                          <div>
                            <strong>Riwayat Penggunaan Obat:</strong>
                            <br />
                            {item.rpo}
                          </div>
                        </div>
                      </div>
                      <div
                        style={{
                          border: '1px solid #e5e7eb',
                          borderRadius: 8,
                          padding: 12,
                          marginBottom: 12
                        }}
                      >
                        <h6 style={{ color: '#0d6efd', marginBottom: 12, fontSize: 14 }}>II. PEMERIKSAAN FISIK</h6>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 8 }}>
                          <div>
                            <strong>Keadaan Umum:</strong> {item.keadaan}
                          </div>
                          <div>
                            <strong>Kesadaran:</strong> {item.kesadaran}
                          </div>
                          <div>
                            <strong>GCS(E,V,M):</strong> {item.gcs}
                          </div>
                          <div>
                            <strong>TB:</strong> {item.tb} cm
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 8 }}>
                          <div>
                            <strong>BB:</strong> {item.bb} kg
                          </div>
                          <div>
                            <strong>TD:</strong> {item.td} mmHg
                          </div>
                          <div>
                            <strong>Nadi:</strong> {item.nadi} x/menit
                          </div>
                          <div>
                            <strong>RR:</strong> {item.rr} x/menit
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 8 }}>
                          <div>
                            <strong>Suhu:</strong> {item.suhu} °C
                          </div>
                          <div>
                            <strong>SpO2:</strong> {item.spo} %
                          </div>
                          <div>
                            <strong>Kepala:</strong> {item.kepala}
                          </div>
                          <div>
                            <strong>Mata:</strong> {item.mata}
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 8 }}>
                          <div>
                            <strong>Gigi & Mulut:</strong> {item.gigi}
                          </div>
                          <div>
                            <strong>Leher:</strong> {item.leher}
                          </div>
                          <div>
                            <strong>Thoraks:</strong> {item.thoraks}
                          </div>
                          <div>
                            <strong>Abdomen:</strong> {item.abdomen}
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                          <div>
                            <strong>Genital & Anus:</strong> {item.genital}
                          </div>
                          <div>
                            <strong>Ekstremitas:</strong> {item.ekstremitas}
                          </div>
                          <div>
                            <strong>Keterangan Fisik:</strong> {item.ket_fisik}
                          </div>
                        </div>
                      </div>
                      <div
                        style={{
                          border: '1px solid #e5e7eb',
                          borderRadius: 8,
                          padding: 12,
                          marginBottom: 12
                        }}
                      >
                        <h6 style={{ color: '#0d6efd', marginBottom: 12, fontSize: 14 }}>III. STATUS LOKALIS</h6>
                        <div style={{ textAlign: 'center', marginBottom: 12 }}>
                          <img
                            src="/images/semua.png"
                            alt="Gambar Lokalis"
                            style={{ maxWidth: '600px', width: '100%', height: 'auto' }}
                          />
                        </div>
                        <div>
                          <strong>Keterangan:</strong>
                          <br />
                          {item.ket_lokalis}
                        </div>
                      </div>
                      <div
                        style={{
                          border: '1px solid #e5e7eb',
                          borderRadius: 8,
                          padding: 12,
                          marginBottom: 12
                        }}
                      >
                        <h6 style={{ color: '#0d6efd', marginBottom: 12, fontSize: 14 }}>IV. PEMERIKSAAN PENUNJANG</h6>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                          <div>
                            <strong>EKG:</strong>
                            <br />
                            {item.ekg}
                          </div>
                          <div>
                            <strong>Radiologi:</strong>
                            <br />
                            {item.rad}
                          </div>
                          <div>
                            <strong>Laborat:</strong>
                            <br />
                            {item.lab}
                          </div>
                        </div>
                      </div>
                      <div
                        style={{
                          border: '1px solid #e5e7eb',
                          borderRadius: 8,
                          padding: 12,
                          marginBottom: 12
                        }}
                      >
                        <h6 style={{ color: '#0d6efd', marginBottom: 12, fontSize: 14 }}>V. DIAGNOSIS/ASESMEN</h6>
                        <div>{item.diagnosis}</div>
                      </div>
                      <div
                        style={{
                          border: '1px solid #e5e7eb',
                          borderRadius: 8,
                          padding: 12,
                          marginBottom: 12
                        }}
                      >
                        <h6 style={{ color: '#0d6efd', marginBottom: 12, fontSize: 14 }}>VI. TATALAKSANA</h6>
                        <div>{item.tata}</div>
                      </div>
                      {index < legacy.asuhan_medis_igd.length - 1 && (
                        <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid #e5e7eb' }} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pemeriksaan Rawat Jalan (SOAP) */}
            {legacy.pemeriksaan_ralan && legacy.pemeriksaan_ralan.length > 0 && (
              <div style={cardStyle}>
                <div style={{ background: '#ffffff', color: '#374151', borderBottom: '1px solid #e5e7eb', padding: '12px 16px' }}>
                  <h6 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#0d6efd' }}>📋 Pemeriksaan Rawat Jalan (SOAP)</h6>
                </div>
                <div style={{ padding: 16 }}>
                  {legacy.pemeriksaan_ralan.map((item: any, index: number) => (
                    <div key={index} style={{ marginBottom: 16 }}>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={tableStyle}>
                          <tbody>
                            <tr style={{ background: '#f3f4f6' }}>
                              <td style={{ ...tdStyle, width: '5%', textAlign: 'center', fontWeight: 600 }}>No.</td>
                              <td style={{ ...tdStyle, width: '15%', fontWeight: 600 }}>Tanggal</td>
                              <td colSpan={7} style={{ ...tdStyle, width: '53%', fontWeight: 600 }}>
                                Dokter/Paramedis
                              </td>
                              <td colSpan={3} style={{ ...tdStyle, width: '27%', fontWeight: 600 }}>
                                Profesi/Jabatan/Departemen
                              </td>
                            </tr>
                            <tr>
                              <td style={{ ...tdStyle, textAlign: 'center' }}>{index + 1}</td>
                              <td style={tdStyle}>
                                {item.tgl_perawatan} {item.jam_rawat}
                              </td>
                              <td colSpan={7} style={tdStyle}>
                                {item.nip} - {item.nama}
                              </td>
                              <td colSpan={3} style={tdStyle}>
                                {item.jbtn}
                              </td>
                            </tr>
                            {item.keluhan && (
                              <tr>
                                <td colSpan={2} style={tdStyle}></td>
                                <td colSpan={2} style={{ ...tdStyle, fontWeight: 600 }}>
                                  Subjek
                                </td>
                                <td colSpan={8} style={tdStyle}>
                                  {renderNewlines(item.keluhan)}
                                </td>
                              </tr>
                            )}
                            {item.pemeriksaan && (
                              <tr>
                                <td colSpan={2} style={tdStyle}></td>
                                <td colSpan={2} style={{ ...tdStyle, fontWeight: 600 }}>
                                  Objek
                                </td>
                                <td colSpan={8} style={tdStyle}>
                                  {renderNewlines(item.pemeriksaan)}
                                </td>
                              </tr>
                            )}
                            <tr style={{ background: '#f3f4f6' }}>
                              <td colSpan={2} style={tdStyle}></td>
                              <td style={{ ...tdStyle, width: '8%', textAlign: 'center', fontWeight: 600 }}>
                                Suhu(C)
                              </td>
                              <td style={{ ...tdStyle, width: '8%', textAlign: 'center', fontWeight: 600 }}>Tensi</td>
                              <td style={{ ...tdStyle, width: '8%', textAlign: 'center', fontWeight: 600 }}>
                                Nadi(/mnt)
                              </td>
                              <td style={{ ...tdStyle, width: '8%', textAlign: 'center', fontWeight: 600 }}>
                                Resp(/mnt)
                              </td>
                              <td style={{ ...tdStyle, width: '8%', textAlign: 'center', fontWeight: 600 }}>
                                Tinggi(Cm)
                              </td>
                              <td style={{ ...tdStyle, width: '8%', textAlign: 'center', fontWeight: 600 }}>
                                Berat(Kg)
                              </td>
                              <td style={{ ...tdStyle, width: '8%', textAlign: 'center', fontWeight: 600 }}>
                                SpO2(%)
                              </td>
                              <td style={{ ...tdStyle, width: '8%', textAlign: 'center', fontWeight: 600 }}>
                                GCS(E,V,M)
                              </td>
                              <td style={{ ...tdStyle, width: '8%', textAlign: 'center', fontWeight: 600 }}>
                                Kesadaran
                              </td>
                              <td style={{ ...tdStyle, width: '8%', textAlign: 'center', fontWeight: 600 }}>
                                L.P.(Cm)
                              </td>
                            </tr>
                            <tr>
                              <td colSpan={2} style={tdStyle}></td>
                              <td style={{ ...tdStyle, textAlign: 'center' }}>{item.suhu_tubuh}</td>
                              <td style={{ ...tdStyle, textAlign: 'center' }}>{item.tensi}</td>
                              <td style={{ ...tdStyle, textAlign: 'center' }}>{item.nadi}</td>
                              <td style={{ ...tdStyle, textAlign: 'center' }}>{item.respirasi}</td>
                              <td style={{ ...tdStyle, textAlign: 'center' }}>{item.tinggi}</td>
                              <td style={{ ...tdStyle, textAlign: 'center' }}>{item.berat}</td>
                              <td style={{ ...tdStyle, textAlign: 'center' }}>{item.spo2}</td>
                              <td style={{ ...tdStyle, textAlign: 'center' }}>{item.gcs}</td>
                              <td style={{ ...tdStyle, textAlign: 'center' }}>{item.kesadaran}</td>
                              <td style={{ ...tdStyle, textAlign: 'center' }}>{item.lingkar_perut}</td>
                            </tr>
                            {item.alergi && (
                              <tr>
                                <td colSpan={2} style={tdStyle}></td>
                                <td colSpan={2} style={{ ...tdStyle, fontWeight: 600 }}>
                                  Alergi
                                </td>
                                <td colSpan={8} style={tdStyle}>
                                  : {item.alergi}
                                </td>
                              </tr>
                            )}
                            {item.penilaian && (
                              <tr>
                                <td colSpan={2} style={tdStyle}></td>
                                <td colSpan={2} style={{ ...tdStyle, fontWeight: 600 }}>
                                  Asesmen
                                </td>
                                <td colSpan={8} style={tdStyle}>
                                  : {renderNewlines(item.penilaian)}
                                </td>
                              </tr>
                            )}
                            {item.rtl && (
                              <tr>
                                <td colSpan={2} style={tdStyle}></td>
                                <td colSpan={2} style={{ ...tdStyle, fontWeight: 600 }}>
                                  Plan
                                </td>
                                <td colSpan={8} style={tdStyle}>
                                  : {renderNewlines(item.rtl)}
                                </td>
                              </tr>
                            )}
                            {item.instruksi && (
                              <tr>
                                <td colSpan={2} style={tdStyle}></td>
                                <td colSpan={2} style={{ ...tdStyle, fontWeight: 600 }}>
                                  Inst/Impl
                                </td>
                                <td colSpan={8} style={tdStyle}>
                                  : {renderNewlines(item.instruksi)}
                                </td>
                              </tr>
                            )}
                            {item.evaluasi && (
                              <tr>
                                <td colSpan={2} style={{ ...tdStyle, borderBottom: 'none' }}></td>
                                <td colSpan={2} style={{ ...tdStyle, fontWeight: 600, borderBottom: 'none' }}>
                                  Evaluasi
                                </td>
                                <td colSpan={8} style={{ ...tdStyle, borderBottom: 'none' }}>
                                  : {renderNewlines(item.evaluasi)}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      {index < legacy.pemeriksaan_ralan.length - 1 && (
                        <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid #e5e7eb' }} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pemeriksaan Rawat Inap (SOAP) - Similar structure to Rawat Jalan */}
            {legacy.pemeriksaan_ranap && legacy.pemeriksaan_ranap.length > 0 && (
              <div style={cardStyle}>
                <div style={{ background: '#ffffff', color: '#374151', borderBottom: '1px solid #e5e7eb', padding: '12px 16px' }}>
                  <h6 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#6f42c1' }}>🛏️ Pemeriksaan Rawat Inap (SOAP)</h6>
                </div>
                <div style={{ padding: 16 }}>
                  {legacy.pemeriksaan_ranap.map((item: any, index: number) => (
                    <div key={index} style={{ marginBottom: 16 }}>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={tableStyle}>
                          <tbody>
                            <tr style={{ background: '#f3f4f6' }}>
                              <td style={{ ...tdStyle, width: '5%', textAlign: 'center', fontWeight: 600 }}>No.</td>
                              <td style={{ ...tdStyle, width: '15%', fontWeight: 600 }}>Tanggal</td>
                              <td colSpan={6} style={{ ...tdStyle, width: '50%', fontWeight: 600 }}>
                                Dokter/Paramedis
                              </td>
                              <td colSpan={3} style={{ ...tdStyle, width: '30%', fontWeight: 600 }}>
                                Profesi/Jabatan/Departemen
                              </td>
                            </tr>
                            <tr>
                              <td style={{ ...tdStyle, textAlign: 'center' }}>{index + 1}</td>
                              <td style={tdStyle}>
                                {item.tgl_perawatan} {item.jam_rawat}
                              </td>
                              <td colSpan={6} style={tdStyle}>
                                {item.nip} - {item.nama}
                              </td>
                              <td colSpan={3} style={tdStyle}>
                                {item.jbtn}
                              </td>
                            </tr>
                            {item.keluhan && (
                              <tr>
                                <td colSpan={2} style={tdStyle}></td>
                                <td colSpan={2} style={{ ...tdStyle, fontWeight: 600 }}>
                                  Subjek
                                </td>
                                <td colSpan={6} style={tdStyle}>
                                  {renderNewlines(item.keluhan)}
                                </td>
                              </tr>
                            )}
                            {item.pemeriksaan && (
                              <tr>
                                <td colSpan={2} style={tdStyle}></td>
                                <td colSpan={2} style={{ ...tdStyle, fontWeight: 600 }}>
                                  Objek
                                </td>
                                <td colSpan={6} style={tdStyle}>
                                  {renderNewlines(item.pemeriksaan)}
                                </td>
                              </tr>
                            )}
                            <tr style={{ background: '#f3f4f6' }}>
                              <td colSpan={2} style={tdStyle}></td>
                              <td style={{ ...tdStyle, width: '9%', textAlign: 'center', fontWeight: 600 }}>
                                Suhu(C)
                              </td>
                              <td style={{ ...tdStyle, width: '9%', textAlign: 'center', fontWeight: 600 }}>Tensi</td>
                              <td style={{ ...tdStyle, width: '9%', textAlign: 'center', fontWeight: 600 }}>
                                Nadi(/mnt)
                              </td>
                              <td style={{ ...tdStyle, width: '9%', textAlign: 'center', fontWeight: 600 }}>
                                Resp(/mnt)
                              </td>
                              <td style={{ ...tdStyle, width: '9%', textAlign: 'center', fontWeight: 600 }}>
                                Tinggi(Cm)
                              </td>
                              <td style={{ ...tdStyle, width: '9%', textAlign: 'center', fontWeight: 600 }}>
                                Berat(Kg)
                              </td>
                              <td style={{ ...tdStyle, width: '9%', textAlign: 'center', fontWeight: 600 }}>
                                SpO2(%)
                              </td>
                              <td style={{ ...tdStyle, width: '9%', textAlign: 'center', fontWeight: 600 }}>
                                GCS(E,V,M)
                              </td>
                              <td style={{ ...tdStyle, width: '9%', textAlign: 'center', fontWeight: 600 }}>
                                Kesadaran
                              </td>
                            </tr>
                            <tr>
                              <td colSpan={2} style={tdStyle}></td>
                              <td style={{ ...tdStyle, textAlign: 'center' }}>{item.suhu_tubuh}</td>
                              <td style={{ ...tdStyle, textAlign: 'center' }}>{item.tensi}</td>
                              <td style={{ ...tdStyle, textAlign: 'center' }}>{item.nadi}</td>
                              <td style={{ ...tdStyle, textAlign: 'center' }}>{item.respirasi}</td>
                              <td style={{ ...tdStyle, textAlign: 'center' }}>{item.tinggi}</td>
                              <td style={{ ...tdStyle, textAlign: 'center' }}>{item.berat}</td>
                              <td style={{ ...tdStyle, textAlign: 'center' }}>{item.spo2}</td>
                              <td style={{ ...tdStyle, textAlign: 'center' }}>{item.gcs}</td>
                              <td style={{ ...tdStyle, textAlign: 'center' }}>{item.kesadaran}</td>
                            </tr>
                            {item.alergi && (
                              <tr>
                                <td colSpan={2} style={tdStyle}></td>
                                <td colSpan={2} style={{ ...tdStyle, fontWeight: 600 }}>
                                  Alergi
                                </td>
                                <td colSpan={6} style={tdStyle}>
                                  : {item.alergi}
                                </td>
                              </tr>
                            )}
                            {item.penilaian && (
                              <tr>
                                <td colSpan={2} style={tdStyle}></td>
                                <td colSpan={2} style={{ ...tdStyle, fontWeight: 600 }}>
                                  Asesmen
                                </td>
                                <td colSpan={6} style={tdStyle}>
                                  : {renderNewlines(item.penilaian)}
                                </td>
                              </tr>
                            )}
                            {item.rtl && (
                              <tr>
                                <td colSpan={2} style={tdStyle}></td>
                                <td colSpan={2} style={{ ...tdStyle, fontWeight: 600 }}>
                                  Plan
                                </td>
                                <td colSpan={6} style={tdStyle}>
                                  : {renderNewlines(item.rtl)}
                                </td>
                              </tr>
                            )}
                            {item.instruksi && (
                              <tr>
                                <td colSpan={2} style={tdStyle}></td>
                                <td colSpan={2} style={{ ...tdStyle, fontWeight: 600 }}>
                                  Inst/Impl
                                </td>
                                <td colSpan={6} style={tdStyle}>
                                  : {renderNewlines(item.instruksi)}
                                </td>
                              </tr>
                            )}
                            {item.evaluasi && (
                              <tr>
                                <td colSpan={2} style={{ ...tdStyle, borderBottom: 'none' }}></td>
                                <td colSpan={2} style={{ ...tdStyle, fontWeight: 600, borderBottom: 'none' }}>
                                  Evaluasi
                                </td>
                                <td colSpan={6} style={{ ...tdStyle, borderBottom: 'none' }}>
                                  : {renderNewlines(item.evaluasi)}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      {index < legacy.pemeriksaan_ranap.length - 1 && (
                        <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid #e5e7eb' }} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tindakan Rawat Jalan Dokter */}
            {legacy.rawat_jalan_dokter && legacy.rawat_jalan_dokter.length > 0 && (
              <div style={cardStyle}>
                <div style={{ background: '#ffffff', color: '#374151', borderBottom: '1px solid #e5e7eb', padding: '12px 16px' }}>
                  <h6 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#007bff' }}>🏥 Tindakan Rawat Jalan Dokter</h6>
                </div>
                <div style={{ padding: 0 }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ ...tableStyle, border: 'none' }}>
                      <thead style={{ background: '#f3f4f6' }}>
                        <tr>
                          <th style={{ ...tdStyle, fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>No.</th>
                          <th style={{ ...tdStyle, fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Tanggal</th>
                          <th style={{ ...tdStyle, fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Kode</th>
                          <th style={{ ...tdStyle, fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>
                            Nama Tindakan/Perawatan
                          </th>
                          <th style={{ ...tdStyle, fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Dokter</th>
                          <th
                            style={{
                              ...tdStyle,
                              fontWeight: 600,
                              borderBottom: '2px solid #e5e7eb',
                              textAlign: 'end'
                            }}
                          >
                            Biaya
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {legacy.rawat_jalan_dokter.map((item: any, index: number) => (
                          <tr key={index}>
                            <td style={tdStyle}>{index + 1}</td>
                            <td style={tdStyle}>
                              {item.tgl_perawatan} {item.jam_rawat}
                            </td>
                            <td style={tdStyle}>{item.kd_jenis_prw}</td>
                            <td style={tdStyle}>{item.nm_perawatan}</td>
                            <td style={tdStyle}>{item.nm_dokter}</td>
                            <td style={{ ...tdStyle, textAlign: 'end' }}>{formatRupiah(item.biaya_rawat)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Tindakan Rawat Jalan Paramedis */}
            {legacy.rawat_jalan_paramedis && legacy.rawat_jalan_paramedis.length > 0 && (
              <div style={cardStyle}>
                <div style={{ background: '#ffffff', color: '#374151', borderBottom: '1px solid #e5e7eb', padding: '12px 16px' }}>
                  <h6 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#28a745' }}>👨‍⚕️ Tindakan Rawat Jalan Paramedis</h6>
                </div>
                <div style={{ padding: 0 }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ ...tableStyle, border: 'none' }}>
                      <thead style={{ background: '#f3f4f6' }}>
                        <tr>
                          <th style={{ ...tdStyle, fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>No.</th>
                          <th style={{ ...tdStyle, fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Tanggal</th>
                          <th style={{ ...tdStyle, fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Kode</th>
                          <th style={{ ...tdStyle, fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>
                            Nama Tindakan/Perawatan
                          </th>
                          <th style={{ ...tdStyle, fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Paramedis</th>
                          <th
                            style={{
                              ...tdStyle,
                              fontWeight: 600,
                              borderBottom: '2px solid #e5e7eb',
                              textAlign: 'end'
                            }}
                          >
                            Biaya
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {legacy.rawat_jalan_paramedis.map((item: any, index: number) => (
                          <tr key={index}>
                            <td style={tdStyle}>{index + 1}</td>
                            <td style={tdStyle}>
                              {item.tgl_perawatan} {item.jam_rawat}
                            </td>
                            <td style={tdStyle}>{item.kd_jenis_prw}</td>
                            <td style={tdStyle}>{item.nm_perawatan}</td>
                            <td style={tdStyle}>{item.nama}</td>
                            <td style={{ ...tdStyle, textAlign: 'end' }}>{formatRupiah(item.biaya_rawat)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Penggunaan Kamar Inap */}
            {legacy.kamar_inap && legacy.kamar_inap.length > 0 && (
              <div style={cardStyle}>
                <div style={{ background: '#ffffff', color: '#374151', borderBottom: '1px solid #e5e7eb', padding: '12px 16px' }}>
                  <h6 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#fd7e14' }}>🛏️ Penggunaan Kamar Inap</h6>
                </div>
                <div style={{ padding: 0 }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ ...tableStyle, border: 'none' }}>
                      <thead style={{ background: '#f3f4f6' }}>
                        <tr>
                          <th style={{ ...tdStyle, fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>No.</th>
                          <th style={{ ...tdStyle, fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Tanggal Masuk</th>
                          <th style={{ ...tdStyle, fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Tanggal Keluar</th>
                          <th style={{ ...tdStyle, fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Lama Inap</th>
                          <th style={{ ...tdStyle, fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Kamar</th>
                          <th style={{ ...tdStyle, fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Status</th>
                          <th style={{ ...tdStyle, fontWeight: 600, borderBottom: '2px solid #e5e7eb', textAlign: 'end' }}>Biaya</th>
                        </tr>
                      </thead>
                      <tbody>
                        {legacy.kamar_inap.map((item: any, index: number) => (
                          <tr key={index}>
                            <td style={tdStyle}>{index + 1}</td>
                            <td style={tdStyle}>{item.tgl_masuk} {item.jam_masuk}</td>
                            <td style={tdStyle}>{item.tgl_keluar} {item.jam_keluar}</td>
                            <td style={tdStyle}>{item.lama} hari</td>
                            <td style={tdStyle}>{item.kd_kamar}, {item.nm_bangsal}</td>
                            <td style={tdStyle}>{item.stts_pulang}</td>
                            <td style={{ ...tdStyle, textAlign: 'end' }}>{formatRupiah(item.ttl_biaya)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Pemeriksaan Radiologi */}
            {legacy.radiologi && legacy.radiologi.length > 0 && (
              <div style={cardStyle}>
                <div style={{ background: '#ffffff', color: '#374151', borderBottom: '1px solid #e5e7eb', padding: '12px 16px' }}>
                  <h6 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#6610f2' }}>📷 Pemeriksaan Radiologi</h6>
                </div>
                <div style={{ padding: 0 }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ ...tableStyle, border: 'none' }}>
                      <thead style={{ background: '#f3f4f6' }}>
                        <tr>
                          <th style={{ ...tdStyle, fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>No.</th>
                          <th style={{ ...tdStyle, fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Tanggal</th>
                          <th style={{ ...tdStyle, fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Kode</th>
                          <th style={{ ...tdStyle, fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Nama Pemeriksaan</th>
                          <th style={{ ...tdStyle, fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Dokter PJ</th>
                          <th style={{ ...tdStyle, fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Petugas</th>
                          <th style={{ ...tdStyle, fontWeight: 600, borderBottom: '2px solid #e5e7eb', textAlign: 'end' }}>Biaya</th>
                        </tr>
                      </thead>
                      <tbody>
                        {legacy.radiologi.map((item: any, index: number) => (
                          <tr key={index}>
                            <td style={tdStyle}>{index + 1}</td>
                            <td style={tdStyle}>{item.tgl_periksa} {item.jam}</td>
                            <td style={tdStyle}>{item.kd_jenis_prw}</td>
                            <td style={tdStyle}>
                              {item.nm_perawatan}
                              {(item.proyeksi || item.kV || item.mAS) && (
                                <div style={{ fontSize: 12, color: '#6b7280' }}>
                                  {item.proyeksi && <span>Proyeksi: {item.proyeksi}</span>}
                                  {item.kV && <span>, kV: {item.kV}</span>}
                                  {item.mAS && <span>, mAS: {item.mAS}</span>}
                                </div>
                              )}
                            </td>
                            <td style={tdStyle}>{item.nm_dokter}</td>
                            <td style={tdStyle}>{item.nama}</td>
                            <td style={{ ...tdStyle, textAlign: 'end' }}>{formatRupiah(item.biaya)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Hasil Radiologi */}
            {legacy.hasil_radiologi && legacy.hasil_radiologi.length > 0 && (
              <div style={cardStyle}>
                <div style={{ background: '#ffffff', color: '#374151', borderBottom: '1px solid #e5e7eb', padding: '12px 16px' }}>
                  <h6 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>📝 Hasil/Bacaan Radiologi</h6>
                </div>
                <div style={{ padding: 16 }}>
                  {legacy.hasil_radiologi.map((item: any, index: number) => (
                    <div key={index} style={{ marginBottom: 12 }}>
                      <div style={{ fontWeight: 600 }}>{item.tgl_periksa} {item.jam}</div>
                      <div style={{ marginTop: 4 }}>{renderNewlines(item.hasil)}</div>
                      {index < legacy.hasil_radiologi.length - 1 && (
                        <hr style={{ margin: '12px 0', border: 'none', borderTop: '1px solid #e5e7eb' }} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Gambar Radiologi */}
            {legacy.gambar_radiologi && legacy.gambar_radiologi.length > 0 && (
              <div style={cardStyle}>
                <div style={{ background: '#ffffff', color: '#374151', borderBottom: '1px solid #e5e7eb', padding: '12px 16px' }}>
                  <h6 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>🖼️ Gambar Radiologi</h6>
                </div>
                <div style={{ padding: 16 }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={tableStyle}>
                      <thead style={{ background: '#f3f4f6' }}>
                        <tr>
                          <th style={{ ...tdStyle, width: '5%', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>No.</th>
                          <th style={{ ...tdStyle, width: '15%', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Tanggal</th>
                          <th style={{ ...tdStyle, width: '80%', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Gambar Radiologi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {legacy.gambar_radiologi.map((item: any, index: number) => (
                          <tr key={index}>
                            <td style={{ ...tdStyle, textAlign: 'center' }}>{index + 1}</td>
                            <td style={tdStyle}>{item.tgl_periksa} {item.jam}</td>
                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                              {item.gambar_url ? (
                                <div style={{ padding: '8px 0' }}>
                                  <a href={item.gambar_url} target="_blank" rel="noopener noreferrer">
                                    <img
                                      src={item.gambar_url}
                                      alt={`Gambar Radiologi ${item.tgl_periksa}`}
                                      style={{ maxWidth: '450px', maxHeight: '450px', width: '100%', height: 'auto', cursor: 'pointer', border: '1px solid #e5e7eb', borderRadius: 8 }}
                                      onError={handleImageError}
                                    />
                                  </a>
                                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>Klik gambar untuk melihat ukuran penuh</div>
                                </div>
                              ) : (
                                <div style={{ color: '#6b7280', padding: '12px 0' }}><i>Gambar tidak tersedia</i></div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Pemeriksaan Laboratorium PK & MB */}
            {legacy.laboratorium_pkmb && legacy.laboratorium_pkmb.length > 0 && (
              <div style={cardStyle}>
                <div style={{ background: '#ffffff', color: '#374151', borderBottom: '1px solid #e5e7eb', padding: '12px 16px' }}>
                  <h6 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#20c997' }}>🔬 Pemeriksaan Laboratorium PK & MB</h6>
                </div>
                <div style={{ padding: 16 }}>
                  {legacy.laboratorium_pkmb.map((labGroup: any, groupIndex: number) => (
                    <div key={groupIndex} style={{ marginBottom: 16 }}>
                      {labGroup.pemeriksaan.map((pemeriksaan: any, pIndex: number) => (
                        <div key={pIndex} style={{ marginBottom: 12 }}>
                          <div style={{ overflowX: 'auto' }}>
                            <table style={tableStyle}>
                              <thead style={{ background: '#f3f4f6' }}>
                                {pIndex === 0 && (
                                  <tr>
                                    <th style={{ ...tdStyle, width: '5%', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>No.</th>
                                    <th style={{ ...tdStyle, width: '15%', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Tanggal</th>
                                    <th style={{ ...tdStyle, width: '10%', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Kode</th>
                                    <th style={{ ...tdStyle, width: '25%', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Nama Pemeriksaan</th>
                                    <th style={{ ...tdStyle, width: '18%', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Dokter PJ</th>
                                    <th style={{ ...tdStyle, width: '17%', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Petugas</th>
                                    <th style={{ ...tdStyle, width: '10%', fontWeight: 600, borderBottom: '2px solid #e5e7eb', textAlign: 'end' }}>Biaya</th>
                                  </tr>
                                )}
                              </thead>
                              <tbody>
                                <tr>
                                  <td style={{ ...tdStyle, textAlign: 'center' }}>{pIndex + 1}</td>
                                  <td style={tdStyle}>{labGroup.tgl_periksa} {labGroup.jam}</td>
                                  <td style={tdStyle}>{pemeriksaan.kd_jenis_prw}</td>
                                  <td style={tdStyle}>{pemeriksaan.nm_perawatan}</td>
                                  <td style={tdStyle}>{pemeriksaan.nm_dokter}</td>
                                  <td style={tdStyle}>{pemeriksaan.nama}</td>
                                  <td style={{ ...tdStyle, textAlign: 'end' }}>{formatRupiah(pemeriksaan.biaya)}</td>
                                </tr>
                                {pemeriksaan.detail && pemeriksaan.detail.length > 0 && (
                                  <tr>
                                    <td colSpan={7} style={{ padding: 0, borderBottom: '1px solid #e5e7eb' }}>
                                      <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                                        <thead style={{ background: '#f3f4f6' }}>
                                          <tr>
                                            <th style={{ ...tdStyle, width: '40%', textAlign: 'center', fontWeight: 600 }}>Detail Pemeriksaan</th>
                                            <th style={{ ...tdStyle, width: '25%', textAlign: 'center', fontWeight: 600 }}>Hasil</th>
                                            <th style={{ ...tdStyle, width: '25%', textAlign: 'center', fontWeight: 600 }}>Nilai Rujukan</th>
                                            <th style={{ ...tdStyle, width: '10%', textAlign: 'end', fontWeight: 600 }}>Biaya</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {pemeriksaan.detail.map((detail: any, dIndex: number) => (
                                            <tr key={dIndex}>
                                              <td style={tdStyle}>{detail.Pemeriksaan}</td>
                                              <td style={{ ...tdStyle, ...getLabResultClass(detail.keterangan) }}>
                                                {detail.nilai} {detail.satuan}
                                              </td>
                                              <td style={tdStyle}>{renderNewlines(detail.nilai_rujukan)}</td>
                                              <td style={{ ...tdStyle, textAlign: 'end' }}>{formatRupiah(detail.biaya_item)}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </td>
                                  </tr>
                                )}
                                {pemeriksaan.saran_kesan && (
                                  <tr>
                                    <td colSpan={7} style={{ ...tdStyle, borderBottom: 'none' }}>
                                      <div><strong>Kesan:</strong> {pemeriksaan.saran_kesan.kesan}</div>
                                      <div><strong>Saran:</strong> {pemeriksaan.saran_kesan.saran}</div>
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                      {groupIndex < legacy.laboratorium_pkmb.length - 1 && (
                        <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid #e5e7eb' }} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pemeriksaan Laboratorium PA */}
            {legacy.laboratorium_pa && legacy.laboratorium_pa.length > 0 && (
              <div style={cardStyle}>
                <div style={{ background: '#ffffff', color: '#374151', borderBottom: '1px solid #e5e7eb', padding: '12px 16px' }}>
                  <h6 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#fd7e14' }}>🔬 Pemeriksaan Laboratorium PA</h6>
                </div>
                <div style={{ padding: 16 }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={tableStyle}>
                      <thead style={{ background: '#f3f4f6' }}>
                        <tr>
                          <th style={{ ...tdStyle, width: '5%', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>No.</th>
                          <th style={{ ...tdStyle, width: '15%', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Tanggal</th>
                          <th style={{ ...tdStyle, width: '10%', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Kode</th>
                          <th style={{ ...tdStyle, width: '25%', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Nama Pemeriksaan</th>
                          <th style={{ ...tdStyle, width: '18%', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Dokter PJ</th>
                          <th style={{ ...tdStyle, width: '17%', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Petugas</th>
                          <th style={{ ...tdStyle, width: '10%', fontWeight: 600, borderBottom: '2px solid #e5e7eb', textAlign: 'end' }}>Biaya</th>
                        </tr>
                      </thead>
                      <tbody>
                        {legacy.laboratorium_pa.map((item: any, index: number) => (
                          <React.Fragment key={index}>
                            <tr>
                              <td style={{ ...tdStyle, textAlign: 'center' }}>{index + 1}</td>
                              <td style={tdStyle}>{item.tgl_periksa} {item.jam}</td>
                              <td style={tdStyle}>{item.kd_jenis_prw}</td>
                              <td style={tdStyle}>{item.nm_perawatan}</td>
                              <td style={tdStyle}>{item.nm_dokter}</td>
                              <td style={tdStyle}>{item.nama}</td>
                              <td style={{ ...tdStyle, textAlign: 'end' }}>{formatRupiah(item.biaya)}</td>
                            </tr>
                            {item.detail && (
                              <tr>
                                <td colSpan={7} style={{ ...tdStyle, borderBottom: 'none' }}>
                                  <div style={{ padding: 8 }}>
                                    <div style={{ marginBottom: 8 }}><strong>Diagnosa Klinis:</strong> {item.detail.diagnosa_klinik}</div>
                                    <div style={{ marginBottom: 8 }}><strong>Makroskopik:</strong> {item.detail.makroskopik}</div>
                                    <div style={{ marginBottom: 8 }}><strong>Mikroskopik:</strong> {item.detail.mikroskopik}</div>
                                    <div style={{ marginBottom: 8 }}><strong>Kesimpulan:</strong> {item.detail.kesimpulan}</div>
                                    <div style={{ marginBottom: 8 }}><strong>Kesan:</strong> {item.detail.kesan}</div>
                                    {item.gambar_url && (
                                      <div style={{ textAlign: 'center', marginTop: 12 }}>
                                        <a href={item.gambar_url} target="_blank" rel="noopener noreferrer">
                                          <img src={item.gambar_url} alt={`Gambar PA - ${item.nm_perawatan}`} style={{ maxWidth: '450px', maxHeight: '450px', width: '100%', height: 'auto', cursor: 'pointer', border: '1px solid #e5e7eb', borderRadius: 8 }} onError={handleImageError} />
                                        </a>
                                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>Klik gambar untuk melihat ukuran penuh</div>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Pemberian Obat */}
            {legacy.pemberian_obat && legacy.pemberian_obat.length > 0 && (
              <div style={cardStyle}>
                <div style={{ background: '#ffffff', color: '#374151', borderBottom: '1px solid #e5e7eb', padding: '12px 16px' }}>
                  <h6 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#28a745' }}>💊 Pemberian Obat/BHP/Alkes</h6>
                </div>
                <div style={{ padding: 0 }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ ...tableStyle, border: 'none' }}>
                      <thead style={{ background: '#f3f4f6' }}>
                        <tr>
                          <th style={{ ...tdStyle, fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>No.</th>
                          <th style={{ ...tdStyle, fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Tanggal</th>
                          <th style={{ ...tdStyle, fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Kode</th>
                          <th style={{ ...tdStyle, fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Nama Obat/BHP/Alkes</th>
                          <th style={{ ...tdStyle, fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Jumlah</th>
                          <th style={{ ...tdStyle, fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Aturan Pakai</th>
                          <th style={{ ...tdStyle, fontWeight: 600, borderBottom: '2px solid #e5e7eb', textAlign: 'end' }}>Biaya</th>
                        </tr>
                      </thead>
                      <tbody>
                        {legacy.pemberian_obat.map((item: any, index: number) => (
                          <tr key={index}>
                            <td style={tdStyle}>{index + 1}</td>
                            <td style={tdStyle}>{item.tgl_perawatan} {item.jam}</td>
                            <td style={tdStyle}>{item.kode_brng}</td>
                            <td style={tdStyle}>{item.nama_brng}</td>
                            <td style={tdStyle}>{item.jml} {item.kode_sat}</td>
                            <td style={tdStyle}>{item.aturan_pakai || '-'}</td>
                            <td style={{ ...tdStyle, textAlign: 'end' }}>{formatRupiah(item.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Resep Pulang */}
            {legacy.resep_pulang && legacy.resep_pulang.length > 0 && (
              <div style={cardStyle}>
                <div style={{ background: '#ffffff', color: '#374151', borderBottom: '1px solid #e5e7eb', padding: '12px 16px' }}>
                  <h6 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#6610f2' }}>💊 Resep Pulang</h6>
                </div>
                <div style={{ padding: 0 }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ ...tableStyle, border: 'none' }}>
                      <thead style={{ background: '#f3f4f6' }}>
                        <tr>
                          <th style={{ ...tdStyle, width: '5%', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>No.</th>
                          <th style={{ ...tdStyle, width: '10%', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Kode</th>
                          <th style={{ ...tdStyle, width: '40%', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Nama Obat/BHP/Alkes</th>
                          <th style={{ ...tdStyle, width: '20%', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Dosis</th>
                          <th style={{ ...tdStyle, width: '10%', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Jumlah</th>
                          <th style={{ ...tdStyle, width: '15%', fontWeight: 600, borderBottom: '2px solid #e5e7eb', textAlign: 'end' }}>Biaya</th>
                        </tr>
                      </thead>
                      <tbody>
                        {legacy.resep_pulang.map((item: any, index: number) => (
                          <tr key={index}>
                            <td style={tdStyle}>{index + 1}</td>
                            <td style={tdStyle}>{item.kode_brng}</td>
                            <td style={tdStyle}>{item.nama_brng}</td>
                            <td style={tdStyle}>{item.dosis || '-'}</td>
                            <td style={tdStyle}>{item.jml_barang} {item.kode_sat}</td>
                            <td style={{ ...tdStyle, textAlign: 'end' }}>{formatRupiah(item.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* PPN Obat */}
            {legacy.ppn_obat && legacy.ppn_obat > 0 && (
              <div style={cardStyle}>
                <div style={{ padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h6 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>🧾 PPN Obat</h6>
                    <h6 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#000' }}>{formatRupiah(legacy.ppn_obat)}</h6>
                  </div>
                </div>
              </div>
            )}

            {/* Tambahan Biaya */}
            {legacy.tambahan_biaya && legacy.tambahan_biaya.length > 0 && (
              <div style={cardStyle}>
                <div style={{ background: '#ffffff', color: '#374151', borderBottom: '1px solid #e5e7eb', padding: '12px 16px' }}>
                  <h6 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#17a2b8' }}>➕ Tambahan Biaya</h6>
                </div>
                <div style={{ padding: 0 }}>
                  <table style={{ ...tableStyle, border: 'none' }}>
                    <tbody>
                      {legacy.tambahan_biaya.map((item: any, index: number) => (
                        <tr key={index}>
                          <td style={{ ...tdStyle, width: '80%' }}>{item.nama_biaya}</td>
                          <td style={{ ...tdStyle, width: '20%', textAlign: 'end' }}>{formatRupiah(item.besar_biaya)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Potongan Biaya */}
            {legacy.potongan_biaya && legacy.potongan_biaya.length > 0 && (
              <div style={cardStyle}>
                <div style={{ background: '#ffffff', color: '#374151', borderBottom: '1px solid #e5e7eb', padding: '12px 16px' }}>
                  <h6 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#dc3545' }}>➖ Potongan Biaya</h6>
                </div>
                <div style={{ padding: 0 }}>
                  <table style={{ ...tableStyle, border: 'none' }}>
                    <tbody>
                      {legacy.potongan_biaya.map((item: any, index: number) => (
                        <tr key={index}>
                          <td style={{ ...tdStyle, width: '80%' }}>{item.nama_pengurangan}</td>
                          <td style={{ ...tdStyle, width: '20%', textAlign: 'end' }}>{formatRupiah(item.besar_pengurangan)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

              </div>
            ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
