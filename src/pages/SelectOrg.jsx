import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import UserProfile from './UserProfile'; 

export default function SelectOrg({ onCreateClick, onSelect }) {
  const { user, myOrganizations } = useAuth();
  const [showSettings, setShowSettings] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [dbStatus, setDbStatus] = useState({ status: 'trial', daysLeft: 0 });

  // Determine if the account is effectively "locked"
  const isLocked = dbStatus.status !== 'lifetime' && dbStatus.daysLeft <= 0;

  useEffect(() => {
    async function getSubscription() {
      if (!user?.id) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('subscription_status, subscription_end_date')
        .eq('id', user.id)
        .single();

      if (data) {
        const expiry = new Date(data.subscription_end_date);
        const now = new Date();
        const diffTime = expiry - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        setDbStatus({
          status: data.subscription_status || 'trial',
          daysLeft: diffDays > 0 ? diffDays : 0
        });
      }
    }
    getSubscription();
  }, [user, isProfileOpen]);

  const handleLogout = async () => {
    try { await supabase.auth.signOut(); } 
    catch (err) { console.error("Signout blocked:", err); } 
    finally {
      localStorage.clear();
      sessionStorage.clear();
      window.location.replace('/'); 
    }
  };

  if (isProfileOpen) {
    return (
      <div style={overlayStyle}>
        <div style={profileHeaderStyle}>
          <button onClick={() => setIsProfileOpen(false)} style={backBtnStyle}>
            ← Back to Selection
          </button>
        </div>
        <UserProfile user={user} onBack={() => setIsProfileOpen(false)} onLogout={handleLogout} />
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={topNavStyle}>
        <div style={profileCircleStyle} onClick={() => setShowSettings(!showSettings)}>
          {user?.email?.charAt(0).toUpperCase() || '👤'}
        </div>
        {showSettings && (
          <div style={settingsDropdownStyle}>
            <div style={dropdownItemHeader}>{user?.email}</div>
            <div style={dividerStyle} />
            <button style={dropdownItemStyle} onClick={() => { setIsProfileOpen(true); setShowSettings(false); }}>
              ⚙️ Account Settings
            </button>
            <button style={{...dropdownItemStyle, color: '#ef4444'}} onClick={handleLogout}>
              🚪 Sign Out
            </button>
          </div>
        )}
      </div>

      {/* RENEWAL / EXPIRED BANNER */}
      {dbStatus.status !== 'lifetime' && dbStatus.daysLeft <= 3 && (
        <div style={isLocked ? expiredBannerStyle : warningBannerStyle}>
          <span>
            {isLocked ? "🚨 Access Expired! Please renew to access your data." : `⚠️ Access expires in ${dbStatus.daysLeft} days.`}
          </span>
          <button style={renewBtnStyle} onClick={() => setIsProfileOpen(true)}>
            Renew Now
          </button>
        </div>
      )}

      <div style={diagnosticHeader}>
        <div><strong>ACTIVE SESSION:</strong> {user?.email}</div>
      </div>

      <div style={cardStyle}>
        <div style={statusBadgeContainer}>
          {dbStatus.status === 'lifetime' ? (
            <div style={memberBadgeStyle}>💎 Lifetime Member</div>
          ) : dbStatus.status === 'annual' || dbStatus.status === 'monthly' ? (
            <div style={memberBadgeStyle}>✅ Active Member ({dbStatus.daysLeft} days left)</div>
          ) : (
            <div style={dbStatus.daysLeft === 0 ? expiredBadgeStyle : trialBadgeStyle}>
              {dbStatus.daysLeft === 0 ? "❌ Trial Expired" : `⏳ Trial: ${dbStatus.daysLeft} days left`}
            </div>
          )}
        </div>

        <h2 style={{ textAlign: 'center', color: '#1e293b', marginTop: '10px' }}>Select Organization</h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
          {myOrganizations.length > 0 ? (
            myOrganizations.map((org) => (
              <button 
                key={org.id} 
                onClick={() => !isLocked && onSelect(org)} // Block click if locked
                style={isLocked ? lockedOrgButtonStyle : orgButtonStyle}
                disabled={isLocked}
              >
                <span style={{ fontSize: '1.2rem' }}>{isLocked ? '🔒' : '🏢'}</span>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span style={{ fontWeight: '600', color: isLocked ? '#94a3b8' : '#334155' }}>{org.name}</span>
                    {isLocked && <span style={{ fontSize: '0.7rem', color: '#cbd5e1' }}>Locked - Renew to open</span>}
                </div>
              </button>
            ))
          ) : (
            <div style={noOrgsStyle}>No organizations found.</div>
          )}
          
          <button 
            onClick={!isLocked ? onCreateClick : () => setIsProfileOpen(true)} 
            style={isLocked ? lockedCreateBtnStyle : createBtnStyle}
          >
            {isLocked ? '🔒 Renew Access to Create' : '➕ Create New Organization'}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- UPDATED STYLES FOR LOCKED STATE ---
const containerStyle = { minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc', padding: '20px', fontFamily: 'sans-serif' };
const warningBannerStyle = { width: '100%', maxWidth: '400px', backgroundColor: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '12px', padding: '12px 16px', marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: '#92400e' };
const expiredBannerStyle = { ...warningBannerStyle, backgroundColor: '#fef2f2', border: '1px solid #fee2e2', color: '#991b1b' };
const renewBtnStyle = { backgroundColor: '#2563eb', color: 'white', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' };
const orgButtonStyle = { padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', cursor: 'pointer', textAlign: 'left', backgroundColor: 'white', display: 'flex', alignItems: 'center', gap: '12px', width: '100%', marginBottom: '8px' };
const lockedOrgButtonStyle = { ...orgButtonStyle, backgroundColor: '#f1f5f9', cursor: 'not-allowed', borderColor: '#e2e8f0', opacity: 0.8 };
const createBtnStyle = { padding: '16px', border: 'none', borderRadius: '10px', backgroundColor: '#2563eb', color: 'white', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' };
const lockedCreateBtnStyle = { ...createBtnStyle, backgroundColor: '#94a3b8', cursor: 'pointer' }; // Kept clickable but goes to renewal
const expiredBadgeStyle = { backgroundColor: '#fee2e2', color: '#991b1b', padding: '6px 12px', borderRadius: '20px', fontSize: '0.8rem', border: '1px solid #fecaca' };
const memberBadgeStyle = { backgroundColor: '#f0fdf4', color: '#15803d', padding: '6px 12px', borderRadius: '20px', fontSize: '0.8rem', border: '1px solid #dcfce7' };
const trialBadgeStyle = { backgroundColor: '#fff7ed', color: '#c2410c', padding: '6px 12px', borderRadius: '20px', fontSize: '0.8rem', border: '1px solid #ffedd5' };
// ... (Rest of styles remain same as previous version)
const topNavStyle = { position: 'fixed', top: '20px', right: '20px', zIndex: 1000 };
const profileCircleStyle = { width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#2563eb', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', border: '2px solid white' };
const settingsDropdownStyle = { position: 'absolute', top: '50px', right: '0', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', width: '220px', padding: '8px', border: '1px solid #e2e8f0' };
const dropdownItemHeader = { padding: '12px', fontSize: '0.75rem', color: '#64748b', wordBreak: 'break-all' };
const dropdownItemStyle = { width: '100%', padding: '10px 12px', textAlign: 'left', background: 'none', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', color: '#334155' };
const dividerStyle = { height: '1px', backgroundColor: '#e2e8f0', margin: '4px 0' };
const diagnosticHeader = { width: '100%', maxWidth: '400px', backgroundColor: '#0f172a', color: '#38bdf8', padding: '10px', borderRadius: '8px 8px 0 0', fontSize: '0.7rem' };
const cardStyle = { backgroundColor: 'white', padding: '30px', borderRadius: '0 0 16px 16px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px' };
const noOrgsStyle = { textAlign: 'center', padding: '24px', color: '#94a3b8', border: '2px dashed #e2e8f0', borderRadius: '12px' };
const statusBadgeContainer = { display: 'flex', justifyContent: 'center', marginBottom: '15px' };
const overlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#f8fafc', zIndex: 2000, overflowY: 'auto', padding: '40px' };
const profileHeaderStyle = { maxWidth: '800px', margin: '0 auto 20px auto' };
const backBtnStyle = { background: 'none', border: 'none', color: '#2563eb', fontWeight: '600', cursor: 'pointer' };