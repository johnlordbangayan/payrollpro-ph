import React from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';

export default function SelectOrg({ onCreateClick, onSelect }) {
  const { user, myOrganizations } = useAuth();

  const handleLogout = async () => {
  try {
    // 1. Try the official way
    await supabase.auth.signOut();
  } catch (err) {
    console.error("Supabase signout blocked, forcing local clear:", err);
  } finally {
    // 2. The Fail-Safe: Wipe everything from the browser's memory manually
    localStorage.clear();
    sessionStorage.clear();
    
    // 3. Force a hard redirect to the root (which will see no user and show Login)
    window.location.replace('/'); 
  }
};

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc', fontFamily: 'sans-serif', padding: '20px' }}>
      
      {/* DIAGNOSTIC HEADER */}
      <div style={{ width: '100%', maxWidth: '400px', backgroundColor: '#0f172a', color: '#38bdf8', padding: '12px', borderRadius: '8px 8px 0 0', fontSize: '0.7rem', borderBottom: '2px solid #38bdf8' }}>
        <div style={{ marginBottom: '4px' }}><strong>ACTIVE SESSION:</strong> {user?.email}</div>
        <div style={{ wordBreak: 'break-all', opacity: 0.8 }}>ID: {user?.id}</div>
      </div>

      <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '0 0 16px 16px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px', boxSizing: 'border-box' }}>
        <h2 style={{ textAlign: 'center', color: '#1e293b', marginTop: 0 }}>Select Organization</h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
          {myOrganizations.length > 0 ? (
            myOrganizations.map((org) => (
              <button 
                key={org.id} 
                onClick={() => onSelect(org)}
                style={{ 
                  padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', cursor: 'pointer', textAlign: 'left', 
                  backgroundColor: 'white', display: 'flex', alignItems: 'center', gap: '12px', transition: 'all 0.2s' 
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = '#2563eb';
                  e.currentTarget.style.backgroundColor = '#f8faff';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.backgroundColor = 'white';
                }}
              >
                <span style={{ fontSize: '1.2rem' }}>🏢</span>
                <span style={{ fontWeight: '600', color: '#334155' }}>{org.name}</span>
              </button>
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', border: '2px dashed #e2e8f0', borderRadius: '12px' }}>
              No organizations found.
            </div>
          )}

          <button
            onClick={onCreateClick}
            style={{ padding: '16px', border: 'none', borderRadius: '10px', backgroundColor: '#2563eb', color: 'white', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}
          >
            ➕ Create New Organization
          </button>

          <button
            onClick={handleLogout}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem', marginTop: '20px', textDecoration: 'underline' }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}