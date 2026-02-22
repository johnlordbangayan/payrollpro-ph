import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

export default function AddEmployeeModal({ isOpen, onClose, onSave }) {
  // Access the organization details from the global Auth Context
  const { organization } = useAuth(); 
  
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    middle_name: '',
    job_title: '',
    hourly_rate: '',
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); 
    setLoading(true); // Button changes to "Saving..."

    try {
      // 1. Validate that the Organization ID exists
      if (!organization?.id) {
        throw new Error("No active Organization found. Please re-login.");
      }

      // 2. Insert the record into Supabase
      const { error } = await supabase.from('employees').insert([
        {
          organization_id: organization.id, // Links to your current company
          first_name: formData.first_name,
          last_name: formData.last_name,
          middle_name: formData.middle_name,
          job_title: formData.job_title,
          hourly_rate: parseFloat(formData.hourly_rate),
          employment_status: 'Active'
        }
      ]);

      // If the database returns an error (like a duplicate ID), jump to the catch block
      if (error) throw error; 

      // 3. If successful: Refresh, Close, and Reset
      onSave();
      onClose();
      setFormData({ first_name: '', last_name: '', middle_name: '', job_title: '', hourly_rate: '' });

    } catch (err) {
      // Display the specific database error to the user
      alert('Error: ' + err.message);
    } finally {
      // IMPORTANT: This un-freezes the "Saving..." button regardless of success or failure
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
    }}>
      <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '8px', width: '400px', maxWidth: '90%' }}>
        <h2 style={{ marginTop: 0, color: '#0f172a' }}>Add New Employee</h2>
        
        {/* Visual confirmation of the organization context */}
        <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '15px' }}>
          Registering to: <strong>{organization?.name}</strong>
        </p>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input 
              name="first_name" 
              placeholder="First Name" 
              value={formData.first_name} 
              onChange={handleChange} 
              required 
              style={{ flex: 1, padding: '10px', border: '1px solid #ccc', borderRadius: '4px', color: '#000' }} 
            />
            <input 
              name="last_name" 
              placeholder="Last Name" 
              value={formData.last_name} 
              onChange={handleChange} 
              required 
              style={{ flex: 1, padding: '10px', border: '1px solid #ccc', borderRadius: '4px', color: '#000' }} 
            />
          </div>

          <input 
            name="middle_name" 
            placeholder="Middle Name (Optional)" 
            value={formData.middle_name} 
            onChange={handleChange} 
            style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '4px', color: '#000' }} 
          />

          <input 
            name="job_title" 
            placeholder="Job Title / Position" 
            value={formData.job_title} 
            onChange={handleChange} 
            style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '4px', color: '#000' }} 
          />
          
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
            <button 
              type="button" 
              onClick={onClose} 
              style={{ padding: '10px 15px', border: 'none', background: '#e2e8f0', cursor: 'pointer', borderRadius: '4px', color: '#000' }}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading} 
              style={{ 
                padding: '10px 15px', 
                border: 'none', 
                background: loading ? '#94a3b8' : '#2563eb', 
                color: 'white', 
                cursor: loading ? 'not-allowed' : 'pointer', 
                borderRadius: '4px' 
              }}
            >
              {loading ? 'Saving...' : 'Save Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}