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
  d_pro: '', n_due: '', username: '', password: '', email: '', passwd: '',
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

function InlineCell({ value, type, onSave, highlightQuery }: { value: string; type?: string; onSave: (v: string) => void; highlightQuery?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(value);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [editing]);

  const save = () => {
    if (draft !== value) onSave(draft);
    setEditing(false);
  };

  const cancel = () => { setDraft(value); setEditing(false); };

  if (!editing) {
    return (
      <div
        onClick={() => setEditing(true)}
        className="cursor-pointer min-h-[20px] w-full truncate hover:bg-primary/5 rounded px-0.5 -mx-0.5"
        title="Click to edit"
      >
        {value ? (highlightQuery ? <HighlightText text={value} query={highlightQuery} /> : value) : <span className="text-muted-foreground/40">—</span>}
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
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyServer);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterProvider, setFilterProvider] = useState('');
  const [filterDomain, setFilterDomain] = useState('');

  useEffect(() => { loadServers(); }, []);

  async function loadServers() {
    setLoading(true);
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

  function openAdd() {
    setForm({ ...emptyServer, section: tab });
    setModalOpen(true);
  }

  async function handleAdd() {
    setSaving(true);
    await supabase.from('servers').insert(form);
    await logActivity(user!.name, 'add_server', form.ids, `Added server ${form.ids}`);
    toast.success('Server added');
    setSaving(false);
    setModalOpen(false);
    loadServers();
  }

  async function handleInlineSave(server: ServerRow, key: keyof ServerRow, newValue: string) {
    const update = { [key]: newValue };
    await supabase.from('servers').update(update).eq('id', server.id);
    setServers(prev => prev.map(s => s.id === server.id ? { ...s, [key]: newValue } : s));
    await logActivity(user!.name, 'edit_server', server.ids, `Updated ${key} on server ${server.ids}`);
    toast.success('Saved');
  }

  async function handleDelete(s: ServerRow) {
    if (!confirm(`Delete server ${s.ids}?`)) return;
    await supabase.from('servers').delete().eq('id', s.id);
    await logActivity(user!.name, 'delete_server', s.ids, `Deleted server ${s.ids}`);
    toast.success('Server deleted');
    loadServers();
  }

  async function handleSuspend(s: ServerRow) {
    await supabase.from('servers').update({ section: 'suspended' }).eq('id', s.id);
    await logActivity(user!.name, 'suspend_server', s.ids, `Suspended server ${s.ids}`);
    toast.success('Server suspended');
    loadServers();
  }

  async function handleRenew(s: ServerRow) {
    const newDue = new Date();
    newDue.setMonth(newDue.getMonth() + 1);
    await supabase.from('servers').update({ section: 'production', n_due: newDue.toISOString().split('T')[0] }).eq('id', s.id);
    await logActivity(user!.name, 'renew_server', s.ids, `Renewed server ${s.ids}`);
    toast.success('Server renewed');
    loadServers();
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
        <button onClick={openAdd} className="glass-button rounded-lg px-4 py-1.5 text-sm font-medium flex items-center gap-2">
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
                        />
                      </td>
                    ))}
                    <td className="border-r border-border">
                      <NoteCell value={s.notes || ''} serverId={s.id} onSave={(v) => handleInlineSave(s, 'notes', v)} />
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

      {/* Add Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60" onClick={() => setModalOpen(false)}>
          <div className="glass-card rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Add Server</h2>
              <button onClick={() => setModalOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(form).filter(([k]) => k !== 'section').map(([key, val]) => (
                <div key={key}>
                  <label className="block text-xs text-muted-foreground mb-1 capitalize">{key.replace('_', ' ')}</label>
                  <input
                    type={key.includes('d_pro') || key.includes('n_due') ? 'date' : 'text'}
                    value={val}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full glass-input rounded-lg px-3 py-2 text-sm text-foreground outline-none"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Section</label>
                <select
                  value={form.section}
                  onChange={e => setForm(f => ({ ...f, section: e.target.value }))}
                  className="w-full glass-input rounded-lg px-3 py-2 text-sm text-foreground outline-none bg-card"
                >
                  <option value="production">Production</option>
                  <option value="redirect">Redirect</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
              <button onClick={handleAdd} disabled={saving} className="glass-button rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2 disabled:opacity-50">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Add Server
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
