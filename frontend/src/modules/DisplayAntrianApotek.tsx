import React from 'react';
import { localDateStr } from '../utils/date';
import { toSpokenCase } from '../utils/tts';

type ApotekQueueItem = {
  no_antrian: string;
  no_resep: string;
  nm_pasien: string;
  jenis_resep: 'racikan' | 'non_racikan';
  status: 'waiting' | 'called' | 'serving';
  jam_dipanggil?: string | null;
};

type DisplaySettings = {
  nama_rs: string;
  logo_url: string;
  running_text_apotek: string;
  background_color_apotek: string;
  polling_interval: number;
  tts_enabled: boolean;
  tts_rate: number;
  tts_pitch: number;
  tts_volume: number;
};

export const DisplayAntrianApotekView: React.FC = () => {
  const [currentTime, setCurrentTime] = React.useState<Date>(new Date());
  const [audioUnlocked, setAudioUnlocked] = React.useState(false);
  // Ref agar speakQueueApotek selalu baca nilai terbaru tanpa stale closure
  const audioUnlockedRef = React.useRef(false);
  const settingsRef = React.useRef<DisplaySettings>({
    nama_rs: 'PUSKESMAS PIDIE',
    logo_url: '',
    running_text_apotek: 'HARAP MENUNGGU PANGGILAN NOMOR ANTRIAN ANDA',
    background_color_apotek: '#000000',
    polling_interval: 3,
    tts_enabled: true,
    tts_rate: 0.85,
    tts_pitch: 1.0,
    tts_volume: 1.0,
  });

  // Display settings
  const [settings, setSettings] = React.useState<DisplaySettings>({
    nama_rs: 'PUSKESMAS PIDIE',
    logo_url: '',
    running_text_apotek: 'HARAP MENUNGGU PANGGILAN NOMOR ANTRIAN ANDA',
    background_color_apotek: '#000000',
    polling_interval: 3,
    tts_enabled: true,
    tts_rate: 0.85,
    tts_pitch: 1.0,
    tts_volume: 1.0,
  });

  // Active queues
  const [activeRacikan, setActiveRacikan] = React.useState<ApotekQueueItem | null>(null);
  const [activeNonRacikan, setActiveNonRacikan] = React.useState<ApotekQueueItem | null>(null);

  // Previous active queues for change detection
  const prevActiveRacikanRef = React.useRef<ApotekQueueItem | null>(null);
  const prevActiveNonRacikanRef = React.useRef<ApotekQueueItem | null>(null);

  // Waiting queues
  const [waitingRacikan, setWaitingRacikan] = React.useState<ApotekQueueItem[]>([]);
  const [waitingNonRacikan, setWaitingNonRacikan] = React.useState<ApotekQueueItem[]>([]);

  // Auto-cycle halaman waiting list — kalau antrian lebih dari 8 orang,
  // sebelumnya sisanya disembunyikan total (cuma .slice(0,8), tidak
  // pernah kelihatan). Sekarang ditampilkan 8 per halaman, gonta-ganti
  // halaman otomatis tiap PAGE_INTERVAL_MS, balik ke halaman 1 setelah
  // habis. Racikan & non-racikan independen (jumlah antriannya beda).
  const PAGE_SIZE = 8;
  const PAGE_INTERVAL_MS = 5000;
  const [nonRacikanPage, setNonRacikanPage] = React.useState(0);
  const [racikanPage, setRacikanPage] = React.useState(0);

  React.useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(waitingNonRacikan.length / PAGE_SIZE));
    if (totalPages <= 1) {
      setNonRacikanPage(0);
      return;
    }
    const t = setInterval(() => setNonRacikanPage((p) => (p + 1) % totalPages), PAGE_INTERVAL_MS);
    return () => clearInterval(t);
  }, [waitingNonRacikan.length]);

  React.useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(waitingRacikan.length / PAGE_SIZE));
    if (totalPages <= 1) {
      setRacikanPage(0);
      return;
    }
    const t = setInterval(() => setRacikanPage((p) => (p + 1) % totalPages), PAGE_INTERVAL_MS);
    return () => clearInterval(t);
  }, [waitingRacikan.length]);

  // Sync settingsRef setiap kali settings state berubah
  React.useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);


  // Fetch display settings
  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings/display');
      if (res.ok) {
        const data = await res.json();
        setSettings({
          nama_rs: data.nama_rs || 'PUSKESMAS PIDIE',
          logo_url: data.logo_url || '',
          running_text_apotek: data.running_text_apotek || 'HARAP MENUNGGU PANGGILAN NOMOR ANTRIAN ANDA',
          background_color_apotek: data.background_color_apotek || '#000000',
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

  const unlockAudio = React.useCallback(() => {
    if (audioUnlockedRef.current) return;
    if ('speechSynthesis' in window) {
      const dummy = new SpeechSynthesisUtterance('');
      dummy.volume = 0;
      window.speechSynthesis.speak(dummy);
    }
    audioUnlockedRef.current = true;
    setAudioUnlocked(true);
  }, []);

  // Auto-unlock: dengarkan interaksi apapun (klik, sentuh, ketuk keyboard)
  // Browser policy mengharuskan minimal 1 interaksi user sebelum audio bisa diputar
  React.useEffect(() => {
    const events = ['click', 'touchstart', 'keydown'] as const;
    events.forEach(e => document.addEventListener(e, unlockAudio, { once: false }));
    return () => {
      events.forEach(e => document.removeEventListener(e, unlockAudio));
    };
  }, [unlockAudio]);

  // Keep-alive speechSynthesis: Chrome bisa mati setelah idle lama
  React.useEffect(() => {
    const keepAlive = setInterval(() => {
      if (!('speechSynthesis' in window)) return;
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      // Jika stuck (pending tapi tidak speaking), cancel dan reset
      if (window.speechSynthesis.pending && !window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
    }, 5000);
    return () => clearInterval(keepAlive);
  }, []);

  // Reset prev refs saat tengah malam agar pasien hari baru terdeteksi dengan benar
  React.useEffect(() => {
    const todayStr = () => localDateStr();
    let lastDate = todayStr();

    const midnightCheck = setInterval(() => {
      const now = todayStr();
      if (now !== lastDate) {
        lastDate = now;
        prevActiveRacikanRef.current = null;
        prevActiveNonRacikanRef.current = null;
        console.log('[Display] Tanggal berganti, reset antrian refs');
      }
    }, 60000); // cek setiap menit

    return () => clearInterval(midnightCheck);
  }, []);

  // Text-to-Speech function untuk apotek — pakai ref agar tidak stale closure
  const speakQueueApotek = (noAntrian: string, namaPasien: string) => {
    const s = settingsRef.current;
    if (!audioUnlockedRef.current || !s || !s.tts_enabled) return;

    const numbers = noAntrian.split('-')[1] || '';

    const digitMap: { [key: string]: string } = {
      '0': 'KOSONG', '1': 'SATU', '2': 'DUA', '3': 'TIGA',
      '4': 'EMPAT', '5': 'LIMA', '6': 'ENAM', '7': 'TUJUH',
      '8': 'DELAPAN', '9': 'SEMBILAN'
    };

    const spokenNumbers = numbers.split('').map(d => digitMap[d] || d).join(' ');
    const text = `NOMOR ANTRIAN ${spokenNumbers} ATAS NAMA ${namaPasien} SILAHKAN MENUJU LOKET APOTEK`;

    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();

    // Chrome: beri jeda setelah cancel agar tidak race condition
    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(toSpokenCase(text));
      utterance.lang = 'id-ID';
      utterance.rate = s.tts_rate;
      utterance.pitch = s.tts_pitch;
      utterance.volume = s.tts_volume;
      window.speechSynthesis.speak(utterance);
    }, 100);
  };

  // Fetch data antrian dari backend
  const fetchAntrianData = async () => {
    try {
      const res = await fetch('/api/antrian/apotek/display');
      if (!res.ok) throw new Error('Gagal mengambil data antrian apotek');

      const data = await res.json();

      // Set active racikan
      if (data.racikan?.active) {
        setActiveRacikan({
          no_antrian: data.racikan.active.no_antrian,
          no_resep: data.racikan.active.no_resep,
          nm_pasien: data.racikan.active.nm_pasien,
          jenis_resep: 'racikan',
          status: data.racikan.active.status,
          jam_dipanggil: data.racikan.active.jam_dipanggil
        });
      } else {
        setActiveRacikan(null);
      }

      // Set active non-racikan
      if (data.non_racikan?.active) {
        setActiveNonRacikan({
          no_antrian: data.non_racikan.active.no_antrian,
          no_resep: data.non_racikan.active.no_resep,
          nm_pasien: data.non_racikan.active.nm_pasien,
          jenis_resep: 'non_racikan',
          status: data.non_racikan.active.status,
          jam_dipanggil: data.non_racikan.active.jam_dipanggil
        });
      } else {
        setActiveNonRacikan(null);
      }

      // Set waiting racikan
      if (data.racikan?.waiting && Array.isArray(data.racikan.waiting)) {
        setWaitingRacikan(data.racikan.waiting.map((item: any) => ({
          no_antrian: item.no_antrian,
          no_resep: item.no_resep,
          nm_pasien: item.nm_pasien,
          jenis_resep: 'racikan',
          status: item.status
        })));
      } else {
        setWaitingRacikan([]);
      }

      // Set waiting non-racikan
      if (data.non_racikan?.waiting && Array.isArray(data.non_racikan.waiting)) {
        setWaitingNonRacikan(data.non_racikan.waiting.map((item: any) => ({
          no_antrian: item.no_antrian,
          no_resep: item.no_resep,
          nm_pasien: item.nm_pasien,
          jenis_resep: 'non_racikan',
          status: item.status
        })));
      } else {
        setWaitingNonRacikan([]);
      }
    } catch (error) {
      console.error('Error fetching antrian apotek data:', error);
    }
  };

  // Detect changes in active queue and trigger TTS
  // Triggers when jam_dipanggil changes (allows repeated calls for same patient)
  React.useEffect(() => {
    // Check racikan queue changes - trigger if jam_dipanggil changed
    if (activeRacikan && activeRacikan.jam_dipanggil !== prevActiveRacikanRef.current?.jam_dipanggil) {
      console.log('Racikan queue called/re-called, calling TTS:', activeRacikan);
      speakQueueApotek(activeRacikan.no_antrian, activeRacikan.nm_pasien);
      prevActiveRacikanRef.current = activeRacikan;
    }

    // Check non-racikan queue changes - trigger if jam_dipanggil changed
    if (activeNonRacikan && activeNonRacikan.jam_dipanggil !== prevActiveNonRacikanRef.current?.jam_dipanggil) {
      console.log('Non-racikan queue called/re-called, calling TTS:', activeNonRacikan);
      speakQueueApotek(activeNonRacikan.no_antrian, activeNonRacikan.nm_pasien);
      prevActiveNonRacikanRef.current = activeNonRacikan;
    }
  }, [activeRacikan, activeNonRacikan]);

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

  // Format waktu HH:MM:SS — dibangun manual, BUKAN toLocaleTimeString('id-ID', ...):
  // locale id-ID di JS memisahkan jam dengan titik ("02.38.54"), bukan
  // titik dua/colon ("02:38:54") yang diharapkan.
  const formatTime = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  };

  // Determine which queue is currently active (prioritize non-racikan, then racikan)
  const currentActive = activeNonRacikan || activeRacikan;

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: settings.background_color_apotek,
      position: 'relative',
      overflow: 'hidden',
      fontFamily: 'Arial, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px',
      boxSizing: 'border-box',
      gap: '15px'
    }}>
      {/* Tombol aktifkan suara — hanya muncul sebelum diklik, posisi sudut kanan bawah */}
      {!audioUnlocked && (
        <button
          onClick={unlockAudio}
          style={{
            position: 'absolute',
            bottom: '16px',
            right: '16px',
            zIndex: 999,
            background: 'rgba(0,0,0,0.5)',
            color: '#FFD700',
            border: '2px solid #FFD700',
            borderRadius: '8px',
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer',
            letterSpacing: '0.05em',
          }}
        >
          🔊 Aktifkan Suara
        </button>
      )}

      {/* Header - Logo & Nama RS, Jam */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 20px'
      }}>
        {/* Logo & Nama RS */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '15px'
        }}>
          {settings.logo_url ? (
            <img
              src={settings.logo_url}
              alt="Logo"
              style={{
                height: 'clamp(40px, 6vh, 70px)',
                width: 'auto',
                objectFit: 'contain',
              }}
            />
          ) : (
            <div style={{
              width: '0',
              height: '0',
              borderLeft: '25px solid transparent',
              borderRight: '25px solid transparent',
              borderBottom: '45px solid #FFD700'
            }} />
          )}
          <div style={{
            fontSize: 'clamp(1.5rem, 3vw, 2.5rem)',
            fontWeight: 'bold',
            color: '#FFFFFF',
            letterSpacing: '0.02em',
            textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
          }}>
            {settings.nama_rs}
          </div>
        </div>

        {/* Jam */}
        <div style={{
          fontSize: 'clamp(1.5rem, 3vw, 2.5rem)',
          fontWeight: 'bold',
          color: '#FFD700',
          letterSpacing: '0.05em',
          textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
        }}>
          {formatTime(currentTime)}
        </div>
      </div>

      {/* Panel Antrian Aktif - Besar (Top) */}
      <div style={{
        background: '#FFEB3B',
        border: '8px solid #FFD700',
        borderRadius: '10px',
        padding: '30px',
        textAlign: 'center',
        boxShadow: '0 8px 20px rgba(255,235,59,0.5), 0 0 40px rgba(255,235,59,0.3)',
        flex: '0 0 18%',
        minHeight: '120px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden'
      }}>
        <div style={{
          fontSize: 'clamp(2.5rem, 6vw, 6rem)',
          fontWeight: '900',
          color: '#000000',
          letterSpacing: '0.05em',
          lineHeight: 1,
          whiteSpace: 'nowrap',
          width: 'fit-content',
          maxWidth: '100%',
          transform: 'scaleX(1)',
          transformOrigin: 'center',
          textShadow: '2px 2px 0px rgba(255,255,255,0.5)'
        }}>
          {currentActive ? `${currentActive.no_antrian.split('-')[1]} ${currentActive.nm_pasien}` : '--- BELUM ADA ANTRIAN'}
        </div>
      </div>

      {/* Panel Waiting - 2 Column (Bottom) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '20px',
        flex: 1,
        minHeight: 0
      }}>
        {/* NON RACIKAN (Left) */}
        <div style={{
          background: '#4CAF50',
          borderRadius: '10px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 6px 15px rgba(76,175,80,0.4)',
          border: '4px solid #66BB6A'
        }}>
          {/* Header */}
          <div style={{
            background: '#2E7D32',
            padding: '15px',
            textAlign: 'center',
            borderBottom: '4px solid #FFD700',
            position: 'relative'
          }}>
            <div style={{
              fontSize: 'clamp(1.2rem, 2.5vw, 2rem)',
              fontWeight: 'bold',
              color: '#FFFFFF',
              letterSpacing: '0.1em',
              textShadow: '2px 2px 4px rgba(0,0,0,0.5)'
            }}>
              NON RACIKAN
            </div>
            {waitingNonRacikan.length > PAGE_SIZE && (
              <div style={{ position: 'absolute', right: 15, top: '50%', transform: 'translateY(-50%)', fontSize: 'clamp(0.8rem, 1.3vw, 1.1rem)', color: '#FFD700', fontWeight: 'bold' }}>
                Hal {nonRacikanPage + 1}/{Math.ceil(waitingNonRacikan.length / PAGE_SIZE)}
              </div>
            )}
          </div>

          {/* List */}
          <div style={{
            flex: 1,
            padding: '20px',
            overflowY: 'auto'
          }}>
            {waitingNonRacikan.slice(nonRacikanPage * PAGE_SIZE, nonRacikanPage * PAGE_SIZE + PAGE_SIZE).map((queue, index) => (
              <div
                key={`nonracikan-${queue.no_antrian}-${index}`}
                style={{
                  fontSize: 'clamp(1.2rem, 2.5vw, 2rem)',
                  fontWeight: 'bold',
                  color: '#000000',
                  padding: '12px 0',
                  borderBottom: index < 7 ? '2px solid rgba(0,0,0,0.3)' : 'none',
                  display: 'flex',
                  gap: '30px'
                }}
              >
                <span>{queue.no_antrian.split('-')[1]}</span>
                <span>{queue.nm_pasien}</span>
              </div>
            ))}
            {waitingNonRacikan.length === 0 && (
              <div style={{
                fontSize: 'clamp(1rem, 1.8vw, 1.5rem)',
                color: '#FFFFFF',
                opacity: 0.8,
                textAlign: 'center',
                marginTop: '20px',
                fontWeight: 'bold'
              }}>
                Belum ada antrian
              </div>
            )}
          </div>
        </div>

        {/* RACIKAN (Right) */}
        <div style={{
          background: '#FF9800',
          borderRadius: '10px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 6px 15px rgba(255,152,0,0.4)',
          border: '4px solid #FFB74D'
        }}>
          {/* Header */}
          <div style={{
            background: '#F57C00',
            padding: '15px',
            textAlign: 'center',
            borderBottom: '4px solid #FFD700',
            position: 'relative'
          }}>
            <div style={{
              fontSize: 'clamp(1.2rem, 2.5vw, 2rem)',
              fontWeight: 'bold',
              color: '#FFFFFF',
              letterSpacing: '0.1em',
              textShadow: '2px 2px 4px rgba(0,0,0,0.5)'
            }}>
              RACIKAN
            </div>
            {waitingRacikan.length > PAGE_SIZE && (
              <div style={{ position: 'absolute', right: 15, top: '50%', transform: 'translateY(-50%)', fontSize: 'clamp(0.8rem, 1.3vw, 1.1rem)', color: '#FFD700', fontWeight: 'bold' }}>
                Hal {racikanPage + 1}/{Math.ceil(waitingRacikan.length / PAGE_SIZE)}
              </div>
            )}
          </div>

          {/* List */}
          <div style={{
            flex: 1,
            padding: '20px',
            overflowY: 'auto'
          }}>
            {waitingRacikan.slice(racikanPage * PAGE_SIZE, racikanPage * PAGE_SIZE + PAGE_SIZE).map((queue, index) => (
              <div
                key={`racikan-${queue.no_antrian}-${index}`}
                style={{
                  fontSize: 'clamp(1.2rem, 2.5vw, 2rem)',
                  fontWeight: 'bold',
                  color: '#000000',
                  padding: '12px 0',
                  borderBottom: index < 7 ? '2px solid rgba(0,0,0,0.3)' : 'none',
                  display: 'flex',
                  gap: '30px'
                }}
              >
                <span>{queue.no_antrian.split('-')[1]}</span>
                <span>{queue.nm_pasien}</span>
              </div>
            ))}
            {waitingRacikan.length === 0 && (
              <div style={{
                fontSize: 'clamp(1rem, 1.8vw, 1.5rem)',
                color: '#FFFFFF',
                opacity: 0.8,
                textAlign: 'center',
                marginTop: '20px',
                fontWeight: 'bold'
              }}>
                Belum ada antrian
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Running Text — hanya tampil jika ada teks */}
      {settings.running_text_apotek && (
        <div style={{
          background: '#FFD700',
          color: '#000',
          padding: '10px 0',
          overflow: 'hidden',
          position: 'relative',
          fontSize: 'clamp(0.9rem, 1.5vw, 1.2rem)',
          fontWeight: 'bold',
          border: '3px solid #FFA000',
          flexShrink: 0,
        }}>
          {/* Dua salinan teks agar loop terlihat mulus tanpa jeda */}
          <div style={{
            display: 'flex',
            whiteSpace: 'nowrap',
            animation: `marquee ${Math.max(15, settings.running_text_apotek.length * 0.3)}s linear infinite`,
          }}>
            <span style={{ paddingRight: '80px' }}>{settings.running_text_apotek}</span>
            <span style={{ paddingRight: '80px' }}>{settings.running_text_apotek}</span>
            <span style={{ paddingRight: '80px' }}>{settings.running_text_apotek}</span>
          </div>
        </div>
      )}

      <style>{`
        @keyframes marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
      `}</style>
    </div>
  );
};
