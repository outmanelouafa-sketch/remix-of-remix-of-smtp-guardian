import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { getDrnDays } from '@/lib/statusColors';
import { AlertTriangle, Server, ShieldAlert, ShieldCheck, CheckCircle2, FileWarning, Loader2 } from 'lucide-react';

export default function DashboardPage() {
  const { user, canViewActivityLog } = useAuth();
  const [loading, setLoading] = useState(true);
  const [servers, setServers] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
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
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

    const [sRes, stRes, dRes, aRes] = await Promise.all([
      supabase.from('servers').select('*'),
      supabase.from('smtp_status').select('*').eq('date', today),
      supabase.from('delistings').select('*'),
      supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(10),
    ]);

    setServers(sRes.data || []);
    setStatuses(stRes.data || []);
    setDelistings(dRes.data || []);
    setActivities(aRes.data || []);
    setLoading(false);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const production = servers.filter(s => s.section === 'production');
  const suspended = servers.filter(s => s.section === 'suspended');
  const expiringSoon = production.filter(s => {
    const drn = getDrnDays(s.n_due);
    return drn !== null && drn <= 5;
  });

  const todayBL = statuses.filter(s => s.status === 'BL').length;
  const todaySH = statuses.filter(s => s.status === 'SH').length;
  const todayClean = statuses.filter(s => s.status === 'CLEAN').length;

  const today2 = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const delistingsThisWeek = delistings.filter(d => d.submitted_date >= weekAgo).length;
  const delistingsToday = delistings.filter(d => d.submitted_date === today2).length;
  const approvedThisWeek = delistings.filter(d => d.submitted_date >= weekAgo && d.result === 'approved').length;

  const stats = [
    { label: 'Production Servers', value: production.length, icon: Server, color: 'text-primary' },
    { label: 'Suspended', value: suspended.length, icon: FileWarning, color: 'text-status-ecr' },
    { label: 'Blacklisted Today', value: todayBL, icon: ShieldAlert, color: 'text-status-bl' },
    { label: 'Spamhaus Today', value: todaySH, icon: ShieldAlert, color: 'text-status-sh' },
    { label: 'Clean Today', value: todayClean, icon: CheckCircle2, color: 'text-status-clean' },
    { label: 'Delistings This Week', value: delistingsThisWeek, icon: ShieldCheck, color: 'text-primary' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
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

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map((s, i) => (
          <div key={i} className="glass-card rounded-xl p-4" style={{ animationDelay: `${i * 50}ms` }}>
            <s.icon className={`w-5 h-5 ${s.color} mb-2`} />
            <p className="text-2xl font-bold text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

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
