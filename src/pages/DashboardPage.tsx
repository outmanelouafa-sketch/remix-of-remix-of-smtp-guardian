import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { getDrnDays, STATUS_CONFIG } from '@/lib/statusColors';
import { AlertTriangle, Server, ShieldAlert, ShieldCheck, CheckCircle2, FileWarning, Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, CartesianGrid, Legend } from 'recharts';

const STATUS_COLORS: Record<string, string> = {
  BL: '#e53e3e', SH: '#ffc800', BR: '#805ad5', TO: '#ed64a6',
  EXP: '#00b5d8', ECR: '#ed8936', CLEAN: '#48bb78',
};

export default function DashboardPage() {
  const { user, canViewActivityLog } = useAuth();
  const [loading, setLoading] = useState(true);
  const [servers, setServers] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [allStatuses, setAllStatuses] = useState<any[]>([]);
  const [delistings, setDelistings] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    loadData();
    const channels = ['servers', 'smtp_status', 'delistings', 'activity_log'].map(table =>
      supabase.channel(`dashboard-${table}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, () => loadData())
        .subscribe()
    );
    return () => { channels.forEach(c => supabase.removeChannel(c)); };
  }, []);

  async function loadData() {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0];

    const [sRes, stRes, stAllRes, dRes, aRes] = await Promise.all([
      supabase.from('servers').select('*'),
      supabase.from('smtp_status').select('*').eq('date', today),
      supabase.from('smtp_status').select('*').gte('date', twoWeeksAgo),
      supabase.from('delistings').select('*'),
      supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(10),
    ]);

    setServers(sRes.data || []);
    setStatuses(stRes.data || []);
    setAllStatuses(stAllRes.data || []);
    setDelistings(dRes.data || []);
    setActivities(aRes.data || []);
    setLoading(false);
  }

  // Derived analytics
  const analytics = useMemo(() => {
    const production = servers.filter(s => s.section === 'production');
    const suspended = servers.filter(s => s.section === 'suspended');
    const expiringSoon = production.filter(s => {
      const drn = getDrnDays(s.n_due);
      return drn !== null && drn <= 5;
    });

    const todayBL = statuses.filter(s => s.status === 'BL').length;
    const todaySH = statuses.filter(s => s.status === 'SH').length;
    const todayClean = statuses.filter(s => s.status === 'CLEAN').length;

    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const delistingsThisWeek = delistings.filter(d => d.submitted_date >= weekAgo).length;
    const delistingsToday = delistings.filter(d => d.submitted_date === today).length;
    const approvedThisWeek = delistings.filter(d => d.submitted_date >= weekAgo && d.result === 'approved').length;

    // --- SMTP trend (last 14 days) ---
    const dayMap: Record<string, Record<string, number>> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
      dayMap[d] = { date: d as any, CLEAN: 0, BL: 0, SH: 0, BR: 0, TO: 0, EXP: 0, ECR: 0 };
    }
    allStatuses.forEach(s => {
      if (dayMap[s.date]) {
        dayMap[s.date][s.status] = (dayMap[s.date][s.status] || 0) + 1;
      }
    });
    const trendData = Object.values(dayMap).map(d => ({
      ...d,
      date: (d as any).date?.slice(5), // MM-DD
    }));

    // --- Provider distribution ---
    const providerCount: Record<string, number> = {};
    production.forEach(s => {
      const p = s.provider || 'Unknown';
      providerCount[p] = (providerCount[p] || 0) + 1;
    });
    const providerData = Object.entries(providerCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // --- Status distribution today ---
    const statusCount: Record<string, number> = {};
    statuses.forEach(s => {
      statusCount[s.status] = (statusCount[s.status] || 0) + 1;
    });
    const statusPieData = Object.entries(statusCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // --- Health score ---
    const totalToday = statuses.length;
    const healthPct = totalToday > 0 ? Math.round((todayClean / totalToday) * 100) : 100;

    // Yesterday comparison
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const yesterdayStatuses = allStatuses.filter(s => s.date === yesterday);
    const yesterdayClean = yesterdayStatuses.filter(s => s.status === 'CLEAN').length;
    const yesterdayTotal = yesterdayStatuses.length;
    const yesterdayPct = yesterdayTotal > 0 ? Math.round((yesterdayClean / yesterdayTotal) * 100) : 100;
    const healthDelta = healthPct - yesterdayPct;

    return {
      production, suspended, expiringSoon,
      todayBL, todaySH, todayClean,
      delistingsThisWeek, delistingsToday, approvedThisWeek,
      trendData, providerData, statusPieData,
      healthPct, healthDelta, totalToday,
    };
  }, [servers, statuses, allStatuses, delistings]);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const { production, suspended, expiringSoon, todayBL, todaySH, todayClean,
    delistingsThisWeek, delistingsToday, approvedThisWeek,
    trendData, providerData, statusPieData, healthPct, healthDelta, totalToday } = analytics;

  const stats = [
    { label: 'Production', value: production.length, icon: Server, color: 'text-primary' },
    { label: 'Suspended', value: suspended.length, icon: FileWarning, color: 'text-status-ecr' },
    { label: 'Blacklisted', value: todayBL, icon: ShieldAlert, color: 'text-status-bl' },
    { label: 'Spamhaus', value: todaySH, icon: ShieldAlert, color: 'text-status-sh' },
    { label: 'Clean', value: todayClean, icon: CheckCircle2, color: 'text-status-clean' },
    { label: 'Delistings', value: delistingsThisWeek, icon: ShieldCheck, color: 'text-primary' },
  ];

  const PROVIDER_COLORS = ['#4f8ef7', '#48bb78', '#ed8936', '#805ad5', '#ed64a6', '#00b5d8', '#ffc800', '#e53e3e'];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Alert */}
      {expiringSoon.length > 0 && (
        <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: 'rgba(229,62,62,0.12)', border: '1px solid rgba(229,62,62,0.3)' }}>
          <AlertTriangle className="w-5 h-5 text-status-bl shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-status-bl">{expiringSoon.length} server{expiringSoon.length > 1 ? 's' : ''} expiring soon</p>
            <p className="text-xs text-muted-foreground mt-1">
              {expiringSoon.map(s => `${s.ids} (${getDrnDays(s.n_due)}d)`).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {stats.map((s, i) => (
          <div key={i} className="glass-card rounded-xl p-3" style={{ animationDelay: `${i * 50}ms` }}>
            <div className="flex items-center gap-2 mb-1">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Health Score + Status Pie */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Health Score */}
        <div className="glass-card rounded-xl p-4 flex flex-col items-center justify-center">
          <p className="text-xs text-muted-foreground mb-2">Health Score</p>
          <div className="relative w-24 h-24">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
              <circle cx="50" cy="50" r="42" fill="none"
                stroke={healthPct >= 80 ? '#48bb78' : healthPct >= 50 ? '#ffc800' : '#e53e3e'}
                strokeWidth="8" strokeLinecap="round"
                strokeDasharray={`${healthPct * 2.64} 264`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-foreground">{healthPct}%</span>
            </div>
          </div>
          <div className="flex items-center gap-1 mt-2">
            {healthDelta > 0 ? <TrendingUp className="w-3 h-3 text-status-clean" /> : healthDelta < 0 ? <TrendingDown className="w-3 h-3 text-status-bl" /> : null}
            <span className={`text-xs font-medium ${healthDelta > 0 ? 'text-status-clean' : healthDelta < 0 ? 'text-status-bl' : 'text-muted-foreground'}`}>
              {healthDelta > 0 ? '+' : ''}{healthDelta}% vs yesterday
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">{totalToday} servers checked today</p>
        </div>

        {/* Status Distribution Pie */}
        <div className="glass-card rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-2">Today's Status Breakdown</p>
          {statusPieData.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center mt-8">No data today</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={statusPieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                  innerRadius={35} outerRadius={65} paddingAngle={3} strokeWidth={0}>
                  {statusPieData.map((entry) => (
                    <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#666'} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    background: 'rgba(26, 29, 39, 0.95)', 
                    border: '1px solid rgba(79, 142, 247, 0.3)', 
                    borderRadius: 12, 
                    fontSize: 12, 
                    color: '#fff',
                    backdropFilter: 'blur(10px)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
                  }} 
                  itemStyle={{ color: '#fff' }}
                  labelStyle={{ color: 'hsl(217, 91%, 64%)', fontWeight: 'bold' }}
                />
                <Legend formatter={(value) => <span className="text-xs text-muted-foreground">{STATUS_CONFIG[value]?.label || value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Provider Distribution */}
        <div className="glass-card rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-2">Servers by Provider</p>
          {providerData.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center mt-8">No servers</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={providerData} layout="vertical" margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 11, fill: 'hsl(215,20%,70%)' }} />
                <Tooltip 
                  contentStyle={{ 
                    background: 'rgba(26, 29, 39, 0.95)', 
                    border: '1px solid rgba(79, 142, 247, 0.3)', 
                    borderRadius: 12, 
                    fontSize: 12, 
                    color: '#fff',
                    backdropFilter: 'blur(10px)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
                  }} 
                  itemStyle={{ color: '#fff' }}
                  labelStyle={{ color: 'hsl(217, 91%, 64%)', fontWeight: 'bold' }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
                  {providerData.map((_, i) => (
                    <Cell key={i} fill={PROVIDER_COLORS[i % PROVIDER_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* SMTP Trend Area Chart */}
      <div className="glass-card rounded-xl p-4">
        <p className="text-xs text-muted-foreground mb-3">SMTP Status Trend (14 days)</p>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={trendData} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(232,22%,18%)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(215,20%,70%)' }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'hsl(215,20%,70%)' }} />
            <Tooltip 
              contentStyle={{ 
                background: 'rgba(26, 29, 39, 0.95)', 
                border: '1px solid rgba(79, 142, 247, 0.3)', 
                borderRadius: 12, 
                fontSize: 12, 
                color: '#fff',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
              }} 
              itemStyle={{ color: '#fff' }}
              labelStyle={{ color: 'hsl(217, 91%, 64%)', fontWeight: 'bold' }}
            />
            <Area type="monotone" dataKey="CLEAN" stackId="1" stroke="#48bb78" fill="#48bb78" fillOpacity={0.4} />
            <Area type="monotone" dataKey="BL" stackId="1" stroke="#e53e3e" fill="#e53e3e" fillOpacity={0.4} />
            <Area type="monotone" dataKey="SH" stackId="1" stroke="#ffc800" fill="#ffc800" fillOpacity={0.4} />
            <Area type="monotone" dataKey="BR" stackId="1" stroke="#805ad5" fill="#805ad5" fillOpacity={0.4} />
            <Area type="monotone" dataKey="EXP" stackId="1" stroke="#00b5d8" fill="#00b5d8" fillOpacity={0.4} />
            <Area type="monotone" dataKey="ECR" stackId="1" stroke="#ed8936" fill="#ed8936" fillOpacity={0.4} />
            <Area type="monotone" dataKey="TO" stackId="1" stroke="#ed64a6" fill="#ed64a6" fillOpacity={0.4} />
            <Legend formatter={(value) => <span className="text-xs text-muted-foreground">{STATUS_CONFIG[value]?.label || value}</span>} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Activity + Delistings */}
      <div className="grid md:grid-cols-2 gap-4">
        {canViewActivityLog && (
          <div className="glass-card rounded-xl p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Recent Activity</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {activities.length === 0 ? (
                <p className="text-xs text-muted-foreground">No recent activity</p>
              ) : activities.map(a => (
                <div key={a.id} className="flex items-start gap-2 text-xs">
                  <span className="text-muted-foreground shrink-0">{new Date(a.created_at).toLocaleTimeString()}</span>
                  <span className="text-primary font-medium">{a.user_name}</span>
                  <span className="text-muted-foreground">{a.action_type}</span>
                  {a.server_ids && <span className="font-mono text-foreground">{a.server_ids}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="glass-card rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Delisting Summary</h3>
          <div className="flex gap-6">
            <div>
              <p className="text-2xl font-bold text-foreground">{delistingsToday}</p>
              <p className="text-xs text-muted-foreground">Submitted today</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{approvedThisWeek}</p>
              <p className="text-xs text-muted-foreground">Approved this week</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
