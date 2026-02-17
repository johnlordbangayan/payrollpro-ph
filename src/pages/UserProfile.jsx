import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function UserProfile({ user, onLogout, onBack }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const LINKS = {
    monthly: "https://pm.link/org-FBfUS8Z3gwMcX9TwWS9jWhEV/XFLs85g",
    annual: "https://pm.link/org-FBfUS8Z3gwMcX9TwWS9jWhEV/cq2yQ9F",
    lifetime: "https://pm.link/org-FBfUS8Z3gwMcX9TwWS9jWhEV/7kTxttZ"
  };

  // --- 1. STABLE FETCH LOGIC ---
  const fetchProfile = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      if (data) setProfile(data);
    } catch (err) {
      console.error("Profile load error:", err);
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  // --- 2. TAB-FOCUS AUTO-SYNC ---
  useEffect(() => {
    fetchProfile();

    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        console.log("Tab focused: Checking for subscription updates...");
        fetchProfile(false); // Background refresh
      }
    };

    document.addEventListener('visibilitychange', handleFocus);
    return () => document.removeEventListener('visibilitychange', handleFocus);
  }, [fetchProfile]);

  const handlePurchase = (url) => {
    window.open(url, '_blank');
  };

  const handleContactSupport = () => {
    const subject = `Payment Proof - ${user.email}`;
    const body = `Hi Admin,\n\nI have paid for a subscription. Attached is my receipt.\n\nMy Email: ${user.email}`;
    window.location.href = `mailto:support@payrollpro.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  // --- 3. CALCULATE TRIAL & STATUS ---
  const trialDays = 10;
  const createdAt = new Date(user.created_at);
  const fallbackExpiry = new Date(createdAt.getTime() + trialDays * 24 * 60 * 60 * 1000);
  
  const expiryDate = profile?.subscription_end_date 
    ? new Date(profile.subscription_end_date) 
    : fallbackExpiry;

  const today = new Date();
  const subscriptionStatus = profile?.subscription_status; // 'monthly', 'annual', 'lifetime', or null
  const isLifetime = subscriptionStatus === 'lifetime';
  const isPaid = subscriptionStatus === 'monthly' || subscriptionStatus === 'annual';
  const isExpired = today > expiryDate && !isLifetime;
  
  const diffTime = expiryDate - today;
  const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // IMPROVED STATUS TEXT
  let statusText = 'ACTIVE TRIAL';
  if (isLifetime) statusText = 'LIFETIME ACCESS';
  else if (isExpired) statusText = 'EXPIRED';
  else if (isPaid) statusText = `${subscriptionStatus.toUpperCase()} MEMBER`;

  if (loading && !profile) {
    return <div style={{padding:'100px', textAlign:'center', color: '#64748b', fontWeight: 'bold'}}>Verifying Account Status...</div>;
  }

  return (
    <div style={container}>
      <div style={card}>
        {/* HEADER SECTION */}
        <div style={header}>
            <div style={avatarLarge}>{user.email[0].toUpperCase()}</div>
            <h2 style={{ margin: '15px 0 5px 0', color: '#1e293b', fontSize: '1.5rem' }}>{user.email}</h2>
            
            <div style={getStatusStyle(isExpired, profile?.subscription_status)}>
                {statusText}
            </div>
            
            {!isExpired && !isLifetime && (
                <p style={{color: '#64748b', marginTop: '12px', fontSize: '0.9rem'}}>
                    Your trial expires in: <strong style={{color: daysLeft < 3 ? '#ef4444' : '#1e293b'}}>{daysLeft} Days</strong>
                </p>
            )}
            {isLifetime && <p style={{color: '#10b981', marginTop: '12px', fontWeight: 'bold'}}>Premium Active Forever</p>}
        </div>

        <hr style={divider} />

        {/* PRICING PLANS */}
        {!isLifetime && (
            <>
                <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                    <h3 style={{ color: '#1e293b', marginBottom: '8px' }}>Choose Your Plan</h3>
                    <p style={instructionText}>
                       Secure payment via <strong>GCash, Maya, or Card</strong>. <br/>
                       Please use <strong>{user.email}</strong> at checkout for faster activation.
                    </p>
                </div>

                <div style={grid}>
                    <div style={planCard}>
                        <h4 style={planTitle}>Monthly</h4>
                        <div style={price}>₱499<small style={priceSub}>/mo</small></div>
                        <button onClick={() => handlePurchase(LINKS.monthly)} style={buyBtn}>Get Monthly</button>
                    </div>

                    <div style={{...planCard, borderColor: '#3b82f6', background: '#f8faff', transform: 'scale(1.02)'}}>
                        <div style={popularBadge}>MOST POPULAR</div>
                        <h4 style={planTitle}>Annual</h4>
                        <div style={price}>₱3,000<small style={priceSub}>/yr</small></div>
                        <p style={savingsText}>Save ₱2,988 vs monthly</p>
                        <button onClick={() => handlePurchase(LINKS.annual)} style={{...buyBtn, background: '#3b82f6', color: 'white'}}>Get Annual</button>
                    </div>

                    <div style={planCard}>
                        <h4 style={planTitle}>Lifetime</h4>
                        <div style={price}>₱5,000</div>
                        <p style={savingsText}>One-time payment</p>
                        <button onClick={() => handlePurchase(LINKS.lifetime)} style={buyBtn}>Get Lifetime</button>
                    </div>
                </div>
                
                <div style={supportBox}>
                    <div style={{ flex: 1 }}>
                        <strong>Need Help?</strong> Once paid, send your receipt to activate your account instantly.
                    </div>
                    <button onClick={handleContactSupport} style={contactBtn}>Email Receipt</button>
                </div>
            </>
        )}
        
        <div style={{marginTop: '40px', display: 'flex', flexDirection: 'column', gap: '10px'}}>
             {!isExpired && <button onClick={onBack} style={backBtn}>Back to Dashboard</button>}
             <button onClick={onLogout} style={logoutBtn}>Sign Out</button>
        </div>
      </div>
    </div>
  );
}

// --- STYLES ---
const container = { 
  padding: '40px 20px', 
  maxWidth: '900px', 
  margin: '0 auto',
  fontFamily: 'sans-serif' // <--- Add this to match SelectOrg.js
};
const card = { background: 'white', borderRadius: '24px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)', padding: '50px', border: '1px solid #f1f5f9' };
const header = { display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '10px' };
const avatarLarge = { width: '80px', height: '80px', borderRadius: '50%', background: '#3b82f6', color: 'white', fontSize: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', boxShadow: '0 4px 6px rgba(59, 130, 246, 0.3)' };
const divider = { border: '0', borderTop: '1px solid #f1f5f9', margin: '40px 0' };
const instructionText = { color: '#64748b', fontSize: '0.9rem', lineHeight: '1.6', margin: '0 auto' };
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' };
const planCard = { background: 'white', padding: '30px 20px', borderRadius: '16px', border: '2px solid #f1f5f9', textAlign: 'center', position: 'relative', transition: '0.3s' };
const planTitle = { margin: '0 0 10px 0', color: '#475569', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' };
const price = { fontSize: '1.8rem', fontWeight: '900', color: '#1e293b' };
const priceSub = { fontSize: '0.9rem', color: '#94a3b8', fontWeight: 'normal' };
const savingsText = { fontSize: '0.75rem', color: '#16a34a', margin: '8px 0', fontWeight: 'bold' };
const buyBtn = { width: '100%', padding: '12px', marginTop: '20px', borderRadius: '10px', border: '2px solid #3b82f6', background: 'transparent', color: '#3b82f6', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' };
const popularBadge = { position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: '#3b82f6', color: 'white', padding: '4px 14px', borderRadius: '20px', fontSize: '0.65rem', fontWeight: 'bold' };
const supportBox = { marginTop: '40px', background: '#f0f9ff', padding: '20px', borderRadius: '16px', fontSize: '0.85rem', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '20px', border: '1px solid #bae6fd' };
const contactBtn = { padding: '10px 20px', background: '#0369a1', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap' };
const logoutBtn = { width: '100%', padding: '14px', background: 'transparent', color: '#94a3b8', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9rem' };
const backBtn = { width: '100%', padding: '14px', background: '#1e293b', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9rem' };

const getStatusStyle = (isExpired, status) => {
    let bgColor = '#dcfce7'; 
    let color = '#166534';
    if (status === 'lifetime') { bgColor = '#dbeafe'; color = '#1e40af'; }
    else if (isExpired) { bgColor = '#fee2e2'; color = '#991b1b'; }

    return { background: bgColor, color: color, padding: '6px 16px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', marginTop: '8px' };
};