import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { getDrnDays, getDrnColor } from '@/lib/statusColors';
import { toast } from 'sonner';
import { Plus, Trash2, PauseCircle, RotateCcw, Loader2, X, Check } from 'lucide-react';

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

  useEffect(() => {
    loadServers();
  }, []);

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
    return matchesSearch && matchesProvider && matchesDomain;
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
        <button onClick={handleAdd} className="glass-button rounded-lg px-4 py-1.5 text-sm font-medium flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Server
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search IDs, IP, domain, email..." className="glass-input rounded-lg px-3 py-1.5 text-sm text-foreground outline-none w-56" />
        <select value={filterProvider} onChange={e => setFilterProvider(e.target.value)} className="glass-input rounded-lg px-3 py-1.5 text-sm text-foreground outline-none bg-card">
          <option value="">All Providers</option>
          {providers.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        {(search || filterProvider) && (
          <button onClick={() => { setSearch(''); setFilterProvider(''); setFilterDomain(''); }} className="text-xs text-muted-foreground hover:text-foreground px-2">Clear</button>
        )}
        <span className="text-xs text-muted-foreground self-center ml-auto">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full dense-table border-collapse">
            <thead>
              <tr className="text-left">
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
    </div>
  );
}
