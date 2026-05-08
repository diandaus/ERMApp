/**
 * ExampleForm.tsx
 *
 * Contoh implementasi form menggunakan design tokens dari designTokens.ts
 *
 * File ini menunjukkan cara menggunakan design system ERMApp dengan benar.
 * Gunakan file ini sebagai referensi saat membuat form atau komponen baru.
 */

import React from 'react';
import designTokens from '../styles/designTokens';

const { colors, typography, spacing, borderRadius, shadows, componentStyles } = designTokens;

type ExampleFormProps = {
  onSubmit?: (data: any) => void;
};

export const ExampleForm: React.FC<ExampleFormProps> = ({ onSubmit }) => {
  const [formData, setFormData] = React.useState({
    field1: '',
    field2: '',
    field3: '',
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [tableData, setTableData] = React.useState([
    { id: 1, name: 'Item 1', status: 'Sudah', category: 'Kategori A' },
    { id: 2, name: 'Item 2', status: 'Belum', category: 'Kategori B' },
    { id: 3, name: 'Item 3', status: 'Batal', category: 'Kategori A' },
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!formData.field1 || !formData.field2) {
      setError('Mohon lengkapi semua field yang wajib diisi.');
      return;
    }

    setLoading(true);

    // Simulasi API call
    setTimeout(() => {
      setSuccess('Data berhasil disimpan!');
      setLoading(false);
      if (onSubmit) {
        onSubmit(formData);
      }
    }, 1000);
  };

  return (
    <section style={componentStyles.card.main}>
      {/* Header Section */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: spacing[6],
        }}
      >
        <div>
          <h2
            style={{
              marginTop: 0,
              marginBottom: spacing[1],
              fontSize: typography.fontSize['3xl'],
              fontWeight: typography.fontWeight.semibold,
            }}
          >
            Contoh Form
          </h2>
          <p
            style={{
              margin: 0,
              color: colors.neutral.gray500,
              fontSize: typography.fontSize.md,
            }}
          >
            Contoh implementasi form menggunakan design system ERMApp
          </p>
        </div>

        <button
          onClick={() => {
            setTableData([
              { id: 1, name: 'Item 1', status: 'Sudah', category: 'Kategori A' },
              { id: 2, name: 'Item 2', status: 'Belum', category: 'Kategori B' },
              { id: 3, name: 'Item 3', status: 'Batal', category: 'Kategori A' },
            ]);
          }}
          style={{
            ...componentStyles.button.success,
            fontSize: typography.fontSize.base,
          }}
        >
          Refresh Data
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div style={componentStyles.message.error}>
          {error}
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div style={componentStyles.message.success}>
          {success}
        </div>
      )}

      {/* Form Section */}
      <form
        onSubmit={handleSubmit}
        style={{
          ...componentStyles.card.form,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: spacing[6],
          marginBottom: spacing[6],
        }}
      >
        <div>
          <h3
            style={{
              marginTop: 0,
              marginBottom: spacing[3],
              fontSize: typography.fontSize.lg,
              fontWeight: typography.fontWeight.semibold,
            }}
          >
            Input Data Baru
          </h3>

          {/* Field 1 - Text Input */}
          <div style={{ marginBottom: spacing[4] }}>
            <label style={componentStyles.label}>
              Field 1 <span style={{ color: colors.error.red }}>*</span>
            </label>
            <input
              type="text"
              value={formData.field1}
              onChange={(e) => setFormData({ ...formData, field1: e.target.value })}
              placeholder="Masukkan field 1"
              style={componentStyles.input.base}
            />
          </div>

          {/* Field 2 - Select Dropdown */}
          <div style={{ marginBottom: spacing[4] }}>
            <label style={componentStyles.label}>
              Field 2 <span style={{ color: colors.error.red }}>*</span>
            </label>
            <select
              value={formData.field2}
              onChange={(e) => setFormData({ ...formData, field2: e.target.value })}
              style={componentStyles.input.select}
            >
              <option value="">Pilih Field 2</option>
              <option value="opsi1">Opsi 1</option>
              <option value="opsi2">Opsi 2</option>
              <option value="opsi3">Opsi 3</option>
            </select>
          </div>
        </div>

        <div>
          <h3
            style={{
              marginTop: 0,
              marginBottom: spacing[3],
              fontSize: typography.fontSize.lg,
              fontWeight: typography.fontWeight.semibold,
              visibility: 'hidden',
            }}
          >
            .
          </h3>

          {/* Field 3 - Date Input */}
          <div style={{ marginBottom: spacing[4] }}>
            <label style={componentStyles.label}>Field 3 (Opsional)</label>
            <input
              type="date"
              value={formData.field3}
              onChange={(e) => setFormData({ ...formData, field3: e.target.value })}
              style={componentStyles.input.date}
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              ...(loading ? componentStyles.button.disabled : componentStyles.button.primary),
              marginTop: spacing[1],
            }}
          >
            {loading ? 'Menyimpan...' : 'Simpan Data'}
          </button>
        </div>
      </form>

      {/* Table Section */}
      <div>
        <h3
          style={{
            marginTop: 0,
            marginBottom: spacing[4],
            fontSize: typography.fontSize.xl,
            fontWeight: typography.fontWeight.semibold,
            color: colors.neutral.gray900,
          }}
        >
          Data Tabel
        </h3>

        <div style={componentStyles.table.container}>
          <table style={componentStyles.table.base}>
            <thead style={componentStyles.table.header}>
              <tr>
                <th style={componentStyles.table.th}>ID</th>
                <th style={componentStyles.table.th}>Nama</th>
                <th style={componentStyles.table.th}>Kategori</th>
                <th style={componentStyles.table.th}>Status</th>
                <th style={componentStyles.table.th}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((item, index) => {
                const statusStyle = designTokens.getStatusStyle(item.status);
                return (
                  <tr
                    key={item.id}
                    style={{
                      background: designTokens.getTableRowBg(item.status, index),
                    }}
                  >
                    <td style={componentStyles.table.td}>{item.id}</td>
                    <td style={componentStyles.table.td}>{item.name}</td>
                    <td style={componentStyles.table.td}>{item.category}</td>
                    <td style={componentStyles.table.td}>
                      <span
                        style={{
                          ...componentStyles.badge.status,
                          background: statusStyle.bg,
                          color: statusStyle.color,
                        }}
                      >
                        {statusStyle.label}
                      </span>
                    </td>
                    <td style={componentStyles.table.td}>
                      {/* Outline Button Example */}
                      <button
                        onClick={() => alert(`Edit item ${item.id}`)}
                        style={componentStyles.button.outline}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = colors.primary.blue;
                          e.currentTarget.style.color = colors.neutral.white;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = colors.neutral.white;
                          e.currentTarget.style.color = colors.primary.blue;
                        }}
                      >
                        Edit
                      </button>
                      {' '}
                      {/* Danger Button Example */}
                      <button
                        onClick={() => {
                          if (confirm(`Hapus ${item.name}?`)) {
                            setTableData(tableData.filter((d) => d.id !== item.id));
                          }
                        }}
                        style={componentStyles.button.danger}
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                );
              })}

              {tableData.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      ...componentStyles.table.td,
                      textAlign: 'center',
                      padding: spacing[7],
                      color: colors.neutral.gray400,
                    }}
                  >
                    Tidak ada data
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Box Example */}
      <div
        style={{
          marginTop: spacing[6],
          padding: spacing[5],
          borderRadius: borderRadius.xl,
          border: `1px solid ${colors.neutral.gray200}`,
          background: colors.neutral.gray50,
          fontSize: typography.fontSize.md,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[3] }}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke={colors.primary.blue}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
          <div>
            <strong style={{ color: colors.neutral.gray900 }}>Catatan:</strong>{' '}
            <span style={{ color: colors.neutral.gray600 }}>
              Ini adalah contoh form yang menggunakan design tokens dari{' '}
              <code
                style={{
                  background: colors.neutral.white,
                  padding: '2px 6px',
                  borderRadius: borderRadius.sm,
                  fontSize: typography.fontSize.sm,
                  fontFamily: 'monospace',
                  border: `1px solid ${colors.neutral.gray200}`,
                }}
              >
                designTokens.ts
              </code>
              . Gunakan pola yang sama saat membuat form baru.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

/**
 * CARA MENGGUNAKAN DESIGN TOKENS
 *
 * 1. Import design tokens:
 *    import designTokens from '../styles/designTokens';
 *
 * 2. Destructure tokens yang diperlukan:
 *    const { colors, typography, spacing, componentStyles } = designTokens;
 *
 * 3. Gunakan tokens dalam inline styles:
 *    <button style={componentStyles.button.primary}>Click</button>
 *
 * 4. Untuk custom styling, gunakan tokens individual:
 *    <div style={{ color: colors.primary.blue, padding: spacing[4] }}>...</div>
 *
 * 5. Gunakan helper functions untuk logic:
 *    const statusStyle = designTokens.getStatusStyle('Sudah');
 *
 * KEUNTUNGAN MENGGUNAKAN DESIGN TOKENS:
 * - Konsistensi visual di seluruh aplikasi
 * - Mudah maintenance (ubah sekali, berpengaruh ke semua)
 * - Autocomplete di IDE/editor
 * - Type safety dengan TypeScript
 * - Single source of truth untuk design
 */

export default ExampleForm;
