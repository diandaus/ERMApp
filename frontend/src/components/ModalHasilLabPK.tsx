import React from 'react';
import Swal from 'sweetalert2';
import QRCode from 'qrcode';

// ModalHasilLabPK — "Input Data Hasil Periksa Laboratorium PK", padanan pola
// ModalHasilRadiologi.tsx (header identitas, Dokter P.J. default dari
// set_pjlab.kd_dokterlab, Petugas auto dari user login, Tanggal+Jam
// otomatis) tapi bagian isi hasilnya beda: bukan satu textarea bacaan bebas,
// melainkan TABEL nilai per parameter (template_laboratorium), mengikuti
// pola "Detail Pemeriksaan" yang sudah ada di ModalInputLab.tsx — cuma di
// sana kolomnya utk MEMILIH parameter yg diminta, di sini utk MENGISI
// nilai hasilnya.

type ExamDetail = { kd_jenis_prw: string; nm_perawatan: string };

type HasilNilaiItem = { pemeriksaan: string; nilai: string; keterangan: string };

type OrderDetail = {
  noorder: string; no_rawat: string; no_rkm_medis: string; nm_pasien: string;
  dokter_perujuk: string; nm_dokter: string; status: string;
  diagnosa_klinis: string; informasi_tambahan: string;
  sudah_ada_hasil: boolean; pemeriksaan: ExamDetail[];
  kd_dokter_pj: string; nm_dokter_pj: string;
  hasil_nilai: HasilNilaiItem[];
};

type TemplateItem = {
  id_template: number; pemeriksaan: string; satuan: string;
  nilai_rujukan_ld: string; nilai_rujukan_la: string; nilai_rujukan_pd: string; nilai_rujukan_pa: string;
  kd_jenis_prw: string;
};

// fontSize 12.5 — disamakan dgn konvensi ModalPenyerahanResep.tsx (label
// "Unggah foto manual" & file input di sana juga 12/12.5, bukan 13).
const pill: React.CSSProperties = {
  padding: '7px 14px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12.5,
  outline: 'none', boxSizing: 'border-box', background: '#ffffff', color: '#111827',
};
const pillReadOnly: React.CSSProperties = { ...pill, background: '#f9fafb', color: '#374151' };
const labelSm: React.CSSProperties = { fontSize: 12.5, color: '#374151', flexShrink: 0, width: 96 };
const clipBtn: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 4, border: '1px solid #e5e7eb', background: '#ffffff',
  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'default', flexShrink: 0, color: '#9ca3af',
};

const ClipIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
  </svg>
);

type Props = { noorder: string; nip?: string; onClose: () => void; onSaved: () => void };

export const ModalHasilLabPK: React.FC<Props> = ({ noorder, nip, onClose, onSaved }) => {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [detail, setDetail] = React.useState<OrderDetail | null>(null);
  const [examChecked, setExamChecked] = React.useState<Record<string, boolean>>({});
  const [templates, setTemplates] = React.useState<TemplateItem[]>([]);
  const [loadingTemplates, setLoadingTemplates] = React.useState(false);
  const [nilaiMap, setNilaiMap] = React.useState<Record<number, { nilai: string; keterangan: string }>>({});

  const [petugasQuery, setPetugasQuery] = React.useState('');
  const [petugasNip, setPetugasNip] = React.useState('');
  const [petugasList, setPetugasList] = React.useState<{ nip: string; nama: string }[]>([]);
  const [showPetugasDropdown, setShowPetugasDropdown] = React.useState(false);

  const [dokterPjQuery, setDokterPjQuery] = React.useState('');
  const [kdDokterPj, setKdDokterPj] = React.useState('');
  const [dokterPjList, setDokterPjList] = React.useState<{ kd_dokter: string; nm_dokter: string }[]>([]);
  const [showDokterPjDropdown, setShowDokterPjDropdown] = React.useState(false);

  const [otomatisJam, setOtomatisJam] = React.useState(true);
  const [tglPeriksa, setTglPeriksa] = React.useState('');
  const [jamPeriksa, setJamPeriksa] = React.useState('');

  const [saving, setSaving] = React.useState(false);
  const [printing, setPrinting] = React.useState(false);

  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/lab-pk/permintaan/${encodeURIComponent(noorder)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal memuat detail permintaan');
        setDetail(data);
        const checked: Record<string, boolean> = {};
        (data.pemeriksaan || []).forEach((e: ExamDetail) => { checked[e.kd_jenis_prw] = true; });
        setExamChecked(checked);
        if (data.kd_dokter_pj) {
          setKdDokterPj(data.kd_dokter_pj);
          setDokterPjQuery(data.nm_dokter_pj || '');
          setDokterPjList([{ kd_dokter: data.kd_dokter_pj, nm_dokter: data.nm_dokter_pj || '' }]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
      } finally {
        setLoading(false);
      }
    })();
    const now = new Date();
    setTglPeriksa(todayStr());
    setJamPeriksa(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noorder]);

  // Muat template parameter (template_laboratorium) utk SEMUA pemeriksaan
  // di permintaan ini sekaligus (bukan cuma yg dicentang) — dimuat sekali
  // begitu detail selesai dimuat, ditampilkan/disembunyikan per exam lewat
  // examChecked (bukan di-fetch ulang tiap toggle, spy tidak flicker).
  React.useEffect(() => {
    if (!detail || detail.pemeriksaan.length === 0) return;
    let cancelled = false;
    setLoadingTemplates(true);
    Promise.all(
      detail.pemeriksaan.map((e) =>
        fetch(`/api/lab/template?kd_jenis_prw=${encodeURIComponent(e.kd_jenis_prw)}`)
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => [])
      )
    )
      .then((results) => {
        if (cancelled) return;
        const merged: TemplateItem[] = results.flat().filter(Boolean);
        setTemplates(merged);
        // Prefill nilai dari hasil_nilai (kalau sudah pernah diisi) — cocokkan
        // berdasarkan nama Pemeriksaan (trim), sumbernya sama-sama dari
        // template_laboratorium jadi namanya identik.
        const prefill: Record<number, { nilai: string; keterangan: string }> = {};
        merged.forEach((t) => {
          const match = (detail.hasil_nilai || []).find((h) => h.pemeriksaan.trim() === t.pemeriksaan.trim());
          prefill[t.id_template] = { nilai: match?.nilai || '', keterangan: match?.keterangan || '' };
        });
        setNilaiMap(prefill);
      })
      .finally(() => { if (!cancelled) setLoadingTemplates(false); });
    return () => { cancelled = true; };
  }, [detail]);

  React.useEffect(() => {
    const t = setTimeout(async () => {
      const res = await fetch(`/api/petugas?search=${encodeURIComponent(petugasQuery)}`);
      if (res.ok) setPetugasList(await res.json());
    }, 250);
    return () => clearTimeout(t);
  }, [petugasQuery]);

  React.useEffect(() => {
    const t = setTimeout(async () => {
      const res = await fetch(`/api/dokter?search=${encodeURIComponent(dokterPjQuery)}`);
      if (res.ok) setDokterPjList(await res.json());
    }, 250);
    return () => clearTimeout(t);
  }, [dokterPjQuery]);

  // Petugas default = user yg sedang login (nip) — cari by nip persis
  // (bukan substring) supaya tidak salah ambil petugas lain.
  React.useEffect(() => {
    if (!nip) return;
    (async () => {
      const res = await fetch(`/api/petugas?search=${encodeURIComponent(nip)}`);
      if (!res.ok) return;
      const list: { nip: string; nama: string }[] = await res.json();
      const match = list.find((p) => p.nip === nip);
      if (match) {
        setPetugasNip(match.nip);
        setPetugasQuery(match.nama);
      }
    })();
  }, [nip]);

  const updateNilai = (idTemplate: number, patch: Partial<{ nilai: string; keterangan: string }>) => {
    setNilaiMap((prev) => ({ ...prev, [idTemplate]: { ...(prev[idTemplate] || { nilai: '', keterangan: '' }), ...patch } }));
  };

  // Kelompokkan template per pemeriksaan induk (kd_jenis_prw), cuma yang
  // exam-nya dicentang — sama pola groupedDetailPK di ModalInputLab.tsx.
  const groupedTemplates = React.useMemo(() => {
    const groups: { kd_jenis_prw: string; nm_perawatan: string; items: TemplateItem[] }[] = [];
    const idxByKd: Record<string, number> = {};
    templates.forEach((t) => {
      if (!examChecked[t.kd_jenis_prw]) return;
      if (!(t.kd_jenis_prw in idxByKd)) {
        idxByKd[t.kd_jenis_prw] = groups.length;
        const exam = detail?.pemeriksaan.find((e) => e.kd_jenis_prw === t.kd_jenis_prw);
        groups.push({ kd_jenis_prw: t.kd_jenis_prw, nm_perawatan: exam?.nm_perawatan || t.kd_jenis_prw, items: [] });
      }
      groups[idxByKd[t.kd_jenis_prw]].items.push(t);
    });
    return groups;
  }, [templates, examChecked, detail]);

  // umurDariTglLahir — padanan persis di ModalHasilRadiologi.tsx.
  const umurDariTglLahir = (tglLahir: string): string => {
    if (!tglLahir || tglLahir === '0000-00-00') return '-';
    const birth = new Date(tglLahir);
    const today = new Date();
    let years = today.getFullYear() - birth.getFullYear();
    let months = today.getMonth() - birth.getMonth();
    let days = today.getDate() - birth.getDate();
    if (days < 0) {
      months--;
      days += new Date(today.getFullYear(), today.getMonth(), 0).getDate();
    }
    if (months < 0) {
      years--;
      months += 12;
    }
    return `${years} Th ${months} Bl ${days} Hr`;
  };

  // handleCetak — "HASIL PEMERIKSAAN LABORATORIUM", padanan handleCetak di
  // ModalHasilRadiologi.tsx (kop RS, info pasien 2 kolom, tanda tangan
  // elektronik 2 kolom dgn QR) tapi isi hasilnya TABEL per parameter
  // (bukan teks bebas) — datanya dari GET /api/lab-pk/cetak/:noorder
  // (backend ambil sesi periksa_lab TERBARU utk no_rawat ini, bukan cuma
  // apa yg sedang diketik di form, jadi tombol ini cuma aktif kalau
  // hasilnya SUDAH tersimpan).
  const handleCetak = async () => {
    setPrinting(true);
    try {
      const [dataRes, settingsRes] = await Promise.all([
        fetch(`/api/lab-pk/cetak/${encodeURIComponent(noorder)}`),
        fetch('/api/admin/settings'),
      ]);
      const data = await dataRes.json();
      if (!dataRes.ok) throw new Error(data.error || 'Gagal memuat data cetak');
      let settings = { nama_instansi: '', alamat: '', logo_url: '', kota_rs: '', kontak: '', email_rs: '' };
      if (settingsRes.ok) settings = await settingsRes.json();

      const printWindow = window.open('', '_blank', 'width=900,height=1000');
      if (!printWindow) return;

      const logoSrc = settings.logo_url
        ? (settings.logo_url.startsWith('/') ? `${window.location.origin}${settings.logo_url}` : settings.logo_url)
        : '';
      const kontakEmail = [settings.kontak, settings.email_rs ? `E-mail : ${settings.email_rs}` : '']
        .filter(Boolean).join('<br/>');

      const tanggalCetak = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
        + ' ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      const fingerPj =
        `Dikeluarkan di ${settings.nama_instansi}, Kabupaten/Kota ${settings.kota_rs}\n` +
        `Ditandatangani secara elektronik oleh ${data.penanggung_jawab || '-'}\n` +
        `ID ${data.kd_penanggung_jawab || '-'}\n${tanggalCetak}`;
      const fingerPetugas =
        `Dikeluarkan di ${settings.nama_instansi}, Kabupaten/Kota ${settings.kota_rs}\n` +
        `Ditandatangani secara elektronik oleh ${data.petugas_nama || '-'}\n` +
        `ID ${data.petugas_nip || '-'}\n${tanggalCetak}`;

      let qrPj = '';
      let qrPetugas = '';
      try { qrPj = await QRCode.toDataURL(fingerPj, { width: 80, margin: 1 }); } catch { /* lanjut tanpa QR */ }
      try { qrPetugas = await QRCode.toDataURL(fingerPetugas, { width: 80, margin: 1 }); } catch { /* lanjut tanpa QR */ }

      type CetakItem = { nm_perawatan: string; pemeriksaan: string; hasil: string; satuan: string; nilai_rujukan: string; keterangan: string };
      const items: CetakItem[] = data.hasil || [];
      const rowsHtml = items.map((it) => `
        <tr>
          <td>${it.pemeriksaan}</td>
          <td>${it.hasil || '-'}</td>
          <td>${it.satuan || '-'}</td>
          <td>${it.nilai_rujukan || '-'}</td>
          <td>${it.keterangan || '-'}</td>
        </tr>
      `).join('');

      printWindow.document.write(`
        <html>
          <head>
            <title>Hasil Pemeriksaan Laboratorium - ${data.no_periksa}</title>
            <style>
              @page { size: 210mm 297mm; margin-top: 14px; }
              body { font-family: Tahoma, Arial, sans-serif; font-size: 11pt; padding: 0 16px 16px; color: #000; }
              table.tbl_form td { border: 0; vertical-align: middle; }
              hr { border: none; border-top: 1px solid #000; margin: 8px 0; }
              table.info { width: 100%; table-layout: fixed; border-collapse: collapse; margin-top: 10px; font-size: 11pt; }
              table.info td { padding: 2px 4px; vertical-align: top; }
              table.info td.label { white-space: nowrap; }
              table.info td.truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 0; }
              table.info td.nowrap { white-space: nowrap; }
              table.hasil { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10.5pt; }
              table.hasil th, table.hasil td { border: 1px solid #333; padding: 4px 6px; text-align: left; }
              table.hasil th { background: #f3f4f6; }
              .ttd { width: 45%; text-align: center; font-size: 11pt; }
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
            <center><div class="judul">HASIL PEMERIKSAAN LABORATORIUM</div></center>

            <table class="info">
              <colgroup>
                <col style="width:14%"><col style="width:2%"><col style="width:36%">
                <col style="width:20%"><col style="width:2%"><col style="width:26%">
              </colgroup>
              <tr>
                <td class="label">No.RM</td><td class="sep">:</td><td>${data.no_rm}</td>
                <td class="label">Penanggung Jawab</td><td class="sep">:</td><td class="nowrap">${data.penanggung_jawab || '-'}</td>
              </tr>
              <tr>
                <td class="label">Nama Pasien</td><td class="sep">:</td><td>${data.nama_pasien}</td>
                <td class="label">Dokter Pengirim</td><td class="sep">:</td><td class="nowrap">${data.dokter_pengirim || '-'}</td>
              </tr>
              <tr>
                <td class="label">JK/Umur</td><td class="sep">:</td><td>${data.jk || '-'} / ${umurDariTglLahir(data.tgl_lahir)}</td>
                <td class="label">Tgl.Pemeriksaan</td><td class="sep">:</td><td>${data.tgl_pemeriksaan}</td>
              </tr>
              <tr>
                <td class="label">Alamat</td><td class="sep">:</td><td class="truncate" title="${data.alamat || '-'}">${data.alamat || '-'}</td>
                <td class="label">Jam Pemeriksaan</td><td class="sep">:</td><td>${data.jam_pemeriksaan}</td>
              </tr>
              <tr>
                <td class="label">No.Periksa</td><td class="sep">:</td><td>${data.no_periksa}</td>
                <td class="label">Poli</td><td class="sep">:</td><td>${data.poli || '-'}</td>
              </tr>
            </table>

            <table class="hasil">
              <thead>
                <tr><th>Pemeriksaan</th><th>Hasil</th><th>Satuan</th><th>Nilai Rujukan</th><th>Keterangan</th></tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>

            <table width="100%" style="margin-top:24px;">
              <tr>
                <td></td>
                <td class="ttd">Tgl.Cetak : ${tanggalCetak}</td>
              </tr>
              <tr>
                <td class="ttd">
                  <div>Penanggung Jawab</div>
                  ${qrPj ? `<img src="${qrPj}" width="65" height="65" style="margin:8px 0;" />` : '<div style="height:65px;"></div>'}
                  <div>${data.penanggung_jawab || '-'}</div>
                </td>
                <td class="ttd">
                  <div>Petugas Laboratorium</div>
                  ${qrPetugas ? `<img src="${qrPetugas}" width="65" height="65" style="margin:8px 0;" />` : '<div style="height:65px;"></div>'}
                  <div>${data.petugas_nama || '-'}</div>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.onload = () => printWindow.print();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setPrinting(false);
    }
  };

  const handleSubmit = async () => {
    if (!petugasNip) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Pilih Petugas dulu' });
      return;
    }
    if (!kdDokterPj) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Pilih Dokter P.J. dulu' });
      return;
    }
    if (groupedTemplates.length === 0) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Centang minimal satu pemeriksaan' });
      return;
    }
    const adaNilai = groupedTemplates.some((g) => g.items.some((t) => (nilaiMap[t.id_template]?.nilai || '').trim() !== ''));
    if (!adaNilai) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Isi minimal satu nilai hasil pemeriksaan' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/lab-pk/hasil', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noorder,
          no_rawat: detail!.no_rawat,
          nip: petugasNip,
          kd_dokter: kdDokterPj,
          pemeriksaan: groupedTemplates.map((g) => ({
            kd_jenis_prw: g.kd_jenis_prw,
            detail: g.items.map((t) => ({
              id_template: t.id_template,
              nilai: nilaiMap[t.id_template]?.nilai || '',
              keterangan: nilaiMap[t.id_template]?.keterangan || '',
            })),
          })),
          tgl: otomatisJam ? '' : tglPeriksa,
          jam: otomatisJam ? '' : jamPeriksa,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan hasil pemeriksaan');
      await Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Hasil pemeriksaan lab PK berhasil disimpan', timer: 2000, showConfirmButton: false });
      onSaved();
      onClose();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setSaving(false);
    }
  };

  // Loading/error state — modal SATU panel kecil (belum ada data pasien
  // buat panel kiri), baru pecah jadi 2 panel begitu detail selesai dimuat.
  if (loading || error || !detail) {
    return (
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}
        onClick={onClose}
      >
        <div
          style={{ background: '#ffffff', borderRadius: 16, padding: 24, width: 420, maxWidth: '92vw', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 15, color: '#111827' }}>Input Data Hasil Periksa Laboratorium PK</span>
            <button
              type="button" onClick={onClose}
              style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}
            >&times;</button>
          </div>
          {loading ? (
            <div style={{ padding: 30, textAlign: 'center', color: '#6b7280' }}>Memuat...</div>
          ) : (
            <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: 13 }}>{error}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}
      onClick={onClose}
    >
      {/* 2 panel terpisah bersisian — bukan 1 kotak dgn grid internal —
          sama pola dgn ModalPenyerahanResep.tsx (main card + side card,
          masing2 kartu putih sendiri, disatukan lewat flex row + gap). */}
      <div style={{ display: 'flex', alignItems: 'stretch', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>

        {/* Panel kiri — Data Permintaan (identitas + checklist pemeriksaan) */}
        <div
          style={{ background: '#ffffff', borderRadius: 16, padding: 20, width: 340, maxWidth: '92vw', height: '90vh', maxHeight: '90vh', boxShadow: '0 20px 50px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Title + baris identitas ringkas sbg teks polos (bukan pill/box
              input) — persis pola ModalPenyerahanResep.tsx, termasuk
              ukuran fontnya (judul 15/700, info 12/#6b7280). */}
          <div style={{ fontSize: 15, color: '#111827', marginBottom: 4 }}>Data Permintaan</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>
            No.Rawat {detail.no_rawat} — {detail.nm_pasien} ({detail.no_rkm_medis})
          </div>

            {/* Header identitas — pill fields, padanan ModalHasilRadiologi.tsx.
                Card abu-abu di sekitarnya sengaja dihapus dulu (langsung di
                background putih panel), bukan dobel kotak. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ ...labelSm, width: 'auto' }}>Dokter P.J. :</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input
                      value={dokterPjQuery}
                      onChange={(e) => { setDokterPjQuery(e.target.value); setKdDokterPj(''); setShowDokterPjDropdown(true); }}
                      onFocus={() => setShowDokterPjDropdown(true)}
                      onBlur={() => setTimeout(() => setShowDokterPjDropdown(false), 200)}
                      placeholder="Cari dokter..."
                      style={{ ...pill, width: '100%' }}
                    />
                    {showDokterPjDropdown && dokterPjList.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, maxHeight: 180, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 10 }}>
                        {dokterPjList.map((d) => (
                          <div key={d.kd_dokter} onClick={() => { setKdDokterPj(d.kd_dokter); setDokterPjQuery(d.nm_dokter); setShowDokterPjDropdown(false); }}
                            style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid #f3f4f6' }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                            onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                          >{d.nm_dokter}</div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={clipBtn}><ClipIcon /></div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ ...labelSm, width: 'auto' }}>Petugas :</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input
                      value={petugasQuery}
                      onChange={(e) => { setPetugasQuery(e.target.value); setPetugasNip(''); setShowPetugasDropdown(true); }}
                      onFocus={() => setShowPetugasDropdown(true)}
                      onBlur={() => setTimeout(() => setShowPetugasDropdown(false), 200)}
                      placeholder="Cari nama petugas..."
                      style={{ ...pill, width: '100%' }}
                    />
                    {showPetugasDropdown && petugasList.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, maxHeight: 180, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 10 }}>
                        {petugasList.map((p) => (
                          <div key={p.nip} onClick={() => { setPetugasNip(p.nip); setPetugasQuery(p.nama); setShowPetugasDropdown(false); }}
                            style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid #f3f4f6' }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                            onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                          >{p.nama} <span style={{ color: '#9ca3af' }}>({p.nip})</span></div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={clipBtn}><ClipIcon /></div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ ...labelSm, width: 'auto' }}>Dokter Perujuk :</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input readOnly value={detail.nm_dokter} style={{ ...pillReadOnly, flex: 1 }} />
                  <div style={clipBtn}><ClipIcon /></div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <input
                  type="date" value={tglPeriksa} onChange={(e) => setTglPeriksa(e.target.value)}
                  disabled={otomatisJam} style={{ ...pill, width: 130, opacity: otomatisJam ? 0.6 : 1 }}
                />
                <input
                  type="time" value={jamPeriksa} onChange={(e) => setJamPeriksa(e.target.value)}
                  disabled={otomatisJam} style={{ ...pill, width: 95, opacity: otomatisJam ? 0.6 : 1 }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#374151', cursor: 'pointer' }}>
                  <input type="checkbox" checked={otomatisJam} onChange={(e) => setOtomatisJam(e.target.checked)} />
                  Otomatis
                </label>
              </div>
            </div>

            {/* Checklist pemeriksaan — exam mana yang mau diisi hasilnya
                sekarang (default semua tercentang). */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block', color: '#374151' }}>Pemeriksaan</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {detail.pemeriksaan.map((e) => (
                  <label
                    key={e.kd_jenis_prw}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                      border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                      background: examChecked[e.kd_jenis_prw] ? '#e0f2fe' : '#ffffff',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!!examChecked[e.kd_jenis_prw]}
                      onChange={(ev) => setExamChecked((prev) => ({ ...prev, [e.kd_jenis_prw]: ev.target.checked }))}
                    />
                    {e.nm_perawatan}
                  </label>
                ))}
              </div>
            </div>
        </div>

        {/* Panel kanan — utama: header+close, tabel hasil per parameter
            (padanan tabel Detail Pemeriksaan di ModalInputLab.tsx, kolom
            Hasil & Keterangan bisa diisi, bukan cuma referensi), warning,
            footer Batal/Simpan. */}
        <div
          style={{ background: '#ffffff', borderRadius: 16, padding: 20, width: 860, maxWidth: '92vw', height: '90vh', maxHeight: '90vh', boxShadow: '0 20px 50px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <span style={{ fontSize: 15, color: '#111827' }}>Input Data Hasil Periksa Laboratorium PK</span>
            <button
              type="button" onClick={onClose}
              style={{
                width: 28, height: 28, borderRadius: '50%', border: '1px solid #e5e7eb',
                background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, lineHeight: 1, cursor: 'pointer', color: '#6b7280', padding: 0,
              }}
            >
              &times;
            </button>
          </div>

          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              {loadingTemplates ? (
                <div style={{ textAlign: 'center', padding: 16, color: '#6b7280' }}>
                  <div style={{ display: 'inline-block', width: 20, height: 20, border: '2px solid #f3f4f6', borderTop: '2px solid #1AB1E5', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                </div>
              ) : groupedTemplates.length === 0 ? (
                <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: 12.5, border: '1px dashed #e5e7eb', borderRadius: 8 }}>
                  Tidak ada parameter untuk pemeriksaan yang dicentang
                </div>
              ) : (
                <div style={{ flex: 1, minHeight: 0, border: '1px solid #e5e7eb', borderRadius: 8, overflowY: 'auto', overscrollBehavior: 'contain' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ background: '#f9fafb', color: '#374151' }}>
                        <th style={{ position: 'sticky', top: 0, zIndex: 1, background: '#f9fafb', padding: '8px 10px', textAlign: 'left', width: 180, fontWeight: 400, fontSize: 13, whiteSpace: 'nowrap' }}>Pemeriksaan</th>
                        <th style={{ position: 'sticky', top: 0, zIndex: 1, background: '#f9fafb', padding: '8px 10px', textAlign: 'left', width: 100, fontWeight: 400, fontSize: 13, whiteSpace: 'nowrap' }}>Hasil</th>
                        <th style={{ position: 'sticky', top: 0, zIndex: 1, background: '#f9fafb', padding: '8px 10px', textAlign: 'left', width: 80, fontWeight: 400, fontSize: 13, whiteSpace: 'nowrap' }}>Satuan</th>
                        {/* 4 kolom terpisah (bukan digabung 1 kolom) — persis
                            header tabel Khanza Desktop (tbDetailPK). */}
                        <th style={{ position: 'sticky', top: 0, zIndex: 1, background: '#f9fafb', padding: '8px 10px', textAlign: 'left', width: 100, fontWeight: 400, fontSize: 13, whiteSpace: 'nowrap' }}>Nilai Rujukan L.D.</th>
                        <th style={{ position: 'sticky', top: 0, zIndex: 1, background: '#f9fafb', padding: '8px 10px', textAlign: 'left', width: 100, fontWeight: 400, fontSize: 13, whiteSpace: 'nowrap' }}>Nilai Rujukan L.A.</th>
                        <th style={{ position: 'sticky', top: 0, zIndex: 1, background: '#f9fafb', padding: '8px 10px', textAlign: 'left', width: 100, fontWeight: 400, fontSize: 13, whiteSpace: 'nowrap' }}>Nilai Rujukan P.D.</th>
                        <th style={{ position: 'sticky', top: 0, zIndex: 1, background: '#f9fafb', padding: '8px 10px', textAlign: 'left', width: 100, fontWeight: 400, fontSize: 13, whiteSpace: 'nowrap' }}>Nilai Rujukan P.A.</th>
                        <th style={{ position: 'sticky', top: 0, zIndex: 1, background: '#f9fafb', padding: '8px 10px', textAlign: 'left', width: 90, fontWeight: 400, fontSize: 13, whiteSpace: 'nowrap' }}>Keterangan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedTemplates.map((g) => (
                        <React.Fragment key={g.kd_jenis_prw}>
                          {g.items.map((t) => (
                            <tr key={t.id_template} style={{ borderTop: '1px solid #f3f4f6' }}>
                              <td style={{ padding: '6px 10px', color: '#111827' }}>{t.pemeriksaan}</td>
                              <td style={{ padding: '4px 6px' }}>
                                <input
                                  type="text"
                                  value={nilaiMap[t.id_template]?.nilai || ''}
                                  onChange={(ev) => updateNilai(t.id_template, { nilai: ev.target.value })}
                                  style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                                />
                              </td>
                              <td style={{ padding: '6px 10px', color: '#374151' }}>{t.satuan || '-'}</td>
                              <td style={{ padding: '6px 10px', color: '#6b7280' }}>{t.nilai_rujukan_ld || '-'}</td>
                              <td style={{ padding: '6px 10px', color: '#6b7280' }}>{t.nilai_rujukan_la || '-'}</td>
                              <td style={{ padding: '6px 10px', color: '#6b7280' }}>{t.nilai_rujukan_pd || '-'}</td>
                              <td style={{ padding: '6px 10px', color: '#6b7280' }}>{t.nilai_rujukan_pa || '-'}</td>
                              <td style={{ padding: '4px 6px' }}>
                                <input
                                  type="text"
                                  value={nilaiMap[t.id_template]?.keterangan || ''}
                                  onChange={(ev) => updateNilai(t.id_template, { keterangan: ev.target.value })}
                                  style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                                />
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {detail.sudah_ada_hasil && (
              <div style={{ fontSize: 12, color: '#92400e', padding: '8px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8 }}>
                ⚠ Permintaan ini sudah pernah diisi hasilnya — nilai di atas sudah diprefill dari hasil terakhir, submit ulang akan menimpa nilai yang sama.
              </div>
            )}
          </div>

          {/* Footer — di luar area scroll, dipaku di dasar modal
              (flexShrink:0) supaya Batal/Simpan selalu kelihatan. */}
          <div style={{ flexShrink: 0, paddingTop: 12, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={handleCetak}
              disabled={printing}
              title="Cetak Hasil Pemeriksaan Laboratorium"
              style={{ width: 38, height: 38, borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: printing ? '#9ca3af' : '#374151', cursor: printing ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9"></polyline>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                <rect x="6" y="14" width="12" height="8"></rect>
              </svg>
            </button>
            <button type="button" onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#374151', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>Batal</button>
            <button
              type="button" onClick={handleSubmit} disabled={saving}
              style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: saving ? '#9ca3af' : '#2563eb', color: '#fff', cursor: saving ? 'default' : 'pointer', fontSize: 13 }}
            >
              {saving ? 'Menyimpan...' : 'Simpan Hasil'}
            </button>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }`}</style>
    </div>
  );
};
