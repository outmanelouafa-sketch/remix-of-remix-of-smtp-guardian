import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { getDrnDays, getDrnColor } from '@/lib/statusColors';
import { toast } from 'sonner';
import { Plus, Trash2, PauseCircle, RotateCcw, Loader2, X, Check, AlertTriangle, Bell, Users, ExternalLink, Link2 } from 'lucide-react';

interface ServerRow {
  id: string; ids: string; ip_main: string; domain: string; provider: string; rdns: string;
  score: string; d_pro: string; n_due: string; password: string;
  email: string; passwd: string; price: string; section: string; notes: string;
}

const emptyServer = {
  ids: '', ip_main: '', domain: '', provider: '', rdns: '', score: '',
  d_pro: null as string | null, n_due: null as string | null, password: '', email: '', passwd: '',
  price: '', section: 'production', notes: '',
};

const NOTE_COLORS = [
  'hsl(210, 80%, 55%)', 'hsl(340, 75%, 55%)', 'hsl(150, 60%, 40%)',
  'hsl(45, 85%, 50%)', 'hsl(280, 65%, 55%)', 'hsl(20, 80%, 55%)',
  'hsl(180, 60%, 40%)', 'hsl(0, 70%, 55%)', 'hsl(120, 50%, 45%)',
];

function getNoteColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return NOTE_COLORS[Math.abs(hash) % NOTE_COLORS.length];
}

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query || !text) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary/25 text-foreground rounded-sm px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function NoteCell({ value, serverId, onSave, highlightQuery }: { value: string; serverId: string; onSave: (v: string) => void; highlightQuery?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const color = getNoteColor(serverId);
  const firstWord = value ? value.split(/\s+/)[0] : '';

  useEffect(() => {
    if (editing) { setDraft(value); setTimeout(() => inputRef.current?.focus(), 0); }
  }, [editing]);

  const save = () => { if (draft !== value) onSave(draft); setEditing(false); };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
        onBlur={save}
        className="w-full bg-primary/10 border border-primary/30 rounded px-1 py-0.5 text-xs outline-none text-foreground"
      />
    );
  }

  if (!value) {
    return (
      <div onClick={() => setEditing(true)} className="cursor-pointer text-muted-foreground/40 hover:bg-primary/5 rounded px-0.5 min-h-[20px]">—</div>
    );
  }

  const hasMatch = highlightQuery && value.toLowerCase().includes(highlightQuery.toLowerCase());

  return (
    <div onClick={() => setEditing(true)} className="cursor-pointer group relative">
      <span
        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold truncate max-w-[70px] ${hasMatch ? 'ring-2 ring-primary/50' : ''}`}
        style={{ color: 'white', background: color }}
      >
        {firstWord}
      </span>
      <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block z-50 max-w-[250px] p-2 rounded-lg text-xs text-foreground shadow-lg border border-border bg-card whitespace-pre-wrap">
        {highlightQuery ? <HighlightText text={value} query={highlightQuery} /> : value}
      </div>
    </div>
  );
}

const EDITABLE_COLUMNS: { key: keyof ServerRow; label: string; type?: string }[] = [
  { key: 'ids', label: 'IDs' },
  { key: 'ip_main', label: 'IP Main' },
  { key: 'domain', label: 'Domain' },
  { key: 'provider', label: 'Provider' },
  { key: 'd_pro', label: 'D.Pro', type: 'date' },
  { key: 'n_due', label: 'N.DUE', type: 'date' },
  { key: 'price', label: 'Price' },
  { key: 'password', label: 'Password' },
  { key: 'email', label: 'Email' },
  { key: 'passwd', label: 'Passwd' },
];

function InlineCell({ value, type, onSave, highlightQuery, fieldKey, existingValues }: { value: string; type?: string; onSave: (v: string) => void; highlightQuery?: string; fieldKey?: string; existingValues?: string[] }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [showDropdown, setShowDropdown] = useState(false);
  const [customInput, setCustomInput] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(value);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [editing]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  const save = () => {
    if (draft !== value) onSave(draft);
    setEditing(false);
    setShowDropdown(false);
    setCustomInput(false);
  };

  const cancel = () => { setDraft(value); setEditing(false); setShowDropdown(false); setCustomInput(false); };

  const handleSelect = (selectedValue: string) => {
    if (selectedValue === '__custom__') {
      setCustomInput(true);
      setDraft('');
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setDraft(selectedValue);
      if (selectedValue !== value) onSave(selectedValue);
      setEditing(false);
      setShowDropdown(false);
    }
  };

  if (!editing) {
    return (
      <div
        onClick={() => {
          setEditing(true);
          if (existingValues && existingValues.length > 0) {
            setShowDropdown(true);
            setCustomInput(false);
          }
        }}
        className="cursor-pointer min-h-[20px] w-full truncate hover:bg-primary/5 rounded px-0.5 -mx-0.5 relative"
        title="Click to edit"
      >
        {value ? (highlightQuery ? <HighlightText text={value} query={highlightQuery} /> : value) : <span className="text-muted-foreground/40">—</span>}
        
        {showDropdown && existingValues && (
          <div ref={dropdownRef} className="absolute top-full left-0 mt-1 z-50 glass-card rounded-lg shadow-lg border border-border min-w-[200px] max-h-[200px] overflow-y-auto">
            {!customInput ? (
              <div className="py-1">
                {existingValues.map((existingValue) => (
                  <button
                    key={existingValue}
                    onClick={() => handleSelect(existingValue)}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-primary/10 transition-colors text-foreground"
                  >
                    {existingValue}
                  </button>
                ))}
                <button
                  onClick={() => handleSelect('__custom__')}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-primary/10 transition-colors text-primary font-medium border-t border-border"
                >
                  + Add New
                </button>
              </div>
            ) : (
              <div className="p-2">
                <input
                  ref={inputRef}
                  type={type || 'text'}
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
                  onBlur={save}
                  className="w-full bg-primary/10 border border-primary/30 rounded px-2 py-1 text-xs outline-none text-foreground"
                  placeholder="Enter new value..."
                />
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (showDropdown && existingValues && !customInput) {
    return (
      <div ref={dropdownRef} className="relative">
        <div className="absolute top-full left-0 mt-1 z-50 glass-card rounded-lg shadow-lg border border-border min-w-[200px] max-h-[200px] overflow-y-auto">
          <div className="py-1">
            {existingValues.map((existingValue) => (
              <button
                key={existingValue}
                onClick={() => handleSelect(existingValue)}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-primary/10 transition-colors text-foreground"
              >
                {existingValue}
              </button>
            ))}
            <button
              onClick={() => handleSelect('__custom__')}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-primary/10 transition-colors text-primary font-medium border-t border-border"
            >
              + Add New
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        ref={inputRef}
        type={type || 'text'}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
        onBlur={save}
        className="w-full bg-primary/10 border border-primary/30 rounded px-1 py-0.5 text-xs outline-none text-foreground"
      />
    </div>
  );
}

export default function ServersPage() {
  const { user } = useAuth();
  const [servers, setServers] = useState<ServerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'production' | 'redirect' | 'suspended'>('production');
  const [search, setSearch] = useState('');
  const [filterProvider, setFilterProvider] = useState('');
  const [filterDomain, setFilterDomain] = useState('');
  const [filterSmtpManager, setFilterSmtpManager] = useState('');
  const [serverAlerts, setServerAlerts] = useState<any[]>([]);
  const [showAlerts, setShowAlerts] = useState(true);
  
  // Assignment modal state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [smtpManagers, setSmtpManagers] = useState<any[]>([]);
  const [selectedManager, setSelectedManager] = useState('');
  const [selectedServers, setSelectedServers] = useState<Set<string>>(new Set());
  const [assignments, setAssignments] = useState<any[]>([]);
  const [assigning, setAssigning] = useState(false);
  
  // Single server assignment popup
  const [singleAssignPopup, setSingleAssignPopup] = useState<{ serverId: string; serverIds: string; x: number; y: number } | null>(null);

  // Provider URL state
  const [providerUrls, setProviderUrls] = useState<Record<string, string>>({});
  const [providerUrlMenu, setProviderUrlMenu] = useState<{ provider: string; x: number; y: number } | null>(null);
  const [providerUrlDraft, setProviderUrlDraft] = useState('');
  const [showProviderUrlInput, setShowProviderUrlInput] = useState(false);
  const providerUrlInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadServers();
    loadServerAlerts();
    loadSmtpManagers();
    loadAssignments();
    loadProviderUrls();
    // Subscribe to new alerts
    const channel = supabase.channel('server-alerts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log', filter: 'action_type=eq.server_alert' }, 
        (payload) => {
          setServerAlerts(prev => [payload.new, ...prev]);
          toast.warning(`New server alert: ${payload.new.server_ids}`, { duration: 5000 });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Close single assign popup on click outside
  useEffect(() => {
    if (!singleAssignPopup) return;
    const close = () => setSingleAssignPopup(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [singleAssignPopup]);

  async function loadSmtpManagers() {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'smtp_manager')
      .order('name');
    setSmtpManagers(data || []);
  }

  async function loadAssignments() {
    const { data } = await supabase
      .from('server_smtp_assignments')
      .select('*, users(name)')
      .order('assigned_at', { ascending: false });
    setAssignments(data || []);
  }

  async function handleAssignServers() {
    if (!selectedManager) {
      toast.error('Please select an SMTP manager');
      return;
    }
    if (selectedServers.size === 0) {
      toast.error('Please select at least one server');
      return;
    }

    setAssigning(true);
    
    try {
      // Delete existing assignments for these servers
      await supabase
        .from('server_smtp_assignments')
        .delete()
        .in('server_id', Array.from(selectedServers));
      
      // Insert new assignments
      const assignmentsToInsert = Array.from(selectedServers).map(serverId => ({
        server_id: serverId,
        smtp_manager_id: selectedManager,
        assigned_by: user!.name,
      }));

      const { error } = await supabase
        .from('server_smtp_assignments')
        .insert(assignmentsToInsert);

      if (error) throw error;

      // Log activity
      await logActivity(
        user!.name,
        'ASSIGNED_SERVERS',
        `${selectedServers.size} servers`,
        `Assigned ${selectedServers.size} servers to ${smtpManagers.find(m => m.id === selectedManager)?.name}`
      );

      toast.success(`Assigned ${selectedServers.size} server(s) successfully`);
      setShowAssignModal(false);
      setSelectedServers(new Set());
      setSelectedManager('');
      loadAssignments();
    } catch (error: any) {
      toast.error('Failed to assign servers: ' + error.message);
    } finally {
      setAssigning(false);
    }
  }

  function toggleServerSelection(serverId: string) {
    setSelectedServers(prev => {
      const next = new Set(prev);
      if (next.has(serverId)) {
        next.delete(serverId);
      } else {
        next.add(serverId);
      }
      return next;
    });
  }

  function selectAllServers() {
    const currentServers = filtered.map(s => s.id);
    const allSelected = currentServers.every(id => selectedServers.has(id));
    
    if (allSelected) {
      setSelectedServers(new Set());
    } else {
      setSelectedServers(new Set(currentServers));
    }
  }

  async function handleSingleAssign(serverId: string, serverIds: string, managerId: string) {
    try {
      const manager = smtpManagers.find(m => m.id === managerId);
      if (!manager) {
        toast.error('Manager not found');
        return;
      }

      // Delete existing assignments
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

      await logActivity(
        user!.name,
        'ASSIGNED_SERVERS',
        serverIds,
        `Reassigned server ${serverIds} to ${manager.name}`
      );

      toast.success(`Assigned ${serverIds} to ${manager.name}`);
      setSingleAssignPopup(null);
      loadAssignments();
    } catch (error: any) {
      toast.error('Failed to assign server: ' + error.message);
    }
  }

  async function loadServerAlerts() {
    // Load recent server alerts (last 24 hours)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase.from('activity_log')
      .select('*')
      .eq('action_type', 'server_alert')
      .gte('created_at', yesterday)
      .order('created_at', { ascending: false });
    setServerAlerts(data || []);
  }

  async function loadServers() {
    setLoading(true);
    // Auto-suspend expired production servers
    const today = new Date().toISOString().split('T')[0];
    await supabase.from('servers').update({ section: 'suspended' })
      .eq('section', 'production').lt('n_due', today).not('n_due', 'is', null);
    
    const { data } = await supabase.from('servers').select('*').order('created_at', { ascending: false });
    setServers((data || []) as ServerRow[]);
    setLoading(false);
  }

  const filtered = servers.filter(s => s.section === tab).filter(s => {
    const q = search.toLowerCase();
    const matchesSearch = !q || s.ids?.toLowerCase().includes(q) || s.ip_main?.toLowerCase().includes(q) || s.domain?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q) || s.notes?.toLowerCase().includes(q);
    const matchesProvider = !filterProvider || s.provider === filterProvider;
    const matchesDomain = !filterDomain || s.domain?.toLowerCase().includes(filterDomain.toLowerCase());
    
    // Filter by SMTP manager assignment
    let matchesSmtpManager = true;
    if (filterSmtpManager) {
      const serverAssignments = assignments.filter(a => a.server_id === s.id);
      matchesSmtpManager = serverAssignments.some(a => a.smtp_manager_id === filterSmtpManager);
    }
    
    return matchesSearch && matchesProvider && matchesDomain && matchesSmtpManager;
  });

  const providers = [...new Set(servers.filter(s => s.section === tab && s.provider).map(s => s.provider))];
  const emails = [...new Set(servers.filter(s => s.section === tab && s.email).map(s => s.email))];

  async function handleAdd() {
    // Generate a temporary IDs value that can be updated later
    const tempId = `TEMP-${Date.now()}`;
    const newServer = { ...emptyServer, ids: tempId, section: tab };
    const { data, error } = await supabase.from('servers').insert(newServer).select().single();
    if (error) {
      console.error('Insert error:', error);
      toast.error('Failed to add server: ' + error.message);
      return;
    }
    
    // Add directly to local state instead of reloading
    setServers(prev => [data as ServerRow, ...prev]);
    
    await logActivity(user!.name, 'add_server', tempId, `Added new empty server`);
    toast.success('Empty row added - start typing to fill');
  }

  async function handleInlineSave(server: ServerRow, key: keyof ServerRow, newValue: string) {
    const update = { [key]: newValue };
    const { error } = await supabase.from('servers').update(update).eq('id', server.id);
    
    if (error) {
      toast.error('Failed to save');
      return;
    }
    
    // Update local state directly without reloading
    setServers(prev => prev.map(s => s.id === server.id ? { ...s, [key]: newValue } : s));
    
    // Log activity only if this is not the first field being filled
    if (server.ids || key === 'ids') {
      await logActivity(user!.name, 'edit_server', server.ids || 'new', `Updated ${key} on server ${server.ids || 'new'}`);
    }
    toast.success('Saved');
  }

  async function handleDelete(s: ServerRow) {
    if (!confirm(`Delete server ${s.ids}?`)) return;
    const { error } = await supabase.from('servers').delete().eq('id', s.id);
    
    if (error) {
      toast.error('Failed to delete');
      return;
    }
    
    // Update local state directly without reloading
    setServers(prev => prev.filter(server => server.id !== s.id));
    
    await logActivity(user!.name, 'delete_server', s.ids, `Deleted server ${s.ids}`);
    toast.success('Server deleted');
  }

  async function handleSuspend(s: ServerRow) {
    if (!confirm(`Suspend server ${s.ids}?`)) return;
    
    const { error } = await supabase.from('servers').update({ section: 'suspended' }).eq('id', s.id);
    
    if (error) {
      toast.error('Failed to suspend');
      return;
    }
    
    // Update local state directly without reloading
    setServers(prev => prev.map(server => server.id === s.id ? { ...server, section: 'suspended' } : server));
    
    await logActivity(user!.name, 'suspend_server', s.ids, `Suspended server ${s.ids}`);
    toast.success('Server suspended');
    setTab('suspended');
  }

  async function handleRenew(s: ServerRow) {
    const newDue = new Date();
    newDue.setMonth(newDue.getMonth() + 1);
    const { error } = await supabase.from('servers').update({ section: 'production', n_due: newDue.toISOString().split('T')[0] }).eq('id', s.id);
    
    if (error) {
      toast.error('Failed to renew');
      return;
    }
    
    // Update local state directly without reloading
    setServers(prev => prev.map(server => server.id === s.id ? { ...server, section: 'production', n_due: newDue.toISOString().split('T')[0] } : server));
    
    await logActivity(user!.name, 'renew_server', s.ids, `Renewed server ${s.ids}`);
    toast.success('Server renewed');
  }

  const tabs = ['production', 'redirect', 'suspended'] as const;

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Quick Alert Summary */}
      {serverAlerts.length > 0 && (user?.role === 'server_manager' || user?.role === 'boss') && (
        <div className="glass-card rounded-xl p-3 flex items-center justify-between" style={{ borderLeft: '4px solid #ed8936' }}>
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-status-ecr animate-pulse" />
            <span className="text-sm text-foreground">
              <strong>{serverAlerts.length}</strong> server alert{serverAlerts.length > 1 ? 's' : ''} in last 24h
            </span>
          </div>
          <a href="/notifications" className="text-xs text-primary hover:underline font-medium">
            View All →
          </a>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1">
          {tabs.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                tab === t ? 'glass-button' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)} ({servers.filter(s => s.section === t).length})
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {(user?.role === 'boss' || user?.role === 'server_manager') && (
            <button 
              onClick={() => setShowAssignModal(true)} 
              className="glass-button rounded-lg px-4 py-1.5 text-sm font-medium flex items-center gap-2"
            >
              <Users className="w-4 h-4" /> Assign SMTP Manager
            </button>
          )}
          <button onClick={handleAdd} className="glass-button rounded-lg px-4 py-1.5 text-sm font-medium flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Server
          </button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search IDs, IP, domain, email..." className="glass-input rounded-lg px-3 py-1.5 text-sm text-foreground outline-none w-56" />
        <select value={filterProvider} onChange={e => setFilterProvider(e.target.value)} className="glass-input rounded-lg px-3 py-1.5 text-sm text-foreground outline-none bg-card">
          <option value="">All Providers</option>
          {providers.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        {(user?.role === 'boss' || user?.role === 'server_manager') && smtpManagers.length > 0 && (
          <select value={filterSmtpManager} onChange={e => setFilterSmtpManager(e.target.value)} className="glass-input rounded-lg px-3 py-1.5 text-sm text-foreground outline-none bg-card">
            <option value="">All SMTP Managers</option>
            {smtpManagers.map(manager => (
              <option key={manager.id} value={manager.id}>{manager.name}</option>
            ))}
          </select>
        )}
        {(search || filterProvider || filterSmtpManager) && (
          <button onClick={() => { setSearch(''); setFilterProvider(''); setFilterDomain(''); setFilterSmtpManager(''); }} className="text-xs text-muted-foreground hover:text-foreground px-2">Clear</button>
        )}
        <span className="text-xs text-muted-foreground self-center ml-auto">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full dense-table border-collapse">
            <thead>
              <tr className="text-left">
                {(user?.role === 'boss' || user?.role === 'server_manager') && (
                  <th className="border-r border-border w-10">
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && filtered.every(s => selectedServers.has(s.id))}
                      onChange={selectAllServers}
                      className="w-4 h-4 cursor-pointer"
                    />
                  </th>
                )}
                {EDITABLE_COLUMNS.map(col => (
                  <th key={col.key} className="border-r border-border">{col.label}</th>
                ))}
                <th className="border-r border-border">Notes</th>
                <th className="border-r border-border">DRN</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={EDITABLE_COLUMNS.length + 3} className="text-center py-8 text-muted-foreground">No servers in this section</td></tr>
              ) : filtered.map(s => {
                const drn = getDrnDays(s.n_due);
                return (
                  <tr key={s.id} className="hover:bg-secondary/30 transition-colors">
                    {(user?.role === 'boss' || user?.role === 'server_manager') && (
                      <td className="border-r border-border">
                        <input
                          type="checkbox"
                          checked={selectedServers.has(s.id)}
                          onChange={() => toggleServerSelection(s.id)}
                          className="w-4 h-4 cursor-pointer"
                        />
                      </td>
                    )}
                    {EDITABLE_COLUMNS.map(col => (
                      <td key={col.key} className={`border-r border-border ${col.key === 'ids' ? 'font-mono font-medium text-primary' : ''} ${col.key === 'ip_main' ? 'font-mono' : ''}`}>
                        <InlineCell
                          value={s[col.key] || ''}
                          type={col.type}
                          onSave={(v) => handleInlineSave(s, col.key, v)}
                          highlightQuery={search}
                          fieldKey={col.key}
                          existingValues={col.key === 'provider' ? providers : col.key === 'email' ? emails : undefined}
                        />
                      </td>
                    ))}
                    <td className="border-r border-border">
                      <NoteCell value={s.notes || ''} serverId={s.id} onSave={(v) => handleInlineSave(s, 'notes', v)} highlightQuery={search} />
                    </td>
                    <td className="border-r border-border">
                      {drn !== null && (
                        <span className="status-pill" style={{ color: getDrnColor(drn), background: `${getDrnColor(drn)}22` }}>
                          {drn}d
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        {(user?.role === 'boss' || user?.role === 'server_manager') && smtpManagers.length > 0 && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSingleAssignPopup({ serverId: s.id, serverIds: s.ids, x: e.clientX, y: e.clientY });
                            }} 
                            className="p-1 text-muted-foreground hover:text-primary transition-colors"
                            title="Assign to SMTP Manager"
                          >
                            <Users className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {tab !== 'suspended' && (
                          <button onClick={() => handleSuspend(s)} className="p-1 text-muted-foreground hover:text-status-ecr transition-colors"><PauseCircle className="w-3.5 h-3.5" /></button>
                        )}
                        {tab === 'suspended' && (
                          <button onClick={() => handleRenew(s)} className="p-1 text-muted-foreground hover:text-status-clean transition-colors"><RotateCcw className="w-3.5 h-3.5" /></button>
                        )}
                        <button onClick={() => handleDelete(s)} className="p-1 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assignment Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="glass-card rounded-xl p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Assign Servers to SMTP Manager
              </h2>
              <button 
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedServers(new Set());
                  setSelectedManager('');
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* SMTP Manager Selection */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Select SMTP Manager
                </label>
                <select
                  value={selectedManager}
                  onChange={(e) => setSelectedManager(e.target.value)}
                  className="w-full glass-input rounded-lg px-3 py-2 text-sm text-foreground outline-none bg-card"
                >
                  <option value="">Choose an SMTP manager...</option>
                  {smtpManagers.map(manager => (
                    <option key={manager.id} value={manager.id}>
                      {manager.name} ({manager.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Server Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-foreground">
                    Select Servers ({selectedServers.size} selected)
                  </label>
                  <button
                    onClick={selectAllServers}
                    className="text-xs text-primary hover:underline"
                  >
                    {filtered.length > 0 && filtered.every(s => selectedServers.has(s.id))
                      ? 'Deselect All'
                      : 'Select All'}
                  </button>
                </div>
                <div className="border border-border rounded-lg max-h-64 overflow-y-auto">
                  {filtered.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No servers in current view
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {filtered.map(server => {
                        const assignment = assignments.find(a => a.server_id === server.id);
                        return (
                          <div
                            key={server.id}
                            className={`flex items-center gap-3 p-3 hover:bg-secondary/30 cursor-pointer transition-colors ${
                              selectedServers.has(server.id) ? 'bg-primary/10' : ''
                            }`}
                            onClick={() => toggleServerSelection(server.id)}
                          >
                            <input
                              type="checkbox"
                              checked={selectedServers.has(server.id)}
                              onChange={() => toggleServerSelection(server.id)}
                              className="w-4 h-4 cursor-pointer"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-medium text-primary">
                                  {server.ids}
                                </span>
                                {assignment && (
                                  <span className="text-xs text-muted-foreground">
                                    (Currently: {assignment.users?.name || 'Assigned'})
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {server.ip_main} {server.domain && `• ${server.domain}`}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedServers(new Set());
                    setSelectedManager('');
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  disabled={assigning}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignServers}
                  disabled={assigning || !selectedManager || selectedServers.size === 0}
                  className="px-4 py-2 rounded-lg text-sm font-medium glass-button disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {assigning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Assigning...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Assign {selectedServers.size} Server{selectedServers.size !== 1 ? 's' : ''}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Single Server Assignment Popup */}
      {singleAssignPopup && (
        <div
          className="fixed z-[100] min-w-[220px] rounded-xl border border-border bg-card shadow-2xl animate-fade-in overflow-hidden"
          style={{ left: singleAssignPopup.x, top: singleAssignPopup.y }}
          onClick={e => e.stopPropagation()}
        >
          <div className="px-3 py-2 border-b border-border bg-muted/30">
            <span className="text-xs font-semibold text-foreground">Assign to Manager</span>
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {smtpManagers.map(manager => (
              <button
                key={manager.id}
                onClick={() => handleSingleAssign(singleAssignPopup.serverId, singleAssignPopup.serverIds, manager.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/50 transition-colors text-left"
              >
                <Users className="w-3.5 h-3.5 text-muted-foreground" />
                <div className="flex-1">
                  <div className="text-foreground text-xs font-medium">{manager.name}</div>
                  <div className="text-muted-foreground text-[10px]">{manager.email}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
