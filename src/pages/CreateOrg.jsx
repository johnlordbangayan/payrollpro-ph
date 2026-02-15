import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

export default function CreateOrg({ onCancel, onSuccess }) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim() || !user) return;

    setLoading(true);

    try {
      // 1. Insert the Organization
      // We use .select() to get the ID back immediately
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert([{ name: name.trim() }])
        .select()
        .single();

      if (orgError) {
        console.error("Org Creation Error:", orgError);
        alert(orgError.message);
        return; // This will trigger the 'finally' block
      }

      // 2. Link the member
      // We don't 'await' this strictly to avoid a second hang point
      // If the org was created, we move fast.
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

      // 3. SUCCESS NAVIGATION
      // We call onSuccess() immediately after the attempts.
      onSuccess();
      
    } catch (err) {
      // This catches CSP violations or network interruptions
      console.error("Critical Failure in CreateOrg:", err);
      alert("An unexpected error occurred. Please check your connection.");
    } finally {
      // CRITICAL: This kills the 'Creating...' state even if the script crashed
      setLoading(false);
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc', fontFamily: 'sans-serif' }}>
      <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', width: '100%', maxWidth: '400px' }}>
        <h2 style={{ textAlign: 'center', color: '#1e293b' }}>Create Organization</h2>
        <p style={{ textAlign: 'center', color: '#64748b', marginBottom: '24px' }}>Set up your workspace to get started.</p>

        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <input
            type="text"
            placeholder="Company Name (e.g. GJ SAVE OIL INC.)"
            required
            disabled={loading}
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{ 
              padding: '14px', 
              backgroundColor: loading ? '#94a3b8' : '#16a34a', 
              color: 'white', 
              border: 'none', 
              borderRadius: '8px', 
              cursor: loading ? 'not-allowed' : 'pointer', 
              fontWeight: 'bold' 
            }}
          >
            {loading ? 'Creating Workspace...' : '🚀 Start 15-Day Free Trial'}
          </button>

          {!loading && (
            <button
              type="button"
              onClick={onCancel}
              style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Cancel
            </button>
          )}
        </form>
      </div>
    </div>
  );
}