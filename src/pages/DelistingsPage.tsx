import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { toast } from 'sonner';
import { Plus, Loader2, X, Pencil, Trash2 } from 'lucide-react';
import { HighlightText } from '@/components/HighlightText';

export default function DelistingsPage() {
  const { user, canManageServers } = useAuth();
  const [delistings, setDelistings] = useState<any[]>([]);
  const [servers, setServers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ server_id: '', blacklist_type: 'BL', submitted_date: new Date().toISOString().split('T')[0], result: 'pending', notes: '' });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterResult, setFilterResult] = useState('');

  useEffect(() => {
    loadData();
    const channel = supabase.channel('delistings-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delistings' }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function loadData() {
    setLoading(true);
    const [dRes, sRes] = await Promise.all([
      supabase.from('delistings').select('*, servers(ids, ip_main)').order('submitted_date', { ascending: false }),
      supabase.from('servers').select('id, ids, ip_main').eq('section', 'production'),
    ]);
    setDelistings(dRes.data || []);
    setServers(sRes.data || []);
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    if (editId) {
      await supabase.from('delistings').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editId);
      await logActivity(user!.name, 'update_delisting', '', `Updated delisting result`);
      toast.success('Delisting updated');
    } else {
      await supabase.from('delistings').insert({ ...form, created_by: user!.name });
      await logActivity(user!.name, 'add_delisting', '', `Added delisting ${form.blacklist_type}`);
      toast.success('Delisting added');
    }
    setSaving(false);
    setModalOpen(false);
    loadData();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this delisting?')) return;
    await supabase.from('delistings').delete().eq('id', id);
    await logActivity(user!.name, 'delete_delisting', '', 'Deleted delisting');
    toast.success('Deleted');
    loadData();
  }

  const filteredDelistings = delistings.filter(d => {
    const q = search.toLowerCase();
    const sIds = (d.servers as any)?.ids?.toLowerCase() || '';
    const sIp = (d.servers as any)?.ip_main?.toLowerCase() || '';
    const matchesSearch = !q || sIds.includes(q) || sIp.includes(q) || d.notes?.toLowerCase().includes(q) || d.created_by?.toLowerCase().includes(q);
    const matchesType = !filterType || d.blacklist_type === filterType;
    const matchesResult = !filterResult || d.result === filterResult;
    return matchesSearch && matchesType && matchesResult;
  });

  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const doneToday = delistings.filter(d => d.submitted_date === today).length;
  const doneThisWeek = delistings.filter(d => d.submitted_date >= weekAgo).length;

  const resultColors: Record<string, { color: string; bg: string }> = {
    pending: { color: '#ed8936', bg: 'rgba(237,137,54,0.15)' },
    approved: { color: '#48bb78', bg: 'rgba(72,187,120,0.15)' },
    rejected: { color: '#e53e3e', bg: 'rgba(229,62,62,0.15)' },
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex gap-4">
          <div className="glass-card rounded-xl px-4 py-2">
            <span className="text-xs text-muted-foreground">Today: </span>
            <span className="text-sm font-bold text-foreground">{doneToday}</span>
          </div>
          <div className="glass-card rounded-xl px-4 py-2">
            <span className="text-xs text-muted-foreground">This week: </span>
            <span className="text-sm font-bold text-foreground">{doneThisWeek}</span>
          </div>
        </div>
        <button onClick={() => { setEditId(null); setForm({ server_id: '', blacklist_type: 'BL', submitted_date: today, result: 'pending', notes: '' }); setModalOpen(true); }} className="glass-button rounded-lg px-4 py-1.5 text-sm font-medium flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Delisting
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search server, IP, notes..." className="glass-input rounded-lg px-3 py-1.5 text-sm text-foreground outline-none w-52" />
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="glass-input rounded-lg px-3 py-1.5 text-sm text-foreground outline-none bg-card">
          <option value="">All Types</option>
          <option value="BL">BL</option><option value="SH">SH</option><option value="BR">BR</option>
        </select>
        <select value={filterResult} onChange={e => setFilterResult(e.target.value)} className="glass-input rounded-lg px-3 py-1.5 text-sm text-foreground outline-none bg-card">
          <option value="">All Results</option>
          <option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
        </select>
        {(search || filterType || filterResult) && (
          <button onClick={() => { setSearch(''); setFilterType(''); setFilterResult(''); }} className="text-xs text-muted-foreground hover:text-foreground px-2">Clear</button>
        )}
        <span className="text-xs text-muted-foreground self-center ml-auto">{filteredDelistings.length} result{filteredDelistings.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full dense-table">
            <thead>
              <tr className="text-left">
                <th>Server</th><th>IP</th><th>Type</th><th>Date</th><th>Result</th><th>Notes</th><th>By</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDelistings.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">No delistings</td></tr>
              ) : filteredDelistings.map(d => (
                <tr key={d.id} className="hover:bg-secondary/30">
                  <td className="font-mono text-primary"><HighlightText text={(d.servers as any)?.ids || ''} query={search} /></td>
                  <td className="font-mono"><HighlightText text={(d.servers as any)?.ip_main || ''} query={search} /></td>
                  <td>
                    <span className="status-pill" style={{ color: d.blacklist_type === 'BL' ? '#e53e3e' : d.blacklist_type === 'SH' ? '#ecc94b' : '#805ad5', background: d.blacklist_type === 'BL' ? 'rgba(229,62,62,0.15)' : d.blacklist_type === 'SH' ? 'rgba(236,201,75,0.15)' : 'rgba(128,90,213,0.15)' }}>
                      {d.blacklist_type}
                    </span>
                  </td>
                  <td>{d.submitted_date}</td>
                  <td>
                    <span className="status-pill" style={{ color: resultColors[d.result]?.color, background: resultColors[d.result]?.bg }}>
                      {d.result}
                    </span>
                  </td>
                  <td className="max-w-[150px] truncate"><HighlightText text={d.notes || ''} query={search} /></td>
                  <td><HighlightText text={d.created_by || ''} query={search} /></td>
                  <td>
                    {canManageServers && (
                      <div className="flex gap-1">
                        <button onClick={() => { setEditId(d.id); setForm({ server_id: d.server_id, blacklist_type: d.blacklist_type, submitted_date: d.submitted_date, result: d.result, notes: d.notes || '' }); setModalOpen(true); }} className="p-1 text-muted-foreground hover:text-primary"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(d.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60" onClick={() => setModalOpen(false)}>
          <div className="glass-card rounded-xl p-6 w-full max-w-md animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">{editId ? 'Edit Delisting' : 'Add Delisting'}</h2>
              <button onClick={() => setModalOpen(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Server</label>
                <select value={form.server_id} onChange={e => setForm(f => ({ ...f, server_id: e.target.value }))} className="w-full glass-input rounded-lg px-3 py-2 text-sm text-foreground outline-none bg-card">
                  <option value="">Select server...</option>
                  {servers.map(s => <option key={s.id} value={s.id}>{s.ids} — {s.ip_main}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Blacklist Type</label>
                <select value={form.blacklist_type} onChange={e => setForm(f => ({ ...f, blacklist_type: e.target.value }))} className="w-full glass-input rounded-lg px-3 py-2 text-sm text-foreground outline-none bg-card">
                  <option value="BL">BL — Blacklist</option>
                  <option value="SH">SH — Spamhaus</option>
                  <option value="BR">BR — Barracuda</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Date</label>
                <input type="date" value={form.submitted_date} onChange={e => setForm(f => ({ ...f, submitted_date: e.target.value }))} className="w-full glass-input rounded-lg px-3 py-2 text-sm text-foreground outline-none" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Result</label>
                <select value={form.result} onChange={e => setForm(f => ({ ...f, result: e.target.value }))} className="w-full glass-input rounded-lg px-3 py-2 text-sm text-foreground outline-none bg-card">
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Notes</label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full glass-input rounded-lg px-3 py-2 text-sm text-foreground outline-none" placeholder="Optional notes..." />
              </div>
            </div>
            <button onClick={handleSave} disabled={!form.server_id || saving} className="w-full glass-button rounded-lg py-2 text-sm font-medium mt-4 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editId ? 'Update' : 'Submit'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
