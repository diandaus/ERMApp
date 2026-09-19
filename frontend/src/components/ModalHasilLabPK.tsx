import React from 'react';
import Swal from 'sweetalert2';
import QRCode from 'qrcode';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// ModalHasilLabPK — "Input Data Hasil Periksa Laboratorium PK", padanan pola
// ModalHasilRadiologi.tsx (header identitas, Dokter P.J. default dari
// set_pjlab.kd_dokterlab, Petugas auto dari user login, Tanggal+Jam
// otomatis) tapi bagian isi hasilnya beda: bukan satu textarea bacaan bebas,
// melainkan TABEL nilai per parameter (template_laboratorium), mengikuti
// pola "Detail Pemeriksaan" yang sudah ada di ModalInputLab.tsx — cuma di
// sana kolomnya utk MEMILIH parameter yg diminta, di sini utk MENGISI
// nilai hasilnya.

// PERURI_SIGNING_ERROR_MAP — tabel kode resultCode resmi API Signing
// Peruri, persis salinan dari ModalHasilRadiologi.tsx, dipakai
// handleTandaTangan supaya pesan error yg ditampilkan ke user jelas
// menyebut penyebabnya, bukan cuma resultDesc mentah yg kadang berupa
// placeholder rusak spt "%docSigningOutput/errorMessage%".
const PERURI_SIGNING_ERROR_MAP: Record<string, string> = {
  '01': 'OTP tidak valid/gagal. Silakan klik "Minta OTP Ulang" lalu coba Tanda Tangan lagi.',
  '02': 'Expired key.',
  '03': 'Dokumen sudah kadaluarsa atau sudah pernah ditandatangani. Coba ulangi dari awal (klik Tanda Tangan lagi).',
  '4001': 'Sertifikat elektronik dokter ini belum tersedia di Peruri. Cek status via tombol "Sertifikat" di Bridging > Peruri > Data Pengguna.',
  '4003': 'Worker Peruri belum tersedia. Coba lagi beberapa saat.',
  '4004': 'Worker Peruri sedang bermasalah. Coba lagi beberapa saat.',
  '4005': 'Spesimen tanda tangan tidak ditemukan — dokter kemungkinan belum submit spesimen tanda tangan ke Peruri.',
  '4006': 'Gagal mengambil data spesimen tanda tangan dari Peruri.',
  '4007': 'Gagal menambahkan visibility penandatangan.',
  '4008': 'Gagal mengubah visibility penandatangan.',
  '4009': 'File dokumen tidak ditemukan di Peruri.',
  '4012': 'Gagal melakukan proses penandatanganan di server Peruri.',
  '4014': 'Koordinat posisi tanda tangan tidak ditemukan di dokumen oleh Peruri.',
  '4015': 'Gagal generate Peruri Tera (stample tanda tangan).',
  '4017': 'Gagal generate kode QR tanda tangan.',
  '4026': 'Gagal memvalidasi token dan OTP. Silakan klik "Minta OTP Ulang" lalu coba Tanda Tangan lagi.',
};

type ExamDetail = { kd_jenis_prw: string; nm_perawatan: string };

type HasilNilaiItem = { pemeriksaan: string; nilai: string; keterangan: string };

type OrderDetail = {
  noorder: string; no_rawat: string; no_rkm_medis: string; nm_pasien: string; umur: string;
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
// StepperIcon — ikon bulat chevron atas-bawah, ganti "clip paper" dekoratif
// yg dulu nempel di samping field Dokter P.J./Petugas/Dokter Perujuk (persis
// pola PillSelect di ApotekPenerimaan.tsx/TarifLab.tsx, warna disesuaikan
// tema modal ini #1AB1E5).
const StepperIcon = () => (
  <div
    style={{
      position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
      width: 20, height: 20, borderRadius: 4, background: '#2563eb',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none', flexShrink: 0,
    }}
  >
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 8.5 12 3.5 7 8.5"></polyline>
      <polyline points="7 15.5 12 20.5 17 15.5"></polyline>
    </svg>
  </div>
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
  const [previewingTtd, setPreviewingTtd] = React.useState(false);
  const [signing, setSigning] = React.useState(false);
  const [requestingOtp, setRequestingOtp] = React.useState(false);
  const [downloadingTte, setDownloadingTte] = React.useState(false);
  // lastTteOrderId — orderId dari Send Document/Signing TERAKHIR di sesi
  // modal ini (bukan disimpan permanen), dipakai tombol Download utk
  // ambil dokumen yg sudah ditandatangani dari Peruri — persis pola
  // ModalHasilRadiologi.tsx.
  const [lastTteOrderId, setLastTteOrderId] = React.useState<string | null>(null);

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

  // applyHasilTemplate/handleSimpanTemplateBaru/handleBukaTemplateMenu —
  // "Template Hasil Pemeriksaan" (tombol bookmark di header tiap grup):
  // simpan set nilai Hasil (semua parameter dlm 1 pemeriksaan) sbg template
  // bernama, lalu klik utk langsung autofill ulang form — sangat membantu
  // pemeriksaan yg hasilnya narasi panjang & berulang (mis. Morfologi),
  // tinggal klik nama template = langsung terisi, tanpa ketik ulang.
  const applyHasilTemplate = (details: { id_template: number; nilai: string; keterangan: string }[]) => {
    details.forEach((d) => updateNilai(d.id_template, { nilai: d.nilai, keterangan: d.keterangan }));
  };

  const handleSimpanTemplateBaru = async (group: { kd_jenis_prw: string; nm_perawatan: string; items: TemplateItem[] }) => {
    const { value: nama } = await Swal.fire({
      title: 'Simpan sebagai Template',
      input: 'text',
      inputLabel: `Template untuk "${group.nm_perawatan}"`,
      inputPlaceholder: 'mis. Normal / Anemia Def.Fe',
      showCancelButton: true,
      confirmButtonText: 'Simpan',
      cancelButtonText: 'Batal',
      inputValidator: (v) => (!v || !v.trim() ? 'Nama template wajib diisi' : undefined),
    });
    if (!nama) return;
    const details = group.items.map((t) => ({
      id_template: t.id_template,
      nilai: nilaiMap[t.id_template]?.nilai || '',
      keterangan: nilaiMap[t.id_template]?.keterangan || '',
    }));
    try {
      const res = await fetch('/api/lab-pk/hasil-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kd_jenis_prw: group.kd_jenis_prw, nama_template: nama.trim(), details }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan template');
      Swal.fire({ icon: 'success', title: 'Tersimpan!', text: `Template "${nama.trim()}" siap dipakai lagi`, timer: 1800, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    }
  };

  const handleBukaTemplateMenu = async (group: { kd_jenis_prw: string; nm_perawatan: string; items: TemplateItem[] }) => {
    let templates: { id: number; nama_template: string; details: { id_template: number; nilai: string; keterangan: string }[] }[] = [];
    try {
      const res = await fetch(`/api/lab-pk/hasil-template?kd_jenis_prw=${encodeURIComponent(group.kd_jenis_prw)}`);
      templates = res.ok ? await res.json() : [];
    } catch { templates = []; }

    const listHtml = templates.length === 0
      ? `<div style="color:#9ca3af;font-size:12.5px;padding:10px 0;">Belum ada template tersimpan utk "${group.nm_perawatan}"</div>`
      : templates.map((t) => `
          <div class="tmpl-row" data-id="${t.id}" style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 12px;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:6px;cursor:pointer;text-align:left;">
            <span style="font-size:12.5px;color:#111827;">${t.nama_template}</span>
            <button type="button" class="tmpl-del" data-id="${t.id}" title="Hapus template" style="border:none;background:transparent;color:#dc2626;cursor:pointer;font-size:11px;padding:2px 4px;">Hapus</button>
          </div>
        `).join('');

    Swal.fire({
      title: `Template — ${group.nm_perawatan}`,
      html: `
        <div id="tmplListWrap" style="text-align:left;max-height:320px;overflow-y:auto;">${listHtml}</div>
        <button type="button" id="tmplNewBtn" style="margin-top:10px;width:100%;padding:9px;border-radius:8px;border:1px solid #4338ca;background:#fff;color:#4338ca;font-size:12.5px;font-weight:600;cursor:pointer;">+ Simpan Nilai Saat Ini sbg Template Baru</button>
      `,
      showConfirmButton: false,
      showCloseButton: true,
      width: 380,
      didOpen: (el) => {
        el.querySelectorAll('.tmpl-row').forEach((row) => {
          row.addEventListener('click', (e) => {
            if ((e.target as HTMLElement).classList.contains('tmpl-del')) return;
            const id = row.getAttribute('data-id');
            const tmpl = templates.find((t) => String(t.id) === id);
            if (tmpl) applyHasilTemplate(tmpl.details || []);
            Swal.close();
          });
        });
        el.querySelectorAll('.tmpl-del').forEach((btn) => {
          btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.getAttribute('data-id');
            try {
              await fetch(`/api/lab-pk/hasil-template/${id}`, { method: 'DELETE' });
              (btn.closest('.tmpl-row') as HTMLElement | null)?.remove();
            } catch { /* biarkan baris tetap tampil kalau gagal hapus */ }
          });
        });
        el.querySelector('#tmplNewBtn')?.addEventListener('click', () => {
          Swal.close();
          handleSimpanTemplateBaru(group);
        });
      },
    });
  };

  // isMorfologi — pemeriksaan "Morfologi" (mis. Morfologi Darah Tepi/MDT)
  // hasilnya narasi bebas per parameter (Eritrosit/Leukosit/Trombosit/
  // Kesimpulan), BUKAN nilai numerik dgn nilai rujukan spt parameter lab
  // PK biasa — jadi kolom Satuan/Nilai Rujukan/Keterangan disembunyikan,
  // cuma Pemeriksaan+Hasil yg tersisa (Hasil dibuat textarea lebar).
  const isMorfologi = (nmPerawatan: string) => /morfologi/i.test(nmPerawatan);

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

  // allMorfologi — SEMUA pemeriksaan yg dicentang bertipe Morfologi (kasus
  // umum: Morfologi dipesan sendirian) -> header tabel disederhanakan jadi
  // cuma Pemeriksaan+Hasil. Kalau campur dgn pemeriksaan biasa, header
  // penuh dipertahankan (krn kolom itu masih relevan utk baris lain),
  // baris Morfologi-nya sendiri tetap disembunyikan kolomnya (colSpan).
  const allMorfologi = groupedTemplates.length > 0 && groupedTemplates.every((g) => isMorfologi(g.nm_perawatan));

  // handleBukaTemplateMenuFooter — tombol bookmark di footer (sejajar tombol
  // Simpan Hasil, rata kiri). Kalau cuma 1 pemeriksaan dicentang langsung
  // buka menu templatenya; kalau lebih dari 1, minta pilih dulu grupnya.
  const handleBukaTemplateMenuFooter = () => {
    if (groupedTemplates.length === 0) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Centang minimal satu pemeriksaan dulu' });
      return;
    }
    if (groupedTemplates.length === 1) {
      handleBukaTemplateMenu(groupedTemplates[0]);
      return;
    }
    const optionsHtml = groupedTemplates.map((g, i) => `
      <button type="button" class="tmpl-group-pick" data-idx="${i}" style="display:block;width:100%;text-align:left;padding:9px 12px;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:6px;background:#fff;color:#111827;font-size:12.5px;cursor:pointer;">${g.nm_perawatan}</button>
    `).join('');
    Swal.fire({
      title: 'Pilih Pemeriksaan',
      html: `<div style="text-align:left;">${optionsHtml}</div>`,
      showConfirmButton: false,
      showCloseButton: true,
      width: 380,
      didOpen: (el) => {
        el.querySelectorAll('.tmpl-group-pick').forEach((btn) => {
          btn.addEventListener('click', () => {
            const idx = Number(btn.getAttribute('data-idx'));
            Swal.close();
            handleBukaTemplateMenu(groupedTemplates[idx]);
          });
        });
      },
    });
  };

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
      // allMorfologiPrint — sama konsep dgn allMorfologiPdf di
      // buildHasilLabPKPdfUntukTtd: pemeriksaan "Morfologi" (mis. MDT)
      // hasilnya narasi bebas tanpa nilai rujukan, jadi kolom Satuan/Nilai
      // Rujukan/Keterangan disembunyikan & judul dokumen berubah jadi
      // "HASIL PEMERIKSAAN MDT".
      const allMorfologiPrint = items.length > 0 && items.every((it) => isMorfologi(it.nm_perawatan));
      // Baris judul kelompok pemeriksaan (mis. "DARAH LENGKAP") — disisipkan
      // tiap kali nm_perawatan berganti, sama pola dgn tabel on-screen modal
      // ini & tabel di buildHasilLabPKPdfUntukTtd.
      let lastGroup = '';
      const rowsHtml = items.map((it) => {
        const morfologiItem = isMorfologi(it.nm_perawatan);
        const groupColspan = allMorfologiPrint ? 2 : 5;
        // Kalau allMorfologiPrint, baris judul kelompok ini SEKALIGUS jadi
        // header tabel (latar abu2 #f3f4f6 spt <thead> th) krn <thead>
        // "Pemeriksaan|Hasil" generik-nya sengaja dihilangkan di mode ini.
        const groupRow = it.nm_perawatan !== lastGroup
          ? (lastGroup = it.nm_perawatan, `<tr><td colspan="${groupColspan}" style="background:${allMorfologiPrint ? '#f3f4f6' : '#ffffff'};border-bottom-color:${allMorfologiPrint ? '#333' : '#9ca3af'};">${it.nm_perawatan}</td></tr>`)
          : '';
        if (morfologiItem) {
          // Morfologi — cuma Pemeriksaan+Hasil, kolom Satuan/Nilai Rujukan/
          // Keterangan disembunyikan (Hasil merentang via colspan). Baris
          // baru di textarea (multi-baris) diubah jadi <br/> krn HTML
          // meratakan \n polos jadi satu baris.
          const hasilHtml = (it.hasil || '-').split('\n').map((line) => line || '&nbsp;').join('<br/>');
          return `${groupRow}
        <tr>
          <td style="padding-left:1.5em;">${it.pemeriksaan}</td>
          <td colspan="4">${hasilHtml}</td>
        </tr>
      `;
        }
        // Kolom Hasil saja — merah kalau Keterangan "H" (tinggi), biru
        // kalau "L" (rendah), padanan warna di buildHasilLabPKPdfUntukTtd.
        const ket = (it.keterangan || '').trim().toUpperCase();
        const hasilColor = ket === 'H' ? '#dc2626' : ket === 'L' ? '#0044dd' : '';
        return `${groupRow}
        <tr>
          <td style="padding-left:1.5em;">${it.pemeriksaan}</td>
          <td${hasilColor ? ` style="color:${hasilColor};"` : ''}>${it.hasil || '-'}</td>
          <td>${it.satuan || '-'}</td>
          <td>${it.nilai_rujukan || '-'}</td>
          <td>${it.keterangan || '-'}</td>
        </tr>
      `;
      }).join('');

      printWindow.document.write(`
        <html>
          <head>
            <title>${allMorfologiPrint ? 'Hasil Pemeriksaan MDT' : 'Hasil Pemeriksaan Laboratorium'} - ${data.no_permintaan_lab}</title>
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
              table.hasil th, table.hasil td { border: 1px solid #333; padding: 4px 6px; text-align: left; vertical-align: top; }
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
            <center><div class="judul">${allMorfologiPrint ? 'HASIL PEMERIKSAAN MDT' : 'HASIL PEMERIKSAAN LABORATORIUM'}</div></center>

            <table class="info">
              <colgroup>
                <col style="width:16%"><col style="width:2%"><col style="width:34%">
                <col style="width:22%"><col style="width:2%"><col style="width:24%">
              </colgroup>
              <tr>
                <td class="label">No.RM</td><td class="sep">:</td><td>${data.no_rm}</td>
                <td class="label">No.Permintaan Lab</td><td class="sep">:</td><td class="nowrap">${data.no_permintaan_lab}</td>
              </tr>
              <tr>
                <td class="label">Nama Pasien</td><td class="sep">:</td><td>${data.nama_pasien}</td>
                <td class="label">Tgl.Permintaan</td><td class="sep">:</td><td>${data.tgl_permintaan}</td>
              </tr>
              <tr>
                <td class="label">JK/Umur</td><td class="sep">:</td><td>${data.jk || '-'} / ${umurDariTglLahir(data.tgl_lahir)}</td>
                <td class="label">Jam Permintaan</td><td class="sep">:</td><td>${data.jam_permintaan}</td>
              </tr>
              <tr>
                <td class="label">Alamat</td><td class="sep">:</td><td class="truncate" title="${data.alamat || '-'}">${data.alamat || '-'}</td>
                <td class="label">Tgl. Keluar Hasil</td><td class="sep">:</td><td>${data.tgl_keluar_hasil}</td>
              </tr>
              <tr>
                <td class="label">No.Periksa</td><td class="sep">:</td><td>${data.no_periksa}</td>
                <td class="label">Jam Keluar Hasil</td><td class="sep">:</td><td>${data.jam_keluar_hasil}</td>
              </tr>
              <tr>
                <td class="label">Dokter Pengirim</td><td class="sep">:</td><td class="nowrap">${data.dokter_pengirim || '-'}</td>
                <td class="label">${data.poli_label || 'Poli'}</td><td class="sep">:</td><td>${data.poli || '-'}</td>
              </tr>
            </table>

            <table class="hasil">
              ${allMorfologiPrint ? '' : `
              <thead>
                <tr><th>Pemeriksaan</th><th>Hasil</th><th>Satuan</th><th>Nilai Rujukan</th><th>Keterangan</th></tr>
              </thead>
              `}
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

  // Kotak tanda tangan elektronik Peruri (Penanggung Jawab, kiri) — padanan
  // PERSIS SIGN_BOX di ModalHasilRadiologi.tsx (lihat komentar di sana utk
  // alasan tag "#A#"/kenapa box di-center pd posisi tag, bukan sebaliknya).
  const SIGN_BOX_WIDTH = 40;
  const SIGN_BOX_HEIGHT = 40;
  const SIGN_BOX_GAP_BELOW_HASIL = 55;

  // buildHasilLabPKPdfUntukTtd — PENGECUALIAN dari CETAK_STANDAR.md §1,
  // padanan PERSIS buildRadiologiPdfUntukTtd (ModalHasilRadiologi.tsx):
  // fitur kirim ke Peruri butuh byte PDF asli, window.print() tidak bisa
  // diambil sbg byte oleh JS. Beda dari versi Radiologi cuma di isi badan
  // dokumen — di sini TABEL per parameter (Pemeriksaan/Hasil/Satuan/Nilai
  // Rujukan/Keterangan), bukan satu kotak "Hasil Pemeriksaan" teks bebas.
  const buildHasilLabPKPdfUntukTtd = async (): Promise<{
    pdfBytes: Uint8Array; email: string; namaDokterPj: string;
    signBox: { lowerLeftX: number; lowerLeftY: number; upperRightX: number; upperRightY: number; page: string };
  }> => {
    if (!kdDokterPj) {
      throw new Error('Pilih Dokter P.J. dulu.');
    }
    const [dataRes, settingsRes, emailRes] = await Promise.all([
      fetch(`/api/lab-pk/cetak/${encodeURIComponent(noorder)}`),
      fetch('/api/admin/settings'),
      fetch(`/api/dokter/${encodeURIComponent(kdDokterPj)}/email`),
    ]);
    const data = await dataRes.json();
    if (!dataRes.ok) throw new Error(data.error || 'Gagal memuat data cetak');
    let settings = { nama_instansi: '', alamat: '', logo_url: '', kota_rs: '', kontak: '', email_rs: '' };
    if (settingsRes.ok) settings = await settingsRes.json();
    const emailData = await emailRes.json().catch(() => ({}));
    if (!emailRes.ok) throw new Error(emailData.error || 'Dokter P.J. tidak ditemukan');
    const namaDokterPj = dokterPjQuery || emailData.nm_dokter || '-';
    if (!emailData.email) {
      throw new Error(`Email dokter penanggung jawab (${namaDokterPj}) belum diisi. Hubungi admin untuk menambahkan email di data dokter.`);
    }
    const emailDokterPj = emailData.email as string;

    // items/allMorfologiPdf dihitung di awal (bukan pas mau digambar tabel
    // di bawah) krn judul dokumen ("HASIL PEMERIKSAAN MDT" vs "...
    // LABORATORIUM") sudah butuh tau ini duluan.
    type CetakItem = { nm_perawatan: string; pemeriksaan: string; hasil: string; satuan: string; nilai_rujukan: string; keterangan: string };
    const items: CetakItem[] = data.hasil || [];
    const allMorfologiPdf = items.length > 0 && items.every((it) => isMorfologi(it.nm_perawatan));

    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = 40;
    let page = pdf.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    const text = (s: string, x: number, size = 10, bold = false, yOverride?: number) => {
      page.drawText(s, { x, y: yOverride ?? y, size, font: bold ? fontBold : font, color: rgb(0, 0, 0) });
    };
    const centerText = (s: string, size = 10, bold = false) => {
      const f = bold ? fontBold : font;
      const w = f.widthOfTextAtSize(s, size);
      page.drawText(s, { x: (pageWidth - w) / 2, y, size, font: f, color: rgb(0, 0, 0) });
    };
    const truncateToWidth = (s: string, size: number, maxWidth: number) => {
      if (font.widthOfTextAtSize(s, size) <= maxWidth) return s;
      let truncated = s;
      while (truncated.length > 0 && font.widthOfTextAtSize(`${truncated}...`, size) > maxWidth) {
        truncated = truncated.slice(0, -1);
      }
      return `${truncated}...`;
    };
    // wrapText — dipindah ke atas (sebelumnya cuma dipakai footer legal di
    // bawah) krn sekarang dipakai juga oleh drawNarrativeItem (section
    // Morfologi) yg letaknya lebih awal dari footer.
    const wrapText = (s: string, maxWidth: number, size = 10): string[] => {
      const words = s.split(' ');
      const lines: string[] = [];
      let line = '';
      for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (font.widthOfTextAtSize(test, size) > maxWidth && line) { lines.push(line); line = w; } else { line = test; }
      }
      if (line) lines.push(line);
      return lines;
    };

    // Kop 3-kolom PERSIS buildRadiologiPdfUntukTtd/buildBillingPdf.
    let logoImg: Awaited<ReturnType<typeof pdf.embedPng>> | Awaited<ReturnType<typeof pdf.embedJpg>> | null = null;
    if (settings.logo_url) {
      try {
        const logoSrc = settings.logo_url.startsWith('/') ? `${window.location.origin}${settings.logo_url}` : settings.logo_url;
        const imgRes = await fetch(logoSrc);
        if (imgRes.ok) {
          const bytes = await imgRes.arrayBuffer();
          const isJpg = /\.(jpe?g)($|\?)/i.test(logoSrc) || (imgRes.headers.get('content-type') || '').includes('jpeg');
          logoImg = isJpg ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes);
        }
      } catch { /* lanjut tanpa logo kalau gagal fetch/embed */ }
    }

    const contentWidth = pageWidth - margin * 2;
    const col1X = margin;
    const col2X = margin + contentWidth * 0.20;
    const col2Width = contentWidth * 0.60;
    const centerInCol = (s: string, colX: number, colWidth: number, size = 9, bold = false) => {
      const f = bold ? fontBold : font;
      const w = f.widthOfTextAtSize(s, size);
      page.drawText(s, { x: colX + (colWidth - w) / 2, y, size, font: f, color: rgb(0, 0, 0) });
    };

    const kopTop = y;
    const logoSize = 45;
    if (logoImg) {
      page.drawImage(logoImg, { x: col1X, y: kopTop - logoSize + 8, width: logoSize, height: logoSize });
    }
    if (settings.nama_instansi) { centerInCol(settings.nama_instansi, col2X, col2Width, 14, false); y -= 11; }
    if (settings.alamat) { centerInCol(settings.alamat, col2X, col2Width, 9); y -= 11; }
    if (settings.kontak) { centerInCol(settings.kontak, col2X, col2Width, 9); y -= 11; }
    if (settings.email_rs) { centerInCol(`E-mail : ${settings.email_rs}`, col2X, col2Width, 9); y -= 0; }
    y = Math.min(y, kopTop - logoSize + 8 - 4);
    y -= 1;
    page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 1, color: rgb(0, 0, 0) });
    y -= 18;
    centerText(allMorfologiPdf ? 'HASIL PEMERIKSAAN MDT' : 'HASIL PEMERIKSAAN LABORATORIUM', 12, false);
    y -= 22;

    const colLeftX = margin;
    const colRightX = pageWidth / 2 + 10;
    const infoValueX = colLeftX + 90;
    const infoValuePrefixWidth = font.widthOfTextAtSize(': ', 9.5);
    const alamatMaxWidth = colRightX - infoValueX - 8 - infoValuePrefixWidth;
    const alamatSingkat = truncateToWidth(data.alamat || '-', 9.5, alamatMaxWidth);
    const infoLeft: [string, string][] = [
      ['No.RM', data.no_rm], ['Nama Pasien', data.nama_pasien],
      ['JK/Umur', `${data.jk || '-'} / ${umurDariTglLahir(data.tgl_lahir)}`],
      ['Alamat', alamatSingkat],
      ['No.Periksa', data.no_periksa],
      ['Dokter Pengirim', data.dokter_pengirim || '-'],
    ];
    const infoRight: [string, string][] = [
      ['No.Permintaan Lab', data.no_permintaan_lab], ['Tgl.Permintaan', data.tgl_permintaan],
      ['Jam Permintaan', data.jam_permintaan], ['Tgl. Keluar Hasil', data.tgl_keluar_hasil],
      ['Jam Keluar Hasil', data.jam_keluar_hasil], [data.poli_label || 'Poli', data.poli || '-'],
    ];
    const rowStartY = y;
    infoLeft.forEach(([label, value], i) => {
      y = rowStartY - i * 14;
      text(label, colLeftX, 9.5); text(`: ${value}`, colLeftX + 90, 9.5);
    });
    infoRight.forEach(([label, value], i) => {
      y = rowStartY - i * 14;
      text(label, colRightX, 9.5); text(`: ${value}`, colRightX + 100, 9.5);
    });
    y = rowStartY - Math.max(infoLeft.length, infoRight.length) * 14;
    y -= 14;

    // Tabel hasil per parameter — kolom Pemeriksaan/Hasil/Satuan/Nilai
    // Rujukan/Keterangan, padanan tabel `.hasil` di handleCetak (versi
    // window.print HTML) tapi digambar manual krn pdf-lib tidak punya
    // tabel bawaan. Ada pagination sederhana (tambah halaman baru) krn
    // pemeriksaan spt "Darah Lengkap" bisa 20+ baris parameter.
    // (items/allMorfologiPdf sudah dihitung di atas, dekat judul dokumen.)
    const tableColX = [margin, margin + contentWidth * 0.32, margin + contentWidth * 0.47, margin + contentWidth * 0.60, margin + contentWidth * 0.80];
    const tableColEndX = pageWidth - margin;
    const rowHeight = 15;
    const headerHeight = 16;

    // Garis vertikal antar kolom (margin + 4 batas kolom + tepi kanan) —
    // digambar PER-SEGMEN (per header/per baris, dari sisi atas ke bawah
    // segmen itu saja) alih-alih satu garis panjang dari atas tabel ke
    // bawah. Ini supaya tetap benar kalau tabelnya pindah halaman (setiap
    // segmen digambar di `page` yg sedang aktif saat itu) — segmen2 yg
    // berurutan otomatis menyambung jadi terlihat seperti satu garis utuh.
    const colLineX = [margin, tableColX[1], tableColX[2], tableColX[3], tableColX[4], tableColEndX];
    const drawColLines = (topY: number, bottomY: number) => {
      colLineX.forEach((x) => {
        page.drawLine({ start: { x, y: topY }, end: { x, y: bottomY }, thickness: 0.75, color: rgb(0, 0, 0) });
      });
    };

    const addPage = () => {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    };
    const drawTableHeader = () => {
      const headerTop = y;
      page.drawRectangle({ x: margin, y: y - headerHeight, width: contentWidth, height: headerHeight, color: rgb(0.95, 0.95, 0.96) });
      // Baseline teks header diturunkan ke dalam kotak (bukan di tepi
      // atasnya) — kalau dibiarkan di y (tepi atas), ascender huruf
      // "nongol" di atas kotak sementara badan teksnya nyaris kosong.
      const headerTextY = y - headerHeight + 5;
      page.drawText('Pemeriksaan', { x: tableColX[0] + 4, y: headerTextY, size: 9, font: font, color: rgb(0, 0, 0) });
      page.drawText('Hasil', { x: tableColX[1] + 4, y: headerTextY, size: 9, font: font, color: rgb(0, 0, 0) });
      page.drawText('Satuan', { x: tableColX[2] + 4, y: headerTextY, size: 9, font: font, color: rgb(0, 0, 0) });
      page.drawText('Nilai Rujukan', { x: tableColX[3] + 4, y: headerTextY, size: 9, font: font, color: rgb(0, 0, 0) });
      page.drawText('Keterangan', { x: tableColX[4] + 4, y: headerTextY, size: 9, font: font, color: rgb(0, 0, 0) });
      y -= headerHeight;
      page.drawLine({ start: { x: margin, y: headerTop }, end: { x: tableColEndX, y: headerTop }, thickness: 0.75, color: rgb(0, 0, 0) });
      page.drawLine({ start: { x: margin, y }, end: { x: tableColEndX, y }, thickness: 0.75, color: rgb(0, 0, 0) });
      drawColLines(headerTop, y);
    };

    // Baris judul kelompok pemeriksaan (mis. "DARAH LENGKAP") — padanan
    // baris header abu-abu di tabel on-screen modal ini, digambar sekali
    // tiap kali nm_perawatan berganti (items sudah berurutan per exam dari
    // backend, jadi cukup deteksi perubahan nilai berturut-turut).
    const drawGroupRow = (label: string) => {
      const rowTop = y;
      y -= rowHeight;
      // TIDAK digambar kotak isian putih di sini (beda dari versi lama yg
      // isi abu2) — latar halaman memang sudah putih, jadi kotak putih di
      // atas putih itu percuma DAN merusak: rectangle-nya nutup sampai ke
      // rowTop, pas nimpa garis yg SUDAH digambar elemen sebelumnya di
      // koordinat itu (mis. border bawah header yg hitam) jadi kepotong
      // tipis & keliatan pudar/abu2.
      // Baseline +5 dari dasar kotak (bukan pas di garis bawah) — sama
      // konvensi dgn headerTextY di drawTableHeader, supaya teks tidak
      // berhimpit dgn garis bawah baris ini (kalau pas di 0, garis bawah
      // itu menempel tepat di baseline huruf & keliatan spt tercoret).
      page.drawText(label, { x: margin + 4, y: y + 5, size: 8.5, font: font, color: rgb(0, 0, 0) });
      // Garis ATAS baris ini SENGAJA tidak digambar ulang — koordinatnya
      // (rowTop) persis sama dgn garis bawah elemen sebelumnya (border
      // bawah header, atau garis pemisah baris data terakhir kelompok
      // sebelumnya), jadi kalau digambar lagi di sini bisa menimpa warna
      // garis yg sudah benar (mis. border bawah header yg hitam, ketiban
      // jadi abu2). Cukup garis bawah kotak ini saja yg abu2.
      page.drawLine({ start: { x: margin, y }, end: { x: tableColEndX, y }, thickness: 0.5, color: rgb(0.6, 0.6, 0.6) });
      // Garis kolom (termasuk kiri/kanan) ikut digambar di baris ini juga
      // (sama spt drawColLines di baris data biasa) — supaya nyambung terus
      // dgn garis kolom baris di atas/bawahnya, bukan putus tepat di baris
      // nama pemeriksaan ini.
      drawColLines(rowTop, y);
    };

    // drawNarrativeHeader/drawNarrativeItem — padanan render "Morfologi" di
    // tabel on-screen (cuma Pemeriksaan+Hasil, lihat isMorfologi di
    // ModalHasilLabPK), tapi digambar sbg TABEL 2 kolom bergaris (bukan
    // blok teks polos tanpa border) spy rapi & konsisten dgn gaya tabel
    // hasil lab lainnya — kolom kiri label parameter (mis. "Eritrosit"),
    // kolom kanan narasi multi-baris (krn Morfologi memang teks bebas
    // tanpa nilai rujukan numerik, beda dari drawTableHeader 5-kolom).
    const narrContentColX = margin + 110;
    // drawNarrativeHeader — header tabel narasi bukan lagi "Pemeriksaan |
    // Hasil" (generik), tapi nama pemeriksaannya sendiri (mis. "Morfologi
    // Sel Darah Tepi*"), satu sel menyatu penuh tanpa pembatas kolom —
    // padanan drawGroupRow tapi bergaya header (kotak abu2 + border atas).
    const drawNarrativeHeader = (label: string) => {
      const headerTop = y;
      page.drawRectangle({ x: margin, y: y - headerHeight, width: contentWidth, height: headerHeight, color: rgb(0.95, 0.95, 0.96) });
      const headerTextY = y - headerHeight + 5;
      page.drawText(label, { x: margin + 4, y: headerTextY, size: 9, font, color: rgb(0, 0, 0) });
      y -= headerHeight;
      page.drawLine({ start: { x: margin, y: headerTop }, end: { x: tableColEndX, y: headerTop }, thickness: 0.75, color: rgb(0, 0, 0) });
      page.drawLine({ start: { x: margin, y }, end: { x: tableColEndX, y }, thickness: 0.75, color: rgb(0, 0, 0) });
      page.drawLine({ start: { x: margin, y: headerTop }, end: { x: margin, y }, thickness: 0.75, color: rgb(0, 0, 0) });
      page.drawLine({ start: { x: tableColEndX, y: headerTop }, end: { x: tableColEndX, y }, thickness: 0.75, color: rgb(0, 0, 0) });
    };
    const drawNarrativeItem = (label: string, content: string, isLastItem: boolean, groupLabel: string) => {
      const contentColWidth = tableColEndX - narrContentColX - 8;
      const wrapped = (content || '-').split('\n').flatMap((line) => wrapText(line || ' ', contentColWidth, 9));
      const rowH = Math.max(18, wrapped.length * 12 + 6);
      if (y - rowH < margin + 130) {
        addPage();
        if (allMorfologiPdf) drawNarrativeHeader(groupLabel); else drawTableHeader();
      }
      const rowTop = y;
      y -= rowH;
      const firstLineY = rowTop - 12;
      text(label, margin + 4, 9, false, firstLineY);
      let lineY = firstLineY;
      wrapped.forEach((line) => { text(line, narrContentColX + 4, 9, false, lineY); lineY -= 12; });
      // Garis bawah PERSIS di batas baris (persis konvensi drawGroupRow) —
      // abu2 utk pemisah antar baris, hitam pekat kalau ini baris TERAKHIR
      // seluruh tabel (border penutup).
      page.drawLine({
        start: { x: margin, y }, end: { x: tableColEndX, y },
        thickness: isLastItem ? 0.75 : 0.5, color: isLastItem ? rgb(0, 0, 0) : rgb(0.6, 0.6, 0.6),
      });
      page.drawLine({ start: { x: margin, y: rowTop }, end: { x: margin, y }, thickness: 0.75, color: rgb(0, 0, 0) });
      page.drawLine({ start: { x: tableColEndX, y: rowTop }, end: { x: tableColEndX, y }, thickness: 0.75, color: rgb(0, 0, 0) });
      page.drawLine({ start: { x: narrContentColX, y: rowTop }, end: { x: narrContentColX, y }, thickness: 0.75, color: rgb(0, 0, 0) });
    };

    if (!allMorfologiPdf) drawTableHeader();
    let lastGroup = '';
    items.forEach((it, idx) => {
      const morfologiItem = isMorfologi(it.nm_perawatan);
      if (it.nm_perawatan !== lastGroup) {
        lastGroup = it.nm_perawatan;
        if (allMorfologiPdf) {
          if (y - headerHeight < margin + 130) addPage();
          drawNarrativeHeader(lastGroup);
        } else {
          if (y - rowHeight < margin + 130) { addPage(); drawTableHeader(); }
          drawGroupRow(lastGroup);
        }
      }
      if (morfologiItem) {
        drawNarrativeItem(it.pemeriksaan, it.hasil, idx === items.length - 1, lastGroup);
        return;
      }
      if (y - rowHeight < margin + 130) {
        // batas bawah reserved utk blok ttd (~130pt) — pindah halaman baru
        // kalau tabelnya masih panjang.
        addPage();
        drawTableHeader();
      }
      const rowTop = y;
      y -= rowHeight;
      // Baseline teks +2 dari dasar baris (bukan pas di 0) — sama alasan
      // dgn headerTextY/drawGroupRow: kalau pas di garis bawah baris, teks
      // berhimpit dgn garis pemisah/border baris berikutnya (kentara PARAH
      // pas baris ini persis sebelum baris judul kelompok berikutnya, krn
      // border ATAS kelompok itu digambar tepat di koordinat `y` yg sama).
      const textY = y + 2;
      // Nama parameter diindentasi 1 "tab" (16pt) dari nama kelompok
      // pemeriksaan di atasnya (mis. "hemoglobin" masuk ke dalam relatif
      // "DARAH LENGKAP*") supaya hierarkinya kelihatan jelas.
      const itemIndent = 16;
      text(truncateToWidth(it.pemeriksaan, 8.5, tableColX[1] - tableColX[0] - 6 - itemIndent), tableColX[0] + 4 + itemIndent, 8.5, false, textY);
      // Kolom Hasil saja — merah kalau Keterangan "H" (tinggi), biru kalau
      // "L" (rendah), hitam normal selain itu. Kolom lain tetap hitam.
      const ket = (it.keterangan || '').trim().toUpperCase();
      const hasilColor = ket === 'H' ? rgb(0.86, 0.15, 0.15) : ket === 'L' ? rgb(0, 0.27, 0.87) : rgb(0, 0, 0);
      page.drawText(truncateToWidth(it.hasil || '-', 8.5, tableColX[2] - tableColX[1] - 6), { x: tableColX[1] + 4, y: textY, size: 8.5, font, color: hasilColor });
      text(truncateToWidth(it.satuan || '-', 8.5, tableColX[3] - tableColX[2] - 6), tableColX[2] + 4, 8.5, false, textY);
      text(truncateToWidth(it.nilai_rujukan || '-', 8.5, tableColX[4] - tableColX[3] - 6), tableColX[3] + 4, 8.5, false, textY);
      text(truncateToWidth(it.keterangan || '-', 8.5, tableColEndX - tableColX[4] - 6), tableColX[4] + 4, 8.5, false, textY);
      // Garis pemisah PERSIS di batas bawah baris (y, bukan y-3 lagi) —
      // supaya menyatu rapi dgn border ATAS baris/kelompok berikutnya,
      // bukan tumpang tindih 3pt ke dalam baris berikutnya (itu penyebab
      // tampilan "dobel garis" tepat di pergantian kelompok pemeriksaan).
      const isLastRow = idx === items.length - 1;
      page.drawLine({
        start: { x: margin, y }, end: { x: tableColEndX, y },
        thickness: isLastRow ? 0.75 : 0.5, color: isLastRow ? rgb(0, 0, 0) : rgb(0.6, 0.6, 0.6),
      });
      drawColLines(rowTop, y);
    });

    // Tag "#A#" — posisi (tagX, tagY) persis di bawah tabel hasil (padanan
    // "#A#" di bawah kotak Hasil Pemeriksaan pada versi Radiologi), lalu
    // SIGN_BOX di-center pd posisi tag ini.
    const tagX = margin + 60;
    const tagY = Math.max(margin + SIGN_BOX_HEIGHT / 2, y - SIGN_BOX_GAP_BELOW_HASIL - SIGN_BOX_HEIGHT / 2);
    const centeredX = Math.trunc(tagX - SIGN_BOX_WIDTH / 2 + 5);
    const centeredY = Math.trunc(tagY - SIGN_BOX_HEIGHT / 2);
    const SIGN_BOX = {
      lowerLeftX: centeredX, lowerLeftY: centeredY,
      upperRightX: centeredX + SIGN_BOX_WIDTH, upperRightY: centeredY + SIGN_BOX_HEIGHT,
      page: String(pdf.getPageCount()),
    };

    // Kolom KANAN — Petugas Laboratorium. BUKAN area stample Peruri, QR-nya
    // e-signature lokal biasa (persis pola qrPetugas di handleCetak).
    const petugasBoxX = { start: 395, end: 555 };
    const petugasBoxCenterX = (petugasBoxX.start + petugasBoxX.end) / 2;
    const tanggalCetak = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
      + ' ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const fingerPetugas =
      `Dikeluarkan di ${settings.nama_instansi || ''}, Kabupaten/Kota ${settings.kota_rs || ''}\n` +
      `Ditandatangani secara elektronik oleh ${data.petugas_nama || '-'}\n` +
      `ID ${data.petugas_nip || '-'}\n${tanggalCetak}`;
    let qrPetugasImg: Awaited<ReturnType<typeof pdf.embedPng>> | null = null;
    try {
      const qrDataUrl = await QRCode.toDataURL(fingerPetugas, { width: 80, margin: 1 });
      const qrBytes = await fetch(qrDataUrl).then((r) => r.arrayBuffer());
      qrPetugasImg = await pdf.embedPng(qrBytes);
    } catch { /* lanjut tanpa QR kalau gagal generate/embed */ }

    const blockCenterY = (SIGN_BOX.lowerLeftY + SIGN_BOX.upperRightY) / 2;
    const qrSize = 40;
    const labelY = blockCenterY + qrSize / 2 + 12;
    const nameY = blockCenterY - qrSize / 2 - 12;

    const tglCetakText = `Tgl.Cetak : ${tanggalCetak}`;
    const tglCetakW = font.widthOfTextAtSize(tglCetakText, 8.5);
    page.drawText(tglCetakText, { x: petugasBoxCenterX - tglCetakW / 2, y: labelY + 14, size: 8.5, font, color: rgb(0, 0, 0) });

    // Kolom KIRI — Penanggung Jawab. Area stample Peruri (SIGN_BOX, 40x40)
    // TIDAK digambar apa pun (kosong), stample-nya ditempel Peruri sendiri.
    const visualBoxCenterX = (SIGN_BOX.lowerLeftX + SIGN_BOX.upperRightX) / 2;
    const signLabelW = font.widthOfTextAtSize('Penanggung Jawab', 9);
    page.drawText('Penanggung Jawab', { x: visualBoxCenterX - signLabelW / 2, y: labelY, size: 9, font, color: rgb(0, 0, 0) });
    page.drawText('#A#', { x: tagX, y: tagY, size: 7, font, color: rgb(0.6, 0.6, 0.6) });
    const namaW = font.widthOfTextAtSize(namaDokterPj, 9);
    page.drawText(namaDokterPj, { x: visualBoxCenterX - namaW / 2, y: nameY, size: 9, font, color: rgb(0, 0, 0) });

    const petugasLabelW = font.widthOfTextAtSize('Petugas Laboratorium', 9);
    page.drawText('Petugas Laboratorium', { x: petugasBoxCenterX - petugasLabelW / 2, y: labelY, size: 9, font, color: rgb(0, 0, 0) });
    if (qrPetugasImg) {
      page.drawImage(qrPetugasImg, { x: petugasBoxCenterX - qrSize / 2, y: blockCenterY - qrSize / 2, width: qrSize, height: qrSize });
    }
    const petugasNamaW = font.widthOfTextAtSize(data.petugas_nama || '-', 9);
    page.drawText(data.petugas_nama || '-', { x: petugasBoxCenterX - petugasNamaW / 2, y: nameY, size: 9, font, color: rgb(0, 0, 0) });

    // Footer legal — jarak tetap dari tepi bawah kertas.
    const footerSeparatorY = margin - 10;
    page.drawLine({ start: { x: margin, y: footerSeparatorY }, end: { x: pageWidth - margin, y: footerSeparatorY }, thickness: 0.5, color: rgb(0.75, 0.75, 0.75) });
    const footerText = 'Dokumen ini sah dan telah ditandatangani secara elektronik menggunakan sertifikat digital yang diterbitkan oleh Peruri';
    const footerLines = wrapText(footerText, pageWidth - margin * 2, 7.5);
    let footerLineY = footerSeparatorY - 10;
    footerLines.forEach((line) => {
      const w = font.widthOfTextAtSize(line, 7.5);
      page.drawText(line, { x: (pageWidth - w) / 2, y: footerLineY, size: 7.5, font, color: rgb(0.45, 0.45, 0.45) });
      footerLineY -= 9;
    });

    const pdfBytes = await pdf.save();
    return { pdfBytes, email: emailDokterPj, namaDokterPj, signBox: SIGN_BOX };
  };

  // handlePreviewTtd — "Review PDF", buka PDF yg AKAN dikirim ke Peruri
  // (buildHasilLabPKPdfUntukTtd) di tab baru TANPA benar-benar mengirim apa
  // pun ke Peruri — padanan handlePreviewTtd di ModalHasilRadiologi.tsx.
  const handlePreviewTtd = async () => {
    setPreviewingTtd(true);
    try {
      const { pdfBytes } = await buildHasilLabPKPdfUntukTtd();
      const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
      window.open(URL.createObjectURL(blob), '_blank');
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setPreviewingTtd(false);
    }
  };

  // peruriPost — helper kecil, panggil endpoint proxy Peruri (JSON), balikin
  // response.response (raw upstream Peruri) sambil lempar Error kalau gagal
  // di level HTTP KITA (bukan level Peruri) ATAU resultCode Peruri bukan
  // "0" — persis salinan dari ModalHasilRadiologi.tsx (endpoint backend
  // Peruri sudah generik, dipakai bersama semua modul TTE).
  const peruriPost = async (path: string, body: unknown): Promise<any> => {
    const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Gagal memanggil ${path}`);
    const upstream = data.response;
    if (upstream && typeof upstream === 'object' && 'resultCode' in upstream && upstream.resultCode !== '0') {
      throw new Error(`[${upstream.resultCode}] ${upstream.resultDesc || `${path} gagal`}`);
    }
    return upstream;
  };

  const showProcessing = (html: string) => {
    Swal.fire({
      html,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading(),
    });
  };
  const hideProcessing = () => Swal.close();

  // showOtpDialog — dialog input kode OTP, persis salinan dari
  // ModalHasilRadiologi.tsx (ikon amplop, satu kolom input, link "Kirim
  // ulang").
  const showOtpDialog = async (email: string, onResend: () => Promise<void>, confirmButtonText: string): Promise<string | undefined> => {
    const { value: otpCode } = await Swal.fire({
      html: `
        <div style="display:flex;flex-direction:column;align-items:center;text-align:center;">
          <div style="width:64px;height:64px;border-radius:50%;background:#eff6ff;display:flex;align-items:center;justify-content:center;margin-bottom:14px;">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="m22 6-10 7L2 6"></path></svg>
          </div>
          <div style="font-size:19px;font-weight:700;color:#111827;margin-bottom:6px;">Masukkan Kode OTP</div>
          <div style="font-size:13px;color:#6b7280;line-height:1.5;">Kode verifikasi sudah dikirim ke<br/><b style="color:#111827;">${email}</b></div>
        </div>
      `,
      input: 'text',
      inputAttributes: { maxlength: '6', inputmode: 'numeric', autocomplete: 'one-time-code' },
      showCancelButton: false,
      showCloseButton: true,
      confirmButtonText,
      confirmButtonColor: '#2563eb',
      inputValidator: (value) => (!value ? 'Kode OTP wajib diisi' : undefined),
      didOpen: (popup) => {
        const input = popup.querySelector('.swal2-input') as HTMLInputElement | null;
        if (input) {
          input.placeholder = '6 digit kode OTP';
          Object.assign(input.style, {
            textAlign: 'center', fontSize: '22px', fontWeight: '700', letterSpacing: '8px',
            maxWidth: '220px', margin: '4px auto 6px', borderRadius: '10px',
          });
        }
        const confirmBtn = popup.querySelector('.swal2-confirm') as HTMLButtonElement | null;
        if (confirmBtn) Object.assign(confirmBtn.style, { width: '85%', margin: '10px auto 0', borderRadius: '8px', fontWeight: '700' });

        const resendWrap = document.createElement('div');
        resendWrap.style.cssText = 'text-align:center;font-size:12.5px;color:#6b7280;margin-top:4px;';
        resendWrap.innerHTML = 'Tidak menerima kode? <button id="btnResendOtpDialogLabPK" type="button" style="background:none;border:none;color:#2563eb;font-weight:600;font-size:12.5px;cursor:pointer;text-decoration:underline;padding:0;">Kirim ulang</button>';
        input?.insertAdjacentElement('afterend', resendWrap);

        const resendBtn = resendWrap.querySelector('#btnResendOtpDialogLabPK') as HTMLButtonElement | null;
        resendBtn?.addEventListener('click', async () => {
          resendBtn.disabled = true;
          resendBtn.textContent = 'Mengirim ulang...';
          try {
            await onResend();
            resendBtn.textContent = 'Kode baru terkirim';
          } catch (err) {
            resendBtn.textContent = err instanceof Error ? err.message : 'Gagal kirim ulang';
          } finally {
            window.setTimeout(() => {
              resendBtn.disabled = false;
              resendBtn.textContent = 'Kirim ulang';
            }, 3000);
          }
        });
      },
    });
    return otpCode as string | undefined;
  };

  // handleTandaTangan — tombol "Tanda Tangan", alur Digital Signature
  // Peruri (Send Document -> Get OTP -> Validate OTP -> Signing), persis
  // salinan alur ModalHasilRadiologi.tsx, cuma dokumennya dari
  // buildHasilLabPKPdfUntukTtd (tabel/narasi hasil lab, bukan textarea
  // bacaan radiologi).
  const handleTandaTangan = async () => {
    setSigning(true);
    showProcessing('Menyiapkan & mengirim dokumen ke Peruri, mohon tunggu...');
    try {
      const { pdfBytes, email, namaDokterPj, signBox } = await buildHasilLabPKPdfUntukTtd();

      const form = new FormData();
      form.append('file', new Blob([pdfBytes as BlobPart], { type: 'application/pdf' }), `HasilLabPK_${noorder.replace(/\//g, '_')}.pdf`);
      form.append('email', email);
      form.append('isVisualSign', 'YES');
      form.append('lowerLeftX', String(signBox.lowerLeftX));
      form.append('lowerLeftY', String(signBox.lowerLeftY));
      form.append('upperRightX', String(signBox.upperRightX));
      form.append('upperRightY', String(signBox.upperRightY));
      form.append('page', signBox.page);
      form.append('certificateLevel', 'NOT_CERTIFIED');
      form.append('varLocation', 'Sigli');
      form.append('varReason', 'Signed');
      form.append('teraImage', 'QR-DETECSI');
      form.append('orderType', 'INDIVIDUAL');

      const sendRes = await fetch('/api/peruri/send-document-tmp', { method: 'POST', body: form });
      const sendData = await sendRes.json();
      if (!sendRes.ok) throw new Error(sendData.error || 'Gagal mengirim dokumen ke Peruri');
      if (sendData.response && typeof sendData.response === 'object' && 'resultCode' in sendData.response && sendData.response.resultCode !== '0') {
        throw new Error(`[${sendData.response.resultCode}] ${sendData.response.resultDesc || 'Send Document gagal'}`);
      }
      const orderId = sendData?.response?.data?.orderId || sendData?.response?.orderId;
      if (!orderId) throw new Error('Peruri tidak mengembalikan orderId: ' + JSON.stringify(sendData.response));

      // Catat ke tracking_dokumen_ttd (status "Belum") — persis
      // MnSendSigningDokumenActionPerformed Java, INSERT tepat setelah
      // orderId didapat. TANPA baris ini, dokumen yg sudah ditandatangani &
      // terupload pun TIDAK PERNAH muncul di tab Berkas Klaim (getBerkasKlaimTte
      // baca tabel ini dulu utk tahu No.Order mana yg perlu dicek filenya).
      // Best-effort — gagal dicatat TIDAK menggagalkan proses TTE yg sedang
      // berjalan, cuma nanti tidak muncul di Berkas Klaim.
      const noRawatNoSlash = (detail?.no_rawat || '').replace(/\//g, '');
      const namaDokumenTracking = `Hasil_Lab_${noorder}_${noRawatNoSlash}.pdf`;
      try {
        await fetch('/api/peruri/tracking/kirim', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ no_rawat: detail?.no_rawat || '', nama_dokumen: namaDokumenTracking, order_id: orderId, user_pengirim: petugasNip, email_ttd: email }),
        });
      } catch { /* non-blocking, lihat komentar di atas */ }

      showProcessing(`Dokumen berhasil terkirim ke Peruri.<br/>Order ID: <b>${orderId}</b><br/><span style="font-size:12px;color:#6b7280;">Melanjutkan proses tanda tangan...</span>`);
      await new Promise((resolve) => window.setTimeout(resolve, 1200));

      const sessionRes = await fetch(`/api/peruri/session-status?email=${encodeURIComponent(email)}`);
      const sessionData = await sessionRes.json().catch(() => ({ valid: false }));
      let sesiDipakaiUlang = false;

      if (sessionRes.ok && sessionData.valid) {
        sesiDipakaiUlang = true;
      } else {
        const otpResp = await peruriPost('/api/peruri/get-otp', { email, sendEmail: '1', sendSms: '0', sendWhatsapp: '0' });
        let tokenSession = otpResp?.data?.tokenSession || otpResp?.tokenSession;
        if (!tokenSession) throw new Error('Peruri tidak mengembalikan tokenSession: ' + JSON.stringify(otpResp));

        hideProcessing();
        const otpCode = await showOtpDialog(email, async () => {
          const resendResp = await peruriPost('/api/peruri/get-otp', { email, sendEmail: '1', sendSms: '0', sendWhatsapp: '0' });
          const newTokenSession = resendResp?.data?.tokenSession || resendResp?.tokenSession;
          if (!newTokenSession) throw new Error('Peruri tidak mengembalikan tokenSession');
          tokenSession = newTokenSession;
        }, 'Verifikasi & Tanda Tangan');
        if (!otpCode) return;

        showProcessing('Memverifikasi OTP & menandatangani dokumen, mohon tunggu...');
        await peruriPost('/api/peruri/validate-otp', { email, tokenSession, otpCode, duration: '1440' });
      }

      if (sesiDipakaiUlang) showProcessing('Sesi OTP masih aktif, menandatangani dokumen, mohon tunggu...');
      try {
        await peruriPost('/api/peruri/signing', { orderId });
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        const codeMatch = msg.match(/^\[([^\]]+)\]/);
        const code = codeMatch?.[1];
        if (code && code in PERURI_SIGNING_ERROR_MAP) {
          throw new Error(`[${code}] ${PERURI_SIGNING_ERROR_MAP[code]}`);
        }
        if (/otp|session|expired/i.test(msg)) {
          throw new Error('Masa berlaku sesi OTP sudah habis di sisi Peruri. Silakan klik tombol "Minta OTP Ulang" terlebih dahulu, lalu coba Tanda Tangan lagi.');
        }
        throw err;
      }
      // Signing sukses -> tandai tracking_dokumen_ttd jadi "Sudah" (dibaca
      // getBerkasKlaimTte utk memunculkan dokumen ini di tab Berkas Klaim).
      // Best-effort, sama alasan dgn tracking/kirim di atas.
      try {
        await fetch('/api/peruri/tracking/sukses', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: orderId }),
        });
      } catch { /* non-blocking */ }
      hideProcessing();
      setLastTteOrderId(orderId);

      await Swal.fire({
        icon: 'success', title: 'Berhasil ditandatangani',
        html: `Dokumen berhasil ditandatangani oleh <b>${namaDokterPj}</b> (${email}).<br/>Order ID: <b>${orderId}</b>`
          + (sesiDipakaiUlang ? '<br/><small>(Sesi OTP masih aktif, tidak perlu OTP ulang)</small>' : ''),
      });
    } catch (err) {
      hideProcessing();
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setSigning(false);
    }
  };

  // handleDownloadDokumen — tombol Download, ambil dokumen yg SUDAH
  // ditandatangani dari Peruri (downloadDocument/v1, orderId dari signing
  // TERAKHIR di sesi modal ini — lastTteOrderId), persis salinan dari
  // ModalHasilRadiologi.tsx. Prefix nama file dibedakan ("HasilLabPK_")
  // supaya tidak ketimpa/campur dgn hasil Radiologi di berkas rawat.
  const handleDownloadDokumen = async () => {
    if (!lastTteOrderId) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Belum ada dokumen yang ditandatangani di sesi ini. Lakukan Tanda Tangan dulu.' });
      return;
    }
    setDownloadingTte(true);
    showProcessing('Mengunduh dokumen dari Peruri, mohon tunggu...');
    try {
      const res = await fetch('/api/peruri/download-document', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: lastTteOrderId, no_rawat: detail?.no_rawat || '', no_order: noorder, prefix: 'Lab_' }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Gagal mengunduh dokumen');
      const upstream = resData.response;
      if (upstream && typeof upstream === 'object' && 'resultCode' in upstream && upstream.resultCode !== '0') {
        throw new Error(`[${upstream.resultCode}] ${upstream.resultDesc || 'Download Document gagal'}`);
      }
      const data = upstream?.data || upstream || {};
      const base64Doc: string | undefined = data.base64Document || data.document || data.file || data.base64;
      if (!base64Doc) {
        hideProcessing();
        Swal.fire({
          icon: 'warning', title: 'Format respons tidak dikenali',
          html: `Peruri tidak mengembalikan field dokumen yg dikenali. Response mentah:<br/><pre style="text-align:left;font-size:11px;white-space:pre-wrap;">${JSON.stringify(upstream, null, 2)}</pre>`,
        });
        return;
      }
      const byteChars = atob(base64Doc);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TTE_HasilLabPK_${noorder.replace(/\//g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      hideProcessing();
      if (resData.uploaded_to_berkasrawat) {
        Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Dokumen terunduh & otomatis terupload ke Berkas Rawat.', timer: 2000, showConfirmButton: false });
      } else {
        // Dulu kegagalan auto-upload ini DIAM SAJA (dokumen tetap terunduh
        // lokal, tapi Berkas Rawat di server tidak pernah tertimpa/terupdate
        // tanpa pemberitahuan apa pun) — sekarang ditampilkan eksplisit.
        Swal.fire({
          icon: 'warning', title: 'Auto-upload ke Berkas Rawat gagal',
          text: `Dokumen berhasil diunduh ke komputer, tapi GAGAL otomatis terupload ke Berkas Rawat${resData.upload_error ? `: ${resData.upload_error}` : '.'}`,
        });
      }
    } catch (err) {
      hideProcessing();
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setDownloadingTte(false);
    }
  };

  // handleMintaOtpUlang — tombol terpisah (sebelum Tanda Tangan), persis
  // salinan dari ModalHasilRadiologi.tsx.
  const handleMintaOtpUlang = async () => {
    if (!kdDokterPj) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Pilih Dokter P.J. dulu' });
      return;
    }
    setRequestingOtp(true);
    showProcessing('Mengirim kode OTP, mohon tunggu...');
    try {
      const emailRes = await fetch(`/api/dokter/${encodeURIComponent(kdDokterPj)}/email`);
      const emailData = await emailRes.json();
      if (!emailRes.ok) throw new Error(emailData.error || 'Dokter P.J. tidak ditemukan');
      if (!emailData.email) {
        throw new Error(`Email dokter penanggung jawab (${dokterPjQuery || emailData.nm_dokter || '-'}) belum diisi. Hubungi admin untuk menambahkan email di data dokter.`);
      }
      const email = emailData.email as string;

      const otpResp = await peruriPost('/api/peruri/get-otp', { email, sendEmail: '1', sendSms: '0', sendWhatsapp: '0' });
      let tokenSession = otpResp?.data?.tokenSession || otpResp?.tokenSession;
      if (!tokenSession) throw new Error('Peruri tidak mengembalikan tokenSession: ' + JSON.stringify(otpResp));

      hideProcessing();
      const otpCode = await showOtpDialog(email, async () => {
        const resendResp = await peruriPost('/api/peruri/get-otp', { email, sendEmail: '1', sendSms: '0', sendWhatsapp: '0' });
        const newTokenSession = resendResp?.data?.tokenSession || resendResp?.tokenSession;
        if (!newTokenSession) throw new Error('Peruri tidak mengembalikan tokenSession');
        tokenSession = newTokenSession;
      }, 'Verifikasi');
      if (!otpCode) return;

      showProcessing('Memverifikasi OTP, mohon tunggu...');
      await peruriPost('/api/peruri/validate-otp', { email, tokenSession, otpCode, duration: '1440' });
      hideProcessing();

      await Swal.fire({
        icon: 'success', title: 'Sesi OTP diperbarui',
        html: `Sesi OTP untuk <b>${email}</b> berhasil divalidasi ulang dan aktif selama 24 jam ke depan.`,
      });
    } catch (err) {
      hideProcessing();
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setRequestingOtp(false);
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
          {/* Kartu identitas avatar (avatar + Nama pasien (Umur) + No.RM +
              No.Rawat) — pola avatar sama dgn Pemeriksaan.tsx, warna
              disesuaikan utk latar kartu putih (bukan gradient). */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" fill="#2563eb" />
                <path d="M12 14C6.47715 14 2 17.134 2 21C2 21.5523 2.44772 22 3 22H21C21.5523 22 22 21.5523 22 21C22 17.134 17.5228 14 12 14Z" fill="#2563eb" />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', wordBreak: 'break-word' }}>
                {detail.nm_pasien}{detail.umur ? ` (${detail.umur})` : ''}
              </div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>No.RM {detail.no_rkm_medis}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>No.Rawat {detail.no_rawat}</div>
            </div>
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
                      style={{ ...pill, width: '100%', paddingRight: 28 }}
                    />
                    <StepperIcon />
                    {showDokterPjDropdown && dokterPjList.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, maxHeight: 180, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 10 }}>
                        {dokterPjList.map((d) => (
                          <div key={d.kd_dokter} onClick={() => { setKdDokterPj(d.kd_dokter); setDokterPjQuery(d.nm_dokter); setShowDokterPjDropdown(false); }}
                            style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid #e5e7eb' }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#e5e7eb'}
                            onMouseLeave={(e) => e.currentTarget.style.background = '#f9fafb'}
                          >{d.nm_dokter}</div>
                        ))}
                      </div>
                    )}
                  </div>
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
                      style={{ ...pill, width: '100%', paddingRight: 28 }}
                    />
                    <StepperIcon />
                    {showPetugasDropdown && petugasList.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, maxHeight: 180, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 10 }}>
                        {petugasList.map((p) => (
                          <div key={p.nip} onClick={() => { setPetugasNip(p.nip); setPetugasQuery(p.nama); setShowPetugasDropdown(false); }}
                            style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid #e5e7eb' }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#e5e7eb'}
                            onMouseLeave={(e) => e.currentTarget.style.background = '#f9fafb'}
                          >{p.nama} <span style={{ color: '#9ca3af' }}>({p.nip})</span></div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ ...labelSm, width: 'auto' }}>Dokter Perujuk :</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input readOnly value={detail.nm_dokter} style={{ ...pillReadOnly, width: '100%', paddingRight: 28 }} />
                    <StepperIcon />
                  </div>
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

            {detail.sudah_ada_hasil && (
              <div style={{ fontSize: 12, color: '#92400e', padding: '8px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8 }}>
                ⚠ Permintaan ini sudah pernah diisi hasilnya — nilai di atas sudah diprefill dari hasil terakhir, submit ulang akan menimpa nilai yang sama.
              </div>
            )}
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
                        <th style={{ position: 'sticky', top: 0, zIndex: 1, background: '#f9fafb', padding: '5px 10px', textAlign: 'left', width: allMorfologi ? 220 : 180, fontWeight: 400, fontSize: 13, whiteSpace: 'nowrap' }}>Pemeriksaan</th>
                        <th style={{ position: 'sticky', top: 0, zIndex: 1, background: '#f9fafb', padding: '5px 10px', textAlign: 'left', width: allMorfologi ? 'auto' : 100, fontWeight: 400, fontSize: 13, whiteSpace: 'nowrap' }}>Hasil</th>
                        {!allMorfologi && (
                          <>
                            <th style={{ position: 'sticky', top: 0, zIndex: 1, background: '#f9fafb', padding: '5px 10px', textAlign: 'left', width: 80, fontWeight: 400, fontSize: 13, whiteSpace: 'nowrap' }}>Satuan</th>
                            {/* 4 kolom terpisah (bukan digabung 1 kolom) — persis
                                header tabel Khanza Desktop (tbDetailPK). */}
                            <th style={{ position: 'sticky', top: 0, zIndex: 1, background: '#f9fafb', padding: '5px 10px', textAlign: 'left', width: 100, fontWeight: 400, fontSize: 13, whiteSpace: 'nowrap' }}>Nilai Rujukan L.D.</th>
                            <th style={{ position: 'sticky', top: 0, zIndex: 1, background: '#f9fafb', padding: '5px 10px', textAlign: 'left', width: 100, fontWeight: 400, fontSize: 13, whiteSpace: 'nowrap' }}>Nilai Rujukan L.A.</th>
                            <th style={{ position: 'sticky', top: 0, zIndex: 1, background: '#f9fafb', padding: '5px 10px', textAlign: 'left', width: 100, fontWeight: 400, fontSize: 13, whiteSpace: 'nowrap' }}>Nilai Rujukan P.D.</th>
                            <th style={{ position: 'sticky', top: 0, zIndex: 1, background: '#f9fafb', padding: '5px 10px', textAlign: 'left', width: 100, fontWeight: 400, fontSize: 13, whiteSpace: 'nowrap' }}>Nilai Rujukan P.A.</th>
                            <th style={{ position: 'sticky', top: 0, zIndex: 1, background: '#f9fafb', padding: '5px 10px', textAlign: 'left', width: 90, fontWeight: 400, fontSize: 13, whiteSpace: 'nowrap' }}>Keterangan</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {groupedTemplates.map((g) => {
                        const morfologi = isMorfologi(g.nm_perawatan);
                        const headerColSpan = allMorfologi ? 2 : 8;
                        return (
                        <React.Fragment key={g.kd_jenis_prw}>
                          <tr style={{ borderTop: '1px solid #e5e7eb' }}>
                            <td colSpan={headerColSpan} style={{ padding: '5px 10px', background: '#f9fafb', color: '#111827', fontWeight: 600 }}>{g.nm_perawatan}</td>
                          </tr>
                          {g.items.map((t) => {
                            const isHigh = (nilaiMap[t.id_template]?.keterangan || '').trim().toUpperCase() === 'H';
                            const redText = isHigh ? '#dc2626' : undefined;
                            if (morfologi) {
                              // Morfologi (mis. Morfologi Darah Tepi/MDT) —
                              // hasilnya narasi bebas per parameter (Eritrosit/
                              // Leukosit/Trombosit/Kesimpulan), bukan angka dgn
                              // nilai rujukan — jadi cuma Pemeriksaan+Hasil yg
                              // tampil (kolom lain disembunyikan via colSpan),
                              // Hasil pakai textarea multi-baris & lebih tinggi.
                              const isKesimpulan = t.pemeriksaan.trim().toLowerCase() === 'kesimpulan';
                              return (
                                <tr key={t.id_template} style={{ borderTop: '1px solid #f3f4f6' }}>
                                  <td style={{ padding: '4px 10px', color: redText || '#111827', verticalAlign: 'top' }}>{t.pemeriksaan}</td>
                                  <td style={{ padding: '4px 6px' }} colSpan={allMorfologi ? 1 : 7}>
                                    <textarea
                                      rows={isKesimpulan ? 6 : 3}
                                      value={nilaiMap[t.id_template]?.nilai || ''}
                                      onChange={(ev) => updateNilai(t.id_template, { nilai: ev.target.value })}
                                      style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, outline: 'none', boxSizing: 'border-box', color: redText, resize: 'vertical', fontFamily: 'inherit' }}
                                    />
                                  </td>
                                </tr>
                              );
                            }
                            return (
                              <tr key={t.id_template} style={{ borderTop: '1px solid #f3f4f6' }}>
                                <td style={{ padding: '2px 10px', color: redText || '#111827' }}>{t.pemeriksaan}</td>
                                <td style={{ padding: '2px 6px' }}>
                                  <input
                                    type="text"
                                    value={nilaiMap[t.id_template]?.nilai || ''}
                                    onChange={(ev) => updateNilai(t.id_template, { nilai: ev.target.value })}
                                    style={{ width: '100%', padding: '3px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, outline: 'none', boxSizing: 'border-box', color: redText }}
                                  />
                                </td>
                                <td style={{ padding: '2px 10px', color: redText || '#374151' }}>{t.satuan || '-'}</td>
                                <td style={{ padding: '2px 10px', color: redText || '#6b7280' }}>{t.nilai_rujukan_ld || '-'}</td>
                                <td style={{ padding: '2px 10px', color: redText || '#6b7280' }}>{t.nilai_rujukan_la || '-'}</td>
                                <td style={{ padding: '2px 10px', color: redText || '#6b7280' }}>{t.nilai_rujukan_pd || '-'}</td>
                                <td style={{ padding: '2px 10px', color: redText || '#6b7280' }}>{t.nilai_rujukan_pa || '-'}</td>
                                <td style={{ padding: '2px 6px' }}>
                                  <input
                                    type="text"
                                    value={nilaiMap[t.id_template]?.keterangan || ''}
                                    onChange={(ev) => updateNilai(t.id_template, { keterangan: ev.target.value })}
                                    style={{ width: '100%', padding: '3px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, outline: 'none', boxSizing: 'border-box', color: redText }}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Footer — di luar area scroll, dipaku di dasar modal
              (flexShrink:0) supaya Batal/Simpan selalu kelihatan. */}
          <div style={{ flexShrink: 0, paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={handleBukaTemplateMenuFooter}
              title="Template Hasil Pemeriksaan — simpan/pakai nilai siap-pakai"
              style={{ width: 38, height: 38, borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#4338ca', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg width="16" height="16" viewBox="0 0 512 512" fill="currentColor">
                <path d="M70.715,0v512L256,326.715L441.285,512V0H70.715z M411.239,439.462L256,284.224L100.761,439.462V30.046h310.477V439.462z"/>
              </svg>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
            <button
              type="button"
              onClick={handlePreviewTtd}
              disabled={previewingTtd}
              title="Review PDF yang akan dikirim ke Peruri"
              style={{ width: 38, height: 38, borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: previewingTtd ? '#9ca3af' : '#374151', cursor: previewingTtd ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
            <button
              type="button"
              onClick={handleMintaOtpUlang}
              disabled={requestingOtp}
              title="Minta OTP Ulang (perbarui sesi Peruri Dokter P.J.)"
              style={{ width: 38, height: 38, borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: requestingOtp ? '#9ca3af' : '#374151', cursor: requestingOtp ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 15 15" fill="none">
                <path d="M6 5.5H9M7.5 5.5V10M10.5 10V7.5M10.5 7.5V5.5H11.5C12.0523 5.5 12.5 5.94772 12.5 6.5C12.5 7.05228 12.0523 7.5 11.5 7.5H10.5ZM4.5 6.5V8.5C4.5 9.05228 4.05228 9.5 3.5 9.5C2.94772 9.5 2.5 9.05228 2.5 8.5V6.5C2.5 5.94772 2.94772 5.5 3.5 5.5C4.05228 5.5 4.5 5.94772 4.5 6.5ZM1.5 0.5H13.5C14.0523 0.5 14.5 0.947715 14.5 1.5V13.5C14.5 14.0523 14.0523 14.5 13.5 14.5H1.5C0.947716 14.5 0.5 14.0523 0.5 13.5V1.5C0.5 0.947716 0.947715 0.5 1.5 0.5Z" stroke="currentColor"/>
              </svg>
            </button>
            <button
              type="button"
              onClick={handleDownloadDokumen}
              disabled={downloadingTte || !lastTteOrderId}
              title={lastTteOrderId ? 'Download Dokumen Tertandatangani (Peruri)' : 'Belum ada dokumen tertandatangani di sesi ini'}
              style={{ width: 38, height: 38, borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: (downloadingTte || !lastTteOrderId) ? '#9ca3af' : '#374151', cursor: (downloadingTte || !lastTteOrderId) ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9.517 3.31h4.966v6.621h3.31L12 16.552 6.207 9.931h3.31V3.31zM0 19.034h24v1.655H0v-1.655z"/>
              </svg>
            </button>
            <button
              type="button"
              onClick={handleTandaTangan}
              disabled={signing}
              title="Tanda Tangan Elektronik (Peruri)"
              style={{ width: 38, height: 38, borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: signing ? '#9ca3af' : '#374151', cursor: signing ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg width="20" height="20" viewBox="0 1.5 14 11" fill="currentColor">
                <path d="m 1.0324444,11.139308 c 0.0179,-0.1218 0.061,-0.2215 0.0958,-0.2215 0.0348,0 0.0633,-0.064 0.0633,-0.1428 0,-0.079 0.0321,-0.1428 0.0714,-0.1428 0.0393,0 0.0714,-0.064 0.0714,-0.1427 0,-0.079 0.0321,-0.1428 0.0714,-0.1428 0.0393,0 0.0714,-0.047 0.0714,-0.1045 0,-0.058 0.08,-0.2479001 0.17776,-0.4230001 0.12606,-0.2258 0.16557,-0.3794 0.13583,-0.528 -0.0254,-0.1269 0.002,-0.2942 0.0687,-0.4236 0.0608,-0.1177 0.18066,-0.4193 0.26627,-0.6702 0.0856,-0.251 0.17774,-0.4885 0.20472,-0.5277 0.027,-0.039 0.0925,-0.216 0.14571,-0.3927 0.0532,-0.1766 0.1232,-0.3517 0.15563,-0.389 0.0324,-0.037 0.059,-0.1417 0.059,-0.232 0,-0.09 0.0321,-0.1642 0.0714,-0.1642 0.0393,0 0.0714,-0.094 0.0714,-0.21 0,-0.1154 0.0321,-0.2298 0.0714,-0.254 0.0393,-0.024 0.073,-0.099 0.0749,-0.1649 0.002,-0.066 0.16547,-0.2492 0.36338,-0.4062 0.1979,-0.1571 0.43577,-0.3579 0.5286,-0.4462 0.0928,-0.088 0.1866,-0.1606 0.20838,-0.1606 0.0218,0 0.13637,-0.093 0.25466,-0.2056 0.11829,-0.113 0.3509,-0.2977 0.51691,-0.4104 0.16601,-0.1128 0.31254,-0.2291 0.32563,-0.2585 0.0131,-0.029 0.0683,-0.053 0.12276,-0.053 0.0544,0 0.21335,-0.064 0.35316,-0.1428 0.26925,-0.1512 0.60679,-0.1909 0.60679,-0.071 0,0.039 0.0421,0.071 0.0936,0.071 0.0515,0 0.15589,0.058 0.23201,0.1285 0.24872,0.231 0.37942,0.24 0.55068,0.038 0.30396,-0.3586 1.0957,-1.1308 1.25041,-1.2194 0.18638,-0.1068 0.51461,-0.1182 0.51461,-0.018 0,0.039 0.043,0.071 0.0956,0.071 0.12754,0 0.26131,0.3072 0.26131,0.6002 0,0.2369 -0.24982,0.6817 -0.50955,0.9073 -0.0731,0.063 -0.13294,0.139 -0.13294,0.1677 0,0.029 -0.0964,0.1422 -0.21416,0.2523 -0.23429,0.2188 -0.26247,0.3229 -0.12217,0.4512 0.18171,0.1662 0.89017,0.5482 1.01669,0.5482 0.0577,0 0.10491,0.029 0.10491,0.063 0,0.035 0.20949,0.1202 0.46554,0.1895 0.4572796,0.1237 0.4683696,0.1234 0.6246396,-0.018 0.1522,-0.1379 0.20395,-0.1411 1.19421,-0.074 0.56932,0.038 1.0438,0.078 1.05441,0.087 0.0106,0.01 0.0719,0.2706 0.13625,0.5806 0.22137,1.0669 0.1397,2.7256 -0.19548,3.9704001 l -0.0726,0.2698 -1.10376,0 -1.10375,0 0,-0.2142 c 0,-0.1178 -0.0321,-0.2142 -0.0714,-0.2142 -0.0393,0 -0.0714,-0.068 -0.0714,-0.1504 0,-0.1163 -0.0283,-0.1381 -0.12493,-0.096 -0.0687,0.03 -0.2373696,0.067 -0.3747896,0.083 -0.13742,0.016 -0.31799,0.063 -0.40128,0.1034 -0.15948,0.078 -0.59017,0.053 -1.4191,-0.084 -0.56756,-0.093 -0.48797,-0.091 -1.12627,-0.028 -0.26608,0.026 -0.50088,0.076 -0.52177,0.1096 -0.0539,0.087 -1.79571,0.078 -1.84994,-0.01 -0.0243,-0.039 -0.15276,-0.071 -0.28555,-0.071 -0.13279,0 -0.26128,-0.032 -0.28555,-0.071 -0.0243,-0.039 -0.15836,-0.071 -0.29798,-0.071 -0.20152,0 -0.30517,0.055 -0.50271,0.2677 -0.13687,0.1473 -0.29749,0.34 -0.35693,0.4284 -0.0594,0.088 -0.16674,0.1606 -0.23843,0.1606 -0.0717,0 -0.15021,0.032 -0.17447,0.071 -0.0243,0.039 -0.10154,0.071 -0.17172,0.071 -0.0702,0 -0.22087,0.046 -0.33487,0.1034 -0.11401,0.057 -0.33873,0.1244 -0.49939,0.1501 l -0.29211,0.047 0.0325,-0.2215 z m 0.83725,-0.2929 c 0.0243,-0.039 0.10648,-0.071 0.18268,-0.071 0.0762,0 0.13857,-0.032 0.13857,-0.071 0,-0.039 0.0482,-0.071 0.10708,-0.071 0.0589,0 0.10708,-0.048 0.10708,-0.1065 0,-0.1314 -0.28157,-0.4646 -0.39263,-0.4646 -0.11106,0 -0.39263,0.3332 -0.39263,0.4646 0,0.059 -0.0321,0.1065 -0.0714,0.1065 -0.0393,0 -0.0714,0.064 -0.0714,0.1428 0,0.1038 0.0476,0.1428 0.17426,0.1428 0.0958,0 0.19411,-0.032 0.21837,-0.071 z m 9.7914796,-0.4796 c 0.56959,-0.044 0.51279,0.02 0.6796,-0.7697001 0.10998,-0.5207 0.15529,-2.1091 0.0628,-2.2016 -0.0416,-0.042 -0.0756,-0.1661 -0.0756,-0.2766 0,-0.1106 -0.0399,-0.329 -0.0888,-0.4855 l -0.0888,-0.2844 -0.54608,0 c -0.62148,0 -0.64971,0.026 -0.55725,0.5046 0.11336,0.5873 0.075,1.9136 -0.0772,2.6663 -0.15299,0.7568001 -0.13618,1.0112001 0.0617,0.9332001 0.0652,-0.026 0.34848,-0.064 0.62959,-0.086 z M 6.1529444,9.9283079 c 0.15705,-0.042 0.48897,-0.1306 0.73759,-0.1971 0.4275,-0.1144 0.48566,-0.1141 1.07082,0.01 0.34032,0.07 0.81151,0.1273 1.04709,0.1279 0.50257,0.001 1.3830896,-0.1952 1.5309896,-0.3415 0.10718,-0.1061 0.23238,-0.8318 0.23976,-1.3898 0.005,-0.3722 -0.0687,-0.9074 -0.18342,-1.3327 -0.0786,-0.2915 -0.0876,-0.2983 -0.44116,-0.3348 -0.5742096,-0.059 -0.8963196,-0.1281 -0.8963196,-0.1915 0,-0.032 -0.0723,-0.082 -0.16062,-0.1096 -0.0883,-0.028 -0.36468,-0.1746 -0.61409,-0.326 -0.24941,-0.1514 -0.48231,-0.2753 -0.51756,-0.2753 -0.0352,0 -0.0641,-0.032 -0.0641,-0.071 0,-0.1875 -0.27918,-0.03 -0.65538,0.3706 -0.37178,0.3956 -0.41543,0.474 -0.41543,0.7454 0,0.1668 -0.0321,0.3232 -0.0714,0.3474 -0.0393,0.024 -0.0714,0.1069 -0.0714,0.1837 0,0.1551 -0.11414,0.3784 -0.30339,0.5936 -0.0687,0.078 -0.12493,0.1681 -0.12493,0.1999 0,0.1 0.34485,0.063 0.75135,-0.079 0.38822,-0.1364 0.39085,-0.1364 0.39085,0 0,0.078 -0.0993,0.2321 -0.22063,0.3429 l -0.22062,0.2015 -1.10194,0 c -0.7526,0 -1.12849,0.023 -1.18571,0.08 -0.0461,0.046 -0.17371,0.084 -0.28365,0.084 -0.10994,0 -0.19989,0.032 -0.19989,0.071 0,0.039 -0.0642,0.071 -0.14277,0.071 -0.0785,0 -0.14278,0.027 -0.14278,0.059 0,0.033 -0.0779,0.101 -0.17302,0.152 -0.18219,0.098 -0.28332,0.3465 -0.21403,0.5271 0.0461,0.1201 0.52553,0.3324 0.75054,0.3324 0.0805,0 0.19232,-0.046 0.24841,-0.1019 0.1151,-0.1151 0.14054,-0.6833 0.0306,-0.6833 -0.0393,0 -0.0714,-0.064 -0.0714,-0.1428 0,-0.1852 0.0407,-0.18 0.25311,0.033 0.12743,0.1274 0.17522,0.2528 0.17522,0.4598 0,0.1565 -0.0321,0.3044 -0.0714,0.3287 -0.13127,0.081 -0.0734,0.2215 0.12493,0.3028 0.22116,0.091 0.76798,0.071 1.19574,-0.043 z m -3.49888,-1.0793 c 0.20573,-0.3259 0.22956,-0.6039 0.0658,-0.7677 -0.0966,-0.097 -0.12355,-0.099 -0.1804,-0.013 -0.0368,0.055 -0.0861,0.1892 -0.10953,0.2971 -0.0235,0.108 -0.0656,0.1964 -0.0937,0.1964 -0.0642,0 -0.2167,0.3289 -0.2167,0.4673 0,0.063 0.0699,0.1038 0.17757,0.1038 0.12939,0 0.22625,-0.077 0.35694,-0.2842 z m 0.48514,0.048 c 0.26307,-0.271 0.4081,-0.5016 0.4081,-0.6489 0,-0.056 0.0241,-0.1128 0.0535,-0.1259 0.0294,-0.013 0.13385,-0.1992 0.23201,-0.4135 0.0982,-0.2144 0.31499,-0.5268 0.48186,-0.6942 0.16687,-0.1674 0.3034,-0.321 0.3034,-0.3412 0,-0.068 0.24679,-0.3411 1.08866,-1.2037 0.46134,-0.4727 0.8388,-0.888 0.8388,-0.9229 0,-0.1533 -0.39705,-0.4103 -0.63371,-0.4103 -0.16776,0 -0.63626,0.2586 -0.80241,0.443 -0.0635,0.071 -0.14859,0.1281 -0.18909,0.1281 -0.0405,0 -0.23766,0.1606 -0.43816,0.3569 -0.20049,0.1963 -0.3832,0.3569 -0.40602,0.3569 -0.0846,0 -0.78643,0.7789 -0.8785,0.9749 -0.0525,0.1117 -0.12374,0.2588 -0.15842,0.327 -0.0347,0.068 -0.0631,0.1726 -0.0631,0.232 0,0.059 -0.0321,0.1081 -0.0714,0.1081 -0.0393,0 -0.0714,0.094 -0.0714,0.2082 0,0.1145 -0.0388,0.2211 -0.0862,0.2369 -0.0576,0.019 -0.0357,0.083 0.0658,0.1919 0.22734,0.2441 0.34549,0.5655 0.24483,0.6662 -0.0449,0.045 -0.0817,0.1537 -0.0817,0.2417 0,0.088 -0.0321,0.1798 -0.0714,0.2041 -0.0732,0.045 -0.10182,0.3212 -0.0333,0.3212 0.0209,0 0.1414,-0.1064 0.2677,-0.2365 z m 2.72831,-1.0663 c 0.13638,-0.088 0.24836,-0.2008 0.24885,-0.2499 4.8e-4,-0.049 0.033,-0.089 0.0723,-0.089 0.0393,0 0.0714,-0.064 0.0714,-0.1428 0,-0.079 0.0321,-0.1427 0.0714,-0.1427 0.0393,0 0.0714,-0.08 0.0714,-0.1785 0,-0.2216 -0.0932,-0.2288 -0.23214,-0.018 -0.0582,0.088 -0.26617,0.3284 -0.4622,0.5335 -0.19602,0.2051 -0.3395,0.3899 -0.31884,0.4105 0.0753,0.075 0.23533,0.034 0.4779,-0.123 z"></path>
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
      </div>

      <style>{`@keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }`}</style>
    </div>
  );
};
