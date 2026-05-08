import React from 'react';
import { DisplaySettingsView } from './DisplaySettings';

export const AntrianDashboardView: React.FC = () => {
  const [showSettings, setShowSettings] = React.useState(false);

  React.useEffect(() => {
    console.log('showSettings changed:', showSettings);
  }, [showSettings]);

  const handleOpenDisplay = (type: string) => {
    // Membuka window baru dengan parameter jenis display
    const url = `${window.location.origin}${window.location.pathname}#display-${type}`;
    const newWindow = window.open(url, '_blank');

    // Check if popup was blocked
    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
      // Popup blocked - show alert with URL
      alert(`Popup diblokir oleh browser!\n\nSilakan copy URL berikut dan paste di tab/window baru:\n\n${url}\n\nAtau izinkan popup untuk situs ini di pengaturan browser.`);
    } else {
      // Try to maximize the window
      newWindow.focus();
      setTimeout(() => {
        try {
          newWindow.moveTo(0, 0);
          newWindow.resizeTo(window.screen.width, window.screen.height);
        } catch (e) {
          console.log('Cannot resize window:', e);
        }
      }, 100);
    }
  };

  const handleCopyURL = (type: string) => {
    const url = `${window.location.origin}${window.location.pathname}#display-${type}`;
    navigator.clipboard.writeText(url).then(() => {
      alert(`✓ URL berhasil dicopy!\n\n${url}\n\nSilakan paste di browser baru untuk membuka display.`);
    }).catch(() => {
      // Fallback if clipboard API fails
      alert(`URL Display:\n\n${url}\n\nSilakan copy URL di atas dan paste di browser baru.`);
    });
  };

  const displayButtons = [
    {
      id: 'poli',
      label: 'Display Antrian Poli',
      description: 'Tampilan antrian untuk poliklinik',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none">
          <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20ZM11 7H13V13H11V7ZM11 15H13V17H11V15Z" fill="#2563eb"/>
        </svg>
      ),
      color: '#2563eb'
    },
    {
      id: 'registrasi',
      label: 'Display Antrian Registrasi',
      description: 'Tampilan antrian untuk pendaftaran pasien',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none">
          <path d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM19 19H5V5H19V19ZM17 12H7V10H17V12ZM13 16H7V14H13V16ZM17 8H7V6H17V8Z" fill="#16a34a"/>
        </svg>
      ),
      color: '#16a34a'
    },
    {
      id: 'apotek',
      label: 'Display Antrian Apotek',
      description: 'Tampilan antrian untuk farmasi/apotek',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none">
          <path d="M21 5H3C2.45 5 2 5.45 2 6V18C2 18.55 2.45 19 3 19H21C21.55 19 22 18.55 22 18V6C22 5.45 21.55 5 21 5ZM20 17H4V7H20V17ZM11 8H13V11H16V13H13V16H11V13H8V11H11V8Z" fill="#dc2626"/>
        </svg>
      ),
      color: '#dc2626'
    },
    {
      id: 'operasi',
      label: 'Display Jadwal Operasi',
      description: 'Tampilan jadwal operasi hari ini',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none">
          <path d="M19 4H18V2H16V4H8V2H6V4H5C3.89 4 3.01 4.9 3.01 6L3 20C3 21.1 3.89 22 5 22H19C20.1 22 21 21.1 21 20V6C21 4.9 20.1 4 19 4ZM19 20H5V10H19V20ZM19 8H5V6H19V8ZM12 13H17V18H12V13Z" fill="#9333ea"/>
        </svg>
      ),
      color: '#9333ea'
    },
    {
      id: 'informasi',
      label: 'Display Layanan Informasi',
      description: 'Informasi layanan rumah sakit',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L2 7V17.5C2 21.08 8.16 23.82 12 24C15.84 23.82 22 21.08 22 17.5V7L12 2ZM12 11.99H20V17.5C20 19.77 14.74 21.91 12 22C9.26 21.91 4 19.77 4 17.5V12H12V11.99ZM12 10H4V8.03L12 4.19L20 8.03V10H12Z" fill="#ea580c"/>
        </svg>
      ),
      color: '#ea580c'
    }
  ];

  // Jika mode pengaturan, tampilkan DisplaySettingsView
  if (showSettings) {
    console.log('Rendering DisplaySettingsView');
    return (
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        {/* Back Button */}
        <div style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          zIndex: 1000
        }}>
          <button
            onClick={() => setShowSettings(false)}
            style={{
              padding: '12px 24px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              background: '#ffffff',
              color: '#374151',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f9fafb';
              e.currentTarget.style.borderColor = '#9ca3af';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#ffffff';
              e.currentTarget.style.borderColor = '#d1d5db';
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M5 12L12 19M5 12L12 5"/>
            </svg>
            Kembali ke Dashboard
          </button>
        </div>

        {/* Display Settings Component */}
        <DisplaySettingsView />
      </div>
    );
  }

  return (
    <div style={{
      width: '100%',
      height: '100%',
      padding: '40px',
      background: '#f9fafb'
    }}>
      {/* Header */}
      <div style={{
        marginBottom: '40px'
      }}>
        <h1 style={{
          margin: 0,
          fontSize: '32px',
          fontWeight: 700,
          color: '#111827',
          marginBottom: '8px'
        }}>
          Anjungan & Antrian
        </h1>
        <p style={{
          margin: 0,
          fontSize: '16px',
          color: '#6b7280'
        }}>
          Kelola tampilan antrian dan informasi untuk layar display
        </p>
      </div>

      {/* Display Buttons Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '24px',
        marginBottom: '40px'
      }}>
        {displayButtons.map((button) => (
          <div
            key={button.id}
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              padding: '32px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
              border: '1px solid #e5e7eb',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              transition: 'all 0.2s ease',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.05)';
            }}
          >
            {/* Icon */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '80px',
              height: '80px',
              borderRadius: '16px',
              background: `${button.color}10`
            }}>
              {button.icon}
            </div>

            {/* Content */}
            <div>
              <h3 style={{
                margin: 0,
                fontSize: '20px',
                fontWeight: 600,
                color: '#111827',
                marginBottom: '8px'
              }}>
                {button.label}
              </h3>
              <p style={{
                margin: 0,
                fontSize: '14px',
                color: '#6b7280',
                lineHeight: 1.5
              }}>
                {button.description}
              </p>
            </div>

            {/* Buttons */}
            <div style={{
              display: 'flex',
              gap: '8px',
              marginTop: 'auto'
            }}>
              <button
                onClick={() => handleOpenDisplay(button.id)}
                style={{
                  flex: 1,
                  padding: '12px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  background: button.color,
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              >
                Buka Display
              </button>
              <button
                onClick={() => handleCopyURL(button.id)}
                title="Copy URL"
                style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  background: '#ffffff',
                  color: '#374151',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f9fafb';
                  e.currentTarget.style.borderColor = '#9ca3af';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#ffffff';
                  e.currentTarget.style.borderColor = '#d1d5db';
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Pengaturan Section */}
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        padding: '32px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
        border: '1px solid #e5e7eb'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '24px'
        }}>
          <div style={{ flex: 1 }}>
            <h3 style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: 600,
              color: '#111827',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M19.14 12.94C19.18 12.64 19.2 12.33 19.2 12C19.2 11.68 19.18 11.36 19.13 11.06L21.16 9.48C21.34 9.34 21.39 9.07 21.28 8.87L19.36 5.55C19.24 5.33 18.99 5.26 18.77 5.33L16.38 6.29C15.88 5.91 15.35 5.59 14.76 5.35L14.4 2.81C14.36 2.57 14.16 2.4 13.92 2.4H10.08C9.84 2.4 9.65 2.57 9.61 2.81L9.25 5.35C8.66 5.59 8.12 5.92 7.63 6.29L5.24 5.33C5.02 5.25 4.77 5.33 4.65 5.55L2.74 8.87C2.62 9.08 2.66 9.34 2.86 9.48L4.89 11.06C4.84 11.36 4.8 11.69 4.8 12C4.8 12.31 4.82 12.64 4.87 12.94L2.84 14.52C2.66 14.66 2.61 14.93 2.72 15.13L4.64 18.45C4.76 18.67 5.01 18.74 5.23 18.67L7.62 17.71C8.12 18.09 8.65 18.41 9.24 18.65L9.6 21.19C9.65 21.43 9.84 21.6 10.08 21.6H13.92C14.16 21.6 14.36 21.43 14.39 21.19L14.75 18.65C15.34 18.41 15.88 18.09 16.37 17.71L18.76 18.67C18.98 18.75 19.23 18.67 19.35 18.45L21.27 15.13C21.39 14.91 21.34 14.66 21.15 14.52L19.14 12.94ZM12 15.6C10.02 15.6 8.4 13.98 8.4 12C8.4 10.02 10.02 8.4 12 8.4C13.98 8.4 15.6 10.02 15.6 12C15.6 13.98 13.98 15.6 12 15.6Z" fill="#64748b"/>
              </svg>
              Pengaturan Display
            </h3>
            <p style={{
              margin: 0,
              fontSize: '14px',
              color: '#6b7280'
            }}>
              Kelola pengaturan tampilan, warna, teks berjalan, dan konfigurasi lainnya
            </p>
          </div>
          <button
            onClick={() => {
              console.log('Tombol Buka Pengaturan diklik');
              setShowSettings(true);
            }}
            style={{
              padding: '12px 32px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              background: '#ffffff',
              color: '#374151',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f9fafb';
              e.currentTarget.style.borderColor = '#9ca3af';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#ffffff';
              e.currentTarget.style.borderColor = '#d1d5db';
            }}
          >
            Buka Pengaturan
          </button>
        </div>
      </div>
    </div>
  );
};
