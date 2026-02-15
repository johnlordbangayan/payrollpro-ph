import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function HolidayManager({ organizationId }) {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ holiday_date: '', name: '', type: 'Regular' });

  const fetchHolidays = async () => {
    setLoading(true);
    // Fetch Global (null) OR Organization-specific holidays
    const { data, error } = await supabase
      .from('holidays')
      .select('*')
      .or(`organization_id.is.null,organization_id.eq.${organizationId}`)
      .order('holiday_date', { ascending: true });
    
    if (!error) setHolidays(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchHolidays(); }, [organizationId]);

  const handleSave = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('holidays').upsert([
      { ...form, organization_id: organizationId } // Tags it to this org
    ]);
    if (error) alert(error.message);
    else {
      setForm({ holiday_date: '', name: '', type: 'Regular' });
      fetchHolidays();
    }
  };

  const deleteHoliday = async (h) => {
    if (!h.organization_id) {
      alert("You cannot delete Global Holidays.");
      return;
    }
    if (!window.confirm("Delete this organization holiday?")) return;
    await supabase.from('holidays').delete().eq('id', h.id);
    fetchHolidays();
  };

  return (
    <div style={{ maxWidth: '1000px', margin: 'auto', padding: '10px' }}>
      <div style={formCard}>
        <h3 style={{ marginTop: 0, marginBottom: '20px' }}>➕ Add Company-Specific Holiday</h3>
        <form onSubmit={handleSave} style={modernFormRow}>
          <div style={inputFlexGroup}>
            <label style={labelStyle}>DATE</label>
            <input type="date" value={form.holiday_date} required onChange={e => setForm({...form, holiday_date: e.target.value})} style={cleanInput} />
          </div>
          <div style={{ ...inputFlexGroup, flex: 2 }}>
            <label style={labelStyle}>HOLIDAY NAME</label>
            <input type="text" value={form.name} required placeholder="e.g. Foundation Day" onChange={e => setForm({...form, name: e.target.value})} style={cleanInput} />
          </div>
          <div style={inputFlexGroup}>
            <label style={labelStyle}>TYPE</label>
            <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} style={cleanInput}>
              <option value="Regular">Regular (200%)</option>
              <option value="Special">Special (130%)</option>
              <option value="Additional Special">Addl Special (130%)</option>
            </select>
          </div>
          <button type="submit" style={saveBtn}>Add to Calendar</button>
        </form>
      </div>

      <div style={listCard}>
        {holidays.map(h => (
          <div key={h.id} style={{...holidayRow, borderLeft: h.organization_id ? '5px solid #3b82f6' : '1px solid #f1f5f9'}}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1 }}>
              <div style={dateBox}>
                <span style={monthText}>{new Date(h.holiday_date).toLocaleString('default', { month: 'short' }).toUpperCase()}</span>
                <span style={dayText}>{new Date(h.holiday_date).getDate()}</span>
              </div>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>{h.name}</div>
                <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{h.organization_id ? '🏢 ORG HOLIDAY' : '🌍 GLOBAL'}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <span style={badgeStyle(h.type)}>{h.type}</span>
              {h.organization_id && (
                <button onClick={() => deleteHoliday(h)} style={delBtn}>Remove</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- STYLES REMAIN CONSISTENT WITH YOUR UI ---
const formCard = { background: 'white', padding: '30px', borderRadius: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '30px' };
const modernFormRow = { display: 'flex', gap: '15px', alignItems: 'flex-end', width: '100%', flexWrap: 'wrap' };
const inputFlexGroup = { display: 'flex', flexDirection: 'column', flex: 1, minWidth: '180px' };
const labelStyle = { fontSize: '0.65rem', fontWeight: 'bold', color: '#94a3b8', marginBottom: '8px', display: 'block' };
const cleanInput = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box' };
const saveBtn = { padding: '13px 25px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', height: '45px' };
const listCard = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '15px' };
const holidayRow = { background: 'white', padding: '15px 20px', borderRadius: '15px', display: 'flex', alignItems: 'center' };
const dateBox = { background: '#f1f5f9', width: '52px', height: '52px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' };
const monthText = { fontSize: '0.6rem', color: '#64748b', fontWeight: 'bold' };
const dayText = { fontSize: '1.2rem', fontWeight: 'bold', color: '#1e293b' };
const badgeStyle = (type) => ({ padding: '5px 12px', borderRadius: '20px', fontSize: '0.65rem', fontWeight: 'bold', background: type === 'Regular' ? '#fee2e2' : type === 'Special' ? '#dcfce7' : '#fef9c3', color: type === 'Regular' ? '#991b1b' : type === 'Special' ? '#166534' : '#854d0e' });
const delBtn = { color: '#ef4444', fontSize: '0.8rem', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold' };