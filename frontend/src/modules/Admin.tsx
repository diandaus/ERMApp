import React from 'react';
import Swal from 'sweetalert2';
import { AddUserModal } from '../components/AddUserModal';

type AppUser = {
  id: number;
  username: string;
  full_name: string;
  role: string;
  is_active?: boolean;
  allowed_modules?: string;
};

type BridgingConfig = {
  kode: string;
  nama: string;
  grp: string;
  enabled: boolean;
  config: Record<string, string>;
};

type FieldType = 'url' | 'text' | 'secret' | 'port' | 'toggle';
type FieldDef = { key: string; label: string; type: FieldType; placeholder?: string };
type ServiceDef = { kode: string; nama: string; grp: string; fields: FieldDef[] };

const BRIDGING_DEFS: ServiceDef[] = [
  {
    kode: 'bpjs_vclaim', nama: 'VClaim', grp: 'bpjs',
    fields: [
      { key: 'URL', label: 'URL / Base URL', type: 'url', placeholder: 'https://apijkn.bpjs-kesehatan.go.id/vclaim-rest/' },
      { key: 'CONSID', label: 'Consumer ID', type: 'text' },
      { key: 'SECRETKEY', label: 'Secret Key', type: 'secret' },
      { key: 'USERKEY', label: 'User Key', type: 'secret' },
    ],
  },
  {
    kode: 'bpjs_aplicare', nama: 'Aplicare', grp: 'bpjs',
    fields: [
      { key: 'URL', label: 'URL / Base URL', type: 'url', placeholder: 'https://apijkn.bpjs-kesehatan.go.id/aplicaresapp/' },
      { key: 'CONSID', label: 'Consumer ID', type: 'text' },
      { key: 'SECRETKEY', label: 'Secret Key', type: 'secret' },
    ],
  },
  {
    kode: 'bpjs_mobilejkn', nama: 'Mobile JKN (RS)', grp: 'bpjs',
    fields: [
      { key: 'URL', label: 'URL / Base URL', type: 'url', placeholder: 'https://apijkn.bpjs-kesehatan.go.id/mobilejkn/' },
      { key: 'CONSID', label: 'Consumer ID', type: 'text' },
      { key: 'SECRETKEY', label: 'Secret Key', type: 'secret' },
      { key: 'USERKEY', label: 'User Key', type: 'secret' },
    ],
  },
  {
    kode: 'bpjs_mobilejknfktp', nama: 'Mobile JKN (FKTP)', grp: 'bpjs',
    fields: [
      { key: 'URL', label: 'URL / Base URL', type: 'url', placeholder: 'https://apijkn.bpjs-kesehatan.go.id/mobilejknfktp/' },
      { key: 'CONSID', label: 'Consumer ID', type: 'text' },
      { key: 'SECRETKEY', label: 'Secret Key', type: 'secret' },
      { key: 'USERNAME', label: 'Username', type: 'text' },
      { key: 'PASSWORD', label: 'Password', type: 'secret' },
    ],
  },
  {
    kode: 'bpjs_apotek', nama: 'Apotek Online', grp: 'bpjs',
    fields: [
      { key: 'URL', label: 'URL / Base URL', type: 'url', placeholder: 'https://apijkn.bpjs-kesehatan.go.id/apotek/' },
      { key: 'CONSID', label: 'Consumer ID', type: 'text' },
      { key: 'SECRETKEY', label: 'Secret Key', type: 'secret' },
      { key: 'DIAGNOSARUJUKANMASUK', label: 'Diagnosa Rujukan Masuk', type: 'toggle' },
      { key: 'JADIKANBOOKINGSURATKONTROL', label: 'Jadikan Booking Surat Kontrol', type: 'toggle' },
      { key: 'ADDANTRIAN', label: 'Add Antrian', type: 'toggle' },
    ],
  },
  {
    kode: 'bpjs_icare', nama: 'I-Care BPJS', grp: 'bpjs',
    fields: [
      { key: 'URL', label: 'URL / Base URL', type: 'url', placeholder: 'https://icare.bpjs-kesehatan.go.id/' },
      { key: 'USERNAME', label: 'Username', type: 'text' },
      { key: 'PASSWORD', label: 'Password', type: 'secret' },
    ],
  },
  {
    kode: 'bpjs_smartclaim', nama: 'Smart Claim', grp: 'bpjs',
    fields: [
      { key: 'URL', label: 'URL / Base URL', type: 'url', placeholder: 'https://apijkn.bpjs-kesehatan.go.id/smartclaim/' },
      { key: 'CONSID', label: 'Consumer ID', type: 'text' },
      { key: 'SECRETKEY', label: 'Secret Key', type: 'secret' },
    ],
  },
  {
    kode: 'bpjs_pcare', nama: 'PCare', grp: 'bpjs',
    fields: [
      { key: 'URL', label: 'URL / Base URL', type: 'url', placeholder: 'https://new-api.bpjs-kesehatan.go.id/apotek/' },
      { key: 'USERNAME', label: 'Username', type: 'text' },
      { key: 'PASSWORD', label: 'Password', type: 'secret' },
    ],
  },
  {
    kode: 'satu_sehat', nama: 'Satu Sehat', grp: 'satusehat',
    fields: [
      { key: 'CLIENTID', label: 'Client ID', type: 'text' },
      { key: 'SECRETKEY', label: 'Secret Key', type: 'secret' },
      { key: 'URL_AUTH', label: 'URL Auth', type: 'url', placeholder: 'https://api-satusehat.kemkes.go.id/oauth2/v1' },
      { key: 'URL_FHIR', label: 'URL FHIR', type: 'url', placeholder: 'https://api-satusehat.kemkes.go.id/fhir-r4/v1' },
      { key: 'ID', label: 'Organization ID', type: 'text' },
      { key: 'KELURAHAN', label: 'Kode Kelurahan', type: 'text' },
      { key: 'KECAMATAN', label: 'Kode Kecamatan', type: 'text' },
      { key: 'KABUPATEN', label: 'Kode Kabupaten', type: 'text' },
      { key: 'PROPINSI', label: 'Kode Provinsi', type: 'text' },
      { key: 'KODEPOS', label: 'Kode Pos', type: 'text' },
    ],
  },
  {
    kode: 'orthanc', nama: 'ORTHANC (PACS)', grp: 'orthanc',
    fields: [
      { key: 'URL', label: 'URL / Host', type: 'url', placeholder: 'http://localhost' },
      { key: 'PORT', label: 'Port', type: 'port', placeholder: '8042' },
      { key: 'USERNAME', label: 'Username', type: 'text' },
      { key: 'PASSWORD', label: 'Password', type: 'secret' },
    ],
  },
  {
    kode: 'sisrute', nama: 'SISRUTE', grp: 'kemkes',
    fields: [
      { key: 'URL', label: 'URL / Base URL', type: 'url' },
      { key: 'USERNAME', label: 'Username', type: 'text' },
      { key: 'PASSWORD', label: 'Password', type: 'secret' },
    ],
  },
  {
    kode: 'sirs', nama: 'SIRS Online', grp: 'kemkes',
    fields: [
      { key: 'URL', label: 'URL / Base URL', type: 'url' },
      { key: 'USERNAME', label: 'Username', type: 'text' },
      { key: 'PASSWORD', label: 'Password', type: 'secret' },
    ],
  },
  {
    kode: 'sitt', nama: 'SITT (TB)', grp: 'kemkes',
    fields: [
      { key: 'URL', label: 'URL / Base URL', type: 'url' },
      { key: 'USERNAME', label: 'Username', type: 'text' },
      { key: 'PASSWORD', label: 'Password', type: 'secret' },
    ],
  },
  {
    kode: 'corona', nama: 'Covid-19 Kemenkes', grp: 'kemkes',
    fields: [
      { key: 'URL', label: 'URL / Base URL', type: 'url' },
      { key: 'USERNAME', label: 'Username', type: 'text' },
      { key: 'PASSWORD', label: 'Password', type: 'secret' },
    ],
  },
];

const GROUPS = [
  { id: 'bpjs',      label: 'BPJS Kesehatan',  color: '#16a34a', icon: '🏥', bgLight: '#f0fdf4', borderColor: '#86efac' },
  { id: 'satusehat', label: 'Satu Sehat',       color: '#2563eb', icon: '🇮🇩', bgLight: '#eff6ff', borderColor: '#93c5fd' },
  { id: 'orthanc',   label: 'ORTHANC (PACS)',   color: '#7c3aed', icon: '🩻', bgLight: '#f5f3ff', borderColor: '#c4b5fd' },
  { id: 'kemkes',    label: 'Kemkes Lainnya',   color: '#ea580c', icon: '🏛️', bgLight: '#fff7ed', borderColor: '#fed7aa' },
];

export const AdminView: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<'users' | 'settings' | 'bridging'>('users');
  const [users, setUsers] = React.useState<AppUser[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [savingId, setSavingId] = React.useState<number | null>(null);

  const [showModal, setShowModal] = React.useState<boolean>(false);
  const [editingUser, setEditingUser] = React.useState<AppUser | null>(null);

  const [namaInstansi, setNamaInstansi] = React.useState<string>('');
  const [alamatInstansi, setAlamatInstansi] = React.useState<string>('');
  const [logoFile, setLogoFile] = React.useState<File | null>(null);
  const [logoPreview, setLogoPreview] = React.useState<string>('');
  const [savingSettings, setSavingSettings] = React.useState<boolean>(false);

  // Bridging state
  const [bridgingList, setBridgingList]         = React.useState<BridgingConfig[]>([]);
  const [bridgingDraft, setBridgingDraft]       = React.useState<Record<string, Record<string, string>>>({});
  const [bridgingEnabled, setBridgingEnabled]   = React.useState<Record<string, boolean>>({});
  const [savingBridging, setSavingBridging]     = React.useState<string | null>(null);
  const [expandedService, setExpandedService]   = React.useState<Set<string>>(new Set());
  const [showSecret, setShowSecret]             = React.useState<Record<string, boolean>>({});

  // ─── User Management ─────────────────────────────────────────────────────

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengambil data user');
      setUsers(data as AppUser[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { void loadUsers(); }, []);

  const handleUpdate = async (u: AppUser) => {
    setSavingId(u.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: u.full_name, role: u.role, is_active: u.is_active ?? true })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any).error || 'Gagal menyimpan perubahan user');
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan saat menyimpan user');
    } finally {
      setSavingId(null);
    }
  };

  const handleResetPassword = async (u: AppUser) => {
    const confirmReset = window.confirm(`Reset password user "${u.username}" ke nilai default "123456"?`);
    if (!confirmReset) return;
    setSavingId(u.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${u.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: '123456' })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any).error || 'Gagal reset password');
      alert(`Password user "${u.username}" telah direset ke: 123456`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan saat reset password');
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    const user = users.find((u) => u.id === id);
    if (!user) return;
    const result = await Swal.fire({
      title: 'Hapus User?',
      html: `Apakah Anda yakin ingin menghapus user <strong>${user.username}</strong> (${user.full_name})?<br/><br/><span style="color: #dc2626; font-weight: 500;">Data yang dihapus tidak dapat dikembalikan!</span>`,
      icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#dc2626', cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Hapus', cancelButtonText: 'Batal'
    });
    if (!result.isConfirmed) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any).error || 'Gagal menghapus user');
      }
      await Swal.fire({ title: 'Berhasil!', text: `User ${user.username} telah dihapus`, icon: 'success', confirmButtonColor: '#2563eb' });
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan saat menghapus user');
      await Swal.fire({ title: 'Gagal!', text: e instanceof Error ? e.message : 'Terjadi kesalahan', icon: 'error', confirmButtonColor: '#dc2626' });
    }
  };

  const handleToggleActive = (id: number, value: boolean) =>
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, is_active: value } : u));

  const handleRoleChange = (id: number, role: AppUser['role']) =>
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, role } : u));

  // ─── Settings ────────────────────────────────────────────────────────────

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      if (res.ok) {
        setNamaInstansi(data.nama_instansi || '');
        setAlamatInstansi(data.alamat || '');
        if (data.logo_url) setLogoPreview(data.logo_url);
      }
    } catch (e) {
      console.error('Gagal load settings:', e);
    }
  };

  React.useEffect(() => {
    if (activeTab === 'settings') void loadSettings();
  }, [activeTab]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setLogoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('nama_instansi', namaInstansi);
      formData.append('alamat', alamatInstansi);
      if (logoFile) formData.append('logo', logoFile);
      const res = await fetch('/api/admin/settings', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan pengaturan');
      await Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Pengaturan instansi berhasil disimpan', confirmButtonText: 'OK', confirmButtonColor: '#2563eb' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setSavingSettings(false);
    }
  };

  // ─── Bridging ─────────────────────────────────────────────────────────────

  const loadBridging = async () => {
    try {
      const res = await fetch('/api/admin/bridging');
      const data = await res.json();
      if (!res.ok || !Array.isArray(data)) return;
      setBridgingList(data as BridgingConfig[]);
      const draft: Record<string, Record<string, string>> = {};
      const enabled: Record<string, boolean> = {};
      (data as BridgingConfig[]).forEach(b => {
        draft[b.kode] = { ...(b.config ?? {}) };
        enabled[b.kode] = b.enabled;
      });
      setBridgingDraft(draft);
      setBridgingEnabled(enabled);
    } catch { /* silent */ }
  };

  React.useEffect(() => {
    if (activeTab === 'bridging') void loadBridging();
  }, [activeTab]);

  const setConfigDraft = (kode: string, field: string, val: string) =>
    setBridgingDraft(prev => ({ ...prev, [kode]: { ...(prev[kode] ?? {}), [field]: val } }));

  const toggleEnabled = (kode: string) =>
    setBridgingEnabled(prev => ({ ...prev, [kode]: !prev[kode] }));

  const toggleSecret = (key: string) =>
    setShowSecret(prev => ({ ...prev, [key]: !prev[key] }));

  const toggleExpanded = (kode: string) =>
    setExpandedService(prev => {
      const next = new Set(prev);
      next.has(kode) ? next.delete(kode) : next.add(kode);
      return next;
    });

  const handleSaveBridging = async (kode: string) => {
    // Kalau belum pernah tersimpan (belum ada baris di setting_bridging),
    // bridgingList tidak akan punya entri untuk kode ini — pakai metadata
    // statis dari BRIDGING_DEFS supaya penyimpanan pertama kali tetap jalan.
    const existing = bridgingList.find(x => x.kode === kode);
    const def = BRIDGING_DEFS.find(d => d.kode === kode);
    if (!existing && !def) return;
    const nama = existing?.nama ?? def!.nama;
    const grp = existing?.grp ?? def!.grp;
    setSavingBridging(kode);
    try {
      const payload: BridgingConfig = {
        kode,
        nama,
        grp,
        enabled: bridgingEnabled[kode] ?? existing?.enabled ?? true,
        config: bridgingDraft[kode] ?? {},
      };
      const res = await fetch('/api/admin/bridging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan');
      await Swal.fire({ icon: 'success', title: 'Berhasil!', text: `Konfigurasi ${nama} berhasil disimpan`, confirmButtonColor: '#2563eb', timer: 1500, showConfirmButton: false });
      await loadBridging();
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: e instanceof Error ? e.message : 'Terjadi kesalahan', confirmButtonColor: '#2563eb' });
    } finally {
      setSavingBridging(null);
    }
  };

  // ─── Render Helpers ───────────────────────────────────────────────────────

  const renderField = (kode: string, field: FieldDef, grpColor: string) => {
    const draft = bridgingDraft[kode] ?? {};
    const secretKey = `${kode}_${field.key}`;
    const visible = showSecret[secretKey];
    const val = draft[field.key] ?? '';

    if (field.type === 'toggle') {
      const isOn = val === 'true' || val === '1' || val === 'yes';
      return (
        <div key={field.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
          <span style={{ fontSize: 13, color: '#374151' }}>{field.label}</span>
          <div
            onClick={() => setConfigDraft(kode, field.key, isOn ? 'false' : 'true')}
            style={{ width: 36, height: 20, borderRadius: 10, position: 'relative', cursor: 'pointer', background: isOn ? grpColor : '#d1d5db', transition: 'background 0.2s', flexShrink: 0 }}
          >
            <div style={{ position: 'absolute', top: 2, left: isOn ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
          </div>
        </div>
      );
    }

    const isSecret = field.type === 'secret';
    return (
      <div key={field.key}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
          {field.label}
        </label>
        <div style={{ position: 'relative' }}>
          <input
            type={isSecret && !visible ? 'password' : 'text'}
            value={val}
            onChange={e => setConfigDraft(kode, field.key, e.target.value)}
            placeholder={field.placeholder ?? (field.type === 'port' ? '8080' : `Masukkan ${field.label}`)}
            style={{
              width: '100%', padding: isSecret ? '8px 36px 8px 10px' : '8px 10px',
              borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none',
              boxSizing: 'border-box',
              fontFamily: field.type === 'url' || field.type === 'port' ? 'monospace' : 'inherit',
            }}
          />
          {isSecret && (
            <button
              type="button"
              onClick={() => toggleSecret(secretKey)}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0, display: 'flex' }}
            >
              {visible
                ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              }
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderServiceCard = (def: ServiceDef, grp: typeof GROUPS[number]) => {
    const b = Array.isArray(bridgingList) ? bridgingList.find(x => x.kode === def.kode) : undefined;
    const enabled = bridgingEnabled[def.kode] ?? false;
    const expanded = expandedService.has(def.kode);
    const saving = savingBridging === def.kode;
    const toggleFields = def.fields.filter(f => f.type === 'toggle');
    const inputFields  = def.fields.filter(f => f.type !== 'toggle');

    return (
      <div key={def.kode} style={{ borderRadius: 10, border: `1px solid ${grp.borderColor}`, overflow: 'hidden', background: '#fff' }}>
        {/* Service header */}
        <div
          onClick={() => toggleExpanded(def.kode)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: expanded ? grp.bgLight : '#fafafa', cursor: 'pointer', userSelect: 'none' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={grp.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}>
              <polyline points="9 18 15 12 9 6"/>
            </svg>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{def.nama}</span>
            {!b && <span style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>(belum tersinkron)</span>}
            {b && enabled && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: grp.bgLight, color: grp.color, fontWeight: 600, border: `1px solid ${grp.borderColor}` }}>Aktif</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={e => e.stopPropagation()}>
            <div
              onClick={() => toggleEnabled(def.kode)}
              style={{ width: 32, height: 18, borderRadius: 9, position: 'relative', cursor: 'pointer', background: enabled ? grp.color : '#d1d5db', transition: 'background 0.2s' }}
            >
              <div style={{ position: 'absolute', top: 2, left: enabled ? 16 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
            </div>
          </div>
        </div>

        {/* Expanded content */}
        {expanded && (
          <div style={{ padding: 14, borderTop: `1px solid ${grp.borderColor}` }}>
            {/* Input fields grid */}
            {inputFields.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px 16px', marginBottom: toggleFields.length > 0 ? 14 : 0 }}>
                {inputFields.map(f => renderField(def.kode, f, grp.color))}
              </div>
            )}

            {/* Toggle fields */}
            {toggleFields.length > 0 && (
              <div style={{ borderRadius: 8, border: '1px solid #f3f4f6', padding: '4px 12px', marginBottom: 12, background: '#fafafa' }}>
                {toggleFields.map(f => renderField(def.kode, f, grp.color))}
              </div>
            )}

            {/* Save button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                onClick={() => void handleSaveBridging(def.kode)}
                disabled={saving}
                style={{ padding: '7px 20px', borderRadius: 8, border: 'none', background: saving ? '#9ca3af' : grp.color, color: '#fff', fontSize: 13, fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer' }}
              >
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── Main Render ──────────────────────────────────────────────────────────

  return (
    <section style={{ background: '#ffffff', borderRadius: 16, padding: 24, boxShadow: '0 10px 30px rgba(15,23,42,0.08)', border: '1px solid #e5e7eb' }}>
      {/* Tab Navigation */}
      <div style={{ marginBottom: 24, borderBottom: '2px solid #e5e7eb' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['users', 'settings', 'bridging'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '12px 24px', border: 'none', background: 'transparent',
                color: activeTab === tab ? '#2563eb' : '#6b7280',
                fontSize: 14, fontWeight: activeTab === tab ? 600 : 400,
                cursor: 'pointer',
                borderBottom: activeTab === tab ? '2px solid #2563eb' : '2px solid transparent',
                marginBottom: -2, transition: 'all 0.2s'
              }}
            >
              {tab === 'users' ? 'Manajemen User' : tab === 'settings' ? 'Pengaturan Instansi' : 'Pengaturan Bridging'}
            </button>
          ))}
        </div>
      </div>

      {/* Tab: Users */}
      {activeTab === 'users' && (
        <>
          {error && (
            <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: '#fef2f2', color: '#b91c1c', fontSize: 13 }}>
              {error}
            </div>
          )}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#111827' }}>Daftar User</h3>
              <button
                onClick={() => setShowModal(true)}
                style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 2px 4px rgba(37,99,235,0.2)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                User Baru
              </button>
            </div>
            <div style={{ borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'hidden', background: '#fff' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Username</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Nama Lengkap</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Role</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Hak Akses Modul</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Status</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '12px 16px', color: '#111827' }}>{u.username}</td>
                      <td style={{ padding: '12px 16px', color: '#111827' }}>{u.full_name}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                          background: u.role === 'admin' ? '#fee2e2' : u.role === 'dokter' ? '#dbeafe' : u.role === 'farmasi' ? '#dcfce7' : u.role === 'kasir' ? '#fef3c7' : u.role === 'pendaftaran' ? '#f3f4f6' : '#ede9fe',
                          color: u.role === 'admin' ? '#dc2626' : u.role === 'dokter' ? '#2563eb' : u.role === 'farmasi' ? '#16a34a' : u.role === 'kasir' ? '#ca8a04' : u.role === 'pendaftaran' ? '#6b7280' : '#6d28d9'
                        }}>
                          {u.role === 'pendaftaran' ? 'Pendaftaran' : u.role === 'dokter' ? 'Dokter' : u.role === 'farmasi' ? 'Farmasi' : u.role === 'kasir' ? 'Kasir' : u.role === 'admin' ? 'Admin' : u.role}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 300, maxHeight: 80, overflow: 'auto' }}>
                          {u.allowed_modules ? (
                            u.allowed_modules.split(',').map((mod) => (
                              <span key={mod} style={{ padding: '2px 8px', borderRadius: 4, background: '#dbeafe', color: '#1e40af', fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap' }}>
                                {mod}
                              </span>
                            ))
                          ) : (
                            <span style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>Tidak ada modul</span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                          <input type="checkbox" checked={u.is_active ?? true} onChange={(e) => handleToggleActive(u.id, e.target.checked)} style={{ cursor: 'pointer' }} />
                          {u.is_active ?? true ? 'Aktif' : 'Nonaktif'}
                        </label>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => { setEditingUser(u); setShowModal(true); }}
                            style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => void handleDelete(u.id)}
                            style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && !loading && (
                    <tr>
                      <td colSpan={6} style={{ padding: '24px 8px', textAlign: 'center', color: '#9ca3af', borderTop: '1px solid #e5e7eb' }}>
                        Belum ada user lain selain admin default.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <AddUserModal
        show={showModal}
        onClose={() => { setShowModal(false); setEditingUser(null); }}
        onSuccess={loadUsers}
        setError={setError}
        editUser={editingUser}
      />

      {/* Tab: Settings */}
      {activeTab === 'settings' && (
        <div>
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ marginTop: 0, marginBottom: 4 }}>Pengaturan Instansi</h2>
            <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
              Atur informasi dasar rumah sakit seperti nama, alamat, dan logo yang akan ditampilkan pada sistem.
            </p>
          </div>
          {error && (
            <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: '#fef2f2', color: '#b91c1c', fontSize: 13 }}>{error}</div>
          )}
          <form onSubmit={handleSaveSettings}>
            <div style={{ display: 'grid', gap: 20, maxWidth: 600 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500, color: '#374151' }}>Nama Instansi</label>
                <input type="text" value={namaInstansi} onChange={(e) => setNamaInstansi(e.target.value)} placeholder="Contoh: RS Harapan Sehat" required style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500, color: '#374151' }}>Alamat</label>
                <textarea value={alamatInstansi} onChange={(e) => setAlamatInstansi(e.target.value)} placeholder="Contoh: Jl. Merdeka No. 123, Jakarta Pusat" required rows={3} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500, color: '#374151' }}>Logo Instansi</label>
                <input type="file" accept="image/*" onChange={handleLogoChange} style={{ display: 'block', width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }} />
                {logoPreview && <div style={{ marginTop: 12 }}><img src={logoPreview} alt="Logo Preview" style={{ maxWidth: 200, maxHeight: 200, borderRadius: 8, border: '1px solid #e5e7eb' }} /></div>}
              </div>
              <div>
                <button type="submit" disabled={savingSettings} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: savingSettings ? '#9ca3af' : '#2563eb', color: '#fff', cursor: savingSettings ? 'default' : 'pointer', fontSize: 13, fontWeight: 500 }}>
                  {savingSettings ? 'Menyimpan...' : 'Simpan Pengaturan'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Tab: Bridging */}
      {activeTab === 'bridging' && (
        <div>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ margin: '0 0 4px' }}>Pengaturan Bridging</h2>
            <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
              Konfigurasi integrasi dengan sistem eksternal. Klik nama layanan untuk mengatur koneksinya.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {GROUPS.map(grp => {
              const grpDefs = BRIDGING_DEFS.filter(d => d.grp === grp.id);
              if (grpDefs.length === 0) return null;
              return (
                <div key={grp.id}>
                  {/* Group header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 18 }}>{grp.icon}</span>
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: grp.color }}>{grp.label}</h3>
                    <div style={{ flex: 1, height: 1, background: grp.borderColor }} />
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>
                      {grpDefs.filter(d => bridgingEnabled[d.kode]).length}/{grpDefs.length} aktif
                    </span>
                  </div>

                  {/* Service cards */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {grpDefs.map(def => renderServiceCard(def, grp))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};
