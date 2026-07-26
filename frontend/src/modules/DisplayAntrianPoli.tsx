import React from 'react';

type PoliQueueItem = {
  no_antrian: string;
  poli: string;
  status: 'active' | 'waiting';
};

type DisplaySettings = {
  nama_rs: string;
  logo_url: string;
  video_url: string;
  running_text_poli: string;
  background_color_poli: string;
  polling_interval: number;
  tts_enabled: boolean;
  tts_rate: number;
  tts_pitch: number;
  tts_volume: number;
};

export const DisplayAntrianPoliView: React.FC = () => {
  const [currentTime, setCurrentTime] = React.useState<Date>(new Date());
  const [activeQueue, setActiveQueue] = React.useState<PoliQueueItem | null>(null);

  // Settings state dengan default values
  const [settings, setSettings] = React.useState<DisplaySettings>({
    nama_rs: 'PUSKESMAS PIDIE',
    logo_url: '',
    video_url: '',
    running_text_poli: 'MOHON MENUNGGU NOMOR ANTRIAN ANDA DIPANGGIL',
    background_color_poli: 'linear-gradient(135deg, #e3f2fd 0%, #90caf9 25%, #42a5f5 50%, #1e88e5 75%, #1565c0 100%)',
    polling_interval: 3,
    tts_enabled: true,
    tts_rate: 0.85,
    tts_pitch: 1.0,
    tts_volume: 1.0,
  });

  // Daftar lengkap semua poli dengan antrian (dari backend)
  const [allPoliQueues, setAllPoliQueues] = React.useState<PoliQueueItem[]>([]);

  // State untuk tracking index awal carousel
  const [carouselStartIndex, setCarouselStartIndex] = React.useState(0);

  // Fetch settings dari API
  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings/display');
      if (res.ok) {
        const data = await res.json();
        setSettings({
          nama_rs: data.nama_rs || 'PUSKESMAS PIDIE',
          logo_url: data.logo_url || '',
          video_url: data.video_url || '',
          running_text_poli: data.running_text_poli || 'MOHON MENUNGGU NOMOR ANTRIAN ANDA DIPANGGIL',
          background_color_poli: data.background_color_poli || 'linear-gradient(135deg, #e3f2fd 0%, #90caf9 25%, #42a5f5 50%, #1e88e5 75%, #1565c0 100%)',
          polling_interval: data.polling_interval || 3,
          tts_enabled: data.tts_enabled !== false,
          tts_rate: data.tts_rate || 0.85,
          tts_pitch: data.tts_pitch || 1.0,
          tts_volume: data.tts_volume || 1.0,
        });
      }
    } catch (error) {
      console.error('Error fetching display settings:', error);
    }
  };

  // Fetch data antrian dari backend
  const fetchAntrianData = async () => {
    try {
      const res = await fetch('/api/antrian/poli/all-display');
      if (!res.ok) throw new Error('Gagal mengambil data antrian');

      const data = await res.json();

      // Parse poli_list array
      if (data.poli_list && data.poli_list.length > 0) {
        // Cari antrian yang sedang dipanggil (active) dari semua poli
        let foundActive = null;
        for (const poli of data.poli_list) {
          if (poli.active) {
            foundActive = {
              no_antrian: poli.active.no_antrian,
              poli: poli.active.nm_poli,
              status: 'active' as const
            };
            break;
          }
        }
        setActiveQueue(foundActive);

        // Gabungkan semua waiting dari semua poli untuk carousel
        const allWaiting: PoliQueueItem[] = [];
        for (const poli of data.poli_list) {
          if (poli.waiting && poli.waiting.length > 0) {
            const poliWaiting = poli.waiting.map((item: any) => ({
              no_antrian: item.no_antrian,
              poli: item.nm_poli,
              status: 'waiting' as const
            }));
            allWaiting.push(...poliWaiting);
          }
        }
        setAllPoliQueues(allWaiting);
      } else {
        setActiveQueue(null);
        setAllPoliQueues([]);
      }
    } catch (error) {
      console.error('Error fetching antrian data:', error);
      // Tetap tampilkan UI meskipun error
    }
  };

  // Konversi URL YouTube biasa ke URL embed
  const getYouTubeEmbedUrl = (url: string): string | null => {
    if (!url) return null;
    // Sudah dalam format embed
    if (url.includes('youtube.com/embed/')) return url;
    // Format: https://www.youtube.com/watch?v=VIDEO_ID
    const watchMatch = url.match(/youtube\.com\/watch\?(?:.*&)?v=([\w-]+)/);
    if (watchMatch) return `https://www.youtube.com/embed/${watchMatch[1]}?autoplay=1&mute=1&loop=1&playlist=${watchMatch[1]}`;
    // Format: https://youtu.be/VIDEO_ID
    const shortMatch = url.match(/youtu\.be\/([\w-]+)/);
    if (shortMatch) return `https://www.youtube.com/embed/${shortMatch[1]}?autoplay=1&mute=1&loop=1&playlist=${shortMatch[1]}`;
    return null;
  };

  const isLocalVideo = (url: string) => url.startsWith('/uploads/') || url.startsWith('http://') || url.startsWith('https://') && !url.includes('youtube');

  // Fetch settings + data, diulang setiap polling interval agar logo & config terbaru otomatis tampil
  React.useEffect(() => {
    fetchSettings();
    fetchAntrianData();

    const pollingTimer = setInterval(() => {
      fetchSettings();
      fetchAntrianData();
    }, settings.polling_interval * 1000);

    return () => clearInterval(pollingTimer);
  }, [settings.polling_interval]);

  // Update jam setiap detik
  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Auto-scroll carousel setiap 4 detik (hanya jika ada lebih dari 3 item)
  React.useEffect(() => {
    // Hanya scroll jika ada lebih dari 3 item
    if (allPoliQueues.length <= 3) {
      setCarouselStartIndex(0);
      return;
    }

    const carouselTimer = setInterval(() => {
      setCarouselStartIndex((prevIndex) => {
        // Ketika mencapai akhir, kembali ke awal
        return (prevIndex + 1) % allPoliQueues.length;
      });
    }, 4000); // Pindah setiap 4 detik

    return () => clearInterval(carouselTimer);
  }, [allPoliQueues.length]);

  // Ambil 3 poli yang akan ditampilkan (dengan wrapping)
  const getVisibleQueues = (): PoliQueueItem[] => {
    if (allPoliQueues.length === 0) return [];

    const visible: PoliQueueItem[] = [];
    const itemsToShow = Math.min(3, allPoliQueues.length);

    for (let i = 0; i < itemsToShow; i++) {
      const index = (carouselStartIndex + i) % allPoliQueues.length;
      visible.push(allPoliQueues[index]);
    }
    return visible;
  };

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

  const visibleQueues = getVisibleQueues();

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: settings.background_color_poli,
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
        {/* Header: Logo + Nama RS (kiri) | Jam + Tanggal (kanan) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: 'min(1vh, 12px)',
          borderBottom: '3px solid rgba(255, 255, 255, 0.3)',
          flexShrink: 0,
          gap: 'min(2vh, 24px)',
        }}>
          {/* Kiri: Logo + Nama RS */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'min(2vh, 20px)' }}>
            {settings.logo_url && (
              <img
                src={settings.logo_url}
                alt="Logo"
                style={{ height: 'clamp(50px, 6vh, 80px)', width: 'auto', objectFit: 'contain' }}
              />
            )}
            <div style={{
              fontSize: 'clamp(1.5rem, 3vw, 2.5rem)',
              fontWeight: 'bold',
              color: '#ffffff',
              letterSpacing: '0.1em',
              textShadow: '3px 3px 6px rgba(0,0,0,0.4)',
              lineHeight: 1.2
            }}>
              {settings.nama_rs}
            </div>
          </div>

          {/* Kanan: Jam + Tanggal */}
          <div style={{ textAlign: 'right', color: '#ffffff', textShadow: '2px 2px 4px rgba(0,0,0,0.3)', flexShrink: 0 }}>
            <div style={{
              fontSize: 'clamp(2rem, 4vw, 3.5rem)',
              fontWeight: 'bold',
              letterSpacing: '0.15em',
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
            background: '#1976d2',
            borderRadius: 'min(1.5vw, 20px)',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              background: '#1565c0',
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
                ANTRIAN POLI
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
                {activeQueue ? activeQueue.no_antrian : '-'}
              </div>
            </div>

            {/* Footer - Nama Poli */}
            <div style={{
              background: '#1565c0',
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
                {activeQueue ? activeQueue.poli : 'BELUM ADA ANTRIAN'}
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
            {settings.video_url && getYouTubeEmbedUrl(settings.video_url) ? (
              <iframe
                src={getYouTubeEmbedUrl(settings.video_url)!}
                style={{ width: '100%', height: '100%', border: 'none' }}
                allow="autoplay; encrypted-media"
                allowFullScreen
                title="Video Informasi"
              />
            ) : settings.video_url && isLocalVideo(settings.video_url) ? (
              <video
                src={settings.video_url}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                autoPlay
                muted
                loop
              />
            ) : (
              <>
                <div style={{
                  width: 'clamp(60px, 6vw, 100px)',
                  height: 'clamp(60px, 6vw, 100px)',
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
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
                <div style={{
                  position: 'absolute',
                  bottom: 'min(1.5vh, 20px)',
                  left: 'min(1.5vh, 20px)',
                  right: 'min(1.5vh, 20px)',
                  color: '#ffffff',
                  fontSize: 'clamp(0.9rem, 1.2vw, 1.2rem)',
                  textAlign: 'center',
                  opacity: 0.7,
                }}>
                  Video Informasi / Iklan
                </div>
              </>
            )}
          </div>
        </div>

        {/* Panel Antrian Berikutnya (Bawah) - Auto-scroll Carousel */}
        <div style={{
          position: 'relative',
          maxHeight: '25vh',
          flexShrink: 0,
          overflow: 'hidden'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 'min(1.5vh, 20px)',
            transition: 'transform 0.8s ease-in-out'
          }}>
            {visibleQueues.map((queue, index) => {
              const colors = [
                { bg: '#42a5f5', border: '#1e88e5' }, // Light Blue
                { bg: '#1e88e5', border: '#1565c0' }, // Blue
                { bg: '#1565c0', border: '#0d47a1' }  // Dark Blue
              ];
              const color = colors[index];

              return (
                <div
                  key={`${queue.poli}-${queue.no_antrian}-${index}`}
                  style={{
                    background: color.bg,
                    borderRadius: 'min(1vw, 16px)',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
                    overflow: 'hidden',
                    height: '100%',
                    animation: 'fadeIn 0.8s ease-in-out'
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

                  {/* Nama Poli */}
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
                      {queue.poli}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Carousel Indicator */}
          <div style={{
            position: 'absolute',
            bottom: '-30px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: '8px',
            padding: '10px'
          }}>
            {allPoliQueues.map((_, index) => (
              <div
                key={index}
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: index === carouselStartIndex ? '#ffffff' : 'rgba(255,255,255,0.3)',
                  transition: 'all 0.3s ease'
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* CSS Animation */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
};
