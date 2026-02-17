import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

export default function CreateOrg({ onCancel, onSuccess }) {
  // --- ADDED refreshOrgs HERE ---
  const { user, refreshOrgs } = useAuth(); 
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim() || !user) return;

    setLoading(true);

    try {
      // 1. Insert the Organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert([{ name: name.trim() }])
        .select()
        .single();

      if (orgError) {
        console.error("Org Creation Error:", orgError);
        alert(orgError.message);
        setLoading(false);
        return; 
      }

      // 2. Link the user as the Owner
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert([{
          organization_id: org.id,
          user_id: user.id,
          role: 'owner'
        }]);

      if (memberError) {
        console.error("Member Link Error:", memberError);
      }

      // --- CRITICAL FIX: Refresh the AuthContext list before calling onSuccess ---
      if (refreshOrgs) {
        await refreshOrgs(); 
      }

      // 3. SUCCESS NAVIGATION
      onSuccess();
      
    } catch (err) {
      console.error("Critical Failure in CreateOrg:", err);
      alert("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={{ fontSize: '2.5rem', textAlign: 'center', marginBottom: '10px' }}>🏢</div>
        <h2 style={{ textAlign: 'center', color: '#1e293b', marginTop: 0 }}>Create Organization</h2>
        <p style={{ textAlign: 'center', color: '#64748b', marginBottom: '24px', fontSize: '0.9rem' }}>
          Enter your company name to set up your payroll workspace.
        </p>

        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#475569' }}>Company Name</label>
            <input
              type="text"
              placeholder="e.g. GJ SAVE OIL INC."
              required
              disabled={loading}
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ 
              ...buttonStyle,
              backgroundColor: loading ? '#94a3b8' : '#3b82f6',
              cursor: loading ? 'not-allowed' : 'pointer', 
            }}
          >
            {loading ? 'Creating Workspace...' : 'Create Workspace'}
          </button>

          {!loading && (
            <button
              type="button"
              onClick={onCancel}
              style={cancelButtonStyle}
            >
              Back to selection
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

// --- STYLES (Unchanged) ---
const containerStyle = { height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f5f9', fontFamily: 'Inter, system-ui, sans-serif' };
const cardStyle = { backgroundColor: 'white', padding: '40px', borderRadius: '24px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', width: '100%', maxWidth: '420px' };
const inputStyle = { width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '1rem', outlineColor: '#3b82f6' };
const buttonStyle = { padding: '14px', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '1rem', transition: 'all 0.2s', marginTop: '10px' };
const cancelButtonStyle = { background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.9rem', marginTop: '10px', fontWeight: '500' };