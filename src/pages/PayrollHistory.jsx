import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { generatePayslipPDF, generateBulkPayslips } from '../lib/pdfGenerator';

export default function PayrollHistory({ organizationId }) {
  const [records, setRecords] = useState([]);
  const [orgData, setOrgData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterPeriod, setFilterPeriod] = useState({ start: '', end: '' });

  useEffect(() => {
    const initializeHistory = async () => {
      setLoading(true);
      try {
        const [orgRes, latestRes] = await Promise.all([
          supabase.from('organizations').select('*').eq('id', organizationId).single(),
          supabase.from('payroll_history')
            .select('period_start, period_end')
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false })
            .limit(1)
        ]);

        setOrgData(orgRes.data);

        let start = '';
        let end = '';

        if (latestRes.data && latestRes.data.length > 0) {
          start = latestRes.data[0].period_start;
          end = latestRes.data[0].period_end;
          setFilterPeriod({ start, end });
        }

        let query = supabase.from('payroll_history').select(`*, employees(*)`);
        query = query.eq('organization_id', organizationId);
        
        if (start && end) {
          query = query.gte('period_start', start).lte('period_end', end);
        }

        const { data: histData } = await query.order('created_at', { ascending: false });
        setRecords(histData || []);

      } catch (err) {
        console.error("Initialization error:", err);
      } finally {
        setLoading(false);
      }
    };

    initializeHistory();
  }, [organizationId]);

  const handleSearch = async () => {
    if (!filterPeriod.start || !filterPeriod.end) return;
    setLoading(true);
    const { data } = await supabase
      .from('payroll_history')
      .select(`*, employees(*)`)
      .eq('organization_id', organizationId)
      .gte('period_start', filterPeriod.start)
      .lte('period_end', filterPeriod.end)
      .order('created_at', { ascending: false });
    
    setRecords(data || []);
    setLoading(false);
  };

  // --- NEW: DELETE HANDLER ---
  const handleDelete = async (recordId, employeeName) => {
    const confirmed = window.confirm(
      `Warning: You are about to delete the payroll record for ${employeeName.toUpperCase()}.\n\nThis will permanently remove the record from history. Continue?`
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('payroll_history')
        .delete()
        .eq('id', recordId);

      if (error) throw error;

      // Update local state to remove the row without refreshing
      setRecords(prev => prev.filter(r => r.id !== recordId));
    } catch (err) {
      alert("Delete failed: " + err.message);
    }
  };

  const handleBulkPrint = () => {
    if (!orgData) return alert("Organization data still loading...");
    if (records.length === 0) return alert("No records found for this date range.");
    generateBulkPayslips(orgData, records);
  };

  if (loading) return <div style={{ padding: '30px', textAlign: 'center' }}>Loading Archive...</div>;

  return (
    <div style={{ maxWidth: '1200px', margin: 'auto' }}>
      <div style={filterBar}>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 'bold', fontSize: '0.8rem', color: '#475569' }}>BATCH FILTER:</span>
          <input type="date" value={filterPeriod.start} onChange={e => setFilterPeriod({...filterPeriod, start: e.target.value})} style={dateInput} />
          <input type="date" value={filterPeriod.end} onChange={e => setFilterPeriod({...filterPeriod, end: e.target.value})} style={dateInput} />
          
          <button onClick={handleSearch} style={searchBtn}>Search</button>
          
          <div style={{ borderLeft: '1px solid #e2e8f0', height: '30px', margin: '0 10px' }}></div>
          
          <button 
            onClick={handleBulkPrint} 
            style={records.length === 0 ? disabledBtn : activePrintBtn}
            disabled={records.length === 0}
          >
            Download Merged PDF ({records.length})
          </button>
        </div>
      </div>

      <div style={tableCard}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={theadStyle}>
              <th style={th}>Period</th>
              <th style={th}>Employee</th>
              <th style={th}>Net Pay</th>
              <th style={{ ...th, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.length > 0 ? (
              records.map(r => (
                <tr key={r.id} style={trStyle}>
                  <td style={td}>{r.period_start} to {r.period_end}</td>
                  <td style={td}><strong>{r.employees?.last_name?.toUpperCase()}, {r.employees?.first_name}</strong></td>
                  <td style={{ ...td, color: '#16a34a', fontWeight: 'bold' }}>₱{Number(r.net_pay).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td style={{ ...td, textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button onClick={() => generatePayslipPDF(orgData, r)} style={viewBtn}>View PDF</button>
                    {/* DELETE BUTTON */}
                    <button 
                      onClick={() => handleDelete(r.id, `${r.employees?.first_name} ${r.employees?.last_name}`)} 
                      style={deleteBtn}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No records found for the selected period.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// STYLES
const filterBar = { background: 'white', padding: '20px', borderRadius: '15px', marginBottom: '20px', display: 'flex', border: '1px solid #f1f5f9' };
const dateInput = { padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none' };
const searchBtn = { padding: '8px 16px', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' };
const activePrintBtn = { padding: '10px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' };
const disabledBtn = { ...activePrintBtn, background: '#e2e8f0', cursor: 'not-allowed' };
const tableCard = { background: 'white', borderRadius: '15px', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' };
const theadStyle = { background: '#f8fafc', textAlign: 'left', borderBottom: '2px solid #f1f5f9' };
const th = { padding: '15px', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' };
const td = { padding: '15px', fontSize: '0.9rem' };
const trStyle = { borderBottom: '1px solid #f1f5f9' };
const viewBtn = { padding: '6px 15px', background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' };
// NEW: Red Styled Delete Button
const deleteBtn = { padding: '6px 15px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fee2e2', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' };