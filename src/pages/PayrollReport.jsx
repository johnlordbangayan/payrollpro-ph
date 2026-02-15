import React, { useState, useEffect } from 'react'; // FIXED: Added useEffect here
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

  const additionLabels = (orgSettings?.addition_labels || []).filter(l => !l.startsWith("Add Pay"));
  const deductionLabels = (orgSettings?.deduction_labels || []).filter(l => !l.startsWith("Deduction"));

  const fetchReport = async () => {
    if (!selectedPeriod.start || !selectedPeriod.end) return alert("Select a period first.");
    setLoading(true);
    const { data, error } = await supabase
      .from('payroll_history')
      .select(`*, employees(*)`)
      .eq('organization_id', organizationId)
      .gte('period_start', selectedPeriod.start)
      .lte('period_end', selectedPeriod.end)
      .order('created_at', { ascending: true });

    if (error) console.error(error);
    else setReportData(data || []);
    setLoading(false);
  };

  const departments = ['All', ...new Set(reportData.map(r => r.employees?.department).filter(Boolean))];
  const filteredData = deptFilter === 'All' ? reportData : reportData.filter(r => r.employees?.department === deptFilter);
  const calculateGrandTotal = () => filteredData.reduce((sum, row) => sum + Number(row.net_pay || 0), 0);

  // --- ADDED BACK: CSV EXPORT ---
  const exportToCSV = () => {
    if (filteredData.length === 0) return;
    const dynamicAdds = additionLabels.join(",");
    const dynamicDeds = deductionLabels.join(",");
    const headers = [`ID,Name,Position,Dept,Late/UT(M),ND(H),Shift,Daily Rate,Basic,OT,ND Pay,Reg Holiday,Spec Premium,${dynamicAdds},Gross Pay,Late Ded,${dynamicDeds},Loans/Vale,SSS,PHIC,HDMF,W-Tax,Net Pay`].join(",");
    const rows = filteredData.map(row => [
      row.employees?.employee_id_number,
      `"${row.employees?.last_name}, ${row.employees?.first_name}"`,
      row.employees?.position,
      row.employees?.department,
      Number(row.late_minutes || 0) + Number(row.undertime_minutes || 0),
      row.nd_hours || 0,
      row.days_worked,
      (row.employees?.salary_rate / 26).toFixed(2),
      row.basic_pay, row.ot_pay, row.nd_pay || 0, row.holiday_pay || 0, row.special_holiday_pay || 0,
      ...additionLabels.map((_, i) => row.custom_additions?.[i] || 0),
      row.gross_pay,
      row.time_deduction || 0,
      ...deductionLabels.map((_, i) => row.custom_deductions?.[i] || 0),
      row.loan_deduction || 0,
      row.sss_deduction, row.philhealth_deduction, row.pagibig_deduction, row.tax_deduction, row.net_pay
    ].join(","));
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `Payroll_Report_${deptFilter}_${selectedPeriod.start}.csv`);
    link.click();
  };

  // --- PDF GENERATOR ---
  const generatePDFReport = () => {
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text((orgSettings?.name || "PAYROLL REPORT").toUpperCase(), 5, 10);
      doc.setFontSize(7);
      doc.text(`PERIOD: ${selectedPeriod.start} TO ${selectedPeriod.end} | DEPT: ${deptFilter}`, 5, 14);

      const head = [
        [
          { content: 'Employee info', colSpan: 4, styles: { halign: 'center', fillColor: [51, 65, 85] } },
          { content: 'Attendance & Rates', colSpan: 4, styles: { halign: 'center', fillColor: [51, 65, 85] } },
          { content: 'Earnings (Add Pay)', colSpan: 6 + additionLabels.length, styles: { halign: 'center', fillColor: [51, 65, 85] } },
          { content: 'Other Deductions', colSpan: 2 + deductionLabels.length, styles: { halign: 'center', fillColor: [51, 65, 85] } },
          { content: 'Statutory & Tax', colSpan: 4, styles: { halign: 'center', fillColor: [51, 65, 85] } },
          { content: 'Net Pay', styles: { halign: 'center', fillColor: [22, 101, 52] } }
        ],
        [
          'ID', 'Name', 'Pos', 'Dept',
          'L/UT', 'ND', 'Shft', 'Rate',
          'Basic', 'OT', 'ND P', 'Reg H', 'Spec', ...additionLabels.map(l => l.substring(0, 5)), 'GROSS',
          'Late', ...deductionLabels.map(l => l.substring(0, 5)), 'Loans',
          'SSS', 'PHIC', 'HDMF', 'W-Tax', 'TOTAL'
        ].map(h => ({ content: h, styles: { halign: 'center' } }))
      ];

      const body = filteredData.map(row => [
        row.employees?.employee_id_number || '',
        `${row.employees?.last_name || ''}, ${row.employees?.first_name ? row.employees.first_name[0] : ''}.`,
        (row.employees?.position || '').substring(0, 10),
        (row.employees?.department || '').substring(0, 8),
        Number(row.late_minutes || 0) + Number(row.undertime_minutes || 0),
        row.nd_hours || 0,
        row.days_worked || 0,
        Number(row.employees?.salary_rate / 26 || 0).toFixed(0),
        Number(row.basic_pay || 0).toLocaleString(),
        Number(row.ot_pay || 0).toLocaleString(),
        Number(row.nd_pay || 0).toLocaleString(),
        Number(row.holiday_pay || 0).toLocaleString(),
        Number(row.special_holiday_pay || 0).toLocaleString(),
        ...additionLabels.map((_, i) => Number(row.custom_additions?.[i] || 0).toLocaleString()),
        Number(row.gross_pay || 0).toLocaleString(),
        Number(row.time_deduction || 0).toLocaleString(),
        ...deductionLabels.map((_, i) => Number(row.custom_deductions?.[i] || 0).toLocaleString()),
        Number(row.loan_deduction || 0).toLocaleString(),
        Number(row.sss_deduction || 0).toLocaleString(),
        Number(row.philhealth_deduction || 0).toLocaleString(),
        Number(row.pagibig_deduction || 0).toLocaleString(),
        Number(row.tax_deduction || 0).toLocaleString(),
        Number(row.net_pay || 0).toLocaleString()
      ]);

      autoTable(doc, {
        startY: 18,
        head: head,
        body: body,
        theme: 'grid',
        styles: { fontSize: 5, cellPadding: 0.5 },
        margin: { left: 5, right: 5 },
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], lineWidth: 0.1 },
        columnStyles: {
          4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' },
          8: { halign: 'right' }, 9: { halign: 'right' }, 10: { halign: 'right' }, 11: { halign: 'right' },
          12: { halign: 'right' }, 13: { halign: 'right' }, 14: { halign: 'right', fontStyle: 'bold' },
          15: { halign: 'right' }, 16: { halign: 'right' }, 17: { halign: 'right' }, 18: { halign: 'right' },
          19: { halign: 'right' }, 20: { halign: 'right' }, 21: { halign: 'right' }, 
          22: { halign: 'right', fontStyle: 'bold', fillColor: [240, 253, 244] }
        },
        didDrawPage: (data) => {
          if (data.pageNumber === doc.internal.getNumberOfPages()) {
            const finalY = data.cursor.y + 10;
            doc.setFontSize(8);
            doc.text(`GRAND TOTAL: PHP ${calculateGrandTotal().toLocaleString(undefined, {minimumFractionDigits: 2})}`, pageWidth - 5, finalY, { align: 'right' });
            const sigY = finalY + 12;
            doc.line(5, sigY, 55, sigY);
            doc.text("Prepared By", 5, sigY + 4);
            doc.line(pageWidth - 55, sigY, pageWidth - 5, sigY);
            doc.text("Approved By", pageWidth - 55, sigY + 4);
          }
        }
      });
      window.open(doc.output('bloburl'), '_blank');
    } catch (err) {
      console.error("PDF Error:", err);
      alert("Error generating PDF.");
    }
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
              <th colSpan="4" style={{ textAlign: 'center' }}>Employee info</th>
              <th colSpan="4" style={{ textAlign: 'center' }}>Attendance & Rates</th>
              <th colSpan={6 + additionLabels.length} style={{ textAlign: 'center' }}>Earnings (Add Pay)</th>
              <th colSpan={2 + deductionLabels.length} style={{ textAlign: 'center' }}>Other Deductions</th>
              <th colSpan="4" style={{ textAlign: 'center' }}>Statutory & Tax</th>
              <th rowSpan="2" style={{ textAlign: 'center' }}>Net Pay</th>
            </tr>
            <tr style={thMainRow}>
              <th style={{ textAlign: 'center' }}>ID</th>
              <th style={{ textAlign: 'center' }}>Name</th>
              <th style={{ textAlign: 'center' }}>Position</th>
              <th style={{ textAlign: 'center' }}>Dept.</th>
              <th style={{ textAlign: 'center' }}>Late/UT</th>
              <th style={{ textAlign: 'center' }}>ND(H)</th>
              <th style={{ textAlign: 'center' }}>Shift</th>
              <th style={{ textAlign: 'center' }}>Daily</th>
              <th style={{ textAlign: 'center' }}>Basic</th>
              <th style={{ textAlign: 'center' }}>OT</th>
              <th style={{ textAlign: 'center' }}>ND Pay</th>
              <th style={{ textAlign: 'center' }}>Reg Hol</th>
              <th style={{ textAlign: 'center' }}>Spec Prem</th>
              {additionLabels.map(l => <th key={l} style={{ textAlign: 'center' }}>{l.toUpperCase()}</th>)}
              <th style={{ textAlign: 'center' }}>GROSS</th>
              <th style={{ textAlign: 'center' }}>Late Ded</th>
              {deductionLabels.map(l => <th key={l} style={{ textAlign: 'center' }}>{l.toUpperCase()}</th>)}
              <th style={{ textAlign: 'center' }}>Loans</th>
              <th style={{ textAlign: 'center' }}>SSS</th>
              <th style={{ textAlign: 'center' }}>PHIC</th>
              <th style={{ textAlign: 'center' }}>HDMF</th>
              <th style={{ textAlign: 'center' }}>W-Tax</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((row, idx) => (
              <tr key={row.id} style={idx % 2 === 0 ? trEven : trOdd}>
                <td>{row.employees?.employee_id_number}</td>
                <td style={stickyCol}>{row.employees?.last_name}, {row.employees?.first_name}</td>
                <td>{row.employees?.position}</td>
                <td>{row.employees?.department}</td>
                <td style={numCol}>{Number(row.late_minutes || 0) + Number(row.undertime_minutes || 0)}</td>
                <td style={numCol}>{row.nd_hours || 0}</td>
                <td style={numCol}>{row.days_worked}</td>
                <td style={numCol}>{Number(row.employees?.salary_rate / 26).toFixed(0)}</td>
                <td style={valCol}>{Number(row.basic_pay).toLocaleString()}</td>
                <td style={valCol}>{Number(row.ot_pay).toLocaleString()}</td>
                <td style={valCol}>{Number(row.nd_pay || 0).toLocaleString()}</td>
                <td style={valCol}>{Number(row.holiday_pay || 0).toLocaleString()}</td>
                <td style={valCol}>{Number(row.special_holiday_pay || 0).toLocaleString()}</td>
                {additionLabels.map((_, i) => <td key={i} style={valCol}>{Number(row.custom_additions?.[i] || 0).toLocaleString()}</td>)}
                <td style={{...valCol, fontWeight:'bold', background:'#f8fafc'}}>{Number(row.gross_pay).toLocaleString()}</td>
                <td style={dedCol}>{Number(row.time_deduction || 0).toLocaleString()}</td>
                {deductionLabels.map((_, i) => <td key={i} style={dedCol}>{Number(row.custom_deductions?.[i] || 0).toLocaleString()}</td>)}
                <td style={dedCol}>{Number(row.loan_deduction || 0).toLocaleString()}</td>
                <td style={statCol}>{Number(row.sss_deduction).toLocaleString()}</td>
                <td style={statCol}>{Number(row.philhealth_deduction).toLocaleString()}</td>
                <td style={statCol}>{Number(row.pagibig_deduction).toLocaleString()}</td>
                <td style={statCol}>{Number(row.tax_deduction).toLocaleString()}</td>
                <td className="net-col" style={netCol}>₱{Number(row.net_pay).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={footerRow}>
              <td colSpan={20 + additionLabels.length + deductionLabels.length} style={{ textAlign: 'right', paddingRight: '20px', background: '#1e293b' }}>
                {deptFilter.toUpperCase()} ALL TOTAL:
              </td>
              <td className="net-col" style={{ ...netCol, fontSize: '0.8rem' }}>
                ₱{calculateGrandTotal().toLocaleString(undefined, {minimumFractionDigits: 2})}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// --- STYLES ---
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
const footerRow = { background: '#1e293b', color: 'white', fontWeight: 'bold' };