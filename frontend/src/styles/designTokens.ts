/**
 * Design Tokens - ERMApp
 *
 * File ini berisi semua design tokens (warna, spacing, typography, dll)
 * yang digunakan di seluruh aplikasi ERMApp.
 *
 * Gunakan konstanta dari file ini untuk memastikan konsistensi visual
 * di seluruh aplikasi.
 */

// ==================== COLORS ====================

export const colors = {
  // Primary Colors
  primary: {
    blue: '#2563eb',
    blueDark: '#1e40af',
    blueHover: '#1d4ed8',
    blue50: '#eff6ff',
    blue100: '#dbeafe',
    blue200: '#e0f2fe',
    blue300: '#eef2ff',
  },

  // Success Colors
  success: {
    green: '#16a34a',
    bg: '#ecfdf3',
    text: '#166534',
  },

  // Warning Colors
  warning: {
    bg: '#fef3c7',
    text: '#92400e',
  },

  // Error Colors
  error: {
    red: '#dc2626',
    redDark: '#b91c1c',
    redDarker: '#991b1b',
    bg: '#fef2f2',
    bgAlt: '#fee2e2',
  },

  // Purple Colors
  purple: {
    bg: '#f3e8ff',
    text: '#6b21a8',
  },

  // Neutral/Grayscale
  neutral: {
    white: '#ffffff',
    gray50: '#f9fafb',
    gray100: '#f3f4f6',
    gray200: '#e5e7eb',
    gray300: '#d1d5db',
    gray400: '#9ca3af',
    gray500: '#6b7280',
    gray600: '#4b5563',
    gray700: '#374151',
    gray800: '#1e293b',
    gray900: '#111827',
    black: '#000000',
  },

  // Status Colors
  status: {
    sudah: { bg: '#ecfdf3', text: '#166534' },
    belum: { bg: '#fef3c7', text: '#92400e' },
    batal: { bg: '#fee2e2', text: '#991b1b' },
    dirujuk: { bg: '#dbeafe', text: '#1e40af' },
    dirawat: { bg: '#f3e8ff', text: '#6b21a8' },
  },

  // Gradients
  gradients: {
    loginBg: 'radial-gradient(circle at top left, #eff6ff 0, #e0f2fe 40%, #eef2ff 100%)',
    userAvatar: 'linear-gradient(135deg, #2563eb, #1e40af)',
  },
} as const;

// ==================== TYPOGRAPHY ====================

export const typography = {
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',

  fontSize: {
    xs: 10,    // Extra small - badge, label kecil
    sm: 11,    // Small - caption, metadata
    base: 12,  // Base - label input, teks kecil
    md: 13,    // Medium - PALING SERING DIGUNAKAN (body text)
    lg: 14,    // Large - heading kecil
    xl: 15,    // Extra large - heading
    '2xl': 16, // 2X large - icon
    '3xl': 20, // 3X large - heading besar
  },

  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
} as const;

// ==================== SPACING ====================

export const spacing = {
  1: 4,
  2: 6,
  3: 8,
  4: 10,
  5: 12,
  6: 16,
  7: 20,
  8: 24,
  9: 32,
} as const;

// ==================== BORDER RADIUS ====================

export const borderRadius = {
  sm: 6,      // Small - button kecil
  md: 8,      // Medium - input, card kecil
  lg: 10,     // Large - button menu
  xl: 12,     // Extra large - card, dropdown
  '2xl': 15,  // 2X large - section utama
  '3xl': 16,  // 3X large - card besar
  round: 25,  // Rounded - search input
  pill: 999,  // Pill - button, badge
} as const;

// ==================== SHADOWS ====================

export const shadows = {
  sm: '0 2px 4px rgba(37, 99, 235, 0.2)',
  md: '0 4px 12px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 25px rgba(0, 0, 0, 0.1)',
  xl: '0 10px 30px rgba(15, 23, 42, 0.08)',
  '2xl': '0 10px 30px rgba(0, 0, 0, 0.15)',
  '3xl': '0 20px 40px rgba(15, 23, 42, 0.15)',
  focus: '0 0 0 3px rgba(37, 99, 235, 0.1)',
  avatar: '0 4px 12px rgba(37, 99, 235, 0.3)',
} as const;

// ==================== TRANSITIONS ====================

export const transitions = {
  default: 'all 0.2s ease',
  fast: 'all 0.15s ease',
} as const;

// ==================== COMPONENT STYLES ====================

/**
 * Style presets untuk komponen yang sering digunakan
 */
export const componentStyles = {
  // Button Styles
  button: {
    primary: {
      padding: '8px 12px',
      borderRadius: borderRadius.pill,
      border: 'none',
      background: colors.primary.blue,
      color: colors.neutral.white,
      fontSize: typography.fontSize.md,
      fontWeight: typography.fontWeight.semibold,
      cursor: 'pointer',
      transition: transitions.default,
    },
    success: {
      padding: '8px 12px',
      borderRadius: borderRadius.pill,
      border: 'none',
      background: colors.success.green,
      color: colors.neutral.white,
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.medium,
      cursor: 'pointer',
      transition: transitions.default,
    },
    danger: {
      padding: '6px 12px',
      borderRadius: borderRadius.sm,
      border: 'none',
      background: '#ef4444',
      color: colors.neutral.white,
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium,
      cursor: 'pointer',
      transition: transitions.default,
    },
    outline: {
      padding: '4px 8px',
      borderRadius: borderRadius.sm,
      border: `1px solid ${colors.primary.blue}`,
      background: colors.neutral.white,
      color: colors.primary.blue,
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium,
      cursor: 'pointer',
      transition: transitions.default,
    },
    disabled: {
      padding: '8px 12px',
      borderRadius: borderRadius.pill,
      border: 'none',
      background: colors.neutral.gray400,
      color: colors.neutral.white,
      fontSize: typography.fontSize.md,
      fontWeight: typography.fontWeight.semibold,
      cursor: 'default',
    },
  },

  // Input Styles
  input: {
    base: {
      width: '100%',
      padding: '6px 10px',
      borderRadius: borderRadius.md,
      border: `1px solid ${colors.neutral.gray300}`,
      fontSize: typography.fontSize.md,
      outline: 'none',
    },
    select: {
      width: '100%',
      padding: '6px 8px',
      borderRadius: borderRadius.md,
      border: `1px solid ${colors.neutral.gray300}`,
      fontSize: typography.fontSize.md,
    },
    date: {
      padding: '6px 8px',
      borderRadius: borderRadius.md,
      border: `1px solid ${colors.neutral.gray300}`,
      fontSize: typography.fontSize.base,
      boxSizing: 'border-box' as const,
    },
    search: {
      width: '100%',
      padding: '6px 12px 6px 34px',
      borderRadius: borderRadius.round,
      border: `1px solid ${colors.neutral.gray300}`,
      fontSize: typography.fontSize.base,
      outline: 'none',
    },
  },

  // Label Style
  label: {
    display: 'block',
    fontSize: typography.fontSize.base,
    marginBottom: spacing[1],
  },

  // Card/Section Styles
  card: {
    main: {
      background: colors.neutral.white,
      borderRadius: borderRadius['3xl'],
      padding: spacing[8],
      boxShadow: shadows.xl,
      border: `1px solid ${colors.neutral.gray200}`,
    },
    form: {
      padding: spacing[6],
      borderRadius: borderRadius.xl,
      border: `1px solid ${colors.neutral.gray200}`,
      background: colors.neutral.gray50,
      fontSize: typography.fontSize.md,
    },
  },

  // Message Boxes
  message: {
    success: {
      padding: spacing[4],
      borderRadius: borderRadius.md,
      background: colors.success.bg,
      color: colors.success.text,
      fontSize: typography.fontSize.md,
    },
    error: {
      padding: spacing[3],
      borderRadius: borderRadius.md,
      background: colors.error.bg,
      color: colors.error.redDark,
      fontSize: typography.fontSize.md,
    },
  },

  // Badge Styles
  badge: {
    role: {
      padding: '2px 8px',
      borderRadius: borderRadius.pill,
      background: colors.primary.blue100,
      color: colors.primary.blue,
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.semibold,
    },
    status: {
      padding: '2px 8px',
      borderRadius: borderRadius.pill,
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium,
    },
  },

  // Table Styles
  table: {
    container: {
      borderRadius: borderRadius.xl,
      border: `1px solid ${colors.neutral.gray200}`,
      overflow: 'auto' as const,
      maxHeight: 600,
    },
    base: {
      width: '100%',
      borderCollapse: 'collapse' as const,
      fontSize: typography.fontSize.base,
    },
    header: {
      position: 'sticky' as const,
      top: 0,
      background: colors.neutral.gray100,
      zIndex: 1,
    },
    th: {
      padding: '8px',
      textAlign: 'left' as const,
      borderBottom: `2px solid ${colors.neutral.gray200}`,
      fontWeight: typography.fontWeight.semibold,
      color: colors.neutral.gray700,
    },
    td: {
      padding: '6px 8px',
      borderBottom: `1px solid ${colors.neutral.gray200}`,
    },
  },

  // Tab Styles
  tab: {
    container: {
      display: 'flex',
      gap: spacing[6],
      marginBottom: spacing[6],
      borderBottom: `2px solid ${colors.neutral.gray200}`,
      alignItems: 'flex-end' as const,
      flexWrap: 'wrap' as const,
    },
    active: {
      padding: '10px 20px',
      border: 'none',
      background: 'transparent',
      borderBottom: `3px solid ${colors.primary.blue}`,
      color: colors.primary.blue,
      fontSize: typography.fontSize.md,
      fontWeight: typography.fontWeight.semibold,
      cursor: 'pointer',
      transition: transitions.default,
    },
    inactive: {
      padding: '10px 20px',
      border: 'none',
      background: 'transparent',
      borderBottom: '3px solid transparent',
      color: colors.neutral.gray500,
      fontSize: typography.fontSize.md,
      fontWeight: typography.fontWeight.normal,
      cursor: 'pointer',
      transition: transitions.default,
    },
  },

  // Dropdown Styles
  dropdown: {
    container: {
      position: 'absolute' as const,
      background: colors.neutral.white,
      border: `1px solid ${colors.neutral.gray200}`,
      borderRadius: borderRadius.xl,
      boxShadow: shadows.lg,
      zIndex: 100,
      minWidth: 180,
    },
    item: {
      display: 'block',
      width: '100%',
      padding: '8px 12px',
      border: 'none',
      background: 'transparent',
      color: colors.neutral.gray700,
      fontSize: typography.fontSize.base,
      textAlign: 'left' as const,
      cursor: 'pointer',
      borderRadius: borderRadius.md,
      transition: transitions.fast,
    },
  },

  // Layout
  layout: {
    sidebar: {
      width: 240,
      background: colors.neutral.white,
      borderRight: `1px solid ${colors.neutral.gray200}`,
      padding: spacing[5],
      height: '100vh',
      display: 'flex',
      flexDirection: 'column' as const,
    },
    topbar: {
      height: 48,
      padding: '8px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      background: colors.neutral.gray50,
      position: 'sticky' as const,
      top: 0,
      zIndex: 10,
    },
    main: {
      padding: '0 12px 24px 24px',
      flex: 1,
      boxSizing: 'border-box' as const,
      overflow: 'hidden' as const,
    },
  },
} as const;

// ==================== HELPER FUNCTIONS ====================

/**
 * Mendapatkan style untuk status badge berdasarkan status
 */
export const getStatusStyle = (status: string) => {
  switch (status) {
    case 'Sudah':
      return { bg: colors.status.sudah.bg, color: colors.status.sudah.text, label: 'Sudah', dropdownLabel: 'Sudah Periksa' };
    case 'Belum':
      return { bg: colors.status.belum.bg, color: colors.status.belum.text, label: 'Belum', dropdownLabel: 'Belum Periksa' };
    case 'Batal':
      return { bg: colors.status.batal.bg, color: colors.status.batal.text, label: 'Batal', dropdownLabel: 'Batal Periksa' };
    case 'Dirujuk':
      return { bg: colors.status.dirujuk.bg, color: colors.status.dirujuk.text, label: 'Dirujuk', dropdownLabel: 'Dirujuk' };
    case 'Dirawat':
      return { bg: colors.status.dirawat.bg, color: colors.status.dirawat.text, label: 'Dirawat', dropdownLabel: 'Dirawat' };
    default:
      return { bg: colors.neutral.gray100, color: colors.neutral.gray700, label: status, dropdownLabel: status };
  }
};

/**
 * Mendapatkan warna role badge berdasarkan role
 */
export const getRoleColor = (role: string) => {
  switch (role) {
    case 'admin':
      return '#dc2626';
    case 'dokter':
      return colors.primary.blue;
    case 'farmasi':
      return colors.success.green;
    case 'kasir':
      return '#ca8a04';
    default:
      return colors.neutral.gray500;
  }
};

/**
 * Mendapatkan background color untuk table row berdasarkan status dan index
 */
export const getTableRowBg = (status: string, index: number) => {
  if (status === 'Batal') return colors.error.bgAlt;
  if (status === 'Sudah') return colors.success.bg;
  return index % 2 === 0 ? colors.neutral.white : colors.neutral.gray50;
};

// ==================== EXPORTS ====================

export default {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  transitions,
  componentStyles,
  getStatusStyle,
  getRoleColor,
  getTableRowBg,
};
