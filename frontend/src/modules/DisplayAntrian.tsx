import React from 'react';

type QueueItem = {
  no_antrian: string;
  loket: string;
  status: 'active' | 'waiting';
};

type DisplayAntrianProps = {
  type?: string;
};

export const DisplayAntrianView: React.FC<DisplayAntrianProps> = ({ type = 'poli' }) => {
  const [currentTime, setCurrentTime] = React.useState<Date>(new Date());
  const [activeQueue, setActiveQueue] = React.useState<QueueItem>({
    no_antrian: '003',
    loket: 'LOKET 3',
    status: 'active'
  });
  const [nextQueues, setNextQueues] = React.useState<QueueItem[]>([
    { no_antrian: '001', loket: 'LOKET 1', status: 'waiting' },
    { no_antrian: '002', loket: 'LOKET 2', status: 'waiting' },
    { no_antrian: '003', loket: 'LOKET 3', status: 'waiting' }
  ]);

  // Determine display title based on type
  const getDisplayTitle = () => {
    switch (type) {
      case 'poli':
        return 'ANTRIAN POLI';
      case 'registrasi':
        return 'ANTRIAN REGISTRASI';
      case 'apotek':
        return 'ANTRIAN APOTEK';
      case 'operasi':
        return 'JADWAL OPERASI';
      case 'informasi':
        return 'LAYANAN INFORMASI';
      default:
        return 'ANTRIAN';
    }
  };

  // Update jam setiap detik
  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Format waktu HH:MM:SS — dibangun manual, BUKAN toLocaleTimeString('id-ID', ...):
  // locale id-ID di JS memisahkan jam dengan titik ("02.38.54"), bukan
  // titik dua/colon ("02:38:54") yang diharapkan.
  const formatTime = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  };

  // Format tanggal
  const formatDate = (date: Date) => {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI',
                    'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];

    const dayName = days[date.getDay()];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();

    return `${dayName}, ${day} ${month} ${year}`;
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: 'linear-gradient(135deg, #fce4ec 0%, #f8bbd0 25%, #f48fb1 50%, #ec407a 75%, #e91e63 100%)',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: 'Arial, sans-serif'
    }}>
      {/* Background Pattern */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M100 0 L200 100 L100 200 L0 100 Z' fill='%23ffffff' opacity='0.05'/%3E%3C/svg%3E")`,
        backgroundSize: 'min(10vw, 200px) min(10vw, 200px)',
        opacity: 0.3
      }} />

      {/* Content Container */}
      <div style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        padding: 'min(2vh, 30px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'min(1.5vh, 20px)',
        boxSizing: 'border-box'
      }}>
        {/* Header - Jam dan Tanggal */}
        <div style={{
          textAlign: 'right',
          color: '#ffffff',
          textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
          flexShrink: 0
        }}>
          <div style={{
            fontSize: 'clamp(2rem, 4vw, 3.5rem)',
            fontWeight: 'bold',
            letterSpacing: '0.15em',
            marginBottom: 'min(0.5vh, 8px)',
            lineHeight: 1.2
          }}>
            {formatTime(currentTime)}
          </div>
          <div style={{
            fontSize: 'clamp(1rem, 1.5vw, 1.5rem)',
            fontWeight: 500,
            letterSpacing: '0.08em',
            lineHeight: 1.3
          }}>
            {formatDate(currentTime)}
          </div>
        </div>

        {/* Main Content Area */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 2fr',
          gap: 'min(1.5vh, 20px)',
          flex: 1,
          minHeight: 0,
          maxHeight: '55vh'
        }}>
          {/* Panel Antrian Aktif (Kiri) */}
          <div style={{
            background: '#d32f2f',
            borderRadius: 'min(1.5vw, 20px)',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              background: '#c62828',
              padding: 'min(1.5vh, 20px)',
              textAlign: 'center',
              borderBottom: '3px solid #ffffff'
            }}>
              <div style={{
                fontSize: 'clamp(1.2rem, 2.5vw, 2.2rem)',
                fontWeight: 'bold',
                color: '#ffffff',
                letterSpacing: '0.2em',
                lineHeight: 1.2
              }}>
                {getDisplayTitle()}
              </div>
            </div>

            {/* Nomor Antrian */}
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 'min(2vh, 25px)',
              minHeight: 0
            }}>
              <div style={{
                fontSize: 'clamp(4rem, 10vw, 8rem)',
                fontWeight: 'bold',
                color: '#ffffff',
                letterSpacing: '0.15em',
                textShadow: '4px 4px 8px rgba(0,0,0,0.3)',
                lineHeight: 1
              }}>
                {activeQueue.no_antrian}
              </div>
            </div>

            {/* Footer - Loket */}
            <div style={{
              background: '#c62828',
              padding: 'min(1.5vh, 20px)',
              textAlign: 'center',
              borderTop: '3px solid #ffffff'
            }}>
              <div style={{
                fontSize: 'clamp(1.2rem, 2.5vw, 2.2rem)',
                fontWeight: 'bold',
                color: '#ffffff',
                letterSpacing: '0.15em',
                lineHeight: 1.2
              }}>
                {activeQueue.loket}
              </div>
            </div>
          </div>

          {/* Area Video/Iklan (Kanan) */}
          <div style={{
            background: '#2c2c2c',
            borderRadius: 'min(1.5vw, 20px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Placeholder Video */}
            <div style={{
              width: 'clamp(60px, 6vw, 100px)',
              height: 'clamp(60px, 6vw, 100px)',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}>
              <div style={{
                width: 0,
                height: 0,
                borderLeft: 'clamp(20px, 2vw, 32px) solid #ffffff',
                borderTop: 'clamp(12px, 1.2vw, 20px) solid transparent',
                borderBottom: 'clamp(12px, 1.2vw, 20px) solid transparent',
                marginLeft: 'clamp(5px, 0.5vw, 8px)'
              }} />
            </div>

            {/* Optional: Text overlay */}
            <div style={{
              position: 'absolute',
              bottom: 'min(1.5vh, 20px)',
              left: 'min(1.5vh, 20px)',
              right: 'min(1.5vh, 20px)',
              color: '#ffffff',
              fontSize: 'clamp(0.9rem, 1.2vw, 1.2rem)',
              textAlign: 'center',
              opacity: 0.7,
              lineHeight: 1.3
            }}>
              Video Informasi / Iklan
            </div>
          </div>
        </div>

        {/* Panel Antrian Berikutnya (Bawah) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 'min(1.5vh, 20px)',
          maxHeight: '25vh',
          flexShrink: 0
        }}>
          {nextQueues.map((queue, index) => {
            const colors = [
              { bg: '#ffa726', border: '#fb8c00' }, // Orange
              { bg: '#ff7043', border: '#f4511e' }, // Deep Orange
              { bg: '#ef5350', border: '#e53935' }  // Red
            ];
            const color = colors[index];

            return (
              <div
                key={index}
                style={{
                  background: color.bg,
                  borderRadius: 'min(1vw, 16px)',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
                  overflow: 'hidden',
                  height: '100%'
                }}
              >
                {/* Nomor */}
                <div style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 'min(1.5vh, 20px)',
                  minHeight: 0
                }}>
                  <div style={{
                    fontSize: 'clamp(2.5rem, 5vw, 4.5rem)',
                    fontWeight: 'bold',
                    color: '#ffffff',
                    letterSpacing: '0.15em',
                    textShadow: '3px 3px 6px rgba(0,0,0,0.2)',
                    lineHeight: 1
                  }}>
                    {queue.no_antrian}
                  </div>
                </div>

                {/* Loket */}
                <div style={{
                  background: color.border,
                  padding: 'min(1vh, 15px)',
                  textAlign: 'center',
                  borderTop: '2px solid #ffffff'
                }}>
                  <div style={{
                    fontSize: 'clamp(0.9rem, 1.5vw, 1.4rem)',
                    fontWeight: 'bold',
                    color: '#ffffff',
                    letterSpacing: '0.12em',
                    lineHeight: 1.2
                  }}>
                    {queue.loket}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
