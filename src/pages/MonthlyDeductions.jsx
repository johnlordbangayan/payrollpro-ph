import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function MonthlyDeductions({ organizationId, orgSettings }) {
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [targetMonth, setTargetMonth] = useState(new Date().toISOString().substring(0, 7)); 
  const [deptFilter, setDeptFilter] = useState('All');

  // --- 1. MEMOIZE LABELS (Stops infinite loop) ---
  const activeDeductionLabels = useMemo(() => {
    return (orgSettings?.deduction_labels || [])
      .map((label, index) => ({ label, index }))
      .filter(item => item.label && !item.label.startsWith("Deduction"));
  }, [orgSettings?.deduction_labels]);

  // --- 2. STABLE FETCH & AGGREGATION ---
  const fetchMonthlyData = useCallback(async (showLoading = true) => {
    if (!organizationId) return;
    if (showLoading) setLoading(true);
    
    const startOfMonth = `${targetMonth}-01`;
    const endOfMonth = new Date(targetMonth.split('-')[0], targetMonth.split('-')[1], 0).toISOString().split('T')[0];

    try {
      const { data, error } = await supabase
        .from('payroll_history')
        .select(`*, employees(*)`)
        .eq('organization_id', organizationId)
        .gte('period_start', startOfMonth)
        .lte('period_end', endOfMonth);

      if (error) throw error;

      const grouped = (data || []).reduce((acc, row) => {
        const empId = row.employee_id;
        if (!acc[empId]) {
          acc[empId] = {
            name: `${row.employees?.last_name || 'N/A'}, ${row.employees?.first_name || 'N/A'}`,
            dept: row.employees?.department || 'Unassigned',
            sss: 0, phic: 0, hdmf: 0, tax: 0, late: 0, loan: 0, total: 0,
            dynamicDeductions: {} 
          };
        }

        acc[empId].sss += row.sss_deduction || 0;
        acc[empId].phic += row.philhealth_deduction || 0;
        acc[empId].hdmf += row.pagibig_deduction || 0;
        acc[empId].tax += row.tax_deduction || 0;
        acc[empId].late += row.time_deduction || 0;
        acc[empId].loan += row.loan_deduction || 0;

        activeDeductionLabels.forEach(({ label, index }) => {
          const val = row.custom_deductions?.[index] || 0;
          acc[empId].dynamicDeductions[label] = (acc[empId].dynamicDeductions[label] || 0) + val;
        });

        const customTotal = Object.values(acc[empId].dynamicDeductions).reduce((a, b) => a + b, 0);
        acc[empId].total = acc[empId].sss + acc[empId].phic + acc[empId].hdmf + 
                           acc[empId].tax + acc[empId].late + acc[empId].loan + customTotal;
        
        return acc;
      }, {});

      // --- SORT A TO Z ---
      const sortedResult = Object.values(grouped).sort((a, b) => 
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      );

      setReportData(sortedResult);
    } catch (err) {
      console.error("Aggregation Error:", err.message);
    } finally {
      setLoading(false);
    }
  }, [organizationId, targetMonth, activeDeductionLabels]);

  useEffect(() => {
    fetchMonthlyData();
    const handleFocus = () => { if (document.visibilityState === 'visible') fetchMonthlyData(false); };
    window.addEventListener('visibilitychange', handleFocus);
    return () => window.removeEventListener('visibilitychange', handleFocus);
  }, [fetchMonthlyData]);

  // --- 3. PDF GENERATION LOGIC ---
  const downloadPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const formattedMonth = new Date(targetMonth).toLocaleString('default', { month: 'long', year: 'numeric' });
    
    doc.setFontSize(16);
    doc.text(`MONTHLY DEDUCTION SUMMARY - ${formattedMonth.toUpperCase()}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Organization ID: ${organizationId}`, 14, 22);

    const headers = [
      "Employee", "Dept", "SSS", "PHIC", "HDMF", "Loan", 
      ...activeDeductionLabels.map(l => l.label), "Total"
    ];

    const body = filtered.map(emp => [
      emp.name,
      emp.dept,
      emp.sss.toFixed(2),
      emp.phic.toFixed(2),
      emp.hdmf.toFixed(2),
      emp.loan.toFixed(2),
      ...activeDeductionLabels.map(l => (emp.dynamicDeductions[l.label] || 0).toFixed(2)),
      emp.total.toFixed(2)
    ]);

    autoTable(doc, {
      startY: 30,
      head: [headers],
      body: body,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 41, 59] }
    });

    doc.save(`MONTHLY_DEDUCTIONS_${targetMonth}.pdf`);
  };

  const departments = ['All', ...new Set(reportData.map(r => r.dept).filter(Boolean))];
  const filtered = deptFilter === 'All' ? reportData : reportData.filter(r => r.dept === deptFilter);

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div>
          <h2 style={{ margin: 0 }}>📉 Monthly Deduction Summary</h2>
          <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
            Sorted Alpha A-Z • {targetMonth}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input type="month" value={targetMonth} onChange={e => setTargetMonth(e.target.value)} style={inputStyle} />
          <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} style={inputStyle}>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <button onClick={downloadPDF} style={pdfBtnStyle}>📄 Export PDF</button>
          <button onClick={() => fetchMonthlyData(true)} style={btnStyle}>{loading ? '...' : 'Sync'}</button>
        </div>
      </div>

      <div style={tableWrapper}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Employee</th>
              <th style={thStyle}>Dept</th>
              <th style={thStyle}>SSS</th>
              <th style={thStyle}>PHIC</th>
              <th style={thStyle}>HDMF</th>
              <th style={thStyle}>Loan</th>
              {activeDeductionLabels.map(({ label }) => (
                <th key={label} style={thStyle}>{label}</th>
              ))}
              <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((emp, i) => (
              <tr key={i} style={i % 2 === 0 ? trStyle : { ...trStyle, backgroundColor: '#f8fafc' }}>
                <td style={{ padding: '14px', fontWeight: 'bold' }}>{emp.name}</td>
                <td style={tdStyle}>{emp.dept}</td>
                <td style={tdStyle}>₱{emp.sss.toLocaleString()}</td>
                <td style={tdStyle}>₱{emp.phic.toLocaleString()}</td>
                <td style={tdStyle}>₱{emp.hdmf.toLocaleString()}</td>
                <td style={tdStyle}>₱{emp.loan.toLocaleString()}</td>
                {activeDeductionLabels.map(({ label }) => (
                  <td key={label} style={tdStyle}>₱{(emp.dynamicDeductions[label] || 0).toLocaleString()}</td>
                ))}
                <td style={totalColCell}>₱{emp.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- STYLES ---
const containerStyle = { padding: '25px', background: 'white', borderRadius: '20px', border: '1px solid #f1f5f9' };
const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' };
const inputStyle = { padding: '10px', borderRadius: '10px', border: '2px solid #f1f5f9', outline: 'none' };
const btnStyle = { background: '#1e293b', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' };
const pdfBtnStyle = { ...btnStyle, background: '#ef4444' };
const tableWrapper = { borderRadius: '16px', border: '1px solid #f1f5f9', overflow: 'hidden' };
const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' };
const thStyle = { textAlign: 'left', background: '#f8fafc', padding: '14px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.65rem' };
const tdStyle = { padding: '14px' };
const trStyle = { borderBottom: '1px solid #f1f5f9' };
const totalColCell = { fontWeight: '900', color: '#1e293b', textAlign: 'right', background: '#f8fafc', padding: '14px' };