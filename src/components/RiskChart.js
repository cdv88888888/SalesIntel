'use client';

import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

export default function RiskChart({ currentVolume, lastMonthVolume, target }) {
  const data = [
    {
      name: 'Last Month',
      Volume: lastMonthVolume,
      fill: '#f59e0b', // orange
    },
    {
      name: 'Current Month',
      Volume: currentVolume,
      fill: '#3b82f6', // blue
    }
  ];

  const formatVolume = (val) => `${val.toLocaleString()} KGs`;

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ backgroundColor: 'var(--surface-dark)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '8px', color: 'var(--text-primary)', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          <p style={{ margin: '0 0 4px 0', fontWeight: 'bold', color: 'var(--text-secondary)' }}>{label}</p>
          <p style={{ margin: 0, color: payload[0].payload.fill, fontSize: '1.1rem', fontWeight: '600' }}>
            {formatVolume(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ 
      width: '100%', 
      height: '350px', 
      backgroundColor: 'var(--background-dark)', 
      border: '1px solid var(--border-color)', 
      borderRadius: '12px', 
      padding: '24px', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      marginBottom: '32px',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
    }}>
      <h3 style={{ color: 'var(--text-primary)', margin: '0 0 16px 0', fontSize: '1.25rem', fontWeight: '600' }}>Volume Overview vs Target</h3>
      <div style={{ flex: 1, width: '100%', minHeight: '250px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
            <XAxis dataKey="name" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)' }} tickLine={false} axisLine={false} />
            <YAxis 
              stroke="var(--text-secondary)" 
              tick={{ fill: 'var(--text-secondary)' }} 
              tickLine={false} 
              axisLine={false} 
              tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} 
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--surface-hover)', opacity: 0.4 }} />
            {target > 0 && (
              <ReferenceLine 
                y={target} 
                stroke="#10b981" 
                strokeDasharray="4 4" 
                label={{ 
                  position: 'top', 
                  value: `Target: ${formatVolume(target)}`, 
                  fill: '#10b981',
                  fontSize: 14,
                  fontWeight: 600
                }} 
              />
            )}
            <Bar dataKey="Volume" radius={[4, 4, 0, 0]} maxBarSize={100}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      {/* Custom Legend to match the new Bar colors */}
      <div style={{ display: 'flex', gap: '24px', marginTop: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: '#f59e0b' }}></div>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Last Month</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: '#3b82f6' }}></div>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Current Month</span>
        </div>
        {target > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '2px', border: '2px dashed #10b981' }}></div>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Target</span>
          </div>
        )}
      </div>
    </div>
  );
}
