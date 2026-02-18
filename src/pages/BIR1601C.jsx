import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { PDFDocument } from 'pdf-lib';

export default function BIR1601C({ organizationId, orgSettings }) {
  const [loading, setLoading] = useState(false);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [taxData, setTaxData] = useState(null);

  const months = [
    { val: 1, label: 'January' }, { val: 2, label: 'February' }, { val: 3, label: 'March' },
    { val: 4, label: 'April' }, { val: 5, label: 'May' }, { val: 6, label: 'June' },
    { val: 7, label: 'July' }, { val: 8, label: 'August' }, { val: 9, label: 'September' },
    { val: 10, label: 'October' }, { val: 11, label: 'November' }, { val: 12, label: 'December' }
  ];

  // --- COMPUTATION LOGIC ---
  const compute1601C = async () => {
    setLoading(true);
    setTaxData(null);

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const { data: payrolls, error } = await supabase
      .from('payroll_history')
      .select('*')
      .eq('organization_id', organizationId)
      .gte('period_end', startDate)
      .lte('period_end', endDate);

    if (error || !payrolls || payrolls.length === 0) {
      alert("No payroll records found for this month.");
      setLoading(false);
      return;
    }

    let totalCompensation = 0;
    let totalContribs = 0;
    let totalTaxWithheld = 0;

    payrolls.forEach(row => {
        totalCompensation += Number(row.gross_pay) || 0;
        totalContribs += (Number(row.sss_deduction) || 0) + (Number(row.philhealth_deduction) || 0) + (Number(row.pagibig_deduction) || 0);
        totalTaxWithheld += Number(row.tax_deduction) || 0;
    });

    const totalNonTaxable = totalContribs; // Simplified (Add De Minimis logic here if needed)
    const taxableCompensation = totalCompensation - totalNonTaxable;

    setTaxData({
        totalCompensation,
        totalNonTaxable,
        taxableCompensation,
        totalTaxWithheld,
        count: payrolls.length
    });
    
    setLoading(false);
  };

  // --- 📄 FILL PDF FORM ---
  const fillAndDownloadPDF = async () => {
    if (!taxData) return;

    try {
      // 1. Load the existing PDF from public folder
      const formUrl = '/forms/1601C_2018.pdf';
      const existingPdfBytes = await fetch(formUrl).then(res => res.arrayBuffer());

      // 2. Load into PDF-Lib
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const page = pdfDoc.getPages()[0];
      
      // 3. Helper to draw text (Coordinates are from Bottom-Left by default in PDF files)
      // NOTE: You may need to adjust X and Y to align perfectly with your specific PDF version.
      const draw = (text, x, y, size = 10) => {
        page.drawText(String(text), { x, y, size });
      };

      const format = (num) => Number(num).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});

      // --- MAPPING DATA TO COORDINATES (Approximate for 2018 Form) ---
      
      // Header Info
      draw(String(month).padStart(2, '0'), 135, 762); // Month
      draw(String(year), 180, 762); // Year
      
      // TIN (Split 9 digits + 3 branch)
      const tin = (orgSettings?.tin || "").replace(/[^0-9]/g, '');
      if (tin.length >= 9) {
          draw(tin.substring(0,3), 135, 715);
          draw(tin.substring(3,6), 185, 715);
          draw(tin.substring(6,9), 235, 715);
          draw(tin.substring(9,12) || '000', 290, 715); // Branch
      }

      draw(orgSettings?.name || "My Company", 135, 690); // Name
      draw(orgSettings?.address || "Company Address", 135, 665); // Address

      // Computation Part II (X coordinates are approximate for the columns)
      const colX = 400; // The column where amounts go
      
      // Line 14: Total Compensation
      draw(format(taxData.totalCompensation), colX, 555);

      // Line 19: SSS/PHIC/HDMF (Statutory)
      draw(format(taxData.totalNonTaxable), colX, 480);
      
      // Line 21: Total Non-Taxable
      draw(format(taxData.totalNonTaxable), colX, 455);

      // Line 22: Taxable Compensation
      draw(format(taxData.taxableCompensation), colX, 440);

      // Line 25: Tax Due
      draw(format(taxData.totalTaxWithheld), colX, 395);

      // Line 27: Amount Remittable
      draw(format(taxData.totalTaxWithheld), colX, 365);


      // 4. Save and Download
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `BIR_1601C_${year}_${month}.pdf`;
      link.click();

    } catch (err) {
      console.error(err);
      alert("Error generating PDF. Make sure /public/forms/1601C_2018.pdf exists!");
    }
  };

  return (
    <div style={container}>
      <h2 style={{marginTop:0, color:'#1e293b'}}>🏛️ Monthly Remittance (1601-C)</h2>
      <p style={{fontSize:'0.9rem', color:'#64748b', marginBottom:'20px'}}>
        Auto-fill the official BIR 1601-C Form with your payroll data.
      </p>

      {/* CONTROLS */}
      <div style={controlPanel}>
        <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
            <select value={month} onChange={e => setMonth(Number(e.target.value))} style={select}>
                {months.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
            </select>
            <input 
                type="number" 
                value={year} 
                onChange={e => setYear(Number(e.target.value))} 
                style={input} 
            />
            <button onClick={compute1601C} disabled={loading} style={btnPrimary}>
                {loading ? 'Computing...' : '1. Compute Data'}
            </button>
        </div>
      </div>

      {/* RESULTS */}
      {taxData && (
          <div style={resultCard}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
                <div style={{fontWeight:'bold', color:'#334155'}}>Payroll Data ({taxData.count} runs)</div>
                <button onClick={fillAndDownloadPDF} style={btnPdf}>
                   📄 2. Download Filled BIR Form
                </button>
            </div>

            <div style={grid}>
                <div style={item}>
                    <label>Total Compensation</label>
                    <strong>{Number(taxData.totalCompensation).toLocaleString()}</strong>
                </div>
                <div style={item}>
                    <label>Non-Taxable (SSS/Phic/Pagibig)</label>
                    <strong>{Number(taxData.totalNonTaxable).toLocaleString()}</strong>
                </div>
                <div style={item}>
                    <label>Taxable Compensation</label>
                    <strong>{Number(taxData.taxableCompensation).toLocaleString()}</strong>
                </div>
                <div style={{...item, background:'#dcfce7', borderColor:'#86efac'}}>
                    <label style={{color:'#166534'}}>Total Tax Due</label>
                    <strong style={{color:'#15803d'}}>₱{Number(taxData.totalTaxWithheld).toLocaleString()}</strong>
                </div>
            </div>
            <div style={{marginTop:'15px', fontSize:'0.8rem', color:'#94a3b8', fontStyle:'italic'}}>
                * Note: Verify these figures against your records before filing.
            </div>
          </div>
      )}
    </div>
  );
}

// --- STYLES ---
const container = { padding: '30px', background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', maxWidth: '800px', margin: '0 auto' };
const controlPanel = { background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' };
const select = { padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem' };
const input = { padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', width: '80px', fontSize: '0.95rem' };
const btnPrimary = { background: '#2563eb', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' };
const btnPdf = { background: '#dc2626', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight:'bold', boxShadow: '0 4px 6px -1px rgba(220, 38, 38, 0.2)' };
const resultCard = { border: '1px solid #cbd5e1', borderRadius: '12px', padding: '25px' };
const grid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' };
const item = { display: 'flex', flexDirection: 'column', border: '1px solid #e2e8f0', padding: '12px', borderRadius: '8px' };