import React from 'react';
import Swal from 'sweetalert2';

// ModalAksesTablet — Pengaturan > Aplikasi Tablet > Atur Hak Akses Tablet.
// Per AKUN: menu sidebar & tab Pemeriksaan Rawat Jalan/Rawat Inap di ERM
// Tablet yg boleh tampil. Disimpan sbg daftar kunci yg DINONAKTIFKAN
// (PUT /api/tablet/akses/:user_id) — akun yg belum diatur = semua aktif.
// Kunci HARUS sama dgn erm_tablet/lib/services/akses_service.dart.

type Item = { key: string; label: string };
type Grup = { judul: string; items: Item[] };

export const GRUP_AKSES_TABLET: Grup[] = [
  {
    judul: 'Menu Sidebar',
    items: [
      { key: 'menu.dashboard', label: 'Dashboard' },
      { key: 'menu.igd', label: 'IGD' },
      { key: 'menu.poli', label: 'Poliklinik' },
      { key: 'menu.ranap', label: 'Rawat Inap' },
      { key: 'menu.farmasi', label: 'Farmasi' },
      { key: 'menu.lab', label: 'Laboratorium' },
      { key: 'menu.rad', label: 'Radiologi' },
      { key: 'menu.operasi', label: 'Jadwal Operasi' },
    ],
  },
  {
    judul: 'Tab Pemeriksaan Rawat Jalan',
    items: [
      { key: 'ralan.soap', label: 'Soap/CPPT' },
      { key: 'ralan.resep', label: 'Resep' },
      { key: 'ralan.usg', label: 'USG' },
      { key: 'ralan.tindakan', label: 'Tindakan' },
      { key: 'ralan.lab', label: 'Lab' },
      { key: 'ralan.rad', label: 'Rad' },
      { key: 'ralan.diagnosa', label: 'Diagnosa' },
      { key: 'ralan.catatan', label: 'Catatan Dokter' },
      { key: 'ralan.billing', label: 'Billing' },
    ],
  },
  {
    judul: 'Tab Pemeriksaan Rawat Inap',
    items: [
      { key: 'ranap.soap', label: 'Soap/CPPT' },
      { key: 'ranap.resep', label: 'Resep' },
      { key: 'ranap.lab', label: 'Lab' },
      { key: 'ranap.rad', label: 'Rad' },
      { key: 'ranap.tindakan', label: 'Tindakan' },
      { key: 'ranap.diagnosa', label: 'Diagnosa' },
    ],
  },
];

type User = { id: number; username: string; full_name: string; role: string; is_active: boolean };

export function ModalAksesTablet({ onClose }: { onClose: () => void }) {
  const [users, setUsers] = React.useState<User[]>([]);
  const [aturan, setAturan] = React.useState<Record<number, string[]>>({});
  const [userId, setUserId] = React.useState<number | null>(null);
  const [nonaktif, setNonaktif] = React.useState<Set<string>>(new Set());
  const [cari, setCari] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  // Salin hak akses: "Salin dari" (isi form dari akun lain) & "Terapkan ke
  // akun lain" (simpan pengaturan form ini ke banyak akun sekaligus).
  const [sumber, setSumber] = React.useState('');
  const [showTerapkan, setShowTerapkan] = React.useState(false);
  const [tujuan, setTujuan] = React.useState<Set<number>>(new Set());
  const [cariTujuan, setCariTujuan] = React.useState('');

  React.useEffect(() => {
    (async () => {
      try {
        const [ru, ra] = await Promise.all([fetch('/api/admin/users'), fetch('/api/tablet/akses')]);
        const u = await ru.json();
        const a = await ra.json();
        setUsers(Array.isArray(u) ? u : []);
        const map: Record<number, string[]> = {};
        (Array.isArray(a) ? a : []).forEach((x: { user_id: number; nonaktif: string[] }) => { map[x.user_id] = x.nonaktif || []; });
        setAturan(map);
      } catch { /* silent */ }
    })();
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const pilihUser = (id: number) => {
    setUserId(id);
    setNonaktif(new Set(aturan[id] || []));
    setSumber('');
  };

  const toggle = (key: string) => setNonaktif((prev) => {
    const n = new Set(prev);
    if (n.has(key)) n.delete(key); else n.add(key);
    return n;
  });

  const setGrup = (g: Grup, aktif: boolean) => setNonaktif((prev) => {
    const n = new Set(prev);
    g.items.forEach((i) => (aktif ? n.delete(i.key) : n.add(i.key)));
    return n;
  });

  const salinDari = (idStr: string) => {
    setSumber(idStr);
    if (!idStr) return;
    const src = users.find((u) => u.id === Number(idStr));
    setNonaktif(new Set(aturan[Number(idStr)] || []));
    Swal.fire({
      icon: 'info',
      title: 'Disalin ke form',
      text: `Pengaturan ${src?.full_name || src?.username || ''} disalin. Tekan "Simpan Hak Akses" untuk menyimpan.`,
      timer: 2200,
      showConfirmButton: false,
    });
  };

  const terapkanKeAkunLain = async () => {
    if (tujuan.size === 0) return;
    setSaving(true);
    const body = JSON.stringify({ nonaktif: Array.from(nonaktif) });
    let ok = 0;
    const gagal: string[] = [];
    const baru: Record<number, string[]> = {};
    for (const id of Array.from(tujuan)) {
      try {
        const res = await fetch(`/api/tablet/akses/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Gagal');
        baru[id] = data.nonaktif || [];
        ok++;
      } catch {
        const u = users.find((x) => x.id === id);
        gagal.push(u?.full_name || u?.username || String(id));
      }
    }
    setAturan((m) => ({ ...m, ...baru }));
    setSaving(false);
    setShowTerapkan(false);
    setTujuan(new Set());
    Swal.fire({
      icon: gagal.length ? 'warning' : 'success',
      title: gagal.length ? 'Selesai dengan catatan' : 'Tersimpan',
      text: gagal.length ? `${ok} akun berhasil, gagal: ${gagal.join(', ')}` : `Hak akses diterapkan ke ${ok} akun.`,
      confirmButtonColor: '#2563eb',
    });
  };

  const simpan = async () => {
    if (userId === null) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/tablet/akses/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nonaktif: Array.from(nonaktif) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan');
      setAturan((m) => ({ ...m, [userId]: data.nonaktif || [] }));
      Swal.fire({ icon: 'success', title: 'Tersimpan', text: 'Berlaku saat akun ini membuka/memuat ulang ERM Tablet.', timer: 1800, showConfirmButton: false });
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: e instanceof Error ? e.message : 'Terjadi kesalahan', confirmButtonColor: '#2563eb' });
    } finally {
      setSaving(false);
    }
  };

  const q = cari.trim().toLowerCase();
  const daftar = users.filter((u) => !q || u.full_name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q) || u.role.toLowerCase().includes(q));
  const terpilih = users.find((u) => u.id === userId);

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: 'min(980px, 100%)', height: 'min(640px, 100%)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Atur Hak Akses Tablet</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Menu & tab ERM Tablet yang tampil untuk tiap akun. Akun yang belum diatur = semua aktif.</div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 22, color: '#6b7280', cursor: 'pointer' }}>&times;</button>
        </div>

        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {/* Daftar akun */}
          <div style={{ width: 300, borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ padding: 12 }}>
              <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari nama / username / role..."
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {daftar.map((u) => {
                const n = (aturan[u.id] || []).length;
                const aktif = u.id === userId;
                return (
                  <div key={u.id} onClick={() => pilihUser(u.id)}
                    style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', background: aktif ? '#eff6ff' : '#fff', borderLeft: `3px solid ${aktif ? '#2563eb' : 'transparent'}` }}>
                    <div style={{ fontSize: 13, color: '#111827', fontWeight: aktif ? 600 : 400 }}>{u.full_name || u.username}</div>
                    <div style={{ fontSize: 11, color: '#6b7280', display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span>{u.username} · {u.role}</span>
                      {n > 0 && <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: 999, padding: '0 6px' }}>{n} nonaktif</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Centang menu & tab */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            {!terpilih ? (
              <div style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', marginTop: 80 }}>Pilih akun di sebelah kiri.</div>
            ) : (
              <>
                <div style={{ fontSize: 14, color: '#111827', marginBottom: 14 }}>
                  Akun: <b>{terpilih.full_name || terpilih.username}</b> <span style={{ color: '#6b7280' }}>({terpilih.role})</span>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Centang = tampil di tablet. Hapus centang untuk menonaktifkan.</div>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14, padding: 10, background: '#f9fafb', borderRadius: 8 }}>
                  <span style={{ fontSize: 12, color: '#374151' }}>Salin dari akun:</span>
                  <select value={sumber} onChange={(e) => salinDari(e.target.value)}
                    style={{ padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, minWidth: 220, background: '#fff' }}>
                    <option value="">— pilih akun sumber —</option>
                    {users.filter((u) => u.id !== userId).map((u) => (
                      <option key={u.id} value={u.id}>
                        {(u.full_name || u.username) + ` (${u.role})` + ((aturan[u.id] || []).length ? ` · ${(aturan[u.id] || []).length} nonaktif` : ' · semua aktif')}
                      </option>
                    ))}
                  </select>
                  <span style={{ flex: 1 }} />
                  <button type="button" onClick={() => { setTujuan(new Set()); setCariTujuan(''); setShowTerapkan(true); }}
                    style={{ border: '1px solid #2563eb', background: '#fff', color: '#2563eb', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    Terapkan ke akun lain…
                  </button>
                </div>
                {GRUP_AKSES_TABLET.map((g) => {
                  const semuaAktif = g.items.every((i) => !nonaktif.has(i.key));
                  return (
                    <div key={g.judul} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#2563eb' }}>{g.judul}</span>
                        <button type="button" onClick={() => setGrup(g, !semuaAktif)}
                          style={{ border: '1px solid #d1d5db', background: '#fff', borderRadius: 6, padding: '3px 10px', fontSize: 12, cursor: 'pointer', color: '#374151' }}>
                          {semuaAktif ? 'Nonaktifkan semua' : 'Aktifkan semua'}
                        </button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 8 }}>
                        {g.items.map((i) => {
                          const on = !nonaktif.has(i.key);
                          return (
                            <label key={i.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: on ? '#111827' : '#9ca3af', cursor: 'pointer', padding: '6px 8px', borderRadius: 6, background: on ? '#f0fdf4' : '#f9fafb' }}>
                              <input type="checkbox" checked={on} onChange={() => toggle(i.key)} />
                              {i.label}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontSize: 13, cursor: 'pointer' }}>Tutup</button>
          <button onClick={simpan} disabled={userId === null || saving}
            style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: userId === null || saving ? '#93c5fd' : '#2563eb', color: '#fff', fontSize: 13, fontWeight: 600, cursor: userId === null || saving ? 'default' : 'pointer' }}>
            {saving ? 'Menyimpan...' : 'Simpan Hak Akses'}
          </button>
        </div>
      </div>
      {showTerapkan && terpilih && (
        <div onClick={(e) => { e.stopPropagation(); setShowTerapkan(false); }} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: 'min(520px, 100%)', maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Terapkan ke akun lain</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>
                Pengaturan di form ({nonaktif.size ? `${nonaktif.size} menu/tab nonaktif` : 'semua aktif'}) akan menimpa hak akses akun yang dipilih.
              </div>
            </div>
            <div style={{ padding: '10px 18px', display: 'flex', gap: 8, alignItems: 'center' }}>
              <input value={cariTujuan} onChange={(e) => setCariTujuan(e.target.value)} placeholder="Cari akun..."
                style={{ flex: 1, padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }} />
              <button type="button"
                onClick={() => {
                  const qq = cariTujuan.trim().toLowerCase();
                  const ids = users.filter((u) => u.id !== userId && (!qq || u.full_name.toLowerCase().includes(qq) || u.username.toLowerCase().includes(qq) || u.role.toLowerCase().includes(qq))).map((u) => u.id);
                  setTujuan((prev) => (ids.every((i) => prev.has(i)) ? new Set() : new Set(ids)));
                }}
                style={{ border: '1px solid #d1d5db', background: '#fff', borderRadius: 6, padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}>
                Pilih semua
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 18px 10px' }}>
              {users
                .filter((u) => u.id !== userId)
                .filter((u) => { const qq = cariTujuan.trim().toLowerCase(); return !qq || u.full_name.toLowerCase().includes(qq) || u.username.toLowerCase().includes(qq) || u.role.toLowerCase().includes(qq); })
                .map((u) => (
                  <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}>
                    <input type="checkbox" checked={tujuan.has(u.id)}
                      onChange={() => setTujuan((prev) => { const n = new Set(prev); if (n.has(u.id)) n.delete(u.id); else n.add(u.id); return n; })} />
                    <span style={{ fontSize: 13, color: '#111827' }}>{u.full_name || u.username}</span>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>{u.username} · {u.role}</span>
                  </label>
                ))}
            </div>
            <div style={{ padding: '12px 18px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setShowTerapkan(false)} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontSize: 13, cursor: 'pointer' }}>Batal</button>
              <button onClick={terapkanKeAkunLain} disabled={tujuan.size === 0 || saving}
                style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: tujuan.size === 0 || saving ? '#93c5fd' : '#2563eb', color: '#fff', fontSize: 13, fontWeight: 600, cursor: tujuan.size === 0 || saving ? 'default' : 'pointer' }}>
                {saving ? 'Menyimpan...' : `Terapkan ke ${tujuan.size} akun`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
