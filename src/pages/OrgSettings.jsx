import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function OrgSettings({ org, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    working_days_per_year: org.working_days_per_year || 313,
    deduction_labels: org.deduction_labels || ["Short", "Cash Bond", "Deduction 3", "Deduction 4", "Deduction 5"],
    addition_labels: org.addition_labels || ["Add Pay 1", "Add Pay 2", "Add Pay 3"]
  });

  const handleLabelChange = (type, index, value) => {
    const key = type === 'deduction' ? 'deduction_labels' : 'addition_labels';
    const newList = [...settings[key]];
    newList[index] = value;
    setSettings({ ...settings, [key]: newList });
  };

  const handleSave = async () => {
    setLoading(true);
    console.log("Attempting to save for Org ID:", org.id); // Debug log

    try {
      const { data, error, status } = await supabase
        .from('organizations')
        .update({
          working_days_per_year: settings.working_days_per_year,
          deduction_labels: settings.deduction_labels,
          addition_labels: settings.addition_labels
        })
        .eq('id', org.id)
        .select();

      console.log("Supabase Response Status:", status);

      if (error) {
        console.error("Supabase Error Object:", error);
        throw error;
      }

      if (!data || data.length === 0) {
        throw new Error("No rows were updated. Check if the ID is correct or if you have permission.");
      }
      
      onUpdate(data[0]); 
      alert("Company configuration saved!");
    } catch (err) {
      console.error("Full Error Catch:", err);
      alert("Failed to save: " + (err.hint || err.message || "Unknown Database Error"));
    } finally {
      setLoading(false); 
    }
  };

  return (
    <div style={containerStyle}>
      <h2 style={{ marginBottom: '20px' }}>Company Configuration</h2>
      
      <section style={sectionStyle}>
        <h3>Standard Working Days</h3>
        <div style={{ display: 'flex', gap: '20px' }}>
          <label style={radioStyle}>
            <input type="radio" checked={settings.working_days_per_year === 313} onChange={() => setSettings({...settings, working_days_per_year: 313})} />
            6 Days / Week (313 Days)
          </label>
          <label style={radioStyle}>
            <input type="radio" checked={settings.working_days_per_year === 261} onChange={() => setSettings({...settings, working_days_per_year: 261})} />
            5 Days / Week (261 Days)
          </label>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
        <section>
          <h3>Deduction Labels</h3>
          {settings.deduction_labels.map((label, i) => (
            <input key={i} value={label} onChange={(e) => handleLabelChange('deduction', i, e.target.value)} style={inputStyle} />
          ))}
        </section>
        <section>
          <h3>Addition Labels</h3>
          {settings.addition_labels.map((label, i) => (
            <input key={i} value={label} onChange={(e) => handleLabelChange('addition', i, e.target.value)} style={inputStyle} />
          ))}
        </section>
      </div>

      <button onClick={handleSave} disabled={loading} style={loading ? savingBtnStyle : saveBtnStyle}>
        {loading ? 'Saving...' : 'Save Configuration'}
      </button>
    </div>
  );
}

// Styles matching your screenshots
const containerStyle = { background: 'white', padding: '40px', borderRadius: '12px', maxWidth: '900px', margin: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' };
const sectionStyle = { marginBottom: '30px', borderBottom: '1px solid #f1f5f9', paddingBottom: '20px' };
const inputStyle = { width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' };
const radioStyle = { display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '10px 20px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' };
const saveBtnStyle = { width: '100%', padding: '15px', background: '#16a34a', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginTop: '20px' };
const savingBtnStyle = { ...saveBtnStyle, opacity: 0.7, cursor: 'not-allowed' };