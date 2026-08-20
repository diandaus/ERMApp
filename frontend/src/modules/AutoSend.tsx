import React from 'react';
import Swal from 'sweetalert2';

const inputSm: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box' };
const labelSm: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 };

// AutoSend.tsx — halaman pengaturan worker kirim-otomatis
// (satu_sehat_autosend_worker.go). Dua lapis saklar: global (nyala/mati +
// parameter tuning) dan per-resource (35 toggle, dikelompokkan sama seperti
// Perjalanan Pasien). Semua toggle langsung tersimpan begitu diklik (tidak
// ada tombol "Simpan" terpisah utk toggle, cuma utk parameter global).

type ResourceItem = {
  resource_key: string;
  label: string;
  group: string;
  enabled: boolean;
};

type AutoSendData = {
  enabled: boolean;
  interval_detik: number;
  window_hari: number;
  cooldown_menit: number;
  max_per_siklus: number;
  resources: ResourceItem[];
};

const GROUP_LABELS: Record<string, string> = {
  utama: 'Alur Utama',
  observasi_ttv: 'Observation - Tanda Vital',
  radiologi: 'Radiologi',
  lab_pk: 'Laboratorium - Patologi Klinik',
  lab_mb: 'Laboratorium - Mikrobiologi',
};
const GROUP_ORDER = ['utama', 'observasi_ttv', 'radiologi', 'lab_pk', 'lab_mb'];

const ToggleSwitch: React.FC<{ on: boolean; onChange: () => void; color?: string }> = ({ on, onChange, color = '#059669' }) => (
  <div
    onClick={onChange}
    style={{ width: 36, height: 20, borderRadius: 10, position: 'relative', cursor: 'pointer', background: on ? color : '#d1d5db', transition: 'background 0.2s', flexShrink: 0 }}
  >
    <div style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
  </div>
);

export const AutoSendSection: React.FC = () => {
  const [data, setData] = React.useState<AutoSendData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [savingGlobal, setSavingGlobal] = React.useState(false);
  const [draft, setDraft] = React.useState({ interval_detik: 20, window_hari: 3, cooldown_menit: 15, max_per_siklus: 50 });

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/satu-sehat/auto-send/settings');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memuat pengaturan');
      setData(json);
      setDraft({
        interval_detik: json.interval_detik, window_hari: json.window_hari,
        cooldown_menit: json.cooldown_menit, max_per_siklus: json.max_per_siklus,
      });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  const saveGlobal = async (enabledOverride?: boolean) => {
    if (!data) return;
    setSavingGlobal(true);
    try {
      const body = {
        enabled: enabledOverride !== undefined ? enabledOverride : data.enabled,
        interval_detik: draft.interval_detik, window_hari: draft.window_hari,
        cooldown_menit: draft.cooldown_menit, max_per_siklus: draft.max_per_siklus,
      };
      const res = await fetch('/api/satu-sehat/auto-send/settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal menyimpan');
      setData((prev) => (prev ? { ...prev, ...body } : prev));
      if (enabledOverride === undefined) {
        Swal.fire({ icon: 'success', title: 'Tersimpan', text: 'Pengaturan kirim otomatis diperbarui', timer: 1500, showConfirmButton: false });
      }
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setSavingGlobal(false);
    }
  };

  const toggleGlobal = async () => {
    if (!data) return;
    const next = !data.enabled;
    if (next) {
      const confirm = await Swal.fire({
        title: 'Aktifkan kirim otomatis?',
        html: 'Worker akan mulai mengirim data yang sudah layak ke Satu Sehat <b>tanpa perlu klik manual</b>, mengikuti saklar per-resource di bawah. Pastikan sudah yakin sebelum menyalakan.',
        icon: 'warning', showCancelButton: true, confirmButtonText: 'Ya, Aktifkan', cancelButtonText: 'Batal', confirmButtonColor: '#059669',
      });
      if (!confirm.isConfirmed) return;
    }
    setData({ ...data, enabled: next });
    saveGlobal(next);
  };

  const toggleResource = async (resourceKey: string, current: boolean) => {
    if (!data) return;
    const next = !current;
    setData({ ...data, resources: data.resources.map((r) => (r.resource_key === resourceKey ? { ...r, enabled: next } : r)) });
    try {
      const res = await fetch(`/api/satu-sehat/auto-send/resource/${resourceKey}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) throw new Error('Gagal menyimpan');
    } catch (err) {
      setData((prev) => (prev ? { ...prev, resources: prev.resources.map((r) => (r.resource_key === resourceKey ? { ...r, enabled: current } : r)) } : prev));
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    }
  };

  const toggleGroup = async (group: string, enabled: boolean) => {
    if (!data) return;
    const prevData = data;
    setData({ ...data, resources: data.resources.map((r) => (r.group === group ? { ...r, enabled } : r)) });
    try {
      const res = await fetch(`/api/satu-sehat/auto-send/resource-group/${group}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error('Gagal menyimpan');
    } catch (err) {
      setData(prevData);
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    }
  };

  const grouped = React.useMemo(() => {
    if (!data) return [];
    const map = new Map<string, ResourceItem[]>();
    for (const r of data.resources) {
      if (!map.has(r.group)) map.set(r.group, []);
      map.get(r.group)!.push(r);
    }
    return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({ group: g, items: map.get(g)! }));
  }, [data]);

  if (loading || !data) {
    return <div style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>Memuat...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ borderRadius: 10, border: '1px solid #e5e7eb', padding: 16, background: '#ffffff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Saklar Global</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
              Kalau mati, tidak ada resource yang dikirim otomatis walau saklar per-resource di bawah menyala.
            </div>
          </div>
          <ToggleSwitch on={data.enabled} onChange={toggleGlobal} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 12 }}>
          <div>
            <label style={labelSm}>Interval (detik)</label>
            <input type="number" min={5} value={draft.interval_detik} onChange={(e) => setDraft({ ...draft, interval_detik: Number(e.target.value) })} style={inputSm} />
          </div>
          <div>
            <label style={labelSm}>Jendela Tanggal (hari)</label>
            <input type="number" min={1} value={draft.window_hari} onChange={(e) => setDraft({ ...draft, window_hari: Number(e.target.value) })} style={inputSm} />
          </div>
          <div>
            <label style={labelSm}>Cooldown Gagal (menit)</label>
            <input type="number" min={1} value={draft.cooldown_menit} onChange={(e) => setDraft({ ...draft, cooldown_menit: Number(e.target.value) })} style={inputSm} />
          </div>
          <div>
            <label style={labelSm}>Maks per Siklus</label>
            <input type="number" min={1} value={draft.max_per_siklus} onChange={(e) => setDraft({ ...draft, max_per_siklus: Number(e.target.value) })} style={inputSm} />
          </div>
        </div>
        <button
          type="button"
          onClick={() => saveGlobal()}
          disabled={savingGlobal}
          style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: savingGlobal ? '#9ca3af' : '#059669', color: '#fff', cursor: savingGlobal ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500 }}
        >
          {savingGlobal ? 'Menyimpan...' : 'Simpan Parameter'}
        </button>
      </div>

      {grouped.map(({ group, items }) => {
        const allOn = items.every((r) => r.enabled);
        const allOff = items.every((r) => !r.enabled);
        return (
          <div key={group} style={{ borderRadius: 10, border: '1px solid #e5e7eb', padding: 16, background: '#ffffff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                {GROUP_LABELS[group] || group}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group, true)}
                  disabled={allOn}
                  style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #059669', background: '#fff', color: allOn ? '#9ca3af' : '#059669', borderColor: allOn ? '#d1d5db' : '#059669', fontSize: 11, fontWeight: 600, cursor: allOn ? 'not-allowed' : 'pointer' }}
                >
                  Aktifkan Semua
                </button>
                <button
                  type="button"
                  onClick={() => toggleGroup(group, false)}
                  disabled={allOff}
                  style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: allOff ? '#9ca3af' : '#991b1b', fontSize: 11, fontWeight: 600, cursor: allOff ? 'not-allowed' : 'pointer' }}
                >
                  Nonaktifkan Semua
                </button>
              </div>
            </div>
            <div>
              {items.map((r, idx) => (
                <div key={r.resource_key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: idx === items.length - 1 ? 'none' : '1px solid #f3f4f6' }}>
                  <span style={{ fontSize: 13, color: '#374151' }}>{r.label}</span>
                  <ToggleSwitch on={r.enabled} onChange={() => toggleResource(r.resource_key, r.enabled)} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
