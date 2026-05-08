import React from 'react';

type UploadTabProps = {
  patient: any;
};

export const UploadTab: React.FC<UploadTabProps> = ({ patient }) => {
  return (
    <div style={{
      background: '#ffffff',
      borderRadius: 12,
      padding: 24,
      border: '1px solid #e5e7eb'
    }}>
      <h3 style={{ marginTop: 0, marginBottom: 16, color: '#111827' }}>Upload Berkas Digital</h3>
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 24 }}>
        Upload dan kelola berkas digital pasien seperti hasil lab, foto rontgen, scan dokumen, dan file medis lainnya.
      </p>

      {/* Upload Area */}
      <div style={{
        border: '2px dashed #d1d5db',
        borderRadius: 12,
        padding: 48,
        textAlign: 'center',
        background: '#f9fafb',
        marginBottom: 24
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📁</div>
        <p style={{ margin: 0, marginBottom: 8, fontSize: 14, color: '#111827', fontWeight: 500 }}>
          Klik untuk upload atau drag & drop file di sini
        </p>
        <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
          Format yang didukung: PDF, JPG, PNG, DICOM (Maks. 10MB)
        </p>
        <input
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.dcm"
          style={{ display: 'none' }}
          id="file-upload"
        />
        <label
          htmlFor="file-upload"
          style={{
            display: 'inline-block',
            marginTop: 16,
            padding: '10px 24px',
            background: '#2563eb',
            color: '#fff',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500,
            transition: 'all 0.2s'
          }}
        >
          Pilih File
        </label>
      </div>

      {/* List of Uploaded Files */}
      <div>
        <h4 style={{ marginTop: 0, marginBottom: 12, fontSize: 14, fontWeight: 600, color: '#111827' }}>
          Berkas Terupload
        </h4>
        <div style={{
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          overflow: 'hidden'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Nama File</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Jenis</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Ukuran</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Tanggal Upload</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: '#374151' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td colSpan={5} style={{ padding: '48px 16px', textAlign: 'center', color: '#9ca3af' }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>📄</div>
                  <p style={{ margin: 0, fontSize: 13 }}>Belum ada berkas yang diupload</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
