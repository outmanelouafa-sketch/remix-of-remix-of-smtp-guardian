import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { STATUS_CONFIG, getDrnDays, getDrnColor } from '@/lib/statusColors';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Loader2, X, Copy, Shield } from 'lucide-react';

interface ContextMenu {
  serverId: string;
  serverIds: string;
  x: number;
  y: number;
}

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
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [serverFlags, setServerFlags] = useState<Record<string, { id: string; flag_type: string; flagged_by: string; created_at: string }>>({}); 

  // Column selection state
  const [selecting, setSelecting] = useState(false);
  const [selectCol, setSelectCol] = useState<number | null>(null);
  const [selectStartRow, setSelectStartRow] = useState<number | null>(null);
  const [selectEndRow, setSelectEndRow] = useState<number | null>(null);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const tableRef = useRef<HTMLTableElement>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadData();
  }, [month, year]);

  async function loadData() {
    setLoading(true);
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const endDay = new Date(year, month + 1, 0).getDate();
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

    const [sRes, stRes, fRes] = await Promise.all([
      supabase.from('servers').select('*').eq('section', 'production').order('ids'),
      supabase.from('smtp_status').select('*').gte('date', startDate).lte('date', endDate),
      supabase.from('server_flags').select('*'),
    ]);
    setServers(sRes.data || []);
    setStatuses(stRes.data || []);
    const flagMap: Record<string, any> = {};
    (fRes.data || []).forEach((f: any) => { flagMap[f.server_id] = f; });
    setServerFlags(flagMap);
    setLoading(false);
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const today = new Date();
  const isToday = (day: number) => today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

  const todayStr = today.toISOString().slice(0, 10);

  const filteredServers = useMemo(() => {
    const q = search.toLowerCase();
    return servers.filter(s => !q || s.ids?.toLowerCase().includes(q) || s.ip_main?.toLowerCase().includes(q));
  }, [servers, search]);

  const statusMap = useMemo(() => {
    const map: Record<string, any> = {};
    statuses.forEach(s => { map[`${s.server_id}_${s.date}`] = s; });
    return map;
  }, [statuses]);

  // Column selection handlers
  function handleCellDoubleClick(rowIdx: number, colDay: number, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setSelecting(true);
    setSelectCol(colDay);
    setSelectStartRow(rowIdx);
    setSelectEndRow(rowIdx);
    setSelectedCells(new Set([`${rowIdx}_${colDay}`]));
  }

  function handleCellMouseEnter(rowIdx: number, colDay: number) {
    if (!selecting || colDay !== selectCol) return;
    setSelectEndRow(rowIdx);
    const start = Math.min(selectStartRow!, rowIdx);
    const end = Math.max(selectStartRow!, rowIdx);
    const cells = new Set<string>();
    for (let r = start; r <= end; r++) {
      cells.add(`${r}_${colDay}`);
    }
    setSelectedCells(cells);
  }

  const handleMouseUp = useCallback(() => {
    if (selecting) {
      setSelecting(false);
    }
  }, [selecting]);

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseUp]);

  // Ctrl+C shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedCells.size > 0) {
        e.preventDefault();
        copySelectedCells();
      }
      if (e.key === 'Escape' && selectedCells.size > 0) {
        clearSelection();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCells, selectCol, selectStartRow, selectEndRow]);

  function copySelectedCells() {
    if (selectedCells.size === 0 || selectCol === null) return;
    const start = Math.min(selectStartRow!, selectEndRow!);
    const end = Math.max(selectStartRow!, selectEndRow!);
    const lines: string[] = [];
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(selectCol).padStart(2, '0')}`;

    for (let r = start; r <= end; r++) {
      const server = filteredServers[r];
      if (!server) continue;
      const entry = statusMap[`${server.id}_${dateStr}`];
      lines.push(entry ? `${server.ids}\t${entry.status}${entry.note ? '\t' + entry.note : ''}` : server.ids);
    }
    navigator.clipboard.writeText(lines.join('\n'));
    toast.success(`Copied ${lines.length} rows`);
    setSelectedCells(new Set());
    setSelectCol(null);
    setSelectStartRow(null);
    setSelectEndRow(null);
  }

  function clearSelection() {
    setSelectedCells(new Set());
    setSelectCol(null);
    setSelectStartRow(null);
    setSelectEndRow(null);
    setSelecting(false);
  }

  // Close context menu on click anywhere
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [contextMenu]);

  function handleContextMenu(server: any, e: React.MouseEvent) {
    e.preventDefault();
    setContextMenu({ serverId: server.id, serverIds: server.ids, x: e.clientX, y: e.clientY });
  }

  async function toggleSblFlag(serverId: string, serverIds: string) {
    const existing = serverFlags[serverId];
    if (existing) {
      await supabase.from('server_flags').delete().eq('id', existing.id);
      setServerFlags(prev => { const n = { ...prev }; delete n[serverId]; return n; });
      await logActivity(user!.name, 'remove_flag', serverIds, 'Removed SBL flag');
      toast.success('SBL flag removed');
    } else {
      const { data, error } = await supabase.from('server_flags').insert({
        server_id: serverId,
        flag_type: 'SBL',
        flagged_by: user!.name,
      }).select().single();
      if (error) { toast.error('Failed to flag server'); return; }
      setServerFlags(prev => ({ ...prev, [serverId]: data }));
      await logActivity(user!.name, 'add_flag', serverIds, 'Marked as Spamhaus SBL');
      toast.success('Marked as Spamhaus SBL');
    }
    setContextMenu(null);
  }

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
      const { error } = await supabase.from('smtp_status').update({
        status: selectedStatus,
        note,
        updated_by: user!.name,
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id);
      
      if (error) {
        toast.error('Failed to update status');
        setSaving(false);
        return;
      }
      
      setStatuses(prev => prev.map(s => s.id === existing.id ? {
        ...s,
        status: selectedStatus,
        note,
        updated_by: user!.name,
        updated_at: new Date().toISOString(),
      } : s));
    } else {
      const { data, error } = await supabase.from('smtp_status').insert({
        server_id: popup.serverId,
        date: popup.date,
        status: selectedStatus,
        note,
        updated_by: user!.name,
      }).select().single();
      
      if (error) {
        toast.error('Failed to add status');
        setSaving(false);
        return;
      }
      
      setStatuses(prev => [...prev, data]);
    }

    const srv = servers.find(s => s.id === popup.serverId);
    await logActivity(user!.name, 'update_smtp_status', srv?.ids, `Set ${selectedStatus} for ${popup.date}`);
    toast.success('Status updated');
    setSaving(false);
    setPopup(null);
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

      {/* Search filter + copy bar */}
      <div className="flex gap-2 items-center">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by IDs or IP..." className="glass-input rounded-lg px-3 py-1.5 text-sm text-foreground outline-none w-52" />
        {search && <button onClick={() => setSearch('')} className="text-xs text-muted-foreground hover:text-foreground px-2">Clear</button>}
        
        {selectedCells.size > 0 && (
          <div className="flex items-center gap-2 ml-2 px-3 py-1 rounded-lg bg-primary/10 border border-primary/20">
            <span className="text-xs text-primary font-medium">{selectedCells.size} selected</span>
            <button onClick={copySelectedCells} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-semibold">
              <Copy className="w-3 h-3" /> Copy
            </button>
            <button onClick={clearSelection} className="text-xs text-muted-foreground hover:text-foreground">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <span className="text-xs text-muted-foreground self-center ml-auto">{filteredServers.length} servers</span>
      </div>

      {/* Tip */}
      {selectedCells.size === 0 && (
        <p className="text-[10px] text-muted-foreground/60">💡 Double-click a cell then drag down to select · Ctrl+C to copy · Esc to cancel</p>
      )}

      {/* Grid */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table ref={tableRef} className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-card px-1.5 py-1.5 text-left text-[10px] text-muted-foreground uppercase font-semibold border-r border-border w-[70px] min-w-[70px]">IDS</th>
                <th className="sticky left-[70px] z-10 bg-card px-1.5 py-1.5 text-left text-[10px] text-muted-foreground uppercase font-semibold border-r border-border w-[110px] min-w-[110px]">IP</th>
                <th className="sticky left-[180px] z-10 bg-card px-1.5 py-1.5 text-left text-[10px] text-muted-foreground uppercase font-semibold border-r border-border w-[50px] min-w-[50px]">N.DUE</th>
                {days.map(d => (
                  <th
                    key={d}
                    className={`px-0 py-1.5 text-center text-[10px] font-semibold w-[34px] min-w-[34px] ${
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
              {filteredServers.map((server, rowIdx) => {
                const hasSbl = !!serverFlags[server.id];
                return (
                <tr key={server.id} className={`hover:bg-secondary/20 h-9 ${
                  server.created_at?.slice(0, 10) === todayStr ? 'bg-primary/15' : ''
                }`}
                  style={hasSbl ? { background: 'rgba(234, 179, 8, 0.15)' } : undefined}
                  onContextMenu={e => handleContextMenu(server, e)}
                >
                  <td className="sticky left-0 z-10 px-1.5 py-0.5 text-[11px] font-mono font-medium text-primary border-r border-border border-t" style={hasSbl ? { background: 'rgba(234, 179, 8, 0.18)' } : { background: 'hsl(var(--card))' }}>
                    {hasSbl && <Shield className="w-3 h-3 inline mr-0.5 text-yellow-500" />}
                    {server.ids}
                  </td>
                  <td className="sticky left-[70px] z-10 bg-card px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground border-r border-border border-t">{server.ip_main}</td>
                  <td className="sticky left-[180px] z-10 bg-card px-1.5 py-0.5 text-[11px] border-r border-border border-t">
                    {server.n_due && (
                      <span style={{ color: getDrnColor(getDrnDays(server.n_due) || 999) }}>{server.n_due?.slice(5)}</span>
                    )}
                  </td>
                  {days.map(d => {
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    const entry = statusMap[`${server.id}_${dateStr}`];
                    const isSelected = selectedCells.has(`${rowIdx}_${d}`);
                    return (
                      <td
                        key={d}
                        className={`px-0 py-0 border-t border-border cursor-pointer hover:bg-muted/30 transition-colors w-[64px] min-w-[64px] max-w-[64px] h-9 ${
                          isSelected ? 'bg-primary/20 outline outline-2 outline-primary/60 outline-offset-[-2px]' : ''
                        }`}
                        style={isToday(d) ? { borderLeft: '2px solid hsl(217 91% 64%)', borderRight: '2px solid hsl(217 91% 64%)' } : undefined}
                        onClick={e => {
                          if (selectedCells.size > 0) {
                            clearSelection();
                            return;
                          }
                          // Delay single-click to allow double-click to cancel it
                          if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
                          const evt = { clientX: e.clientX, clientY: e.clientY };
                          clickTimerRef.current = setTimeout(() => {
                            handleCellClick(server.id, d, evt as React.MouseEvent);
                            clickTimerRef.current = null;
                          }, 250);
                        }}
                        onDoubleClick={e => {
                          // Cancel single-click popup
                          if (clickTimerRef.current) {
                            clearTimeout(clickTimerRef.current);
                            clickTimerRef.current = null;
                          }
                          handleCellDoubleClick(rowIdx, d, e);
                        }}
                        onMouseEnter={() => handleCellMouseEnter(rowIdx, d)}
                        title={entry ? `${entry.status}${entry.note ? ': ' + entry.note : ''} — by ${entry.updated_by}` : 'Click to set status'}
                      >
                        {entry && (
                          <span
                            className="relative group flex items-center justify-center w-full h-full rounded-none text-[9px] font-bold cursor-pointer"
                            style={{ color: STATUS_CONFIG[entry.status]?.color, background: STATUS_CONFIG[entry.status]?.bg }}
                          >
                            {entry.status}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-50 min-w-[120px] p-2 rounded-lg text-xs text-foreground shadow-lg border border-border bg-card whitespace-nowrap">
                              <div className="font-semibold">{STATUS_CONFIG[entry.status]?.label}</div>
                              {entry.note && <div className="text-muted-foreground mt-0.5">{entry.note}</div>}
                              <div className="text-muted-foreground text-[10px] mt-0.5">by {entry.updated_by}</div>
                            </div>
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
