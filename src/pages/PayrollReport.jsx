import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function PayrollReport({ organizationId, orgSettings }) {
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState({ start: '', end: '' });
  const [deptFilter, setDeptFilter] = useState('All');

  // --- AUTO-DETECT LAST PAYROLL PERIOD ---
  useEffect(() => {
    const getLatestPeriod = async () => {
      const { data } = await supabase
        .from('payroll_history')
        .select('period_start, period_end')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        setSelectedPeriod({
          start: data[0].period_start,
          end: data[0].period_end
        });
      }
    };
    getLatestPeriod();
  }, [organizationId]);

  // --- [RULE: FILTER UNUSED LABELS] ---
  const activeAdditions = (orgSettings?.addition_labels || [])
    .map((label, index) => ({ label, index }))
    .filter(item => !item.label.startsWith("Add Pay"));

  const activeDeductions = (orgSettings?.deduction_labels || [])
    .map((label, index) => ({ label, index }))
    .filter(item => !item.label.startsWith("Deduction"));

  const fetchReport = async () => {
    if (!selectedPeriod.start || !selectedPeriod.end) return alert("Select a period first.");
    setLoading(true);
    
    // 1. Fetch data from Supabase
    const { data, error } = await supabase
      .from('payroll_history')
      .select(`*, employees(*)`)
      .eq('organization_id', organizationId)
      .gte('period_start', selectedPeriod.start)
      .lte('period_end', selectedPeriod.end);

    if (error) {
      console.error(error);
    } else if (data) {
      // 2. --- [FIXED: ROBUST ALPHABETICAL SORTING] ---
      const sorted = [...data].sort((a, b) => {
        const nameA = (a.employees?.last_name || "").toUpperCase();
        const nameB = (b.employees?.last_name || "").toUpperCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        
        const firstA = (a.employees?.first_name || "").toUpperCase();
        const firstB = (b.employees?.first_name || "").toUpperCase();
        return firstA.localeCompare(firstB);
      });

      setReportData(sorted);
    }
    setLoading(false);
  };

  const departments = ['All', ...new Set(reportData.map(r => r.employees?.department).filter(Boolean))];
  const filteredData = deptFilter === 'All' ? reportData : reportData.filter(r => r.employees?.department === deptFilter);
  const calculateGrandTotal = () => filteredData.reduce((sum, row) => sum + Number(row.net_pay || 0), 0);

  // --- CSV EXPORT (FIXED: Monetary Calculations) ---
  const exportToCSV = () => {
    if (filteredData.length === 0) return;
    
    const headers = [
      "ID", "Name", "Dept", "Shift", "L/UT(M)", "ND(H)", "Daily Rate", 
      "Basic", "Normal OT", "Hol OT", "Normal ND", "Hol ND", "Hol Prem",
      ...activeAdditions.map(a => a.label), 
      "Gross Pay", "Late Ded", 
      ...activeDeductions.map(d => d.label), 
      "Vale", "SSS", "PHIC", "HDMF", "W-Tax", "Net Pay"
    ].join(",");

    const rows = filteredData.map(row => {
      const factor = parseFloat(orgSettings?.working_days_per_year) || 313;
      const dailyRate = (parseFloat(row.employees?.salary_rate) || 0) * 12 / factor;
      const hourlyRate = dailyRate / 8;

      const monetaryHolOT = (Number(row.reg_holiday_ot_hrs || 0) * hourlyRate * 2.6) + 
                            (Number(row.spec_holiday_ot_hrs || 0) * hourlyRate * 1.69);

      const monetaryHolND = ((Number(row.reg_holiday_nd || 0) * hourlyRate * 2.0) * 0.10) + 
                            ((Number(row.spec_holiday_nd || 0) * hourlyRate * 1.3) * 0.10);

      return [
        row.employees?.employee_id_number,
        `"${row.employees?.last_name}, ${row.employees?.first_name}"`,
        row.employees?.department,
        row.days_worked,
        Number(row.late_minutes || 0) + Number(row.undertime_minutes || 0),
        row.nd_hours || 0,
        dailyRate.toFixed(2),
        row.basic_pay, 
        row.ot_pay, 
        monetaryHolOT.toFixed(2), 
        row.nd_pay || 0, 
        monetaryHolND.toFixed(2), 
        row.holiday_pay || 0,
        ...activeAdditions.map(a => row.custom_additions?.[a.index] || 0),
        row.gross_pay,
        row.time_deduction || 0,
        ...activeDeductions.map(d => row.custom_deductions?.[d.index] || 0),
        row.loan_deduction || 0,
        row.sss_deduction, row.philhealth_deduction, row.pagibig_deduction, row.tax_deduction, row.net_pay
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `Master_Report_${selectedPeriod.start}.csv`);
    link.click();
  };

  // --- PDF GENERATOR (FIXED: Headers, Spans & Amounts) ---
  const generatePDFReport = () => {
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      doc.setFontSize(10);
      doc.text((orgSettings?.name || "PAYROLL REPORT").toUpperCase(), 5, 10);
      
      const head = [
        [
          { content: 'Employee', colSpan: 3, styles: { halign: 'center' } },
          { content: 'Attendance', colSpan: 3, styles: { halign: 'center' } },
          { content: 'Earnings', colSpan: 7 + activeAdditions.length, styles: { halign: 'center' } },
          { content: 'Deductions', colSpan: 2 + activeDeductions.length, styles: { halign: 'center' } },
          { content: 'Statutory', colSpan: 4, styles: { halign: 'center' } },
          { content: 'Net', styles: { halign: 'center' } }
        ],
        [
          'ID', 'Name', 'Dept',
          'Shft', 'L/UT', 'ND',
          'Basic', 'OT', 'Hol OT', 'ND P', 'Hol ND', 'Hol Prem', ...activeAdditions.map(a => a.label.substring(0, 5)), 'GROSS',
          'Late', ...activeDeductions.map(d => d.label.substring(0, 5)), 'Vale',
          'SSS', 'PHIC', 'HDMF', 'W-Tax', 'TOTAL'
        ]
      ];

      const body = filteredData.map(row => {
        const factor = parseFloat(orgSettings?.working_days_per_year) || 313;
        const dailyRate = (parseFloat(row.employees?.salary_rate) || 0) * 12 / factor;
        const hourlyRate = dailyRate / 8;

        const monetaryHolOT = (Number(row.reg_holiday_ot_hrs || 0) * hourlyRate * 2.6) + 
                              (Number(row.spec_holiday_ot_hrs || 0) * hourlyRate * 1.69);

        const monetaryHolND = ((Number(row.reg_holiday_nd || 0) * hourlyRate * 2.0) * 0.10) + 
                              ((Number(row.spec_holiday_nd || 0) * hourlyRate * 1.3) * 0.10);

        return [
          row.employees?.employee_id_number,
          `${row.employees?.last_name}, ${row.employees?.first_name[0]}.`,
          row.employees?.department?.substring(0, 8),
          row.days_worked,
          Number(row.late_minutes || 0) + Number(row.undertime_minutes || 0),
          row.nd_hours,
          Number(row.basic_pay).toLocaleString(),
          Number(row.ot_pay).toLocaleString(),
          monetaryHolOT.toLocaleString(undefined, {minimumFractionDigits: 2}),
          Number(row.nd_pay || 0).toLocaleString(),
          monetaryHolND.toLocaleString(undefined, {minimumFractionDigits: 2}),
          Number(row.holiday_pay || 0).toLocaleString(),
          ...activeAdditions.map(a => Number(row.custom_additions?.[a.index] || 0).toLocaleString()),
          Number(row.gross_pay || 0).toLocaleString(),
          Number(row.time_deduction || 0).toLocaleString(),
          ...activeDeductions.map(d => Number(row.custom_deductions?.[d.index] || 0).toLocaleString()),
          Number(row.loan_deduction || 0).toLocaleString(),
          Number(row.sss_deduction || 0).toLocaleString(),
          Number(row.philhealth_deduction || 0).toLocaleString(),
          Number(row.pagibig_deduction || 0).toLocaleString(),
          Number(row.tax_deduction || 0).toLocaleString(),
          Number(row.net_pay || 0).toLocaleString()
        ];
      });

      autoTable(doc, {
        startY: 18,
        head: head,
        body: body,
        theme: 'grid',
        styles: { fontSize: 4, cellPadding: 0.4 },
        headStyles: { fillColor: [30, 41, 59] }
      });
      window.open(doc.output('bloburl'), '_blank');
    } catch (err) { console.error(err); }
  };

  return (
    <div style={reportContainer}>
      <div className="no-print" style={headerSection}>
        <div>
          <h2 style={{ margin: 0 }}>📊 Master Payroll Report</h2>
          <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
            <div style={filterItem}><label style={miniLabel}>PERIOD</label>
              <div style={{ display: 'flex', gap: '5px' }}>
                <input type="date" value={selectedPeriod.start} onChange={e => setSelectedPeriod({...selectedPeriod, start: e.target.value})} style={dateInput} />
                <input type="date" value={selectedPeriod.end} onChange={e => setSelectedPeriod({...selectedPeriod, end: e.target.value})} style={dateInput} />
              </div>
            </div>
            <div style={filterItem}><label style={miniLabel}>DEPARTMENT</label>
              <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} style={dateInput}>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <button onClick={fetchReport} style={generateBtn}>Load Data</button>
          <button onClick={exportToCSV} disabled={filteredData.length === 0} style={excelBtn}>Export CSV</button>
          <button onClick={generatePDFReport} disabled={filteredData.length === 0} style={printBtn}>View PDF</button>
        </div>
      </div>

      <div style={tableWrapper}>
        <table style={reportTable}>
          <thead>
            <tr style={thGroupRow}>
              <th colSpan="3">Employee</th>
              <th colSpan="3">Attendance</th>
              <th colSpan={7 + activeAdditions.length}>Earnings</th>
              <th colSpan={2 + activeDeductions.length}>Deductions</th>
              <th colSpan="4">Statutory</th>
              <th>Net Pay</th>
            </tr>
            <tr style={thMainRow}>
              <th>ID</th><th>Name</th><th>Dept</th>
              <th>Shft</th><th>L/UT</th><th>ND</th>
              <th>Basic</th><th>OT</th><th>Hol OT</th><th>ND P</th><th>Hol ND</th><th>Hol Prem</th>
              {activeAdditions.map(a => <th key={a.index}>{a.label.toUpperCase()}</th>)}
              <th>GROSS</th>
              <th>Late</th>
              {activeDeductions.map(d => <th key={d.index}>{d.label.toUpperCase()}</th>)}
              <th>Vale</th>
              <th>SSS</th><th>PHIC</th><th>HDMF</th><th>W-Tax</th>
              <th style={{background:'#166534'}}>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((row, idx) => {
              const factor = parseFloat(orgSettings?.working_days_per_year) || 313;
              const dailyRate = (parseFloat(row.employees?.salary_rate) || 0) * 12 / factor;
              const hourlyRate = dailyRate / 8;

              const monetaryHolOT = (Number(row.reg_holiday_ot_hrs || 0) * hourlyRate * 2.6) + 
                                    (Number(row.spec_holiday_ot_hrs || 0) * hourlyRate * 1.69);

              const monetaryHolND = ((Number(row.reg_holiday_nd || 0) * hourlyRate * 2.0) * 0.10) + 
                                    ((Number(row.spec_holiday_nd || 0) * hourlyRate * 1.3) * 0.10);

              return (
                <tr key={row.id} style={idx % 2 === 0 ? trEven : trOdd}>
                  <td>{row.employees?.employee_id_number}</td>
                  <td style={stickyCol}>{row.employees?.last_name}, {row.employees?.first_name}</td>
                  <td>{row.employees?.department}</td>
                  <td style={numCol}>{row.days_worked}</td>
                  <td style={numCol}>{Number(row.late_minutes || 0) + Number(row.undertime_minutes || 0)}</td>
                  <td style={numCol}>{row.nd_hours || 0}</td>
                  <td style={valCol}>{Number(row.basic_pay).toLocaleString()}</td>
                  <td style={valCol}>{Number(row.ot_pay).toLocaleString()}</td>
                  <td style={valCol}>{monetaryHolOT.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td style={valCol}>{Number(row.nd_pay || 0).toLocaleString()}</td>
                  <td style={valCol}>{monetaryHolND.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td style={valCol}>{Number(row.holiday_pay || 0).toLocaleString()}</td>
                  {activeAdditions.map(a => <td key={a.index} style={valCol}>{Number(row.custom_additions?.[a.index] || 0).toLocaleString()}</td>)}
                  <td style={{...valCol, fontWeight:'bold', background:'#f8fafc'}}>{Number(row.gross_pay).toLocaleString()}</td>
                  <td style={dedCol}>{Number(row.time_deduction || 0).toLocaleString()}</td>
                  {activeDeductions.map(d => <td key={d.index} style={dedCol}>{Number(row.custom_deductions?.[d.index] || 0).toLocaleString()}</td>)}
                  <td style={dedCol}>{Number(row.loan_deduction || 0).toLocaleString()}</td>
                  <td style={statCol}>{Number(row.sss_deduction).toLocaleString()}</td>
                  <td style={statCol}>{Number(row.philhealth_deduction).toLocaleString()}</td>
                  <td style={statCol}>{Number(row.pagibig_deduction).toLocaleString()}</td>
                  <td style={statCol}>{Number(row.tax_deduction).toLocaleString()}</td>
                  <td className="net-col" style={netCol}>₱{Number(row.net_pay).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- STYLES (No changes made here) ---
const reportContainer = { padding: '20px', background: '#f8fafc', minHeight: '100vh' };
const headerSection = { display: 'flex', justifyContent: 'space-between', marginBottom: '20px' };
const filterItem = { display: 'flex', flexDirection: 'column', gap: '4px' };
const miniLabel = { fontSize: '0.6rem', fontWeight: 'bold', color: '#94a3b8' };
const dateInput = { padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.8rem' };
const generateBtn = { background: '#3b82f6', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' };
const excelBtn = { background: '#10b981', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '8px', fontWeight: 'bold', marginLeft: '5px', cursor: 'pointer' };
const printBtn = { background: '#1e293b', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '8px', fontWeight: 'bold', marginLeft: '5px', cursor: 'pointer' };
const tableWrapper = { overflowX: 'auto', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0' };
const reportTable = { width: '100%', borderCollapse: 'collapse', fontSize: '0.65rem', whiteSpace: 'nowrap' };
const thGroupRow = { background: '#334155', color: 'white' };
const thMainRow = { background: '#1e293b', color: 'white' };
const stickyCol = { position: 'sticky', left: 0, background: 'inherit', borderRight: '1px solid #e2e8f0', zIndex: 5, padding: '10px', fontWeight: 'bold' };
const trEven = { background: '#ffffff', borderBottom: '1px solid #f1f5f9' };
const trOdd = { background: '#f8fafc', borderBottom: '1px solid #f1f5f9' };
const numCol = { textAlign: 'right', padding: '10px' };
const valCol = { color: '#2563eb', textAlign: 'right', padding: '8px' };
const dedCol = { color: '#dc2626', textAlign: 'right', padding: '8px' };
const statCol = { color: '#92400e', textAlign: 'right', padding: '8px' };
const netCol = { fontWeight: 'bold', textAlign: 'right', padding: '8px', background: '#f0fdf4', color: '#166534', borderLeft: '2px solid #bbf7d0' };