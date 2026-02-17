import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function HolidayManager({ organizationId }) {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ holiday_date: '', name: '', type: 'Regular' });

  // --- 1. STABLE FETCH LOGIC (Tab-Focus Recovery) ---
  const fetchHolidays = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const { data, error } = await supabase
        .from('holidays')
        .select('*')
        .or(`organization_id.is.null,organization_id.eq.${organizationId}`)
        .order('holiday_date', { ascending: true });
      
      if (error) throw error;
      setHolidays(data || []);
    } catch (err) {
      console.error("Holiday Sync Error:", err.message);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => { 
    fetchHolidays(); 

    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        fetchHolidays(false); // Background sync on tab focus
      }
    };
    window.addEventListener('visibilitychange', handleFocus);
    return () => window.removeEventListener('visibilitychange', handleFocus);
  }, [fetchHolidays]);

  // --- 2. HANDLERS ---
  const handleSave = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('holidays').upsert([
      { ...form, organization_id: organizationId } 
    ]);
    
    if (error) {
      alert(error.message);
    } else {
      setForm({ holiday_date: '', name: '', type: 'Regular' });
      fetchHolidays(false);
    }
  };

  const deleteHoliday = async (h) => {
    if (!h.organization_id) {
      alert("⚠️ Restricted: Global Holidays can only be managed by System Admins.");
      return;
    }
    if (!window.confirm(`Remove "${h.name}" from your company calendar?`)) return;
    
    const { error } = await supabase.from('holidays').delete().eq('id', h.id);
    if (error) alert(error.message);
    else fetchHolidays(false);
  };

  return (
    <div style={container}>
      {/* FIXED: GRID-BASED FORM (No Overlapping) */}
      <div style={formCard}>
        <div style={formHeader}>
          <h3 style={{ margin: 0, color: '#1e293b' }}>➕ Add Company-Specific Holiday</h3>
          <p style={formSubtext}>e.g., Foundation Day, Local Town Fiesta, or Company Anniversary.</p>
        </div>
        
        <form onSubmit={handleSave} style={gridForm}>
          <div style={inputGroup}>
            <label style={labelStyle}>DATE</label>
            <input 
              type="date" 
              value={form.holiday_date} 
              required 
              onChange={e => setForm({...form, holiday_date: e.target.value})} 
              style={cleanInput} 
            />
          </div>

          <div style={inputGroup}>
            <label style={labelStyle}>HOLIDAY NAME</label>
            <input 
              type="text" 
              value={form.name} 
              required 
              placeholder="Foundation Day..." 
              onChange={e => setForm({...form, name: e.target.value})} 
              style={cleanInput} 
            />
          </div>

          <div style={inputGroup}>
            <label style={labelStyle}>TYPE</label>
            <select 
              value={form.type} 
              onChange={e => setForm({...form, type: e.target.value})} 
              style={cleanInput}
            >
              <option value="Regular">Regular (200%)</option>
              <option value="Special">Special (130%)</option>
              <option value="Additional Special">Addl Special (130%)</option>
            </select>
          </div>

          <button type="submit" style={saveBtn}>Add to Calendar</button>
        </form>
      </div>

      {/* HOLIDAY LIST */}
      <div style={listCard}>
        {holidays.map(h => (
          <div key={h.id} style={{...holidayRow, borderLeft: h.organization_id ? '5px solid #3b82f6' : '5px solid #e2e8f0'}}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1 }}>
              <div style={dateBox}>
                <span style={monthText}>{new Date(h.holiday_date).toLocaleString('default', { month: 'short' }).toUpperCase()}</span>
                <span style={dayText}>{new Date(h.holiday_date).getDate()}</span>
              </div>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#1e293b' }}>{h.name}</div>
                <div style={{ fontSize: '0.65rem', color: '#94a3b8', letterSpacing: '0.05em' }}>
                  {h.organization_id ? '🏢 LOCAL/ORG' : '🌍 NATIONAL/GLOBAL'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <span style={badgeStyle(h.type)}>{h.type.toUpperCase()}</span>
              {h.organization_id && (
                <button onClick={() => deleteHoliday(h)} style={delBtn}>✕</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- STYLES ---
const container = { maxWidth: '1100px', margin: 'auto', padding: '20px' };

const formCard = { 
  background: 'white', 
  padding: '32px', 
  borderRadius: '24px', 
  border: '1px solid #f1f5f9', 
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', 
  marginBottom: '30px' 
};

const formHeader = { borderBottom: '1px solid #f1f5f9', marginBottom: '24px', paddingBottom: '16px' };
const formSubtext = { fontSize: '0.85rem', color: '#64748b', marginTop: '4px' };

const gridForm = { 
  display: 'grid', 
  gridTemplateColumns: '1fr 2fr 1.5fr auto', // Uniform columns based on field importance
  gap: '16px', 
  alignItems: 'end' 
};

const inputGroup = { display: 'flex', flexDirection: 'column', gap: '8px' };
const labelStyle = { fontSize: '0.7rem', fontWeight: 'bold', color: '#94a3b8', letterSpacing: '0.025em' };

const cleanInput = { 
  width: '100%', 
  padding: '12px 16px', 
  borderRadius: '12px', 
  border: '1px solid #e2e8f0', 
  fontSize: '0.9rem', 
  background: '#f8fafc',
  color: '#334155',
  boxSizing: 'border-box',
  outline: 'none'
};

const saveBtn = { 
  padding: '0 32px', 
  backgroundColor: '#1e293b', // Matching dashboard header
  color: 'white', 
  border: 'none', 
  borderRadius: '12px', 
  fontWeight: 'bold', 
  cursor: 'pointer', 
  height: '48px',
  fontSize: '0.9rem'
};

const listCard = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' };
const holidayRow = { background: 'white', padding: '15px 20px', borderRadius: '15px', display: 'flex', alignItems: 'center', border: '1px solid #f1f5f9' };
const dateBox = { background: '#f8fafc', width: '52px', height: '52px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px solid #f1f5f9' };
const monthText = { fontSize: '0.6rem', color: '#64748b', fontWeight: 'bold' };
const dayText = { fontSize: '1.2rem', fontWeight: 'bold', color: '#1e293b' };
const badgeStyle = (type) => ({ padding: '4px 10px', borderRadius: '6px', fontSize: '0.6rem', fontWeight: '800', background: type === 'Regular' ? '#fee2e2' : type === 'Special' ? '#dcfce7' : '#fef9c3', color: type === 'Regular' ? '#991b1b' : type === 'Special' ? '#166534' : '#854d0e' });
const delBtn = { color: '#94a3b8', fontSize: '1.1rem', border: 'none', background: 'none', cursor: 'pointer' };