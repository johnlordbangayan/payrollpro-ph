import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function ThirteenthMonth({ organizationId, orgSettings }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  // --- FETCH DATA ---
  const generateReport = async () => {
    setLoading(true);
    
    // 1. Fetch All Employees (Active & Inactive - they are still entitled)
    const { data: employees } = await supabase
      .from('employees')
      .select('*')
      .eq('organization_id', organizationId)
      .order('last_name');

    // 2. Fetch Payroll History for the selected YEAR
    const { data: history } = await supabase
      .from('payroll_history')
      .select('employee_id, basic_pay')
      .eq('organization_id', organizationId)
      .gte('period_start', `${year}-01-01`)
      .lte('period_end', `${year}-12-31`);

    // 3. Calculate 13th Month
    // Formula: Total Basic Salary Earned / 12
    const computed = employees.map(emp => {
      const empHistory = history.filter(h => h.employee_id === emp.id);
      const totalBasicYear = empHistory.reduce((sum, record) => sum + (Number(record.basic_pay) || 0), 0);
      const thirteenthPay = totalBasicYear / 12;

      return {
        ...emp,
        totalBasicYear,
        thirteenthPay,
        monthsCounted: empHistory.length // Optional: helps spot data gaps
      };
    }).filter(item => item.totalBasicYear > 0); // Remove employees with 0 earnings

    setData(computed);
    setLoading(false);
  };

  // --- PDF EXPORT ---
  const downloadPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(12);
    doc.text(`${orgSettings?.name || 'Company'} - 13th Month Pay Report (${year})`, 14, 15);
    doc.setFontSize(8);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 20);

    const tableData = data.map(row => [
      `${row.last_name}, ${row.first_name}`,
      row.department || 'N/A',
      Number(row.totalBasicYear).toLocaleString(undefined, {minimumFractionDigits: 2}),
      Number(row.thirteenthPay).toLocaleString(undefined, {minimumFractionDigits: 2})
    ]);

    autoTable(doc, {
      startY: 25,
      head: [['Employee Name', 'Department', 'Total Basic (YTD)', '13th Month Pay']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59] }, // Dark Blue header
      columnStyles: {
        2: { halign: 'right' },
        3: { halign: 'right', fontStyle: 'bold', textColor: [22, 163, 74] } // Green text for 13th month
      }
    });

    doc.save(`13th_Month_Report_${year}.pdf`);
  };

  return (
    <div style={container}>
      <div style={header}>
        <h2 style={{margin:0}}>🎄 13th Month Pay Calculator</h2>
        <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
          <input 
            type="number" 
            value={year} 
            onChange={e => setYear(e.target.value)} 
            style={input}
          />
          <button onClick={generateReport} style={btnPrimary} disabled={loading}>
            {loading ? 'Computing...' : 'Generate Computation'}
          </button>
          {data.length > 0 && (
            <button onClick={downloadPDF} style={btnSuccess}>Download PDF</button>
          )}
        </div>
      </div>

      {/* --- RESULTS TABLE --- */}
      <div style={tableWrapper}>
        <table style={table}>
          <thead>
            <tr style={{background:'#f1f5f9', textAlign:'left'}}>
              <th style={th}>Employee Name</th>
              <th style={th}>Department</th>
              <th style={{...th, textAlign:'right'}}>Total Basic (YTD)</th>
              <th style={{...th, textAlign:'right', color:'#15803d'}}>13th Month Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr><td colSpan="4" style={{padding:'20px', textAlign:'center', color:'#64748b'}}>No records found for {year}. Click "Generate".</td></tr>
            ) : (
              data.map(row => (
                <tr key={row.id} style={{borderBottom:'1px solid #e2e8f0'}}>
                  <td style={td}>
                    <strong>{row.last_name}</strong>, {row.first_name}
                  </td>
                  <td style={td}>{row.department}</td>
                  <td style={{...td, textAlign:'right'}}>
                    ₱{row.totalBasicYear.toLocaleString(undefined, {minimumFractionDigits:2})}
                  </td>
                  <td style={{...td, textAlign:'right', fontWeight:'bold', color:'#166534', background:'#dcfce7'}}>
                    ₱{row.thirteenthPay.toLocaleString(undefined, {minimumFractionDigits:2})}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- STYLES ---
const container = { padding: '25px', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', maxWidth: '1000px', margin: '0 auto' };
const header = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' };
const input = { padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', width: '80px', textAlign: 'center', fontWeight: 'bold' };
const btnPrimary = { background: '#3b82f6', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' };
const btnSuccess = { background: '#22c55e', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' };
const tableWrapper = { overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' };
const table = { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' };
const th = { padding: '12px 15px', color: '#475569', fontSize: '0.8rem', textTransform: 'uppercase' };
const td = { padding: '12px 15px', color: '#1e293b' };