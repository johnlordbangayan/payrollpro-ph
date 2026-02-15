import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function LoanManager({ organizationId }) {
  const [loans, setLoans] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Drill-down State
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [newLoan, setNewLoan] = useState({ employee_id: '', amount: '', monthly_installment: '', description: '' });

  const fetchLoans = async () => {
    setLoading(true);
    const { data } = await supabase.from('loan_details').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false });
    setLoans(data || []);
    setLoading(false);
  };

  const fetchEmployees = async () => {
    const { data } = await supabase.from('employees').select('id, first_name, last_name').eq('organization_id', organizationId).eq('employment_status', 'Active');
    setEmployees(data || []);
  };

  const fetchPaymentHistory = async (empId) => {
    setLoadingHistory(true);
    const { data } = await supabase
      .from('loan_payments_history')
      .select('*')
      .eq('employee_id', empId)
      .order('period_end', { ascending: false });
    setPaymentHistory(data || []);
    setLoadingHistory(false);
  };

  useEffect(() => {
    fetchLoans();
    fetchEmployees();
  }, [organizationId]);

  const handleViewHistory = (loan) => {
    setSelectedLoan(loan);
    fetchPaymentHistory(loan.employee_id);
  };

  const handleAddLoan = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('loans').insert([{
      ...newLoan,
      organization_id: organizationId,
      balance: parseFloat(newLoan.amount),
      monthly_installment: parseFloat(newLoan.monthly_installment) || 0,
      is_active: true
    }]);
    if (error) alert(error.message);
    else { setShowAdd(false); setNewLoan({ employee_id: '', amount: '', monthly_installment: '', description: '' }); fetchLoans(); }
  };

  const filteredLoans = loans.filter(l => `${l.first_name} ${l.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div style={{ maxWidth: '1200px', margin: 'auto', padding: '20px' }}>
      {/* HEADER & ADD FORM (Same as previous) */}
      <div style={header}>
        <div>
          <h2 style={{ margin: 0 }}>💰 Loan Ledger (Vale)</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Click an employee to view payment history.</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} style={addBtn}>{showAdd ? 'Cancel' : '+ New Loan Entry'}</button>
      </div>

      {showAdd && (
        <form onSubmit={handleAddLoan} style={formCard}>
          <div style={formGrid}>
            <select value={newLoan.employee_id} onChange={e => setNewLoan({...newLoan, employee_id: e.target.value})} style={input} required>
              <option value="">Select Employee...</option>
              {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.last_name}, {emp.first_name}</option>)}
            </select>
            <input type="number" placeholder="Total Amount (₱)" value={newLoan.amount} onChange={e => setNewLoan({...newLoan, amount: e.target.value})} style={input} required />
            <input type="number" placeholder="Installment (₱)" value={newLoan.monthly_installment} onChange={e => setNewLoan({...newLoan, monthly_installment: e.target.value})} style={input} required />
            <input type="text" placeholder="Description" value={newLoan.description} onChange={e => setNewLoan({...newLoan, description: e.target.value})} style={input} />
          </div>
          <button type="submit" style={submitBtn}>Create & Activate Loan</button>
        </form>
      )}

      {/* TABLE */}
      <div style={tableWrapper}>
        <table style={table}>
          <thead>
            <tr style={thead}>
              <th style={th}>Employee</th>
              <th style={th}>Original</th>
              <th style={th}>Remaining</th>
              <th style={th}>Installment</th>
              <th style={th}>Status</th>
              <th style={th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredLoans.map(loan => (
              <tr key={loan.id} style={tr}>
                <td style={td}><strong>{loan.last_name}, {loan.first_name}</strong></td>
                <td style={td}>₱{loan.original_amount.toLocaleString()}</td>
                <td style={{...td, color: loan.current_balance > 0 ? '#ef4444' : '#10b981', fontWeight: 'bold'}}>
                    ₱{loan.current_balance.toLocaleString()}
                </td>
                <td style={td}>₱{loan.monthly_installment.toLocaleString()}</td>
                <td style={td}><span style={loan.is_active ? activeBadge : paidBadge}>{loan.is_active ? 'ACTIVE' : 'PAID'}</span></td>
                <td style={td}>
                  <button onClick={() => handleViewHistory(loan)} style={historyBtn}>View History</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* PAYMENT HISTORY MODAL */}
      {selectedLoan && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <div style={modalHeader}>
              <h3>Payment History: {selectedLoan.first_name} {selectedLoan.last_name}</h3>
              <button onClick={() => setSelectedLoan(null)} style={closeBtn}>✕</button>
            </div>
            <div style={{ padding: '20px' }}>
              {loadingHistory ? <p>Loading history...</p> : (
                <table style={historyTable}>
                  <thead>
                    <tr style={thead}>
                      <th style={th}>Payroll Period</th>
                      <th style={th}>Date Paid</th>
                      <th style={th}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentHistory.length > 0 ? paymentHistory.map(pay => (
                      <tr key={pay.payment_id}>
                        <td style={td}>{pay.period_start} to {pay.period_end}</td>
                        <td style={td}>{new Date(pay.transaction_date).toLocaleDateString()}</td>
                        <td style={{...td, color: '#059669', fontWeight: 'bold'}}>₱{pay.amount_paid.toLocaleString()}</td>
                      </tr>
                    )) : <tr><td colSpan="3" style={{padding: '20px', textAlign: 'center'}}>No payments recorded yet.</td></tr>}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- NEW STYLES FOR DRILL-DOWN ---
const historyBtn = { background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' };
const modalOverlay = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 };
const modalContent = { background: 'white', width: '600px', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' };
const modalHeader = { padding: '20px', background: '#1e293b', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const closeBtn = { background: 'transparent', border: 'none', color: 'white', fontSize: '1.2rem', cursor: 'pointer' };
const historyTable = { width: '100%', borderCollapse: 'collapse' };

// (Previous styles for table, header, badges remain same)
const header = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' };
const addBtn = { background: '#1e293b', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' };
const formCard = { background: 'white', padding: '25px', borderRadius: '16px', marginBottom: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' };
const formGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' };
const input = { padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.9rem' };
const submitBtn = { width: '100%', background: '#2563eb', color: 'white', border: 'none', padding: '14px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' };
const tableWrapper = { background: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' };
const table = { width: '100%', borderCollapse: 'collapse' };
const thead = { background: '#f8fafc', borderBottom: '1px solid #e2e8f0' };
const th = { padding: '15px', textAlign: 'left', fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' };
const td = { padding: '15px', borderBottom: '1px solid #f8fafc', fontSize: '0.85rem' };
const tr = { transition: 'background 0.2s' };
const activeBadge = { background: '#fef2f2', color: '#991b1b', padding: '4px 10px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: '800' };
const paidBadge = { background: '#f0fdf4', color: '#166534', padding: '4px 10px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: '800' };