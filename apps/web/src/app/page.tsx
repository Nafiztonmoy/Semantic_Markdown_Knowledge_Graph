"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, FileText, Share2, Search, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import { api } from '@/lib/api';
import { Brand, Notice, Field, Loading, errorMessage } from '@/components/ui';
import { ExampleGraph } from '@/components/ExampleGraph';
export default function Home() {
  const {
    user,
    loading,
    refreshUser
  } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [empty, setEmpty] = useState(false);
  useEffect(() => {
    if (!loading && user) api.listWorkspaces().then(ws => {
      if (ws.length) router.replace(`/workspaces/${ws[0].id}/dashboard`);else setEmpty(true);
    }).catch(e => setError(errorMessage(e)));
  }, [loading, user, router]);
  const demo = async (role: string) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await api.login({
        email: `${role}@nexusdocs.dev`,
        password: 'DevPassword123!'
      });
      await refreshUser();
      const ws = await api.listWorkspaces();
      if (ws.length) router.push(`/workspaces/${ws[0].id}/dashboard`);else setEmpty(true);
    } catch (e) {
      setError(`Demo sign-in failed. ${errorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  };
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError('Use at least 2 characters for the workspace name.');
      return;
    }
    setBusy(true);
    try {
      const ws = await api.createWorkspace({
        name: name.trim()
      });
      router.push(`/workspaces/${ws.id}/dashboard`);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };
  if (user && empty) return <div className="welcome-workspace"><Brand /><h1>A home for your team’s knowledge.</h1><p className="muted">Create your first workspace, then bring in your notes and connect your ideas.</p>{error && <Notice>{error}</Notice>}<form noValidate onSubmit={create} className="form-stack"><Field label="Workspace name" value={name} onChange={e => setName(e.target.value)} placeholder="Engineering team" maxLength={100} autoFocus /><button className="button" disabled={busy}>{busy ? 'Creating...' : 'Create workspace'}<ArrowRight size={16} /></button></form></div>;
  if (loading || user) return <div className="welcome-workspace"><Brand />{error ? <Notice>{error}</Notice> : <Loading />}</div>;
  return <div className="public-shell"><header className="public-header"><Brand /><nav><Link href="/login">Sign In</Link><Link className="button" href="/register">Get Started <ArrowRight size={14} /></Link></nav></header><main><section className="landing-hero"><div><p className="eyebrow">A workspace for connected thinking</p><h1>Good knowledge<br />doesn’t live alone.<br /><span>Connect the dots.</span></h1><p className="intro">Turn your team’s Markdown notes into a living knowledge graph. Write clearly, discover connections, and find answers with sources.</p><div className="actions"><button className="button" disabled={busy} onClick={() => demo('admin')}>{busy ? 'Opening workspace...' : 'Launch Acme Engineering Demo'}<ArrowRight size={16} /></button></div><div className="landing-demo"><span>Explore as</span><button disabled={busy} onClick={() => demo('admin')}>Admin (Owner)</button><button disabled={busy} onClick={() => demo('editor')}>Editor</button><button disabled={busy} onClick={() => demo('viewer')}>Viewer</button></div>{error && <Notice>{error}</Notice>}</div><div className="landing-visual"><ExampleGraph /></div></section><section className="landing-features"><div><h2>From scattered notes<br />to shared understanding.</h2></div><div className="feature-list">{[[FileText, 'Write in Markdown', 'A focused editor, live preview, and revision history. Your words stay yours.'], [Share2, 'See the relationships', 'Follow wiki links, shared topics, and semantic connections across your workspace.'], [Search, 'Find the idea, not just the word', 'Search by keyword or meaning. Ask questions and open the original source.']].map(([Icon, title, copy]: any) => <div className="feature-line" key={title}><Icon size={20} /><div><h3>{title}</h3><p>{copy}</p></div></div>)}</div></section></main><footer className="public-footer"><span>NexusDocs / Semantic Markdown Knowledge Graph</span><span>Built for the way engineering teams think.</span></footer></div>;
}
