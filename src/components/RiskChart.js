'use client';

import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

export default function RiskChart({ currentVolume, lastMonthVolume, target }) {
  const data = [
    {
      name: 'Last Month',
      Volume: lastMonthVolume,
      fill: 'var(--muted)', // neutral comparison
    },
    {
      name: 'Current Month',
      Volume: currentVolume,
      fill: 'var(--blue)', // blue
    }
  ];

  const formatVolume = (val) => `${val.toLocaleString()} KGs`;

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ backgroundColor: 'var(--surface)', border: 0, padding: '12px', borderRadius: 'var(--r-card)', color: 'var(--text)', boxShadow: '0 24px 60px rgba(0,0,0,.35)' }}>
          <p style={{ margin: '0 0 4px 0', fontWeight: 500, fontSize: '13px', color: 'var(--muted)' }}>{label}</p>
          <p style={{ margin: 0, color: payload[0].payload.fill, fontSize: '17px', fontWeight: '600', fontVariantNumeric: 'tabular-nums' }}>
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
      backgroundColor: 'var(--surface)', 
      border: 0, 
      borderRadius: 'var(--r-group)', 
      padding: '24px', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      marginBottom: '32px'
    }}>
      <h3 style={{ color: 'var(--text)', margin: '0 0 16px 0', fontSize: '17px', fontWeight: '600', letterSpacing: '-.01em' }}>Volume Overview vs Target</h3>
      <div style={{ flex: 1, width: '100%', minHeight: '250px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
            <XAxis dataKey="name" stroke="var(--muted)" tick={{ fill: 'var(--muted)' }} tickLine={false} axisLine={false} />
            <YAxis 
              stroke="var(--muted)" 
              tick={{ fill: 'var(--muted)' }} 
              tickLine={false} 
              axisLine={false} 
              tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} 
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--trk)' }} />
            {target > 0 && (
              <ReferenceLine 
                y={target} 
                stroke="var(--green)" 
                strokeDasharray="4 4" 
                label={{ 
                  position: 'top', 
                  value: `Target: ${formatVolume(target)}`, 
                  fill: 'var(--green)',
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
          <div style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: 'var(--muted)' }}></div>
          <span style={{ color: 'var(--muted)', fontSize: '13px' }}>Last Month</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: 'var(--blue)' }}></div>
          <span style={{ color: 'var(--muted)', fontSize: '13px' }}>Current Month</span>
        </div>
        {target > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '2px', border: '2px dashed var(--green)' }}></div>
            <span style={{ color: 'var(--muted)', fontSize: '13px' }}>Target</span>
          </div>
        )}
      </div>
    </div>
  );
}
