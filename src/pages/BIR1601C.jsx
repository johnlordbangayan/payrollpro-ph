import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import jsPDF from 'jspdf';             // Import jsPDF default
import autoTable from 'jspdf-autotable'; // Import autoTable default

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
      .select(`*, employees (salary_rate, id)`)
      .eq('organization_id', organizationId)
      .gte('period_end', startDate)
      .lte('period_end', endDate);

    if (error || !payrolls || payrolls.length === 0) {
      alert("No payroll records found for this month.");
      setLoading(false);
      return;
    }

    let totalCompensation = 0;       // Line 14
    let totalNonTaxable = 0;         // Line 21
    let totalExempt250k = 0;         // Line 23
    let totalTaxWithheld = 0;        // Line 25

    payrolls.forEach(row => {
        const gross = Number(row.gross_pay) || 0;
        const statutory = (Number(row.sss_deduction) || 0) + (Number(row.philhealth_deduction) || 0) + (Number(row.pagibig_deduction) || 0);
        const tax = Number(row.tax_deduction) || 0;
        
        totalCompensation += gross;
        totalNonTaxable += statutory; 
        totalTaxWithheld += tax;

        // CHECK 250K RULE
        const rowTaxableIncome = gross - statutory;
        const monthlyRate = Number(row.employees?.salary_rate) || 0;
        const annualRate = monthlyRate * 12;

        if (annualRate <= 250000) {
            totalExempt250k += rowTaxableIncome; 
        }
    });

    const taxableCompensation = totalCompensation - totalNonTaxable; // Line 22
    const netTaxableCompensation = taxableCompensation - totalExempt250k; // Line 24

    setTaxData({
        totalCompensation,
        totalNonTaxable,
        taxableCompensation,
        totalExempt250k,
        netTaxableCompensation,
        totalTaxWithheld,
        count: payrolls.length
    });
    
    setLoading(false);
  };

  // --- 📄 GENERATE PDF (Direct Download) ---
  const generateGuidePDF = () => {
    if (!taxData) return;
    
    // 1. Initialize Document
    const doc = new jsPDF();

    // 2. Add Header
    doc.setFontSize(16);
    doc.text("BIR Form 1601-C Data Guide", 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Use these figures to fill out your eBIRForm / EFPS.", 14, 26);
    
    // 3. Company Info Table
    autoTable(doc, {
        startY: 32,
        body: [
            ['TIN', orgSettings?.tin || 'N/A'],
            ['Agent Name', orgSettings?.name || 'N/A'],
            ['Period', `${months.find(m=>m.val===month)?.label} ${year}`]
        ],
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 1 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 30 } }
    });

    // 4. Computation Table (Number First!)
    autoTable(doc, {
        startY: 55,
        head: [['Line', 'Description', 'Amount (PHP)']],
        body: [
            ['14', 'Total Amount of Compensation', Number(taxData.totalCompensation).toLocaleString(undefined, {minimumFractionDigits:2})],
            ['19', 'Less: Statutory (SSS/PHIC/HDMF)', Number(taxData.totalNonTaxable).toLocaleString(undefined, {minimumFractionDigits:2})],
            ['21', 'Total Non-Taxable Compensation', Number(taxData.totalNonTaxable).toLocaleString(undefined, {minimumFractionDigits:2})],
            ['22', 'Taxable Compensation (14 - 21)', Number(taxData.taxableCompensation).toLocaleString(undefined, {minimumFractionDigits:2})],
            ['23', 'Less: Exempt (Annual Income < 250k)', { content: Number(taxData.totalExempt250k).toLocaleString(undefined, {minimumFractionDigits:2}), styles: { textColor: [217, 119, 6] } }],
            ['24', 'Net Taxable Compensation (22 - 23)', { content: Number(taxData.netTaxableCompensation).toLocaleString(undefined, {minimumFractionDigits:2}), styles: { fontStyle: 'bold' } }],
            
            // Results
            ['25', 'TAX DUE', { content: Number(taxData.totalTaxWithheld).toLocaleString(undefined, {minimumFractionDigits:2}), styles: { fillColor: [240, 253, 244], fontStyle: 'bold', textColor: [22, 163, 74] } }],
            ['27', 'AMOUNT REMITTABLE', { content: Number(taxData.totalTaxWithheld).toLocaleString(undefined, {minimumFractionDigits:2}), styles: { fillColor: [220, 252, 231], fontStyle: 'bold', textColor: [21, 128, 61], fontSize: 12 } }]
        ],
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59], halign: 'left' },
        columnStyles: { 
            0: { halign: 'center', fontStyle: 'bold', cellWidth: 15 }, // Narrow column for Line Number
            2: { halign: 'right', cellWidth: 40, fontStyle: 'bold' }    // Right align amounts
        }
    });

    // 5. Footer
    const finalY = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Generated by PayrollPro PH on ${new Date().toLocaleDateString()}`, 14, finalY);

    // 6. FORCE DOWNLOAD
    doc.save(`BIR_1601C_${year}_${month}.pdf`);
  };

  return (
    <div style={container}>
      <h2 style={{marginTop:0, color:'#1e293b'}}>🏛️ BIR 1601-C Data Guide</h2>
      <p style={{fontSize:'0.9rem', color:'#64748b', marginBottom:'20px'}}>
        Generate exact figures to transcribe into your 1601-C eBIRForm.
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

      {/* RESULTS PREVIEW */}
      {taxData && (
          <div style={resultCard}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
                <div style={{fontWeight:'bold', color:'#334155'}}>Payroll Data ({taxData.count} runs)</div>
                <button onClick={generateGuidePDF} style={btnPdf}>
                   📥 2. Download Data Guide
                </button>
            </div>

            <div style={grid}>
                {/* PREVIEW TABLE WITH LINE NUMBERS FIRST */}
                <div style={item}>
                    <label><strong>14</strong> Total Compensation</label>
                    <strong>{Number(taxData.totalCompensation).toLocaleString()}</strong>
                </div>
                <div style={item}>
                    <label><strong>19/21</strong> Non-Taxable</label>
                    <strong>{Number(taxData.totalNonTaxable).toLocaleString()}</strong>
                </div>
                <div style={item}>
                    <label><strong>22</strong> Taxable Comp</label>
                    <strong>{Number(taxData.taxableCompensation).toLocaleString()}</strong>
                </div>
                <div style={item}>
                    <label><strong>23</strong> Exempt (250k Rule)</label>
                    <strong style={{color:'#d97706'}}>{Number(taxData.totalExempt250k).toLocaleString()}</strong>
                </div>
                <div style={item}>
                    <label><strong>24</strong> Net Taxable</label>
                    <strong>{Number(taxData.netTaxableCompensation).toLocaleString()}</strong>
                </div>
                <div style={{...item, background:'#dcfce7', borderColor:'#86efac'}}>
                    <label style={{color:'#166534'}}><strong>25</strong> Tax Due</label>
                    <strong style={{color:'#15803d'}}>₱{Number(taxData.totalTaxWithheld).toLocaleString()}</strong>
                </div>
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