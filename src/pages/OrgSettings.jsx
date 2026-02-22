import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function OrgSettings({ org, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    name: '',
    tin: '',
    address: '',
    working_days_per_year: 313,
    deduction_labels: [],
    addition_labels: []
  });

  // Keep local state in sync if the 'org' prop updates
  useEffect(() => {
    if (org) {
      setSettings({
        name: org.name || '',
        tin: org.tin || '',
        address: org.address || '',
        working_days_per_year: org.working_days_per_year || 313,
        deduction_labels: org.deduction_labels || ["Short", "Cash Bond", "Deduction 3", "Deduction 4", "Deduction 5"],
        addition_labels: org.addition_labels || ["Add Pay 1", "Add Pay 2", "Add Pay 3"]
      });
    }
  }, [org]);

  const handleLabelChange = (type, index, value) => {
    const key = type === 'deduction' ? 'deduction_labels' : 'addition_labels';
    const newList = [...settings[key]];
    newList[index] = value;
    setSettings(prev => ({ ...prev, [key]: newList }));
  };

  const handleSave = async () => {
    if (loading) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('organizations')
        .update({
          name: settings.name,
          tin: settings.tin,
          address: settings.address,
          working_days_per_year: settings.working_days_per_year,
          deduction_labels: settings.deduction_labels,
          addition_labels: settings.addition_labels
        })
        .eq('id', org.id)
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error("Update failed: No rows returned. Check RLS policies.");
      }
      
      onUpdate(data[0]); 
      alert("✨ Company Profile updated successfully!");
    } catch (err) {
      console.error("Settings Save Error:", err);
      alert("Failed to save: " + (err.message || "Unknown Database Error"));
    } finally {
      setLoading(false); 
    }
  };

  return (
    <div style={containerStyle}>
      <div style={{ borderBottom: '2px solid #f1f5f9', marginBottom: '30px', paddingBottom: '10px' }}>
        <h2 style={{ margin: 0, color: '#1e293b' }}>⚙️ Company Configuration</h2>
        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Manage company details, payroll factors, and label definitions.</p>
      </div>

      {/* --- NEW: COMPANY PROFILE SECTION --- */}
      <section style={sectionStyle}>
        <h3 style={sectionTitle}>🏢 Company Profile</h3>
        <p style={subText}>These details will appear on your BIR Forms and Payslips.</p>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '15px' }}>
            <div>
                <label style={labelStyle}>Company / Taxpayer Name</label>
                <input 
                    value={settings.name} 
                    onChange={e => setSettings({...settings, name: e.target.value})}
                    placeholder="e.g. JL Solutions Inc."
                    style={mainInputStyle} 
                />
            </div>
            <div>
                <label style={labelStyle}>Tax Identification No. (TIN)</label>
                <input 
                    value={settings.tin} 
                    onChange={e => setSettings({...settings, tin: e.target.value})}
                    placeholder="000-000-000-000"
                    style={mainInputStyle} 
                />
            </div>
        </div>
        <div>
            <label style={labelStyle}>Registered Address</label>
            <textarea 
                value={settings.address} 
                onChange={e => setSettings({...settings, address: e.target.value})}
                placeholder="Complete Business Address (City, Zip Code)"
                rows="2"
                style={{...mainInputStyle, resize: 'none'}} 
            />
        </div>
      </section>
      
      {/* --- PAYROLL FACTOR --- */}
      <section style={sectionStyle}>
        <h3 style={sectionTitle}>📅 Payroll Factor</h3>
        <p style={subText}>Used to calculate Daily Rate: (Monthly Rate * 12) / Factor</p>
        <div style={{ display: 'flex', gap: '20px' }}>
          <label style={settings.working_days_per_year === 313 ? activeRadio : radioStyle}>
            <input 
              type="radio" 
              name="days"
              checked={settings.working_days_per_year === 313} 
              onChange={() => setSettings({...settings, working_days_per_year: 313})} 
            />
            <div>
                <div style={{fontWeight:'bold'}}>6 Days / Week</div>
                <div style={{fontSize:'0.8rem', color:'#64748b'}}>Factor: 313 Days</div>
            </div>
          </label>
          <label style={settings.working_days_per_year === 261 ? activeRadio : radioStyle}>
            <input 
              type="radio" 
              name="days"
              checked={settings.working_days_per_year === 261} 
              onChange={() => setSettings({...settings, working_days_per_year: 261})} 
            />
            <div>
                <div style={{fontWeight:'bold'}}>5 Days / Week</div>
                <div style={{fontSize:'0.8rem', color:'#64748b'}}>Factor: 261 Days</div>
            </div>
          </label>
        </div>
      </section>

      {/* --- LABELS --- */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
        <section>
          <h3 style={sectionTitle}>Deduction Slots</h3>
          <p style={subText}>Rename your 5 custom deduction fields.</p>
          {settings.deduction_labels.map((label, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
              <span style={slotTag}>{i + 1}</span>
              <input 
                value={label} 
                placeholder={`Slot ${i+1}`}
                onChange={(e) => handleLabelChange('deduction', i, e.target.value)} 
                style={inputStyle} 
              />
            </div>
          ))}
        </section>

        <section>
          <h3 style={sectionTitle}>Addition Slots</h3>
          <p style={subText}>Rename your 3 custom allowance fields.</p>
          {settings.addition_labels.map((label, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
              <span style={slotTag}>{i + 1}</span>
              <input 
                value={label} 
                placeholder={`Slot ${i+1}`}
                onChange={(e) => handleLabelChange('addition', i, e.target.value)} 
                style={inputStyle} 
              />
            </div>
          ))}
        </section>
      </div>

      <button onClick={handleSave} disabled={loading} style={loading ? savingBtnStyle : saveBtnStyle}>
        {loading ? 'Processing...' : '💾 Save Configuration'}
      </button>
    </div>
  );
}

// --- Styles ---
const containerStyle = { background: 'white', padding: '40px', borderRadius: '16px', maxWidth: '1000px', margin: 'auto', border: '1px solid #e2e8f0' };
const sectionStyle = { marginBottom: '30px', background: '#f8fafc', padding: '25px', borderRadius: '12px', border: '1px solid #f1f5f9' };
const sectionTitle = { margin: '0 0 5px 0', fontSize: '1.1rem', color: '#1e293b' };
const subText = { fontSize: '0.8rem', color: '#64748b', marginBottom: '15px' };
const labelStyle = { display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: '#475569', marginBottom: '5px' };
const slotTag = { background: '#f1f5f9', padding: '12px', borderRadius: '8px 0 0 8px', border: '1px solid #e2e8f0', borderRight: 'none', fontSize: '0.7rem', fontWeight: 'bold', color: '#94a3b8' };
const inputStyle = { flex: 1, padding: '11px', borderRadius: '0 8px 8px 0', border: '1px solid #e2e8f0', fontSize: '0.9rem' };
const mainInputStyle = { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem', boxSizing: 'border-box' };
const radioStyle = { flex: 1, display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '15px', background: 'white', borderRadius: '10px', border: '2px solid #e2e8f0', transition: 'all 0.2s' };
const activeRadio = { ...radioStyle, borderColor: '#3b82f6', background: '#eff6ff' };
const saveBtnStyle = { width: '100%', padding: '18px', background: '#1e293b', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', marginTop: '30px', fontSize: '1rem' };
const savingBtnStyle = { ...saveBtnStyle, opacity: 0.7, cursor: 'not-allowed' };