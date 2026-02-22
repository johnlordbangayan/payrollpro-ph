import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

export default function CreateOrg({ onCancel }) {
  const { user, refreshOrgs, setOrganization } = useAuth();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError('');

    try {
      // 1. Insert the Organization
      const { data: newOrg, error: orgError } = await supabase
        .from('organizations')
        .insert([{ name: name.trim() }])
        .select()
        .single();

      if (orgError) throw orgError;

      // 2. Link the current user as the 'owner'
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert([{
          organization_id: newOrg.id,
          user_id: user.id,
          role: 'owner'
        }]);

      if (memberError) throw memberError;

      // 3. Refresh the list in AuthContext and auto-select the new org
      const updatedOrgs = await refreshOrgs();
      
      // Find the newly created org in the refreshed list and select it
      if (updatedOrgs) {
        const created = updatedOrgs.find(o => o.id === newOrg.id);
        if (created) setOrganization(created);
      }

    } catch (err) {
      console.error("Creation failed:", err);
      setError(err.message || "Failed to create organization. Please try again.");
    } finally {
      // Ensuring button is never stuck in "Setting up..." state
      setLoading(false);
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc', fontFamily: 'sans-serif' }}>
      <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', width: '100%', maxWidth: '450px' }}>
        <h2 style={{ textAlign: 'center', color: '#1e293b', marginBottom: '8px' }}>Create Organization</h2>
        <p style={{ textAlign: 'center', color: '#64748b', marginBottom: '32px' }}>Set up your workspace and start your 15-day trial.</p>

        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: '600', color: '#475569' }}>Company Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Corp"
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '1rem' }}
            />
          </div>

          {error && <div style={{ color: '#ef4444', fontSize: '0.85rem', textAlign: 'center' }}>❌ {error}</div>}

          <button
            type="submit"
            disabled={loading}
            style={{ 
              padding: '14px', 
              backgroundColor: '#16a34a', 
              color: 'white', 
              border: 'none', 
              borderRadius: '8px', 
              cursor: loading ? 'not-allowed' : 'pointer', 
              fontWeight: 'bold', 
              fontSize: '1rem' 
            }}
          >
            {loading ? 'Setting up...' : '🚀 Start 15-Day Free Trial'}
          </button>

          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.9rem' }}
          >
            Go Back
          </button>
        </form>
      </div>
    </div>
  );
}