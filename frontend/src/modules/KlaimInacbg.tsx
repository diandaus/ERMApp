import React from 'react';
import * as XLSX from 'xlsx';
import { localDateStr } from '../utils/date';
import { PreviewBilling } from '../components/PreviewBilling';
import { ModalDetailPemberianObat } from '../components/ModalDetailPemberianObat';
import { ModalDetailPeriksaLab } from '../components/ModalDetailPeriksaLab';

type KlaimItem = {
  no_rawat: string;
  no_rkm_medis: string;
  nm_pasien: string;
  // Kelas rawat (hak kelas BPJS) — diambil backend dari bridging_sep.klsrawat
  // ('1'/'2'/'3') berdasarkan no_rawat, kosong kalau belum ada SEP terbit.
  kelas: string;
  nm_dokter: string;
  diagnosa: string;
  biaya_obat: number;
  biaya_lab: number;
  biaya_radiologi: number;
  biaya_darah: number;
  biaya_gizi: number;
  biaya_jasa_medis: number;
  billing: number;
  selisih: number;
  klaim_inacbg: number;
};

const formatRupiah = (n: number) => `Rp ${Math.round(n || 0).toLocaleString('id-ID')}`;
const formatAngkaExport = (n: number) => Math.round(n || 0).toLocaleString('id-ID');

type AppUser = {
  username: string;
  role: string;
  kd_dokter?: string;
};

type KlaimInacbgViewProps = {
  user?: AppUser;
};

export const KlaimInacbgView: React.FC<KlaimInacbgViewProps> = ({ user }) => {
  // Untuk role dokter, dibatasi ke pasien yang dokter ini jadi DPJP-nya
  // lewat app_users.kd_dokter (di-link admin di Pengaturan > User — lihat
  // AddUserModal.tsx). Dulu ini memakai user.username dengan asumsi
  // "username = kd_dokter" (konvensi kalau akun dibuat dari data dokter di
  // AddUserModal), tapi itu cuma kebetulan penamaan, bukan link eksplisit —
  // begitu admin membuat akun dgn username lain atau lewat tipe user
  // "Petugas", filter ini diam-diam kirim kd_dokter yang salah dan data
  // Monitoring Biaya Klaim BPJS jadi kosong (WHERE dpjp_ranap.kd_dokter=?
  // tidak match apapun).
  const isDokter = user?.role === 'dokter' && !!user?.kd_dokter;
  const [searchText, setSearchText] = React.useState<string>('');
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
  const [previewObatNoRawat, setPreviewObatNoRawat] = React.useState<string | null>(null);
  const [previewLabNoRawat, setPreviewLabNoRawat] = React.useState<string | null>(null);
  // Basis filter tanggal — dipilih lewat toggle di toolbar (bukan lagi
  // disembunyikan di dalam btn Filter): "belum-pulang" (default, tidak
  // dibatasi tanggal), "masuk" (kamar_inap.tgl_masuk), atau "pulang"
  // (kamar_inap.tgl_keluar). Cuma satu basis yang aktif dalam satu waktu.
  const [dateFilterMode, setDateFilterMode] = React.useState<'belum-pulang' | 'masuk' | 'pulang'>('belum-pulang');
  const [tglPulangDari, setTglPulangDari] = React.useState<string>(localDateStr());
  const [tglPulangSampai, setTglPulangSampai] = React.useState<string>(localDateStr());
  const dpjpDropdownRef = React.useRef<HTMLDivElement>(null);
  const [showExportDropdown, setShowExportDropdown] = React.useState<boolean>(false);
  const exportDropdownRef = React.useRef<HTMLDivElement>(null);

  const fetchItems = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `/api/klaim-inacbg/list?`;
      if (dateFilterMode === 'belum-pulang') {
        url += `status_pulang=belum`;
      } else if (dateFilterMode === 'masuk') {
        url += `tgl_dari=${tglDari}&tgl_sampai=${tglSampai}`;
      } else {
        url += `tgl_pulang_dari=${tglPulangDari}&tgl_pulang_sampai=${tglPulangSampai}`;
      }
      if (searchText) {
        url += `&search=${encodeURIComponent(searchText)}`;
      }
      if (isDokter) {
        url += `&kd_dokter=${encodeURIComponent(user!.kd_dokter!)}`;
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
  }, [dateFilterMode, tglDari, tglSampai, searchText, isDokter, user, tglPulangDari, tglPulangSampai]);

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

  const dpjpOptions = React.useMemo(() => {
    const names = new Set<string>();
    items.forEach((item) => names.add(item.nm_dokter || 'Tanpa DPJP'));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filteredItems = React.useMemo(() => {
    if (dpjpFilter === 'Semua') return items;
    return items.filter((item) => (item.nm_dokter || 'Tanpa DPJP') === dpjpFilter);
  }, [items, dpjpFilter]);

  // Ekspor (CSV/XLSX/PDF) — isinya sama persis dengan data yang lagi
  // ditampilkan di tabel (sudah kena filter DPJP/tanggal/pencarian),
  // dikelompokkan per dokter DPJP sama seperti tampilan, tapi diratakan
  // jadi satu tabel (kolom DPJP ditambahkan) karena CSV/XLSX tidak punya
  // konsep header grup di baris tabelnya.
  const exportHeader = [
    'No.Rawat', 'No.RM', 'Nama Pasien', 'Kelas', 'DPJP', 'Diagnosa',
    'Biaya Obat', 'Laboratorium', 'Radiologi', 'Pelayanan Darah', 'Gizi', 'Jasa Medis',
    'Billing', 'Selisih', 'Klaim INACBG',
  ];

  const buildExportRows = (): (string | number)[][] => {
    const rows: (string | number)[][] = [];
    groupedByDokter(filteredItems).forEach(([dokter, list]) => {
      list.forEach((item) => {
        rows.push([
          item.no_rawat, item.no_rkm_medis, item.nm_pasien, item.kelas || '-', dokter, item.diagnosa || '-',
          item.biaya_obat, item.biaya_lab, item.biaya_radiologi, item.biaya_darah, item.biaya_gizi, item.biaya_jasa_medis,
          item.billing, item.selisih, item.klaim_inacbg,
        ]);
      });
    });
    return rows;
  };

  const csvEscape = (value: string | number): string => {
    const s = String(value ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  // Excel otomatis membaca isi sel CSV yang "kelihatan" seperti angka
  // (mis. No.RM "000013") sebagai angka murni & membuang nol di depannya
  // jadi "13" — walau nilainya dikutip di CSV. Trik standarnya: bungkus
  // sebagai formula ="000013" supaya Excel memaksa sel tsb tetap teks apa
  // adanya (No.Rawat aman karena sudah ada "/" sehingga tidak dianggap angka).
  const csvForceText = (value: string): string => `="${value}"`;

  const handleExportCsv = () => {
    setShowExportDropdown(false);
    const rows = buildExportRows().map((row) =>
      row.map((cell, idx) => (idx === 1 ? csvForceText(String(cell)) : cell))
    );
    const csv = [exportHeader, ...rows].map((row) => row.map(csvEscape).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Monitoring_Biaya_Klaim_BPJS_${localDateStr()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // XLSX ditulis langsung sbg file .xlsx asli (bukan CSV berekstensi xlsx),
  // jadi No.RM tidak perlu trik ="..." spt CSV — SheetJS menyimpan tipe sel
  // eksplisit (string), Excel tidak menebak2 & tidak membuang nol di depan.
  const handleExportXlsx = () => {
    setShowExportDropdown(false);
    const rows = buildExportRows();
    const ws = XLSX.utils.aoa_to_sheet([exportHeader, ...rows]);
    rows.forEach((_, i) => {
      const cellRef = XLSX.utils.encode_cell({ r: i + 1, c: 1 });
      if (ws[cellRef]) { ws[cellRef].t = 's'; ws[cellRef].z = '@'; }
    });
    ws['!cols'] = [
      { wch: 14 }, { wch: 10 }, { wch: 24 }, { wch: 8 }, { wch: 20 }, { wch: 28 },
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 12 },
      { wch: 14 }, { wch: 14 }, { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Klaim INACBG');
    XLSX.writeFile(wb, `Monitoring_Biaya_Klaim_BPJS_${localDateStr()}.xlsx`);
  };

  // PDF — pola cetak baku (window.open + document.write + print bawaan
  // browser, bukan library PDF), kop/font/ukuran kertas mengikuti
  // CETAK_STANDAR.md. Landscape A4 krn kolomnya banyak (14 kolom).
  const handleExportPdf = async () => {
    setShowExportDropdown(false);
    const printWindow = window.open('', '_blank', 'width=1100,height=800');
    if (!printWindow) return;

    let settings = { nama_instansi: '', alamat: '', logo_url: '', kota_rs: '', kontak: '', email_rs: '' };
    try {
      const res = await fetch('/api/admin/settings');
      if (res.ok) settings = await res.json();
    } catch { /* lanjut cetak tanpa kop lengkap */ }

    const logoSrc = settings.logo_url
      ? (settings.logo_url.startsWith('/') ? `${window.location.origin}${settings.logo_url}` : settings.logo_url)
      : '';
    const kontakEmail = [settings.kontak, settings.email_rs ? `E-mail : ${settings.email_rs}` : '']
      .filter(Boolean).join('<br/>');

    const rowsHtml = groupedByDokter(filteredItems).map(([dokter, list]) => {
      const bodyRows = list.map((item) => `
        <tr>
          <td class="nowrap">${item.no_rawat}</td>
          <td class="nowrap">${item.no_rkm_medis}</td>
          <td>${item.nm_pasien}</td>
          <td>${item.kelas || '-'}</td>
          <td>${item.diagnosa || '-'}</td>
          <td style="text-align:right">${formatAngkaExport(item.biaya_obat)}</td>
          <td style="text-align:right">${formatAngkaExport(item.biaya_lab)}</td>
          <td style="text-align:right">${formatAngkaExport(item.biaya_radiologi)}</td>
          <td style="text-align:right">${formatAngkaExport(item.biaya_darah)}</td>
          <td style="text-align:right">${formatAngkaExport(item.biaya_gizi)}</td>
          <td style="text-align:right">${formatAngkaExport(item.biaya_jasa_medis)}</td>
          <td style="text-align:right">${formatAngkaExport(item.billing)}</td>
          <td style="text-align:right">${formatAngkaExport(item.selisih)}</td>
          <td style="text-align:right">${formatAngkaExport(item.klaim_inacbg)}</td>
        </tr>
      `).join('');
      return `
        <tr><td colspan="14" class="dpjp-row">DPJP : ${dokter}</td></tr>
        ${bodyRows}
      `;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Monitoring Biaya & Klaim INACBG - ${localDateStr()}</title>
          <style>
            @page { size: 297mm 210mm; margin-top: 14px; }
            body { font-family: Tahoma, Arial, sans-serif; font-size: 8pt; padding: 0 16px 16px; color: #000; }
            table.tbl_form td { border: 0; vertical-align: middle; }
            hr { border: none; border-top: 1px solid #000; margin: 8px 0; }
            table.rincian { width: 100%; border-collapse: collapse; font-size: 8pt; margin-top: 10px; }
            table.rincian th, table.rincian td { padding: 3px 4px; vertical-align: top; border-bottom: 1px solid #e0e0e0; }
            table.rincian th { text-align: left; border-bottom: 2px solid #333; }
            table.rincian td.nowrap { white-space: nowrap; }
            table.rincian td.dpjp-row { font-weight: 700; background: #f3f4f6; border-top: 2px solid #333; }
            .rs-nama { font-size: 14pt; }
            .rs-alamat { font-size: 9pt; }
            .judul { font-size: 12pt; }
          </style>
        </head>
        <body>
          <table width="100%" align="center" border="0" class="tbl_form" cellspacing="0" cellpadding="0">
            <tr>
              <td width="15%">${logoSrc ? `<img width="65" height="65" src="${logoSrc}" />` : ''}</td>
              <td width="70%">
                <center>
                  <div class="rs-nama">${settings.nama_instansi}</div>
                  <div class="rs-alamat">${settings.alamat}${kontakEmail ? `<br/>${kontakEmail}` : ''}</div>
                </center>
              </td>
              <td width="15%"></td>
            </tr>
          </table>
          <hr/>
          <center><div class="judul">MONITORING BIAYA &amp; KLAIM INACBG</div></center>

          <table class="rincian">
            <thead>
              <tr>
                <th>No.Rawat</th><th>No.RM</th><th>Nama Pasien</th><th>Kelas</th><th>Diagnosa</th>
                <th style="text-align:right">Obat</th><th style="text-align:right">Lab</th>
                <th style="text-align:right">Radiologi</th><th style="text-align:right">Darah</th>
                <th style="text-align:right">Gizi</th><th style="text-align:right">Jasa Medis</th>
                <th style="text-align:right">Billing</th><th style="text-align:right">Selisih</th>
                <th style="text-align:right">Klaim INACBG</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => printWindow.print();
  };

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

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setShowExportDropdown(false);
      }
    };
    if (showExportDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showExportDropdown]);

  return (
    <section style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar — dua baris: DPJP & Ekspor di paling atas, basis tanggal
          (Belum Pulang/Tgl.Masuk/Pulang) & Cari di baris kedua. */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          marginBottom: 16,
          flexShrink: 0
        }}
      >
        {/* Baris 1 — DPJP kiri, Ekspor kanan */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          {!isDokter ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <label style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>Tampilkan DPJP : </label>
            <div ref={dpjpDropdownRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setShowDpjpDropdown(!showDpjpDropdown)}
                style={{
                  padding: '6px 16px',
                  borderRadius: 4,
                  border: '1px solid #d1d5db',
                  background: '#ffffff',
                  color: '#374151',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2
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
                    borderRadius: 4,
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
          ) : <div />}

          <div ref={exportDropdownRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setShowExportDropdown((v) => !v)}
              disabled={filteredItems.length === 0}
              style={{
                padding: '6px 14px',
                borderRadius: 4,
                border: filteredItems.length === 0 ? '1px solid #9ca3af' : '1px solid #059669',
                background: filteredItems.length === 0 ? '#9ca3af' : '#059669',
                color: '#ffffff',
                cursor: filteredItems.length === 0 ? 'default' : 'pointer',
                fontSize: 12,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                whiteSpace: 'nowrap'
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Ekspor
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {showExportDropdown && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 4,
                  padding: 4,
                  background: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 4,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  zIndex: 100,
                  minWidth: 140,
                }}
              >
                {[
                  { label: 'CSV', onClick: handleExportCsv },
                  { label: 'XLSX (Excel)', onClick: handleExportXlsx },
                  { label: 'PDF', onClick: handleExportPdf },
                ].map((opt) => (
                  <div
                    key={opt.label}
                    onClick={opt.onClick}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 6,
                      fontSize: 12,
                      color: '#374151',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    {opt.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Baris 2 — Basis tanggal, padanan radio button "Belum Pulang /
            Tgl.Masuk : ... s.d ... / Pulang : ... s.d ..." di dialog Khanza
            Desktop: ketiga opsi & field tanggalnya SELALU tampil sebaris
            (bukan disembunyikan tergantung pilihan), user tinggal klik
            radio utk pindah basis. Field tanggal yang bukan basis aktif
            dinonaktifkan (abu-abu) supaya jelas mana yang sedang dipakai. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer' }}>
            <input
              type="radio"
              name="dateFilterMode"
              checked={dateFilterMode === 'belum-pulang'}
              onChange={() => setDateFilterMode('belum-pulang')}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ fontSize: 12, color: '#374151', whiteSpace: 'nowrap' }}>Belum Pulang</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer' }}>
            <input
              type="radio"
              name="dateFilterMode"
              checked={dateFilterMode === 'masuk'}
              onChange={() => setDateFilterMode('masuk')}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ fontSize: 12, color: '#374151', whiteSpace: 'nowrap' }}>Tgl. Masuk :</span>
          </label>
          <input
            type="date"
            value={tglDari}
            disabled={dateFilterMode !== 'masuk'}
            onChange={(e) => { setTglDari(e.target.value); setDateFilterMode('masuk'); }}
            style={{
              padding: '4px 6px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12, boxSizing: 'border-box',
              background: dateFilterMode === 'masuk' ? '#ffffff' : '#f3f4f6',
              color: dateFilterMode === 'masuk' ? '#111827' : '#9ca3af'
            }}
          />
          <span style={{ color: '#9ca3af', fontSize: 12 }}>s.d</span>
          <input
            type="date"
            value={tglSampai}
            disabled={dateFilterMode !== 'masuk'}
            onChange={(e) => { setTglSampai(e.target.value); setDateFilterMode('masuk'); }}
            style={{
              padding: '4px 6px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12, boxSizing: 'border-box',
              background: dateFilterMode === 'masuk' ? '#ffffff' : '#f3f4f6',
              color: dateFilterMode === 'masuk' ? '#111827' : '#9ca3af'
            }}
          />

          <label style={{ display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer' }}>
            <input
              type="radio"
              name="dateFilterMode"
              checked={dateFilterMode === 'pulang'}
              onChange={() => setDateFilterMode('pulang')}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ fontSize: 12, color: '#374151', whiteSpace: 'nowrap' }}>Pulang :</span>
          </label>
          <input
            type="date"
            value={tglPulangDari}
            disabled={dateFilterMode !== 'pulang'}
            onChange={(e) => { setTglPulangDari(e.target.value); setDateFilterMode('pulang'); }}
            style={{
              padding: '4px 6px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12, boxSizing: 'border-box',
              background: dateFilterMode === 'pulang' ? '#ffffff' : '#f3f4f6',
              color: dateFilterMode === 'pulang' ? '#111827' : '#9ca3af'
            }}
          />
          <span style={{ color: '#9ca3af', fontSize: 12 }}>s.d</span>
          <input
            type="date"
            value={tglPulangSampai}
            disabled={dateFilterMode !== 'pulang'}
            onChange={(e) => { setTglPulangSampai(e.target.value); setDateFilterMode('pulang'); }}
            style={{
              padding: '4px 6px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12, boxSizing: 'border-box',
              background: dateFilterMode === 'pulang' ? '#ffffff' : '#f3f4f6',
              color: dateFilterMode === 'pulang' ? '#111827' : '#9ca3af'
            }}
          />

          <div style={{ position: 'relative', marginLeft: 'auto' }}>
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#9ca3af"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            >
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              placeholder="Cari No. RM / Nama Pasien / Nama Dokter"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{
                padding: '6px 12px 6px 30px',
                borderRadius: 4,
                border: '1px solid #d1d5db',
                fontSize: 12,
                width: 260,
                outline: 'none'
              }}
            />
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
                <span style={{ marginLeft: 'auto', fontSize: 12, color: '#6b7280' }}>
                  Total Pasien: <strong style={{ color: '#374151' }}>{list.length}</strong>
                </span>
              </div>
              <div style={{ borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead style={{ background: '#f3f4f6' }}>
                    <tr>
                      <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. Rawat</th>
                      <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. RM</th>
                      <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Nama Pasien</th>
                      <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Kelas</th>
                      <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Diagnosa</th>
                      <th style={{ padding: '8px', textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Obat</th>
                      <th style={{ padding: '8px', textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Laboratorium</th>
                      <th style={{ padding: '8px', textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Radiologi</th>
                      <th style={{ padding: '8px', textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Darah</th>
                      <th style={{ padding: '8px', textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Gizi</th>
                      <th style={{ padding: '8px', textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Jasa Medis</th>
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
                            {item.kelas || '-'}
                          </td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontSize: 12, color: '#374151' }}>
                            {item.diagnosa || '-'}
                          </td>
                          <td style={{
                            padding: '6px 8px',
                            borderBottom: '1px solid #e5e7eb',
                            fontSize: 12,
                            textAlign: 'right',
                          }}>
                            <span
                              onClick={() => setPreviewObatNoRawat(item.no_rawat)}
                              title="Klik untuk lihat detail pemberian obat"
                              style={{
                                cursor: 'pointer',
                                borderBottom: '1px dashed currentColor',
                                color: item.klaim_inacbg > 0 && item.biaya_obat >= item.klaim_inacbg * 0.3
                                  ? '#dc2626'
                                  : item.klaim_inacbg > 0 && item.biaya_obat >= item.klaim_inacbg * 0.2
                                    ? '#eab308'
                                    : '#374151',
                                fontWeight: item.klaim_inacbg > 0 && item.biaya_obat >= item.klaim_inacbg * 0.2 ? 600 : undefined
                              }}
                            >
                              {formatRupiah(item.biaya_obat)}
                              {item.klaim_inacbg > 0 && ` (${Math.round((item.biaya_obat / item.klaim_inacbg) * 100)}%)`}
                            </span>
                          </td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontSize: 12, textAlign: 'right' }}>
                            <span
                              onClick={() => setPreviewLabNoRawat(item.no_rawat)}
                              title="Klik untuk lihat detail pemeriksaan lab"
                              style={{ cursor: 'pointer', borderBottom: '1px dashed currentColor', color: '#374151' }}
                            >
                              {formatRupiah(item.biaya_lab)}
                            </span>
                          </td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontSize: 12, color: '#374151', textAlign: 'right' }}>
                            {formatRupiah(item.biaya_radiologi)}
                          </td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontSize: 12, color: '#374151', textAlign: 'right' }}>
                            {formatRupiah(item.biaya_darah)}
                          </td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontSize: 12, color: '#374151', textAlign: 'right' }}>
                            {formatRupiah(item.biaya_gizi)}
                          </td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontSize: 12, color: '#374151', textAlign: 'right' }}>
                            {formatRupiah(item.biaya_jasa_medis)}
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
      {previewObatNoRawat && (
        <ModalDetailPemberianObat noRawat={previewObatNoRawat} onClose={() => setPreviewObatNoRawat(null)} />
      )}
      {previewLabNoRawat && (
        <ModalDetailPeriksaLab noRawat={previewLabNoRawat} onClose={() => setPreviewLabNoRawat(null)} />
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
