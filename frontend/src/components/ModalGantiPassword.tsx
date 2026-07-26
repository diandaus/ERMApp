import React from 'react';
import Swal from 'sweetalert2';

// ============================================================================
// Ganti Password sendiri — dituju tombol "Pengaturan" di menu user (App.tsx)
// KHUSUS user non-admin (admin tetap diarahkan ke AdminView penuh). Beda
// dari fitur admin "Reset Password" di Admin.tsx (reset paksa ke default
// "123456" tanpa perlu tahu password lama) — di sini user WAJIB masukkan
// password lama dulu, diverifikasi backend (POST /api/auth/change-password)
// sebelum boleh ganti ke password baru.
// ============================================================================

type ModalGantiPasswordProps = {
  userId: number;
  onClose: () => void;
};

export const ModalGantiPassword: React.FC<ModalGantiPasswordProps> = ({ userId, onClose }) => {
  const [oldPassword, setOldPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4,
  };

  const handleSimpan = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      Swal.fire({ icon: 'warning', title: 'Semua field wajib diisi' });
      return;
    }
    if (newPassword.length < 6) {
      Swal.fire({ icon: 'warning', title: 'Password baru minimal 6 karakter' });
      return;
    }
    if (newPassword !== confirmPassword) {
      Swal.fire({ icon: 'warning', title: 'Konfirmasi password baru tidak cocok' });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, old_password: oldPassword, new_password: newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal mengganti password');

      Swal.fire({ icon: 'success', title: 'Password berhasil diganti', timer: 2000, showConfirmButton: false });
      onClose();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 10003, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ background: '#ffffff', borderRadius: 16, padding: 24, width: 380, maxWidth: '92vw', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 16 }}>Ganti Password</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>Password Lama</label>
            <input type="password" style={inputStyle} value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} autoFocus />
          </div>
          <div>
            <label style={labelStyle}>Password Baru</label>
            <input type="password" style={inputStyle} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Konfirmasi Password Baru</label>
            <input type="password" style={inputStyle} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#ffffff', color: '#374151', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSimpan}
            disabled={saving}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: saving ? '#9ca3af' : '#059669', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
};
