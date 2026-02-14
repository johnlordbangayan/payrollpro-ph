import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function AddEmployeeModal({ isOpen, onClose, onSave }) {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    middle_name: '',
    job_title: '',
    hourly_rate: '',
    // Removed 'employee_id_number' - Database handles it now!
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); 
    setLoading(true);

    // 1. Get the current Organization ID
    const { data: orgData } = await supabase.from('organizations').select('id').limit(1).single();
    
    if (!orgData) {
      alert("Error: No Organization found.");
      setLoading(false);
      return;
    }

    // 2. Insert into Supabase
    const { error } = await supabase.from('employees').insert([
      {
        organization_id: orgData.id,
        first_name: formData.first_name,
        last_name: formData.last_name,
        middle_name: formData.middle_name,
        job_title: formData.job_title,
        hourly_rate: parseFloat(formData.hourly_rate),
        employment_status: 'Active' // <--- Changed from is_active: true
      }
    ]);

    if (error) {
      alert('Error adding employee: ' + error.message);
    } else {
      onSave(); // Refresh the list
      onClose(); // Close modal
      // Reset form
      setFormData({ first_name: '', last_name: '', middle_name: '', job_title: '', hourly_rate: '' });
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center'
    }}>
      <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '8px', width: '400px', maxWidth: '90%' }}>
        <h2 style={{ marginTop: 0, color: '#0f172a' }}>Add New Employee</h2>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          
          {/* Note: Employee ID input is gone. The system will auto-assign "1", "2", "3"... */}

          <div style={{ display: 'flex', gap: '10px' }}>
            <input name="first_name" placeholder="First Name" value={formData.first_name} onChange={handleChange} required style={{ flex: 1, padding: '10px', border: '1px solid #ccc', borderRadius: '4px', color: '#000' }} />
            <input name="last_name" placeholder="Last Name" value={formData.last_name} onChange={handleChange} required style={{ flex: 1, padding: '10px', border: '1px solid #ccc', borderRadius: '4px', color: '#000' }} />
          </div>

          <input name="job_title" placeholder="Job Title / Position" value={formData.job_title} onChange={handleChange} style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '4px', color: '#000' }} />
          
          <input 
            name="hourly_rate" 
            type="number" 
            placeholder="Hourly Rate (₱)" 
            value={formData.hourly_rate} 
            onChange={handleChange} 
            required 
            style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '4px', color: '#000' }}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 15px', border: 'none', background: '#e2e8f0', cursor: 'pointer', borderRadius: '4px', color: '#000' }}>Cancel</button>
            <button type="submit" disabled={loading} style={{ padding: '10px 15px', border: 'none', background: '#2563eb', color: 'white', cursor: 'pointer', borderRadius: '4px' }}>
              {loading ? 'Saving...' : 'Save Employee'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}