import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { STATUS_CONFIG, getDrnDays, getDrnColor } from '@/lib/statusColors';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Loader2, X, Copy, Shield, Users, UserPlus, Trash2 } from 'lucide-react';

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
  
  // SMTP Manager filter state (for boss/server_manager only)
  const [smtpManagers, setSmtpManagers] = useState<any[]>([]);
  const [selectedSmtpManager, setSelectedSmtpManager] = useState<string>('');
  
  // Assignment context menu state
  const [showAssignMenu, setShowAssignMenu] = useState(false);
  const [assignMenuPosition, setAssignMenuPosition] = useState<{ x: number; y: number } | null>(null);
  
  // Suspended/Deleted servers
  const [showSuspended, setShowSuspended] = useState(false);
  const [suspendedServers, setSuspendedServers] = useState<any[]>([]);
  const [section, setSection] = useState<'production' | 'suspended'>('production');
  const [allSectionServers, setAllSectionServers] = useState<Record<string, any[]>>({
    production: [],
    suspended: []
  });

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
    loadSmtpManagers();
    
    // Real-time subscription for assignment changes
    const assignmentChannel = supabase.channel('smtp-assignments')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'server_smtp_assignments' }, 
        () => loadData()
      )
      .subscribe();
    
    return () => { supabase.removeChannel(assignmentChannel); };
  }, [month, year, user?.id]);

  // Instant section switching (no reload)
  useEffect(() => {
    if (user?.role === 'boss' || user?.role === 'server_manager') {
      setServers(allSectionServers[section] || []);
    }
  }, [section, allSectionServers]);

  // Reload data when SMTP manager filter changes (without showing loading)
  useEffect(() => {
    if (user?.role === 'boss' || user?.role === 'server_manager') {
      loadData(true); // skipLoading = true - this will update allSectionServers
    }
  }, [selectedSmtpManager, user?.id]);

  async function loadSmtpManagers() {
    // Only load for boss and server_manager
    if (user?.role === 'boss' || user?.role === 'server_manager') {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'smtp_manager')
        .order('name');
      
      if (error) {
        console.error('Error loading SMTP managers:', error);
        return;
      }
      
      console.log('Loaded SMTP managers:', data);
      setSmtpManagers(data || []);
    }
  }

  async function loadData(skipLoading = false) {
    if (!skipLoading) setLoading(true);
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const endDay = new Date(year, month + 1, 0).getDate();
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

    // Check if current user is smtp_manager
    const isSmtpManager = user?.role === 'smtp_manager';
    const canViewAllSections = user?.role === 'boss' || user?.role === 'server_manager';

    // Load servers for all sections if user can view all
    if (canViewAllSections) {
      // Check if filtering by specific SMTP manager
      let assignedServerIds: string[] | null = null;
      if (selectedSmtpManager) {
        const { data: assignments } = await supabase
          .from('server_smtp_assignments')
          .select('server_id')
          .eq('smtp_manager_id', selectedSmtpManager);
        assignedServerIds = assignments?.map(a => a.server_id) || [];
      }

      let prodQuery = supabase.from('servers').select('*').eq('section', 'production');
      let suspQuery = supabase.from('servers').select('*').eq('section', 'suspended');
      
      // Apply SMTP manager filter if a manager is selected
      if (selectedSmtpManager && assignedServerIds !== null) {
        if (assignedServerIds.length > 0) {
          // Manager has servers - show only those
          prodQuery = prodQuery.in('id', assignedServerIds);
          suspQuery = suspQuery.in('id', assignedServerIds);
        } else {
          // Manager has NO servers - return empty results
          prodQuery = prodQuery.eq('id', '00000000-0000-0000-0000-000000000000'); // Impossible ID
          suspQuery = suspQuery.eq('id', '00000000-0000-0000-0000-000000000000');
        }
      }

      const [prodRes, suspRes, stRes, fRes] = await Promise.all([
        prodQuery.order('ids'),
        suspQuery.order('ids'),
        supabase.from('smtp_status').select('*').gte('date', startDate).lte('date', endDate),
        supabase.from('server_flags').select('*'),
      ]);

      setAllSectionServers({
        production: prodRes.data || [],
        suspended: suspRes.data || []
      });
      setServers(section === 'production' ? (prodRes.data || []) : (suspRes.data || []));
      setStatuses(stRes.data || []);
      const flagMap: Record<string, any> = {};
      (fRes.data || []).forEach((f: any) => { flagMap[f.server_id] = f; });
      setServerFlags(flagMap);
    } else {
      // SMTP manager - only load their assigned servers
      let serversQuery = supabase
        .from('servers')
        .select('*')
        .eq('section', section);

      if (user?.id) {
        const { data: assignments } = await supabase
          .from('server_smtp_assignments')
          .select('server_id')
          .eq('smtp_manager_id', user.id);
        
        const assignedServerIds = assignments?.map(a => a.server_id) || [];
        
        if (assignedServerIds.length === 0) {
          setServers([]);
          setStatuses([]);
          setServerFlags({});
          if (!skipLoading) setLoading(false);
          return;
        }
        
        serversQuery = serversQuery.in('id', assignedServerIds);
      }

      const [sRes, stRes, fRes] = await Promise.all([
        serversQuery.order('ids'),
        supabase.from('smtp_status').select('*').gte('date', startDate).lte('date', endDate),
        supabase.from('server_flags').select('*'),
      ]);
      setServers(sRes.data || []);
      setStatuses(stRes.data || []);
      const flagMap: Record<string, any> = {};
      (fRes.data || []).forEach((f: any) => { flagMap[f.server_id] = f; });
      setServerFlags(flagMap);
    }
    
    if (!skipLoading) setLoading(false);
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
    if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; }
    setPopup(null);
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
    setShowAssignMenu(false); // Reset submenu state
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

  async function assignServerToManager(serverId: string, serverIds: string, managerId: string) {
    console.log('Assigning server:', { serverId, serverIds, managerId });
    try {
      // Get manager name
      const manager = smtpManagers.find(m => m.id === managerId);
      console.log('Found manager:', manager);
      
      if (!manager) {
        toast.error('Manager not found');
        return;
      }

      // Delete existing assignments for this server
      await supabase
        .from('server_smtp_assignments')
        .delete()
        .eq('server_id', serverId);

      // Insert new assignment
      const { error } = await supabase
        .from('server_smtp_assignments')
        .insert({
          server_id: serverId,
          smtp_manager_id: managerId,
          assigned_by: user!.name,
        });

      if (error) throw error;

      // Log activity
      await logActivity(
        user!.name,
        'ASSIGNED_SERVERS',
        serverIds,
        `Reassigned server ${serverIds} to ${manager.name}`
      );

      toast.success(`Assigned ${serverIds} to ${manager.name}`);
      setShowAssignMenu(false);
      setContextMenu(null);
      
      // Reload data to reflect changes
      loadData(true);
    } catch (error: any) {
      console.error('Assignment error:', error);
      toast.error('Failed to assign server: ' + error.message);
    }
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
    
    // Check if status is problematic and notify server manager
    const problematicStatuses = ['ECR', 'TO', 'EXP'];
    
    if (problematicStatuses.includes(selectedStatus) && srv) {
      const statusMessages: Record<string, string> = {
        ECR: 'Error Connection Refused',
        TO: 'Connection Timed Out',
        EXP: 'Server Expired'
      };
      
      const alertMessage = `⚠️ SERVER ISSUE DETECTED\n\n` +
        `Server IDS: ${srv.ids}\n` +
        `Server IP: ${srv.ip_main || 'N/A'}\n` +
        `Issue: ${statusMessages[selectedStatus]}\n` +
        `Status: ${selectedStatus}\n` +
        `Date: ${popup.date}\n` +
        `Reported by: ${user!.name} (${user?.role})\n` +
        (note ? `Note: ${note}` : '');
      
      // Log as server alert for server_manager to see
      await logActivity(user!.name, 'server_alert', srv.ids, alertMessage);
      
      // Show warning toast notification
      toast.warning(
        <div>
          <div className="font-bold text-sm">⚠️ Server Issue Detected</div>
          <div className="text-xs mt-1">
            <strong>{srv.ids}</strong> - {statusMessages[selectedStatus]}
          </div>
          <div className="text-xs mt-1 text-muted-foreground">
            Server Manager has been notified
          </div>
        </div>,
        { 
          duration: 6000,
        }
      );
    } else {
      toast.success('Status updated');
    }
    
    setSaving(false);
    setPopup(null);
  }

  async function handleDeleteStatus() {
    if (!popup) return;
    const existing = statusMap[`${popup.serverId}_${popup.date}`];
    if (!existing) return;
    setSaving(true);
    const { error } = await supabase.from('smtp_status').delete().eq('id', existing.id);
    if (error) { toast.error('Failed to delete status'); setSaving(false); return; }
    setStatuses(prev => prev.filter(s => s.id !== existing.id));
    const srv = servers.find(s => s.id === popup.serverId);
    await logActivity(user!.name, 'delete_smtp_status', srv?.ids, `Cleared status for ${popup.date}`);
    toast.success('Status cleared');
    setSaving(false);
    setPopup(null);
  }

  async function handleDeleteSelectedStatuses() {
    if (selectedCells.size === 0 || selectCol === null) return;
    const start = Math.min(selectStartRow!, selectEndRow!);
    const end = Math.max(selectStartRow!, selectEndRow!);
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(selectCol).padStart(2, '0')}`;
    const toDelete: { id: string; serverId: string }[] = [];
    for (let r = start; r <= end; r++) {
      const server = filteredServers[r];
      if (!server) continue;
      const entry = statusMap[`${server.id}_${dateStr}`];
      if (entry) toDelete.push({ id: entry.id, serverId: server.id });
    }
    if (toDelete.length === 0) { toast('No statuses to clear'); return; }
    const ids = toDelete.map(d => d.id);
    const { error } = await supabase.from('smtp_status').delete().in('id', ids);
    if (error) { toast.error('Failed to delete statuses'); return; }
    setStatuses(prev => prev.filter(s => !ids.includes(s.id)));
    await logActivity(user!.name, 'bulk_delete_smtp_status', `${toDelete.length} servers`, `Cleared statuses for ${dateStr}`);
    toast.success(`Cleared ${toDelete.length} statuses`);
    clearSelection();
  }


  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

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

      {/* Section Tabs - Only for boss and server_manager */}
      {(user?.role === 'boss' || user?.role === 'server_manager') && (
        <div className="flex gap-1">
          <button
            onClick={() => setSection('production')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              section === 'production' ? 'glass-button' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Production ({allSectionServers.production?.length || 0})
          </button>
          <button
            onClick={() => setSection('suspended')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              section === 'suspended' ? 'glass-button' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Suspended ({allSectionServers.suspended?.length || 0})
          </button>
        </div>
      )}

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

      {/* SMTP Manager Selector (for boss/server_manager only) */}
      {(user?.role === 'boss' || user?.role === 'server_manager') && smtpManagers.length > 0 && (
        <div className="glass-card rounded-xl p-3">
          <div className="flex items-center gap-3">
            <Users className="w-4 h-4 text-primary" />
            <label className="text-sm font-medium text-foreground">View SMTP Manager:</label>
            <select
              value={selectedSmtpManager}
              onChange={(e) => setSelectedSmtpManager(e.target.value)}
              className="glass-input rounded-lg px-3 py-1.5 text-sm text-foreground outline-none bg-card min-w-[200px]"
            >
              <option value="">All Servers</option>
              {smtpManagers.map(manager => (
                <option key={manager.id} value={manager.id}>
                  {manager.name} ({manager.email})
                </option>
              ))}
            </select>
            {selectedSmtpManager && (
              <button 
                onClick={() => setSelectedSmtpManager('')} 
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

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
            <button onClick={handleDeleteSelectedStatuses} className="flex items-center gap-1 text-xs text-destructive hover:text-destructive/80 font-semibold">
              <Trash2 className="w-3 h-3" /> Clear
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
                          if (selecting) return;
                          if (selectedCells.size > 0) {
                            clearSelection();
                            return;
                          }
                          if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
                          const evt = { clientX: e.clientX, clientY: e.clientY };
                          clickTimerRef.current = setTimeout(() => {
                            if (!selecting) {
                              handleCellClick(server.id, d, evt as React.MouseEvent);
                            }
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
                );
              })}
              {servers.length === 0 && (
                <tr><td colSpan={3 + daysInMonth} className="text-center py-8 text-muted-foreground text-sm">No production servers</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Sheet Status Panel */}
      {popup && (
        <>
          <div className="fixed inset-0 z-40 bg-background/40 backdrop-blur-sm" onClick={() => setPopup(null)} />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card shadow-[0_-8px_30px_rgba(0,0,0,0.3)] animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="max-w-3xl mx-auto px-6 pb-5 pt-2">
              {/* Header row */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-xs text-muted-foreground">Server</span>
                    <p className="text-sm font-bold text-foreground">{servers.find(s => s.id === popup.serverId)?.ids || '—'}</p>
                  </div>
                  <div className="w-px h-8 bg-border" />
                  <div>
                    <span className="text-xs text-muted-foreground">Date</span>
                    <p className="text-sm font-bold text-foreground">{popup.date}</p>
                  </div>
                  {statusMap[`${popup.serverId}_${popup.date}`] && (
                    <>
                      <div className="w-px h-8 bg-border" />
                      <div>
                        <span className="text-xs text-muted-foreground">Current</span>
                        <p className="text-sm font-bold" style={{ color: STATUS_CONFIG[statusMap[`${popup.serverId}_${popup.date}`].status]?.color }}>
                          {statusMap[`${popup.serverId}_${popup.date}`].status}
                        </p>
                      </div>
                    </>
                  )}
                </div>
                <button onClick={() => setPopup(null)} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted/50">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {/* Status buttons */}
              <div className="flex flex-wrap gap-2 mb-4">
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <button
                    key={key}
                    onClick={() => { setSelectedStatus(key); }}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                      selectedStatus === key ? 'ring-2 ring-offset-2 ring-offset-card scale-105' : 'hover:scale-105'
                    }`}
                    style={{ color: cfg.color, background: cfg.bg, ...(selectedStatus === key ? { boxShadow: `0 0 12px ${cfg.color}40` } : {}) }}
                  >
                    {key}
                  </button>
                ))}
              </div>
              {/* Note + actions */}
              <div className="flex items-center gap-3">
                <input
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Note (optional)"
                  className="flex-1 glass-input rounded-lg px-3 py-2 text-sm text-foreground outline-none"
                />
                {statusMap[`${popup.serverId}_${popup.date}`] && (
                  <button
                    onClick={handleDeleteStatus}
                    disabled={saving}
                    className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 flex items-center gap-2 border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    <Trash2 className="w-3.5 h-3.5" /> Clear
                  </button>
                )}
                <button
                  onClick={handleSaveStatus}
                  disabled={!selectedStatus || saving}
                  className="glass-button rounded-lg px-6 py-2 text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-[100] min-w-[200px] rounded-xl border border-border bg-card shadow-2xl animate-fade-in overflow-hidden"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={e => e.stopPropagation()}
        >
          <div className="px-3 py-2 border-b border-border">
            <span className="text-xs font-semibold text-foreground">{contextMenu.serverIds}</span>
          </div>
          
          {/* Assign to Manager section (only for boss/server_manager) */}
          {(user?.role === 'boss' || user?.role === 'server_manager') && (
            <>
              <div className="px-3 py-1.5 bg-muted/30 border-b border-border">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Assign to Manager</span>
              </div>
              {smtpManagers.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">Loading managers...</div>
              ) : (
                smtpManagers.map(manager => (
                  <button
                    key={manager.id}
                    onClick={() => {
                      console.log('Clicked assign to:', manager.name);
                      assignServerToManager(contextMenu.serverId, contextMenu.serverIds, manager.id);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/50 transition-colors text-left border-b border-border/50 last:border-b-0"
                  >
                    <UserPlus className="w-3.5 h-3.5 text-primary" />
                    <div className="flex-1">
                      <div className="text-foreground text-xs font-medium">{manager.name}</div>
                      <div className="text-muted-foreground text-[10px]">{manager.email}</div>
                    </div>
                  </button>
                ))
              )}
            </>
          )}
          
          <button
            onClick={() => toggleSblFlag(contextMenu.serverId, contextMenu.serverIds)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors text-left"
          >
            <Shield className={`w-4 h-4 ${serverFlags[contextMenu.serverId] ? 'text-yellow-500' : 'text-muted-foreground'}`} />
            <span className="text-foreground">
              {serverFlags[contextMenu.serverId] ? 'Remove Spamhaus SBL' : 'Mark as Spamhaus SBL'}
            </span>
            {serverFlags[contextMenu.serverId] && (
              <span className="ml-auto text-[10px] text-muted-foreground">by {serverFlags[contextMenu.serverId].flagged_by}</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
