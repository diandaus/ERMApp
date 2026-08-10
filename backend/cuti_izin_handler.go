package main

import (
	"database/sql"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// KEPEGAWAIAN — Pengajuan Cuti & Izin, padanan kepegawaian/
// PengajuanCutiPegawai.java (sisi pegawai) + PengajuanCutiAdmin.java
// (sisi admin/HRD) di Khanza. SATU tabel `pengajuan_cuti` yang SAMA
// dipakai utk keduanya — "Cuti" dan "Izin" cuma beda nilai `urgensi`
// (enum 'Tahunan','Besar','Sakit','Bersalin' = kategori Cuti;
// 'Alasan Penting','Keterangan Lainnya' = kategori Izin), makanya di
// sini digabung jadi satu handler, tinggal difilter per kategori di
// frontend.
//
// Tabel `pengajuan_cuti` DITULIS Java lewat Sequel.menyimpantf(
// "pengajuan_cuti","?,?,?,?,?,?,?,?,?,?,?","Data",11,...) — 11 kolom
// positional, JADI TIDAK BOLEH ditambah kolom apa pun langsung (sama
// spt petugas/dokter/pegawai/jam_masuk sebelum dimigrasi). Field
// tambahan ERMApp (catatan approval, siapa yang memutuskan) disimpan
// di tabel pendamping `pengajuan_cuti_ext` — Java sendiri TIDAK PUNYA
// field catatan penolakan sama sekali (admin cuma ganti kolom status
// lewat combobox), jadi ini murni penambahan UX, bukan celah yang
// ditambal.
//
// Penyimpangan disengaja dari Java: PengajuanCutiPegawai.java maupun
// PengajuanCutiAdmin.java TIDAK PERNAH mengecek sisa jatah cuti
// (pegawai.cuti_diambil vs stts_kerja.hakcuti) — kedua kolom itu ada di
// skema tapi tidak pernah dibaca/ditulis di alur pengajuan cuti sama
// sekali. Di sini DIREPLIKASI APA ADANYA (tanpa validasi jatah) supaya
// konsisten dgn perilaku Khanza yang sebenarnya — bukan bug yang perlu
// ditambal (beda dgn kasus wajibmasuk=0 di Rekap Kehadiran).
// ============================================================================

func ensurePengajuanCutiExtTable(db *sql.DB) {
	db.Exec(`
		CREATE TABLE IF NOT EXISTS pengajuan_cuti_ext (
			no_pengajuan VARCHAR(17) NOT NULL PRIMARY KEY,
			catatan_approval VARCHAR(255) NOT NULL DEFAULT '',
			disetujui_oleh VARCHAR(100) NOT NULL DEFAULT '',
			CONSTRAINT fk_pengajuan_cuti_ext FOREIGN KEY (no_pengajuan)
				REFERENCES pengajuan_cuti (no_pengajuan) ON DELETE CASCADE
		) ENGINE=InnoDB
	`)
}

// urgensiKategori — pemetaan nilai urgensi ke kategori menu "Cuti" vs
// "Izin" (Khanza sendiri tidak punya kategori eksplisit ini, cuma
// enum urgensi datar — pembagian ini murni konvensi ERMApp utk
// mencocokkan 2 menu terpisah di HP).
var urgensiCuti = []string{"Tahunan", "Besar", "Sakit", "Bersalin"}
var urgensiIzin = []string{"Alasan Penting", "Keterangan Lainnya"}

// generateNoPengajuanCuti — persis Valid.autoNomer3 di
// PengajuanCutiPegawai.java: "PC" + yyyyMMdd (tanggal pengajuan HARI
// INI, bukan tanggal cuti) + 3 digit urut, reset per tanggal.
func generateNoPengajuanCuti(db *sql.DB, tanggal time.Time) (string, error) {
	tglStr := tanggal.Format("2006-01-02")
	prefix := "PC" + tanggal.Format("20060102")
	var maxSeq int
	err := db.QueryRow(`
		SELECT IFNULL(MAX(CONVERT(RIGHT(no_pengajuan,3),SIGNED)),0)
		FROM pengajuan_cuti WHERE tanggal = ?`, tglStr).Scan(&maxSeq)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%s%03d", prefix, maxSeq+1), nil
}

// hitungJumlahHari — persis "select to_days(akhir)-to_days(awal)" di
// Java: selisih kalender murni, TIDAK inklusif, TIDAK mengecualikan
// akhir pekan/hari libur.
func hitungJumlahHari(awal, akhir string) int {
	layout := "2006-01-02"
	tAwal, err1 := time.Parse(layout, awal)
	tAkhir, err2 := time.Parse(layout, akhir)
	if err1 != nil || err2 != nil {
		return 0
	}
	return int(tAkhir.Sub(tAwal).Hours() / 24)
}

type CutiIzinRow struct {
	NoPengajuan     string `json:"no_pengajuan"`
	Tanggal         string `json:"tanggal"`
	TanggalAwal     string `json:"tanggal_awal"`
	TanggalAkhir    string `json:"tanggal_akhir"`
	NIK             string `json:"nik"`
	Nama            string `json:"nama"`
	Departemen      string `json:"departemen"`
	Urgensi         string `json:"urgensi"`
	Alamat          string `json:"alamat"`
	Jumlah          int    `json:"jumlah"`
	Kepentingan     string `json:"kepentingan"`
	NikPJ           string `json:"nik_pj"`
	NamaPJ          string `json:"nama_pj"`
	Status          string `json:"status"`
	CatatanApproval string `json:"catatan_approval"`
	DisetujuiOleh   string `json:"disetujui_oleh"`
}

type CutiIzinSubmitPayload struct {
	NIK          string `json:"nik" binding:"required"`
	TanggalAwal  string `json:"tanggal_awal" binding:"required"`
	TanggalAkhir string `json:"tanggal_akhir" binding:"required"`
	Urgensi      string `json:"urgensi" binding:"required"`
	Alamat       string `json:"alamat" binding:"required"`
	Kepentingan  string `json:"kepentingan" binding:"required"`
	NikPJ        string `json:"nik_pj" binding:"required"`
}

// POST /api/pengajuan-cuti — pegawai ajukan cuti/izin dari HP.
func submitCutiIzin(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var p CutiIzinSubmitPayload
		if err := c.ShouldBindJSON(&p); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		var cekNik string
		if err := db.QueryRow(`SELECT nik FROM pegawai WHERE nik = ?`, p.NIK).Scan(&cekNik); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Akun ini belum terhubung ke data Pegawai"})
			return
		}
		if err := db.QueryRow(`SELECT nik FROM pegawai WHERE nik = ?`, p.NikPJ).Scan(&cekNik); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Penanggung jawab pengganti tidak ditemukan"})
			return
		}

		now := time.Now()
		noPengajuan, err := generateNoPengajuanCuti(db, now)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		jumlah := hitungJumlahHari(p.TanggalAwal, p.TanggalAkhir)

		_, err = db.Exec(`
			INSERT INTO pengajuan_cuti (no_pengajuan, tanggal, tanggal_awal, tanggal_akhir, nik, urgensi, alamat, jumlah, kepentingan, nik_pj, status)
			VALUES (?,?,?,?,?,?,?,?,?,?,'Proses Pengajuan')`,
			noPengajuan, now.Format("2006-01-02"), p.TanggalAwal, p.TanggalAkhir, p.NIK, p.Urgensi, p.Alamat, jumlah, p.Kepentingan, p.NikPJ,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Pengajuan berhasil dikirim", "no_pengajuan": noPengajuan, "jumlah": jumlah})
	}
}

const cutiIzinSelectBase = `
	SELECT pengajuan_cuti.no_pengajuan, DATE_FORMAT(pengajuan_cuti.tanggal,'%Y-%m-%d'),
		DATE_FORMAT(pengajuan_cuti.tanggal_awal,'%Y-%m-%d'), DATE_FORMAT(pengajuan_cuti.tanggal_akhir,'%Y-%m-%d'),
		pengajuan_cuti.nik, peg1.nama, COALESCE(dep.nama, peg1.departemen, ''),
		pengajuan_cuti.urgensi, pengajuan_cuti.alamat, pengajuan_cuti.jumlah, pengajuan_cuti.kepentingan,
		pengajuan_cuti.nik_pj, COALESCE(peg2.nama,''), pengajuan_cuti.status,
		COALESCE(pengajuan_cuti_ext.catatan_approval,''), COALESCE(pengajuan_cuti_ext.disetujui_oleh,'')
	FROM pengajuan_cuti
	INNER JOIN pegawai peg1 ON peg1.nik = pengajuan_cuti.nik
	LEFT JOIN pegawai peg2 ON peg2.nik = pengajuan_cuti.nik_pj
	LEFT JOIN departemen dep ON dep.dep_id = peg1.departemen
	LEFT JOIN pengajuan_cuti_ext ON pengajuan_cuti_ext.no_pengajuan = pengajuan_cuti.no_pengajuan
`

func scanCutiIzinRows(rows *sql.Rows) []CutiIzinRow {
	list := []CutiIzinRow{}
	for rows.Next() {
		var r CutiIzinRow
		if err := rows.Scan(&r.NoPengajuan, &r.Tanggal, &r.TanggalAwal, &r.TanggalAkhir, &r.NIK, &r.Nama, &r.Departemen,
			&r.Urgensi, &r.Alamat, &r.Jumlah, &r.Kepentingan, &r.NikPJ, &r.NamaPJ, &r.Status,
			&r.CatatanApproval, &r.DisetujuiOleh); err == nil {
			list = append(list, r)
		}
	}
	return list
}

func kategoriUrgensiList(kategori string) []string {
	switch kategori {
	case "cuti":
		return urgensiCuti
	case "izin":
		return urgensiIzin
	default:
		return nil
	}
}

// GET /api/pengajuan-cuti/saya?nik=&kategori=cuti|izin
func getCutiIzinSaya(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		nik := strings.TrimSpace(c.Query("nik"))
		if nik == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "nik wajib diisi"})
			return
		}
		kategori := strings.TrimSpace(c.Query("kategori"))
		query := cutiIzinSelectBase + " WHERE pengajuan_cuti.nik = ?"
		args := []interface{}{nik}
		if urgensiList := kategoriUrgensiList(kategori); urgensiList != nil {
			placeholders := make([]string, len(urgensiList))
			for i, u := range urgensiList {
				placeholders[i] = "?"
				args = append(args, u)
			}
			query += " AND pengajuan_cuti.urgensi IN (" + strings.Join(placeholders, ",") + ")"
		}
		query += " ORDER BY pengajuan_cuti.tanggal_awal DESC, pengajuan_cuti.no_pengajuan DESC"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		c.JSON(http.StatusOK, scanCutiIzinRows(rows))
	}
}

// GET /api/pengajuan-cuti/list?status=&tanggal_awal=&tanggal_akhir=&search=&kategori= (admin desktop)
func getCutiIzinList(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		status := strings.TrimSpace(c.Query("status"))
		tglAwal := strings.TrimSpace(c.Query("tanggal_awal"))
		tglAkhir := strings.TrimSpace(c.Query("tanggal_akhir"))
		search := strings.TrimSpace(c.Query("search"))
		kategori := strings.TrimSpace(c.Query("kategori"))

		query := cutiIzinSelectBase + " WHERE 1=1"
		args := []interface{}{}
		if status != "" {
			query += " AND pengajuan_cuti.status = ?"
			args = append(args, status)
		}
		if tglAwal != "" {
			query += " AND pengajuan_cuti.tanggal_awal >= ?"
			args = append(args, tglAwal)
		}
		if tglAkhir != "" {
			query += " AND pengajuan_cuti.tanggal_akhir <= ?"
			args = append(args, tglAkhir)
		}
		if search != "" {
			query += " AND (pengajuan_cuti.nik LIKE ? OR peg1.nama LIKE ?)"
			like := "%" + search + "%"
			args = append(args, like, like)
		}
		if urgensiList := kategoriUrgensiList(kategori); urgensiList != nil {
			placeholders := make([]string, len(urgensiList))
			for i, u := range urgensiList {
				placeholders[i] = "?"
				args = append(args, u)
			}
			query += " AND pengajuan_cuti.urgensi IN (" + strings.Join(placeholders, ",") + ")"
		}
		query += " ORDER BY pengajuan_cuti.tanggal DESC, pengajuan_cuti.no_pengajuan DESC"

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		c.JSON(http.StatusOK, scanCutiIzinRows(rows))
	}
}

type CutiIzinKeputusanPayload struct {
	Catatan       string `json:"catatan"`
	DisetujuiOleh string `json:"disetujui_oleh"`
}

func putusCutiIzin(db *sql.DB, statusBaru string) gin.HandlerFunc {
	return func(c *gin.Context) {
		noPengajuan := c.Param("no_pengajuan")
		var p CutiIzinKeputusanPayload
		if err := c.ShouldBindJSON(&p); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		res, err := db.Exec(`UPDATE pengajuan_cuti SET status=? WHERE no_pengajuan=?`, statusBaru, noPengajuan)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Pengajuan tidak ditemukan"})
			return
		}
		db.Exec(
			`INSERT INTO pengajuan_cuti_ext (no_pengajuan, catatan_approval, disetujui_oleh) VALUES (?,?,?)
			 ON DUPLICATE KEY UPDATE catatan_approval=VALUES(catatan_approval), disetujui_oleh=VALUES(disetujui_oleh)`,
			noPengajuan, p.Catatan, p.DisetujuiOleh,
		)
		pesan := "Pengajuan disetujui"
		if statusBaru == "Ditolak" {
			pesan = "Pengajuan ditolak"
		}
		c.JSON(http.StatusOK, gin.H{"message": pesan})
	}
}

// PUT /api/pengajuan-cuti/:no_pengajuan/approve
func approveCutiIzin(db *sql.DB) gin.HandlerFunc { return putusCutiIzin(db, "Disetujui") }

// PUT /api/pengajuan-cuti/:no_pengajuan/reject
func rejectCutiIzin(db *sql.DB) gin.HandlerFunc { return putusCutiIzin(db, "Ditolak") }

// DELETE /api/pengajuan-cuti/:no_pengajuan — hapus (dipakai admin, atau
// pegawai batalkan pengajuan sendiri; guard "tidak boleh hapus yang
// sudah Disetujui" punya Java cuma di sisi pegawai, jadi ditegakkan di
// UI mobile, bukan di backend — persis spt admin Khanza yang boleh
// hapus apa saja).
func hapusCutiIzin(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noPengajuan := c.Param("no_pengajuan")
		res, err := db.Exec(`DELETE FROM pengajuan_cuti WHERE no_pengajuan=?`, noPengajuan)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Pengajuan tidak ditemukan"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Pengajuan berhasil dihapus"})
	}
}
