import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { HighlightText } from '@/components/HighlightText';

export default function ActivityLogPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterUser, setFilterUser] = useState('');
  const [filterAction, setFilterAction] = useState('');

  useEffect(() => {
    loadLogs();
    const channel = supabase.channel('activity-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_log' }, () => loadLogs())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function loadLogs() {
    setLoading(true);
    const { data } = await supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(200);
    setLogs(data || []);
    setLoading(false);
  }

  const filtered = logs.filter(l =>
    (!filterUser || l.user_name.toLowerCase().includes(filterUser.toLowerCase())) &&
    (!filterAction || l.action_type.toLowerCase().includes(filterAction.toLowerCase()))
  );

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex gap-3">
        <input
          value={filterUser}
          onChange={e => setFilterUser(e.target.value)}
          placeholder="Filter by user..."
          className="glass-input rounded-lg px-3 py-1.5 text-sm text-foreground outline-none w-48"
        />
        <input
          value={filterAction}
          onChange={e => setFilterAction(e.target.value)}
          placeholder="Filter by action..."
          className="glass-input rounded-lg px-3 py-1.5 text-sm text-foreground outline-none w-48"
        />
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full dense-table">
            <thead>
              <tr className="text-left">
                <th>Time</th><th>User</th><th>Action</th><th>Server</th><th>Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No activity</td></tr>
              ) : filtered.map(l => (
                <tr key={l.id} className="hover:bg-secondary/30">
                  <td className="text-muted-foreground whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
                  <td className="text-primary font-medium"><HighlightText text={l.user_name} query={filterUser} /></td>
                  <td>
                    <span className="status-pill" style={{ color: 'hsl(217 91% 64%)', background: 'rgba(79,142,247,0.12)' }}>
                      <HighlightText text={l.action_type} query={filterAction} />
                    </span>
                  </td>
                  <td className="font-mono">{l.server_ids}</td>
                  <td className="max-w-[250px] truncate text-muted-foreground">{l.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
