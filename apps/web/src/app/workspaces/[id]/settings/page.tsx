"use client";

import { use, useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, Save, Shield } from 'lucide-react';
import { api } from '@/lib/api';
import { useWorkspace } from '@/lib/workspaceContext';
import { PageHeader, Field, Notice, Loading, ConfirmDialog, errorMessage } from '@/components/ui';
export default function SettingsPage({
  params
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const {
    id
  } = use(params);
  const {
    workspace,
    refresh
  } = useWorkspace();
  const owner = workspace?.user_role === 'owner';
  const canEdit = workspace?.user_role !== 'viewer';
  const [name, setName] = useState(workspace?.name || '');
  const [description, setDescription] = useState(workspace?.description || '');
  const [members, setMembers] = useState<any[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('editor');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fieldError, setFieldError] = useState<Record<string, string>>({});
  const [remove, setRemove] = useState<any>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setMembers(await api.listWorkspaceMembers(id));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (name.trim().length < 2) {
      setFieldError({
        name: 'Use at least 2 characters.'
      });
      document.getElementById('workspace-name')?.focus();
      return;
    }
    setBusy('save');
    setError('');
    setFieldError({});
    try {
      await api.updateWorkspace(id, {
        name: name.trim(),
        description
      });
      setSuccess('Workspace details saved.');
      refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy('');
    }
  };
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldError({
        email: 'Enter a valid email address.'
      });
      document.getElementById('member-email')?.focus();
      return;
    }
    setBusy('add');
    setError('');
    setFieldError({});
    try {
      await api.addWorkspaceMember(id, {
        email: email.trim(),
        role
      });
      setEmail('');
      setSuccess('Member added to the workspace.');
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy('');
    }
  };
  const deleteMember = async () => {
    if (!remove || busy) return;
    setBusy('remove');
    try {
      await api.removeWorkspaceMember(id, remove.user_id);
      setRemove(null);
      setSuccess('Member removed.');
      await load();
    } catch (e) {
      setRemove(null);
      setError(errorMessage(e));
    } finally {
      setBusy('');
    }
  };
  return <div className="page narrow"><PageHeader title="Workspace Settings" description="Make this space yours. Manage details and the people who can access it." />{error && <Notice>{error}</Notice>}{success && <Notice kind="success">{success}</Notice>}{!canEdit && <Notice kind="info">You have viewer access. An owner or editor can update workspace details.</Notice>}<section className="settings-section settings-grid"><div className="settings-intro"><h2>General information</h2><p>The name and description your team sees throughout the workspace.</p></div><form noValidate className="form-stack" onSubmit={save}><Field id="workspace-name" label="Workspace Name" value={name} maxLength={100} disabled={!canEdit} error={fieldError.name} onChange={e => setName(e.target.value)} /><div className="field"><label htmlFor="description">Description</label><textarea id="description" className="resize-none" value={description} disabled={!canEdit} rows={4} onChange={e => setDescription(e.target.value)} /></div>{canEdit && <div><button className="button" disabled={!!busy}><Save size={15} />{busy === 'save' ? 'Saving...' : 'Save Changes'}</button></div>}</form></section><section className="settings-section settings-grid"><div className="settings-intro"><h2>Workspace Members</h2><p>Owners manage access. Editors write and organize. Viewers read and discover.</p><p><Shield size={14} style={{
            display: 'inline',
            marginRight: 5
          }} />{members.length} members</p></div><div>{owner && <><form noValidate className="invite-form" onSubmit={add}><Field id="member-email" label="Member email" type="email" placeholder="colleague@company.com" value={email} error={fieldError.email} onChange={e => setEmail(e.target.value)} /><div className="field"><label htmlFor="member-role">Role</label><select id="member-role" value={role} onChange={e => setRole(e.target.value)}><option value="editor">Editor</option><option value="viewer">Viewer</option><option value="owner">Owner</option></select></div><button className="button" disabled={!!busy}><Plus size={15} />{busy === 'add' ? 'Adding...' : 'Add member'}</button></form><p className="muted small" style={{
            marginBottom: 15
          }}>Members need an existing NexusDocs account. Adding a member grants access immediately.</p></>}{loading ? <Loading label="Loading members" /> : members.map(m => <div className="member-row" key={m.id}><span className="avatar">{m.user?.display_name?.slice(0, 2).toUpperCase() || 'M'}</span><div className="user-detail"><strong>{m.user?.display_name || 'Member'}</strong><small>{m.user?.email}</small></div><span className="role">{m.role}</span>{owner && m.role !== 'owner' && <button className="icon-button" aria-label={`Remove ${m.user?.display_name || 'member'}`} onClick={() => setRemove(m)}><Trash2 size={15} /></button>}</div>)}</div></section><section className="settings-section settings-grid"><div className="settings-intro"><h2>Connected knowledge</h2><p>Search and discovery work across your workspace documents.</p></div><div className="panel"><h3>Markdown, search, and source-based answers</h3><p className="muted small" style={{
          marginTop: 9
        }}>Wiki links and shared topics build your knowledge graph. The assistant shows the sources it used and indicates when answer generation is unavailable.</p></div></section><ConfirmDialog open={!!remove} onClose={() => setRemove(null)} onConfirm={deleteMember} busy={busy === 'remove'} title="Remove workspace member?" description={`${remove?.user?.display_name || 'This member'} will lose access to this workspace. You can add them again later.`} action="Remove member" /></div>;
}
