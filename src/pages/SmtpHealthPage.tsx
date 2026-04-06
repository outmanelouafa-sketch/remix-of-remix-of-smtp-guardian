import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { STATUS_CONFIG, getDrnDays, getDrnColor } from '@/lib/statusColors';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react';

export default function SmtpHealthPage() {
  const { user } = useAuth();
  const [servers, setServers] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  const [popup, setPopup] = useState<{ serverId: string; date: string; x: number; y: number } | null>(null);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadData();
    const channels = [
      supabase.channel('smtp-servers').on('postgres_changes', { event: '*', schema: 'public', table: 'servers' }, () => loadData()).subscribe(),
      supabase.channel('smtp-status').on('postgres_changes', { event: '*', schema: 'public', table: 'smtp_status' }, () => loadData()).subscribe(),
    ];
    return () => { channels.forEach(c => supabase.removeChannel(c)); };
  }, [month, year]);

  async function loadData() {
    setLoading(true);
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const endDay = new Date(year, month + 1, 0).getDate();
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

    const [sRes, stRes] = await Promise.all([
      supabase.from('servers').select('*').eq('section', 'production').order('ids'),
      supabase.from('smtp_status').select('*').gte('date', startDate).lte('date', endDate),
    ]);
    setServers(sRes.data || []);
    setStatuses(stRes.data || []);
    setLoading(false);
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const today = new Date();
  const isToday = (day: number) => today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

  const statusMap = useMemo(() => {
    const map: Record<string, any> = {};
    statuses.forEach(s => { map[`${s.server_id}_${s.date}`] = s; });
    return map;
  }, [statuses]);

  function handleCellClick(serverId: string, day: number, e: React.MouseEvent) {
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const existing = statusMap[`${serverId}_${date}`];
    setSelectedStatus(existing?.status || '');
    setNote(existing?.note || '');
    setPopup({ serverId, date, x: e.clientX, y: e.clientY });
  }

  async function handleSaveStatus() {
    if (!popup || !selectedStatus) return;
    setSaving(true);

    const existing = statusMap[`${popup.serverId}_${popup.date}`];
    if (existing) {
      await supabase.from('smtp_status').update({
        status: selectedStatus,
        note,
        updated_by: user!.name,
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id);
    } else {
      await supabase.from('smtp_status').insert({
        server_id: popup.serverId,
        date: popup.date,
        status: selectedStatus,
        note,
        updated_by: user!.name,
      });
    }

    const srv = servers.find(s => s.id === popup.serverId);
    await logActivity(user!.name, 'update_smtp_status', srv?.ids, `Set ${selectedStatus} for ${popup.date}`);
    toast.success('Status updated');
    setSaving(false);
    setPopup(null);
    loadData();
  }

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Legend */}
      <div className="glass-card rounded-xl p-3 flex flex-wrap gap-3">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: cfg.color }} />
            <span className="text-xs text-muted-foreground">{key} — {cfg.label}</span>
          </div>
        ))}
      </div>

      {/* Month nav */}
      <div className="flex items-center gap-3">
        <button onClick={() => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); }} className="glass-button rounded-lg p-1.5">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-foreground min-w-[150px] text-center">{monthNames[month]} {year}</span>
        <button onClick={() => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); }} className="glass-button rounded-lg p-1.5">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Search filter */}
      <div className="flex gap-2">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by IDs or IP..." className="glass-input rounded-lg px-3 py-1.5 text-sm text-foreground outline-none w-52" />
        {search && <button onClick={() => setSearch('')} className="text-xs text-muted-foreground hover:text-foreground px-2">Clear</button>}
        <span className="text-xs text-muted-foreground self-center ml-auto">{servers.filter(s => { const q = search.toLowerCase(); return !q || s.ids?.toLowerCase().includes(q) || s.ip_main?.toLowerCase().includes(q); }).length} servers</span>
      </div>

      {/* Grid */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-card px-1.5 py-1.5 text-left text-[10px] text-muted-foreground uppercase font-semibold border-r border-border w-[70px] min-w-[70px]">IDS</th>
                <th className="sticky left-[70px] z-10 bg-card px-1.5 py-1.5 text-left text-[10px] text-muted-foreground uppercase font-semibold border-r border-border w-[110px] min-w-[110px]">IP</th>
                <th className="sticky left-[180px] z-10 bg-card px-1.5 py-1.5 text-left text-[10px] text-muted-foreground uppercase font-semibold border-r border-border w-[50px] min-w-[50px]">N.DUE</th>
                {days.map(d => (
                  <th
                    key={d}
                    className={`px-0 py-1.5 text-center text-[10px] font-semibold w-[28px] min-w-[28px] ${
                      isToday(d) ? 'text-primary' : 'text-muted-foreground'
                    }`}
                    style={isToday(d) ? { borderLeft: '2px solid hsl(217 91% 64%)', borderRight: '2px solid hsl(217 91% 64%)' } : undefined}
                  >
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {servers.filter(s => { const q = search.toLowerCase(); return !q || s.ids?.toLowerCase().includes(q) || s.ip_main?.toLowerCase().includes(q); }).map(server => (
                <tr key={server.id} className="hover:bg-secondary/20 h-9">
                  <td className="sticky left-0 z-10 bg-card px-1.5 py-0.5 text-[11px] font-mono font-medium text-primary border-r border-border border-t">{server.ids}</td>
                  <td className="sticky left-[70px] z-10 bg-card px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground border-r border-border border-t">{server.ip_main}</td>
                  <td className="sticky left-[180px] z-10 bg-card px-1.5 py-0.5 text-[11px] border-r border-border border-t">
                    {server.n_due && (
                      <span style={{ color: getDrnColor(getDrnDays(server.n_due) || 999) }}>{server.n_due?.slice(5)}</span>
                    )}
                  </td>
                  {days.map(d => {
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    const entry = statusMap[`${server.id}_${dateStr}`];
                    return (
                      <td
                        key={d}
                        className="px-0 py-0.5 text-center border-t border-border cursor-pointer hover:bg-muted/30 transition-colors"
                        style={isToday(d) ? { borderLeft: '2px solid hsl(217 91% 64%)', borderRight: '2px solid hsl(217 91% 64%)' } : undefined}
                        onClick={e => handleCellClick(server.id, d, e)}
                        title={entry ? `${entry.status}${entry.note ? ': ' + entry.note : ''} — by ${entry.updated_by}` : 'Click to set status'}
                      >
                        {entry && (
                          <span
                            className="inline-block w-[26px] h-[18px] rounded text-[8px] font-bold leading-[18px]"
                            style={{ color: STATUS_CONFIG[entry.status]?.color, background: STATUS_CONFIG[entry.status]?.bg }}
                          >
                            {entry.status}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {servers.length === 0 && (
                <tr><td colSpan={3 + daysInMonth} className="text-center py-8 text-muted-foreground text-sm">No production servers</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Popup */}
      {popup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/50" onClick={() => setPopup(null)}>
          <div className="glass-card rounded-xl p-5 w-80 animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Set Status — {popup.date}</h3>
              <button onClick={() => setPopup(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => setSelectedStatus(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    selectedStatus === key ? 'ring-2 ring-offset-1 ring-offset-card' : ''
                  }`}
                  style={{ color: cfg.color, background: cfg.bg, ...(selectedStatus === key ? { ringColor: cfg.color } : {}) }}
                >
                  {key}
                </button>
              ))}
            </div>
            <input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Note (optional)"
              className="w-full glass-input rounded-lg px-3 py-2 text-sm text-foreground outline-none mb-3"
            />
            <button
              onClick={handleSaveStatus}
              disabled={!selectedStatus || saving}
              className="w-full glass-button rounded-lg py-2 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
