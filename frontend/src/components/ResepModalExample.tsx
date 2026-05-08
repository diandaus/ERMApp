/**
 * Example: How to use ResepModal in your component
 *
 * This file demonstrates how to integrate the ResepModal into your existing
 * Pemeriksaan or other components.
 */

import React from 'react';
import { ResepModal } from './ResepModal';

// Example usage in your component
export const ExampleComponent = () => {
  const [showResepModal, setShowResepModal] = React.useState(false);

  // Example patient data
  const patient = {
    no_rkm_medis: '000001',
    nm_pasien: 'John Doe',
    no_rawat: '2025/12/03/000001',
    tgl_registrasi: '03/12/2025',
    jam_reg: '08:00',
    nm_poli: 'Poli Umum',
    nm_dokter: 'Dr. Jane Smith',
    umur: '35 Tahun',
    stts: 'Belum',
    png_jawab: 'UMUM',
    kd_dokter: 'D001'
  };

  return (
    <div>
      {/* Trigger button to open modal */}
      <button onClick={() => setShowResepModal(true)}>
        Input Resep
      </button>

      {/* Render modal when showResepModal is true */}
      {showResepModal && (
        <ResepModal
          patient={patient}
          onClose={() => setShowResepModal(false)}
        />
      )}
    </div>
  );
};

/**
 * Integration into Pemeriksaan.tsx
 *
 * To integrate this into your Pemeriksaan component, follow these steps:
 *
 * 1. Import the ResepModal component:
 *    import { ResepModal } from './ResepModal';
 *
 * 2. Add state to control modal visibility:
 *    const [showResepModal, setShowResepModal] = React.useState(false);
 *
 * 3. Modify the success handler in handleSubmit (around line 150):
 *    Replace:
 *      if (result.isConfirmed) {
 *        setActiveTab('cppt');
 *      }
 *
 *    With:
 *      if (result.isConfirmed) {
 *        setShowResepModal(true);
 *      }
 *
 * 4. Add the modal component at the end of your return statement (before closing </section>):
 *    {showResepModal && (
 *      <ResepModal
 *        patient={patient}
 *        onClose={() => setShowResepModal(false)}
 *      />
 *    )}
 *
 * That's it! The modal will now appear when the user clicks "Input Resep" after
 * successfully saving SOAP data.
 */
