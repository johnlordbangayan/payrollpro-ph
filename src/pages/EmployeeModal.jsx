import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function EmployeeModal({ organizationId, employee, onClose, onSuccess }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const isEdit = !!employee;

  const [formData, setFormData] = useState({
    employee_id_number: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    extension_name: '',
    email: '',
    phone_number: '',
    position: '',
    department: '',
    employment_status: 'Active',
    employment_type: 'Full-time',
    date_hired: new Date().toISOString().split('T')[0],
    salary_rate: '',
    tin_number: '',
    sss_number: '',
    philhealth_number: '',
    pagibig_number: ''
  });

  // --- CRASH PROTECTION: Handling the RPC and Initial Data ---
  useEffect(() => {
    if (isEdit && employee) {
      setFormData({ ...employee });
    } else {
      const getNextId = async () => {
        try {
          const { data, error } = await supabase.rpc('get_next_employee_number', { org_id: organizationId });
          
          // Defense: Check if data exists before calling .toString()
          if (!error && data !== null && data !== undefined) {
            setFormData(prev => ({ ...prev, employee_id_number: data.toString() }));
          } else {
            // Fallback: If DB function fails, leave empty for manual entry
            console.warn("RPC failed or returned null, defaulting to empty ID");
            setFormData(prev => ({ ...prev, employee_id_number: '' }));
          }
        } catch (err) {
          console.error("Critical error fetching ID:", err);
        }
      };
      getNextId();
    }
  }, [employee, organizationId, isEdit]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const executeSave = async () => {
    setLoading(true);
    try {
      if (isEdit) {
        // Strip out Supabase metadata before updating
        const { id, created_at, updated_at, organization_id, ...updateData } = formData;
        const { error } = await supabase.from('employees').update(updateData).eq('id', id);
        if (error) throw error;
      } else {
        // Insert new record with current organization_id
        const { error } = await supabase.from('employees').insert([{ ...formData, organization_id: organizationId }]);
        if (error) throw error;
      }
      onSuccess();
    } catch (err) {
      alert("Save failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={modalOverlay}>
      <div style={modalContent}>
        <div style={headerStyle}>
          <h2 style={{ margin: 0 }}>{isEdit ? 'Edit' : 'Add'} Employee</h2>
          <p style={{ color: '#64748b', margin: '5px 0' }}>Step {step} of 3</p>
          <div style={progressBar}><div style={{ ...progressFill, width: `${(step / 3) * 100}%` }}></div></div>
        </div>

        <div>
          {/* STEP 1: PERSONAL DETAILS */}
          {step === 1 && (
            <div style={sectionStyle}>
              <h3 style={sectionTitle}>👤 Personal Details</h3>
              <div style={formGrid}>
                <input name="first_name" placeholder="First Name *" required value={formData.first_name || ''} onChange={handleChange} style={inputStyle} />
                <input name="middle_name" placeholder="Middle Name" value={formData.middle_name || ''} onChange={handleChange} style={inputStyle} />
                <input name="last_name" placeholder="Last Name *" required value={formData.last_name || ''} onChange={handleChange} style={inputStyle} />
                <input name="extension_name" placeholder="Ext. (Jr, III)" value={formData.extension_name || ''} onChange={handleChange} style={inputStyle} />
                <input name="email" type="email" placeholder="Email Address" value={formData.email || ''} onChange={handleChange} style={inputStyle} />
                <input name="phone_number" placeholder="Phone Number" value={formData.phone_number || ''} onChange={handleChange} style={inputStyle} />
              </div>
            </div>
          )}

          {/* STEP 2: EMPLOYMENT DETAILS */}
          {step === 2 && (
            <div style={sectionStyle}>
              <h3 style={sectionTitle}>💼 Employment Details</h3>
              <div style={formGrid}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={labelStyle}>Employee ID</label>
                  <input name="employee_id_number" value={formData.employee_id_number || ''} onChange={handleChange} style={inputStyle} placeholder="Auto-generated or Manual" />
                </div>
                <input name="position" placeholder="Position" value={formData.position || ''} onChange={handleChange} style={inputStyle} />
                <input name="department" placeholder="Department" value={formData.department || ''} onChange={handleChange} style={inputStyle} />
                
                <select name="employment_status" value={formData.employment_status || 'Active'} onChange={handleChange} style={inputStyle}>
                  <option value="Active">Active</option>
                  <option value="Terminated">Terminated</option>
                  <option value="Resigned">Resigned</option>
                </select>
                <select name="employment_type" value={formData.employment_type || 'Full-time'} onChange={handleChange} style={inputStyle}>
                  <option value="Full-time">Full-time</option>
                  <option value="Part-time">Part-time</option>
                  <option value="Contract">Contract</option>
                </select>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={labelStyle}>Date Hired</label>
                  <input name="date_hired" type="date" value={formData.date_hired || ''} onChange={handleChange} style={inputStyle} />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: FINANCIALS & IDS */}
          {step === 3 && (
            <div style={sectionStyle}>
              <h3 style={sectionTitle}>🏦 Financials & Government IDs</h3>
              <div style={formGrid}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={labelStyle}>Monthly Salary Rate (₱)</label>
                  <input name="salary_rate" type="number" placeholder="0.00" value={formData.salary_rate || ''} onChange={handleChange} style={inputStyle} />
                </div>
                <input name="tin_number" placeholder="TIN Number" value={formData.tin_number || ''} onChange={handleChange} style={inputStyle} />
                <input name="sss_number" placeholder="SSS Number" value={formData.sss_number || ''} onChange={handleChange} style={inputStyle} />
                <input name="philhealth_number" placeholder="PhilHealth Number" value={formData.philhealth_number || ''} onChange={handleChange} style={inputStyle} />
                <input name="pagibig_number" placeholder="Pag-IBIG Number" value={formData.pagibig_number || ''} onChange={handleChange} style={inputStyle} />
              </div>
            </div>
          )}

          {/* NAVIGATION BUTTONS */}
          <div style={buttonRow}>
            {step > 1 && (
              <button type="button" onClick={() => setStep(step - 1)} style={secondaryBtn}>Back</button>
            )}
            {step === 1 && (
               <button type="button" onClick={onClose} style={cancelBtn}>Cancel</button>
            )}

            {step < 3 ? (
              <button type="button" onClick={() => setStep(step + 1)} style={primaryBtn}>Next</button>
            ) : (
              <button type="button" onClick={executeSave} disabled={loading} style={saveBtn}>
                {loading ? 'Saving...' : isEdit ? 'Update Changes' : 'Finish & Save'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- STYLES (REMAINING UNCHANGED) ---
const modalOverlay = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' };
const modalContent = { backgroundColor: 'white', padding: '30px', borderRadius: '16px', width: '550px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' };
const headerStyle = { marginBottom: '25px' };
const progressBar = { width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '10px', marginTop: '10px', overflow: 'hidden' };
const progressFill = { height: '100%', backgroundColor: '#2563eb', transition: 'width 0.3s ease' };
const sectionStyle = { minHeight: '280px' };
const sectionTitle = { fontSize: '1.1rem', color: '#1e293b', marginBottom: '15px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' };
const formGrid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' };
const inputStyle = { padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%', boxSizing: 'border-box', outline: 'none' };
const labelStyle = { display: 'block', fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', marginBottom: '5px' };
const buttonRow = { display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '30px' };
const primaryBtn = { padding: '12px 24px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' };
const saveBtn = { padding: '12px 24px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' };
const secondaryBtn = { padding: '12px 24px', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '8px', cursor: 'pointer' };
const cancelBtn = { padding: '12px 24px', backgroundColor: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '8px', cursor: 'pointer' };