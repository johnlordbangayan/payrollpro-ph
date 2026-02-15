import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function MonthlyDeductions({ organizationId, orgSettings }) {
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [targetMonth, setTargetMonth] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM
  const [deptFilter, setDeptFilter] = useState('All');

  const fetchMonthlyData = async () => {
    setLoading(true);
    const startOfMonth = `${targetMonth}-01`;
    const endOfMonth = new Date(targetMonth.split('-')[0], targetMonth.split('-')[1], 0).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('payroll_history')
      .select(`*, employees(*)`)
      .eq('organization_id', organizationId)
      .gte('period_start', startOfMonth)
      .lte('period_end', endOfMonth);

    if (error) console.error(error);
    else {
      // AGGREGATION LOGIC: Combine multiple pay runs for the same employee
      const grouped = data.reduce((acc, row) => {
        const empId = row.employee_id;
        if (!acc[empId]) {
          acc[empId] = {
            name: `${row.employees?.last_name}, ${row.employees?.first_name}`,
            dept: row.employees?.department,
            sss: 0, phic: 0, hdmf: 0, tax: 0,
            late: 0, loan: 0, short: 0, cashBond: 0, total: 0
          };
        }
        acc[empId].sss += row.sss_deduction || 0;
        acc[empId].phic += row.philhealth_deduction || 0;
        acc[empId].hdmf += row.pagibig_deduction || 0;
        acc[empId].tax += row.tax_deduction || 0;
        acc[empId].late += row.time_deduction || 0;
        acc[empId].loan += row.loan_deduction || 0;
        acc[empId].short += row.custom_deductions?.[0] || 0;
        acc[empId].cashBond += row.custom_deductions?.[1] || 0;
        acc[empId].total = acc[empId].sss + acc[empId].phic + acc[empId].hdmf + acc[empId].tax + acc[empId].late + acc[empId].loan + acc[empId].short + acc[empId].cashBond;
        return acc;
      }, {});
      setReportData(Object.values(grouped));
    }
    setLoading(false);
  };

  const departments = ['All', ...new Set(reportData.map(r => r.dept).filter(Boolean))];
  const filtered = deptFilter === 'All' ? reportData : reportData.filter(r => r.dept === deptFilter);

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h2>📉 Monthly Deduction Summary</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input type="month" value={targetMonth} onChange={e => setTargetMonth(e.target.value)} style={inputStyle} />
          <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} style={inputStyle}>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <button onClick={fetchMonthlyData} style={btnStyle}>Generate Report</button>
        </div>
      </div>

      <table style={tableStyle}>
        <thead>
          <tr style={thStyle}>
            <th>Employee</th>
            <th>Dept</th>
            <th>SSS (Fixed)</th>
            <th>PHIC</th>
            <th>HDMF</th>
            <th>Lates (2x)</th>
            <th>Shorts</th>
            <th>Cash Bond</th>
            <th>Total Deduction</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((emp, i) => (
            <tr key={i} style={i % 2 === 0 ? {} : { backgroundColor: '#f8fafc' }}>
              <td style={{ fontWeight: 'bold' }}>{emp.name}</td>
              <td>{emp.dept}</td>
              <td>₱{emp.sss.toLocaleString()}</td>
              <td>₱{emp.phic.toLocaleString()}</td>
              <td>₱{emp.hdmf.toLocaleString()}</td>
              <td style={{ color: '#dc2626' }}>₱{emp.late.toLocaleString()}</td>
              <td>₱{emp.short.toLocaleString()}</td>
              <td>₱{emp.cashBond.toLocaleString()}</td>
              <td style={totalCol}>₱{emp.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Quick Styles ---
const containerStyle = { padding: '20px', background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' };
const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' };
const inputStyle = { padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' };
const btnStyle = { background: '#1e293b', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer' };
const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' };
const thStyle = { textAlign: 'left', background: '#f1f5f9', padding: '12px', borderBottom: '2px solid #e2e8f0' };
const totalCol = { fontWeight: 'bold', color: '#1e293b', textAlign: 'right', background: '#f1f5f9' };