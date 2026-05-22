import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

/* ── helpers ── */
const getFileCategory = (name = '') => {
  const ext = name.split('.').pop().toLowerCase();
  if (['pdf','doc','docx','txt','xls','xlsx','ppt','pptx','csv'].includes(ext)) return 'documents';
  if (['jpg','jpeg','png','gif','svg','bmp','webp','ico'].includes(ext)) return 'images';
  if (['mp4','avi','mov','mkv','webm','wmv','flv'].includes(ext)) return 'videos';
  return 'others';
};

const fmt = (bytes) => {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes/1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes/1048576).toFixed(1)} MB`;
  return `${(bytes/1073741824).toFixed(2)} GB`;
};

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

const fmtTime = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/* ── Security event colour map ── */
const EVENT_COLORS = {
  FILE_ENCRYPT:          { bg: '#EEF2FF', text: '#6366F1', label: 'ENCRYPT' },
  FILE_DECRYPT:          { bg: '#F0FDF4', text: '#16A34A', label: 'DECRYPT' },
  ACCESS_DENIED:         { bg: '#FEE2E2', text: '#DC2626', label: 'ACCESS DENIED' },
  ACCESS_EVAL:           { bg: '#DCFCE7', text: '#15803D', label: 'ACCESS EVAL' },
  FILE_UPLOAD:           { bg: '#DBEAFE', text: '#2563EB', label: 'UPLOAD' },
  FILE_DOWNLOAD:         { bg: '#E0F2FE', text: '#0284C7', label: 'DOWNLOAD' },
  FILE_DELETE:           { bg: '#FEF3C7', text: '#D97706', label: 'DELETE' },
  FILE_SHARE:            { bg: '#F3E8FF', text: '#9333EA', label: 'SHARE' },
  FILE_RESTORE:          { bg: '#DCFCE7', text: '#16A34A', label: 'RESTORE' },
  FILE_PERMANENT_DELETE: { bg: '#FEE2E2', text: '#991B1B', label: 'PERM DELETE' },
  USER_ROLE_UPDATE:      { bg: '#FEF3C7', text: '#B45309', label: 'ROLE UPDATE' },
  USER_DEACTIVATE:       { bg: '#FEE2E2', text: '#DC2626', label: 'DEACTIVATE' },
  LOGIN:                 { bg: '#F0FDF4', text: '#16A34A', label: 'LOGIN' },
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/* ── Dynamic line chart ── */
const LineChart = ({ files }) => {
  const W = 580, H = 180, PAD = { top: 10, bottom: 30, left: 40, right: 10 };
  const now = new Date();
  const counts = Array(12).fill(0);
  files.forEach(f => {
    const d = new Date(f.uploaded_at || f.created_at);
    if (d.getFullYear() === now.getFullYear()) counts[d.getMonth()]++;
  });
  const maxV = Math.max(...counts, 1);
  const pts = counts.map((v, i) => {
    const x = PAD.left + (i / 11) * (W - PAD.left - PAD.right);
    const y = PAD.top + (1 - v / maxV) * (H - PAD.top - PAD.bottom);
    return [x, y];
  });
  const d = pts.map(([x,y], i) => `${i===0?'M':'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const fill = `${d} L${pts[11][0].toFixed(1)},${(H-PAD.bottom).toFixed(1)} L${PAD.left},${(H-PAD.bottom).toFixed(1)} Z`;
  const yTicks = [0, Math.round(maxV/2), maxV];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      {yTicks.map(v => {
        const y = PAD.top + (1 - v / (maxV || 1)) * (H - PAD.top - PAD.bottom);
        return (
          <g key={v}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#E2E8F0" strokeWidth="1"/>
            <text x={PAD.left - 6} y={y + 4} textAnchor="end" fill="#94A3B8" fontSize="9">{v}</text>
          </g>
        );
      })}
      <path d={fill} fill="#22C55E" fillOpacity="0.08"/>
      <path d={d} fill="none" stroke="#6366F1" strokeWidth="2" strokeLinejoin="round"/>
      {pts.map(([x], i) => (
        <text key={i} x={x} y={H - 4} textAnchor="middle" fill="#94A3B8" fontSize="9">{MONTHS[i]}</text>
      ))}
    </svg>
  );
};

/* ── Sensitivity bar chart ── */
const SensitivityChart = ({ files }) => {
  const W = 260, H = 180, PAD = { top: 10, bottom: 30, left: 10, right: 10 };
  const levels = ['low', 'medium', 'high', 'confidential'];
  const colors = { low: '#22C55E', medium: '#F59E0B', high: '#EF4444', confidential: '#8B5CF6' };
  const counts = {};
  levels.forEach(l => { counts[l] = 0; });
  files.forEach(f => { if (counts[f.sensitivity_level] !== undefined) counts[f.sensitivity_level]++; });
  const maxV = Math.max(...Object.values(counts), 1);
  const barW = 38, barGap = 20;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      {levels.map((level, i) => {
        const x = PAD.left + i * (barW + barGap) + 8;
        const chartH = H - PAD.top - PAD.bottom;
        const barH = (counts[level] / maxV) * chartH;
        const y = PAD.top + chartH - barH;
        return (
          <g key={level}>
            <rect x={x} y={y} width={barW} height={barH} fill={colors[level]} rx="3"/>
            <text x={x + barW/2} y={H - 6} textAnchor="middle" fill="#94A3B8" fontSize="8">
              {level.slice(0,3).toUpperCase()}
            </text>
            {counts[level] > 0 && (
              <text x={x + barW/2} y={y - 3} textAnchor="middle" fill={colors[level]} fontSize="9" fontWeight="600">
                {counts[level]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
};

/* ── Trend chip ── */
const Trend = ({ pct, up }) => (
  <div style={{
    display: 'inline-flex', alignItems: 'center', gap: '3px',
    padding: '3px 8px', borderRadius: '20px',
    background: up ? '#F0FDF4' : '#FFF7ED',
    color: up ? '#16A34A' : '#EA580C',
    fontSize: '11px', fontWeight: '600',
  }}>
    {up
      ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
      : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>
    }
    {pct}
  </div>
);

const IconDoc   = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;
const IconImg   = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>;
const IconVid   = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>;
const IconOther = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;

const CATEGORY_META = {
  documents: { label: 'Documents', icon: <IconDoc />,   iconBg: '#EEF2FF' },
  images:    { label: 'Images',    icon: <IconImg />,   iconBg: '#FFFBEB' },
  videos:    { label: 'Videos',    icon: <IconVid />,   iconBg: '#FEF2F2' },
  others:    { label: 'Others',    icon: <IconOther />, iconBg: '#F8FAFC' },
};

/* ── Mini bar chart for daily activity ── */
const DailyBarChart = ({ dailyCounts }) => {
  const W = 420, H = 80, PAD = { top: 8, bottom: 20, left: 0, right: 0 };
  const days = dailyCounts.slice(-14);
  if (!days.length) return <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#94A3B8' }}>No data</div>;
  const maxV = Math.max(...days.map(d => d.count), 1);
  const barW = (W - PAD.left - PAD.right) / days.length - 3;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      {days.map((d, i) => {
        const x = PAD.left + i * ((W - PAD.left - PAD.right) / days.length) + 1.5;
        const chartH = H - PAD.top - PAD.bottom;
        const bH = Math.max((d.count / maxV) * chartH, 2);
        const y = PAD.top + chartH - bH;
        const isToday = d.day === new Date().toISOString().slice(0, 10);
        return (
          <g key={d.day}>
            <rect x={x} y={y} width={barW} height={bH} fill={isToday ? '#6366F1' : '#CBD5E1'} rx="2"/>
            {i % 3 === 0 && (
              <text x={x + barW / 2} y={H - 2} textAnchor="middle" fill="#94A3B8" fontSize="7">
                {d.day.slice(5)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
};

/* ── Role donut ── */
const RoleDonut = ({ users }) => {
  const ROLES_ORDER = ['Administrator','Department Manager','Project Manager','User','Guest'];
  const COLORS = ['#8B5CF6','#3B82F6','#F59E0B','#22C55E','#94A3B8'];
  const counts = ROLES_ORDER.map(r => users.filter(u => u.role === r).length);
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  const R = 40, CX = 54, CY = 54, stroke = 16;
  let offset = 0;
  const circumference = 2 * Math.PI * R;
  const slices = counts.map((c, i) => {
    const pct = c / total;
    const dash = pct * circumference;
    const s = { pct, dash, offset: offset * circumference, color: COLORS[i] };
    offset += pct;
    return s;
  });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
      <svg width="108" height="108" viewBox="0 0 108 108" style={{ flexShrink: 0 }}>
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="#F1F5F9" strokeWidth={stroke}/>
        {slices.map((s, i) => s.pct > 0 && (
          <circle key={i} cx={CX} cy={CY} r={R} fill="none" stroke={s.color} strokeWidth={stroke}
            strokeDasharray={`${s.dash} ${circumference - s.dash}`}
            strokeDashoffset={circumference / 4 - s.offset}
            style={{ transform: 'rotate(-90deg)', transformOrigin: `${CX}px ${CY}px` }}/>
        ))}
        <text x={CX} y={CY + 5} textAnchor="middle" fill="#0F172A" fontSize="14" fontWeight="700">{total}</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {ROLES_ORDER.map((r, i) => (
          <div key={r} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: COLORS[i], flexShrink: 0 }}/>
            <span style={{ fontSize: '11px', color: '#64748B' }}>{r.replace('Department ','Dept. ').replace('Project ','Proj. ')}</span>
            <span style={{ fontSize: '11px', fontWeight: '600', color: '#0F172A', marginLeft: 'auto' }}>{counts[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════
   Admin Dashboard
══════════════════════════════════════════════ */
const SecurityAuditTrail = () => {
  const [logs, setLogs]         = useState([]);
  const [users, setUsers]       = useState([]);
  const [stats, setStats]       = useState({ action_counts: [], daily_counts: [], top_users: [] });
  const [loading, setLoading]   = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filter, setFilter]     = useState('ALL');
  const [activeSection, setActiveSection] = useState('overview');
  const navigate = useNavigate();

  const fetchAll = async () => {
    try {
      const [logsRes, usersRes, statsRes] = await Promise.all([
        api.get('/audit/security?limit=200'),
        api.get('/users'),
        api.get('/audit/stats'),
      ]);
      setLogs(logsRes.data.logs || []);
      setUsers(usersRes.data.users || []);
      setStats(statsRes.data || { action_counts: [], daily_counts: [], top_users: [] });
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(fetchAll, 15000);
    return () => clearInterval(id);
  }, [autoRefresh]);

  const now = Date.now();
  const last24h = logs.filter(l => now - new Date(l.created_at).getTime() < 86400000);
  const last7d  = logs.filter(l => now - new Date(l.created_at).getTime() < 7 * 86400000);

  const count24h = (action) => last24h.filter(l => l.action === action).length;
  const countAll = (action) => logs.filter(l => l.action === action).length;

  const statCards = [
    {
      label: 'Active Users',
      value: users.filter(u => u.is_active).length,
      sub: `${users.length} total`,
      color: '#6366F1', bg: '#EEF2FF',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
        </svg>
      ),
    },
    {
      label: 'File Operations',
      value: last24h.filter(l => l.action.startsWith('FILE_')).length,
      sub: `${last7d.filter(l => l.action.startsWith('FILE_')).length} this week`,
      color: '#0284C7', bg: '#E0F2FE',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
        </svg>
      ),
    },
    {
      label: 'Access Denied',
      value: count24h('ACCESS_DENIED'),
      sub: `${countAll('ACCESS_DENIED')} total`,
      color: '#DC2626', bg: '#FEE2E2',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
        </svg>
      ),
    },
    {
      label: 'Logins Today',
      value: count24h('LOGIN'),
      sub: `${countAll('LOGOUT')} logouts`,
      color: '#16A34A', bg: '#F0FDF4',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>
        </svg>
      ),
    },
  ];

  const FILTER_OPTIONS = ['ALL','FILE_UPLOAD','FILE_DOWNLOAD','FILE_DELETE','FILE_SHARE','FILE_ENCRYPT','FILE_DECRYPT','ACCESS_DENIED','LOGIN','USER_ROLE_UPDATE','USER_DEACTIVATE'];
  const filtered = filter === 'ALL' ? logs : logs.filter(l => l.action === filter);

  const deptCounts = {};
  users.forEach(u => { if (u.department) deptCounts[u.department] = (deptCounts[u.department] || 0) + 1; });

  const recentUsers = [...users]
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, 4);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#0F172A', letterSpacing: '-0.3px' }}>Admin Dashboard</div>
          <div style={{ fontSize: '13px', color: '#64748B', marginTop: '3px' }}>
            System overview · Security audit · User management
            {autoRefresh && <span style={{ color: '#22C55E', marginLeft: '8px', fontWeight: '500' }}>● Live</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setAutoRefresh(a => !a)}
            className={autoRefresh ? 'neu-btn-primary' : 'neu-btn'}
            style={{ fontSize: '12px', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            {autoRefresh ? 'Live' : 'Paused'}
          </button>
          <button onClick={fetchAll} className="neu-btn" style={{ fontSize: '12px', padding: '7px 14px' }}>Refresh</button>
          <button onClick={() => navigate('/admin')} className="neu-btn" style={{ fontSize: '12px', padding: '7px 14px' }}>Manage Users →</button>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {statCards.map(card => (
          <div key={card.label} className="neu-raised" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: card.color }}>
                {card.icon}
              </div>
              <span style={{ fontSize: '10px', color: '#94A3B8' }}>Last 24h</span>
            </div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: card.color, letterSpacing: '-0.5px' }}>{loading ? '—' : card.value}</div>
            <div style={{ fontSize: '12px', color: '#0F172A', fontWeight: '500', marginTop: '2px' }}>{card.label}</div>
            <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Section nav */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px' }}>
        {[['overview','Overview'], ['events','Security Events'], ['users','Users & Departments']].map(([id, label]) => (
          <button key={id} className={activeSection === id ? 'neu-btn-primary' : 'neu-btn'}
            onClick={() => setActiveSection(id)} style={{ fontSize: '13px', padding: '9px 20px' }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Overview section ── */}
      {activeSection === 'overview' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '16px', marginBottom: '16px' }}>

            {/* Activity timeline */}
            <div className="neu-raised" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#0F172A' }}>Activity — Last 14 Days</div>
                <span style={{ fontSize: '11px', color: '#94A3B8' }}>Today highlighted</span>
              </div>
              {loading
                ? <div style={{ padding: '24px', textAlign: 'center', fontSize: '12px', color: '#94A3B8' }}>Loading…</div>
                : <DailyBarChart dailyCounts={stats.daily_counts} />
              }
              <div style={{ display: 'flex', gap: '16px', marginTop: '12px', flexWrap: 'wrap' }}>
                {[
                  { label: 'Uploads (all time)', value: countAll('FILE_UPLOAD'), color: '#2563EB' },
                  { label: 'Downloads (all time)', value: countAll('FILE_DOWNLOAD'), color: '#0284C7' },
                  { label: 'Deletes (all time)', value: countAll('FILE_DELETE'), color: '#DC2626' },
                  { label: 'Shares (all time)', value: countAll('FILE_SHARE'), color: '#9333EA' },
                ].map(m => (
                  <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: m.color }}/>
                    <span style={{ fontSize: '11px', color: '#64748B' }}>{m.label}:</span>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#0F172A' }}>{m.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* User roles donut */}
            <div className="neu-raised" style={{ padding: '20px' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#0F172A', marginBottom: '16px' }}>Users by Role</div>
              {loading
                ? <div style={{ padding: '24px', textAlign: 'center', fontSize: '12px', color: '#94A3B8' }}>Loading…</div>
                : <RoleDonut users={users} />
              }
              <div style={{ marginTop: '16px', borderTop: '1px solid #F1F5F9', paddingTop: '14px' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', marginBottom: '8px' }}>By Department</div>
                {Object.entries(deptCounts).length === 0
                  ? <div style={{ fontSize: '12px', color: '#94A3B8' }}>No departments assigned</div>
                  : Object.entries(deptCounts).map(([dept, cnt]) => (
                    <div key={dept} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <div style={{ flex: 1, fontSize: '11px', color: '#64748B' }}>{dept}</div>
                      <div style={{ flex: 2, height: '6px', borderRadius: '3px', background: '#F1F5F9', overflow: 'hidden' }}>
                        <div style={{ width: `${(cnt / users.length) * 100}%`, height: '100%', background: '#6366F1', borderRadius: '3px' }}/>
                      </div>
                      <div style={{ fontSize: '11px', fontWeight: '600', color: '#0F172A', minWidth: '18px', textAlign: 'right' }}>{cnt}</div>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>

          {/* Bottom row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '16px' }}>

            {/* Recent events feed */}
            <div className="neu-raised" style={{ padding: '0', overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#0F172A' }}>Recent Events</div>
                <button onClick={() => setActiveSection('events')} style={{ fontSize: '12px', color: '#6366F1', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '500' }}>View all →</button>
              </div>
              {loading ? (
                <div style={{ padding: '32px', textAlign: 'center', fontSize: '12px', color: '#94A3B8' }}>Loading…</div>
              ) : logs.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', fontSize: '12px', color: '#94A3B8' }}>No events yet</div>
              ) : (
                <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
                  {logs.slice(0, 12).map((entry, idx) => {
                    const ev = EVENT_COLORS[entry.action] || { bg: '#F1F5F9', text: '#64748B', label: entry.action };
                    return (
                      <div key={entry.id} style={{
                        display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 20px',
                        borderBottom: idx < 11 ? '1px solid #F8FAFC' : 'none',
                        background: entry.action === 'ACCESS_DENIED' ? '#FFF5F5' : 'transparent',
                      }}>
                        <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: ev.text, flexShrink: 0 }}/>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '12px', color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {entry.user_email || 'System'}
                          </div>
                          <div style={{ fontSize: '11px', color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {entry.details || '—'}
                          </div>
                        </div>
                        <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 7px', borderRadius: '20px', background: ev.bg, color: ev.text, whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {ev.label}
                        </span>
                        <div style={{ fontSize: '10px', color: '#94A3B8', whiteSpace: 'nowrap', flexShrink: 0 }}>{fmtTime(entry.created_at)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recent users + most active */}
            <div className="neu-raised" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#0F172A' }}>Recent Users</div>
                <button onClick={() => navigate('/admin')} style={{ fontSize: '12px', color: '#6366F1', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '500' }}>Manage →</button>
              </div>
              {loading ? (
                <div style={{ textAlign: 'center', fontSize: '12px', color: '#94A3B8' }}>Loading…</div>
              ) : recentUsers.length === 0 ? (
                <div style={{ textAlign: 'center', fontSize: '12px', color: '#94A3B8' }}>No users yet</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {recentUsers.map(u => {
                    const initials = (u.full_name || u.email).split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                    return (
                      <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', color: '#6366F1', flexShrink: 0 }}>
                          {initials}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '12px', fontWeight: '600', color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.full_name || '—'}</div>
                          <div style={{ fontSize: '11px', color: '#94A3B8' }}>{u.role} · {u.department || 'No dept'}</div>
                        </div>
                        <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '20px', background: u.is_active ? '#DCFCE7' : '#FEE2E2', color: u.is_active ? '#16A34A' : '#DC2626', whiteSpace: 'nowrap' }}>
                          {u.is_active ? 'Active' : 'Off'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {stats.top_users.length > 0 && (
                <div style={{ marginTop: '18px', borderTop: '1px solid #F1F5F9', paddingTop: '14px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', marginBottom: '8px' }}>Most Active (7d)</div>
                  {stats.top_users.slice(0, 3).map((u, i) => (
                    <div key={u.user_email} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#94A3B8', minWidth: '14px' }}>{i + 1}.</span>
                      <div style={{ flex: 1, fontSize: '11px', color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.user_email?.split('@')[0]}</div>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#6366F1' }}>{u.event_count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Security Events section ── */}
      {activeSection === 'events' && (
        <div className="neu-raised" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#0F172A' }}>All Security Events</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {FILTER_OPTIONS.map(opt => (
                <button key={opt} className={filter === opt ? 'neu-btn-primary' : 'neu-btn'}
                  onClick={() => setFilter(opt)} style={{ fontSize: '10px', padding: '5px 10px' }}>
                  {opt === 'ALL' ? 'All' : (EVENT_COLORS[opt]?.label || opt.replace('_', ' '))}
                </button>
              ))}
            </div>
          </div>
          <div style={{ padding: '8px 20px', borderBottom: '1px solid #F1F5F9', fontSize: '11px', color: '#94A3B8', background: '#FAFAFA' }}>
            {filtered.length} events {filter !== 'ALL' && `matching "${filter}"`}
          </div>
          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center', fontSize: '13px', color: '#94A3B8' }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', fontSize: '13px', color: '#94A3B8' }}>No events match this filter</div>
          ) : (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.9fr 1.3fr 2.2fr 1fr', gap: '8px', padding: '10px 20px', borderBottom: '1px solid #F1F5F9' }}>
                {['User', 'Role', 'Event', 'Details', 'Time'].map(h => (
                  <div key={h} style={{ fontSize: '10px', fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
                ))}
              </div>
              <div style={{ maxHeight: '520px', overflowY: 'auto' }}>
                {filtered.map((entry, idx) => {
                  const ev = EVENT_COLORS[entry.action] || { bg: '#F1F5F9', text: '#64748B', label: entry.action };
                  return (
                    <div key={entry.id} style={{
                      display: 'grid', gridTemplateColumns: '1.4fr 0.9fr 1.3fr 2.2fr 1fr',
                      gap: '8px', padding: '11px 20px', alignItems: 'center',
                      borderBottom: idx < filtered.length - 1 ? '1px solid #F8FAFC' : 'none',
                      background: entry.action === 'ACCESS_DENIED' ? '#FFF5F5' : 'transparent',
                    }}>
                      <div style={{ fontSize: '12px', color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.user_email || 'System'}</div>
                      <div style={{ fontSize: '11px', color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.user_role || '—'}</div>
                      <div>
                        <span style={{ fontSize: '10px', fontWeight: '700', padding: '3px 8px', borderRadius: '20px', background: ev.bg, color: ev.text, display: 'inline-block', whiteSpace: 'nowrap' }}>
                          {ev.label}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.details || '—'}</div>
                      <div style={{ fontSize: '11px', color: '#94A3B8', whiteSpace: 'nowrap' }}>{fmtTime(entry.created_at)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Users & Departments section ── */}
      {activeSection === 'users' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

          {/* Full users table — spans both columns */}
          <div className="neu-raised" style={{ padding: '0', overflow: 'hidden', gridColumn: '1 / -1' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#0F172A' }}>All Users ({users.length})</div>
              <button onClick={() => navigate('/admin')} className="neu-btn" style={{ fontSize: '12px', padding: '7px 14px' }}>Full Management →</button>
            </div>
            {loading ? (
              <div style={{ padding: '48px', textAlign: 'center', fontSize: '13px', color: '#94A3B8' }}>Loading…</div>
            ) : (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1.2fr 1fr 0.8fr', gap: '8px', padding: '10px 20px', borderBottom: '1px solid #F1F5F9' }}>
                  {['Name', 'Email', 'Role', 'Department', 'Status'].map(h => (
                    <div key={h} style={{ fontSize: '10px', fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
                  ))}
                </div>
                <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                  {users.map((u, idx) => {
                    const initials = (u.full_name || u.email).split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                    return (
                      <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1.2fr 1fr 0.8fr', gap: '8px', padding: '12px 20px', alignItems: 'center', borderBottom: idx < users.length - 1 ? '1px solid #F8FAFC' : 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', color: '#6366F1', flexShrink: 0 }}>{initials}</div>
                          <span style={{ fontSize: '12px', fontWeight: '600', color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.full_name || '—'}</span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                        <div><span className="badge" style={{ fontSize: '10px' }}>{u.role}</span></div>
                        <div style={{ fontSize: '12px', color: '#64748B' }}>{u.department || '—'}</div>
                        <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '20px', background: u.is_active ? '#DCFCE7' : '#FEE2E2', color: u.is_active ? '#16A34A' : '#DC2626', fontWeight: '600', display: 'inline-block' }}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Most active users */}
          <div className="neu-raised" style={{ padding: '20px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#0F172A', marginBottom: '16px' }}>Most Active Users (7 days)</div>
            {stats.top_users.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#94A3B8' }}>No activity data yet</div>
            ) : (
              stats.top_users.map((u, i) => (
                <div key={u.user_email} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#94A3B8', minWidth: '18px' }}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.user_email}</div>
                    <div style={{ fontSize: '11px', color: '#94A3B8' }}>{u.user_role}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#6366F1' }}>{u.event_count}</div>
                    <div style={{ fontSize: '10px', color: '#94A3B8' }}>events</div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* All-time action breakdown */}
          <div className="neu-raised" style={{ padding: '20px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#0F172A', marginBottom: '16px' }}>All-Time Action Breakdown</div>
            {stats.action_counts.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#94A3B8' }}>No data yet</div>
            ) : (
              stats.action_counts.slice(0, 8).map(ac => {
                const ev = EVENT_COLORS[ac.action] || { bg: '#F1F5F9', text: '#64748B', label: ac.action };
                const maxCount = stats.action_counts[0]?.count || 1;
                return (
                  <div key={ac.action} style={{ marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <span style={{ fontSize: '11px', color: ev.text, fontWeight: '600' }}>{ev.label || ac.action}</span>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#0F172A' }}>{ac.count}</span>
                    </div>
                    <div style={{ height: '5px', borderRadius: '3px', background: '#F1F5F9', overflow: 'hidden' }}>
                      <div style={{ width: `${(ac.count / maxCount) * 100}%`, height: '100%', background: ev.text, borderRadius: '3px' }}/>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════
   User Dashboard
══════════════════════════════════════════════ */
const UserDashboard = () => {
  const { user } = useAuth();
  const [files, setFiles]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [activeTab, setActiveTab] = useState('12 Months');
  const [storage, setStorage] = useState({ used_bytes: 0, shared_bytes: 0, total_bytes: 10 * 1024 * 1024 * 1024 });

  useEffect(() => {
    const fetch = async () => {
      try {
        const [filesRes, storageRes] = await Promise.all([
          api.get('/files'),
          api.get('/files/storage'),
        ]);
        setFiles(filesRes.data.files || []);
        setStorage(storageRes.data);
      } catch { setError('Failed to load data'); }
      finally { setLoading(false); }
    };
    fetch();
  }, []);

  const counts = { documents: 0, images: 0, videos: 0, others: 0 };
  const sizes  = { documents: 0, images: 0, videos: 0, others: 0 };
  files.forEach(f => {
    const c = getFileCategory(f.original_name);
    counts[c]++;
    sizes[c] += f.size_bytes || 0;
  });

  const recentFiles = [...files].sort((a, b) => new Date(b.uploaded_at || 0) - new Date(a.uploaded_at || 0)).slice(0, 5);

  const handleDownload = async (fileId, fileName) => {
    try {
      const res = await api.get(`/files/download/${fileId}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url; link.setAttribute('download', fileName);
      document.body.appendChild(link); link.click(); link.remove();
    } catch { setError('Download failed'); }
  };

  return (
    <div>
      {error && <div className="error-box">{error}</div>}

      {/* Category stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {Object.entries(CATEGORY_META).map(([key, meta]) => (
          <div key={key} className="neu-raised" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: meta.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{meta.icon}</div>
              <Trend pct={`${counts[key]} files`} up={counts[key] > 0} />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '4px' }}>
              <span style={{ fontSize: '26px', fontWeight: '700', color: '#0F172A', letterSpacing: '-0.5px' }}>{counts[key]}</span>
              <span style={{ fontSize: '13px', color: '#64748B' }}>files</span>
            </div>
            <div style={{ fontSize: '11px', color: '#64748B' }}>{meta.label} · {fmt(sizes[key])}</div>
          </div>
        ))}
      </div>

      {/* Storage bar */}
      <div className="neu-raised" style={{ padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#0F172A' }}>
            CloudFortify <span style={{ color: '#64748B', fontWeight: '400' }}>Space</span>
          </div>
          <div style={{ fontSize: '12px', color: '#64748B' }}>
            Using <strong style={{ color: '#0F172A' }}>{fmt(storage.used_bytes)}</strong> of {fmt(storage.total_bytes)}
          </div>
        </div>
        {(() => {
          const ownPct    = (storage.used_bytes - storage.shared_bytes) / storage.total_bytes * 100;
          const sharedPct = storage.shared_bytes / storage.total_bytes * 100;
          const unusedPct = Math.max(100 - ownPct - sharedPct, 0);
          return (
            <div style={{ display: 'flex', height: '14px', borderRadius: '99px', overflow: 'hidden', gap: '2px', marginBottom: '12px' }}>
              <div style={{ width: `${ownPct}%`,    background: '#6366F1', borderRadius: '99px 0 0 99px', minWidth: ownPct > 0 ? '4px' : '0' }}/>
              <div style={{ width: `${sharedPct}%`, background: '#F59E0B', minWidth: sharedPct > 0 ? '4px' : '0' }}/>
              <div style={{ width: `${unusedPct}%`, background: '#E2E8F0', borderRadius: '0 99px 99px 0', minWidth: unusedPct > 0 ? '4px' : '0' }}/>
            </div>
          );
        })()}
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          {[
            { dot: '#6366F1', label: `My files (${fmt(storage.used_bytes - storage.shared_bytes)})` },
            { dot: '#F59E0B', label: `Shared by me (${fmt(storage.shared_bytes)})` },
            { dot: '#94A3B8', label: `Unused (${fmt(Math.max(storage.total_bytes - storage.used_bytes, 0))})` },
          ].map(({ dot, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: dot, flexShrink: 0 }}/>
              <span style={{ fontSize: '12px', color: '#64748B' }}>{label}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: '12px', fontSize: '12px', color: '#64748B' }}>
          All files are encrypted at rest with AES-256-CBC and RSA-wrapped keys managed by CloudFortify.{' '}
          <span style={{ color: '#22C55E', cursor: 'pointer', fontWeight: '500' }}>Contact support</span> to upgrade.
        </div>
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '16px', marginBottom: '24px' }}>
        <div className="neu-raised" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#0F172A' }}>Upload Activity ({new Date().getFullYear()})</div>
            <div style={{ display: 'flex', gap: '4px' }}>
              {['12 Months','30 Days','7 Days'].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{
                  padding: '5px 12px', borderRadius: '6px', border: 'none', fontSize: '12px', fontWeight: '500', cursor: 'pointer',
                  background: activeTab === tab ? '#0F172A' : 'transparent',
                  color: activeTab === tab ? '#FFFFFF' : '#64748B',
                }}>{tab}</button>
              ))}
            </div>
          </div>
          {loading ? <div style={{ padding: '40px', textAlign: 'center', fontSize: '13px', color: '#94A3B8' }}>Loading…</div> : <LineChart files={files} />}
        </div>

        <div className="neu-raised" style={{ padding: '20px', minWidth: '240px' }}>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#0F172A', marginBottom: '16px' }}>Files by Sensitivity</div>
          {loading ? <div style={{ padding: '40px', textAlign: 'center', fontSize: '13px', color: '#94A3B8' }}>Loading…</div> : <SensitivityChart files={files} />}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
            {[['low','#22C55E'],['medium','#F59E0B'],['high','#EF4444'],['confidential','#8B5CF6']].map(([level, color]) => (
              <div key={level} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: color, flexShrink: 0 }}/>
                <span style={{ fontSize: '11px', color: '#64748B', textTransform: 'capitalize' }}>{level}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Uploads */}
      <div className="neu-raised" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#0F172A' }}>Recent Uploads</div>
          <button style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: 'none', border: '1.5px solid #E2E8F0', borderRadius: '8px', color: '#475569', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            PDF Report
          </button>
        </div>
        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', fontSize: '13px', color: '#94A3B8' }}>Loading…</div>
        ) : recentFiles.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', fontSize: '13px', color: '#94A3B8' }}>No files yet</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Name','Uploader','Date','Size',''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: '11px', fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #F1F5F9' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentFiles.map(file => (
                <tr key={file.id} style={{ borderBottom: '1px solid #F8FAFC' }}>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '500', color: '#0F172A', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.original_name}</div>
                        <div style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'capitalize' }}>{getFileCategory(file.original_name)}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px', fontSize: '12px', color: '#64748B' }}>{file.owner_email?.split('@')[0] || '—'}</td>
                  <td style={{ padding: '12px', fontSize: '12px', color: '#64748B' }}>{fmtDate(file.uploaded_at)}</td>
                  <td style={{ padding: '12px', fontSize: '12px', color: '#64748B' }}>{fmt(file.size_bytes)}</td>
                  <td style={{ padding: '12px' }}>
                    <button className="neu-btn" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={() => handleDownload(file.id, file.original_name)}>Download</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════
   Dashboard router
══════════════════════════════════════════════ */
const Dashboard = () => {
  const { user } = useAuth();
  if (user?.role === 'Administrator') return <SecurityAuditTrail />;
  return <UserDashboard />;
};

export default Dashboard;