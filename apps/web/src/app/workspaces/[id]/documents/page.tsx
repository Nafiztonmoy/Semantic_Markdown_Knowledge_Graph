"use client";

import { use, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FileText, Plus, Trash2, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { api } from '@/lib/api';
import { useWorkspace } from '@/lib/workspaceContext';
import { PageHeader, SearchField, Loading, Notice, EmptyState, ConfirmDialog, ImportButton, Tags, dateLabel, errorMessage } from '@/components/ui';
export default function Documents({
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
    workspace
  } = useWorkspace();
  const canEdit = workspace?.user_role !== 'viewer';
  const sp = useSearchParams();
  const [query, setQuery] = useState(sp.get('search') || '');
  const [tag, setTag] = useState(sp.get('tag') || '');
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleted, setDeleted] = useState<any>(null);
  const [target, setTarget] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState('');
  const [sort, setSort] = useState('updated');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setDocs(await api.listDocuments(id));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    setTag(sp.get('tag') || '');
    setQuery(sp.get('search') || '');
  }, [sp]);
  const filter = (q: string, t: string) => {
    setQuery(q);
    setTag(t);
    const p = new URLSearchParams();
    if (q) p.set('search', q);
    if (t) p.set('tag', t);
    window.history.replaceState(null, '', `${window.location.pathname}${p.size ? '?' + p : ''}`);
  };
  const remove = async () => {
    if (!target || busy) return;
    setBusy(true);
    try {
      await api.deleteDocument(target.id);
      setDeleted(target);
      setTarget(null);
      await load();
    } catch (e) {
      setError(errorMessage(e));
      setTarget(null);
    } finally {
      setBusy(false);
    }
  };
  const restore = async () => {
    setBusy(true);
    try {
      await api.restoreDocument(deleted.id);
      setDeleted(null);
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const importFiles = async (files: File[]) => {
    setImporting(true);
    try {
      const r = await api.importMarkdownFiles(id, files);
      setMessage(`${r.succeeded} imported, ${r.failed} failed.${r.failed ? ' ' + r.results.filter((x: any) => x.status === 'error').map((x: any) => `${x.filename}: ${x.error}`).join(' ') : ' Indexing runs in the background.'}`);
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setImporting(false);
    }
  };
  const allTags = Array.from(new Set<string>(docs.flatMap(d => d.tags.map((t: any) => t.name)))).sort();
  const filtered = docs.filter(d => d.title.toLowerCase().includes(query.toLowerCase()) && (!tag || d.tags.some((t: any) => t.name === tag))).sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title) : new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  return <div className="page"><PageHeader title="Document Library" description="The notes, decisions, and know-how that keep your team moving." actions={canEdit && <><ImportButton busy={importing} onFiles={importFiles} /><Link className="button" href={`/workspaces/${id}/documents/new`}><Plus size={16} />Create Document</Link></>} />{error && <Notice>{error} <button className="text-link" onClick={load}>Try again</button></Notice>}{message && <Notice kind="info">{message}</Notice>}{deleted && <Notice kind="success">“{deleted.title}” moved to deleted documents. <button className="text-link" onClick={restore} disabled={busy}><RotateCcw size={13} />Restore</button></Notice>}<div className="library-toolbar"><SearchField value={query} onChange={v => filter(v, tag)} placeholder="Filter documents by title..." label="Filter documents by title" /><div className="actions"><SlidersHorizontal size={15} className="muted" /><select aria-label="Sort documents" value={sort} onChange={e => setSort(e.target.value)}><option value="updated">Recently updated</option><option value="title">Title A to Z</option></select></div></div><div className="filter-row"><button className={`tag-link ${!tag ? 'selected' : ''}`} aria-pressed={!tag} onClick={() => filter(query, '')}>All documents <small>{docs.length}</small></button>{allTags.map(t => <button key={t} className={`tag-link ${tag === t ? 'selected' : ''}`} aria-pressed={tag === t} onClick={() => filter(query, tag === t ? '' : t)}>{t}</button>)}</div>{loading ? <Loading label="Loading documents" /> : !filtered.length ? <EmptyState title={docs.length ? 'No matching documents' : 'Your library starts here'} description={docs.length ? 'Try a different title or clear your topic filter.' : 'Create a Markdown document or import your existing notes.'} action={docs.length ? <button className="button secondary" onClick={() => filter('', '')}>Clear filters</button> : canEdit ? <Link className="button" href={`/workspaces/${id}/documents/new`}>Create Document</Link> : undefined} /> : <><div className="table-wrap"><table className="document-table"><thead><tr><th>Document</th><th className="optional-column">Topics</th><th className="optional-column">Version</th><th className="optional-column">Last updated</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{filtered.map(doc => <tr key={doc.id}><td><Link className="table-title" href={`/workspaces/${id}/documents/${doc.id}`}><span className="doc-icon"><FileText size={18} /></span><div><span className="doc-title">{doc.title}</span><div className="doc-meta mono">/{doc.slug}</div></div></Link></td><td className="optional-column"><Tags tags={doc.tags} /></td><td className="optional-column"><span className="version">v{doc.version_number}</span></td><td className="optional-column muted">{dateLabel(doc.updated_at)}</td><td><div className="table-actions"><Link className="button secondary small-button" href={`/workspaces/${id}/documents/${doc.id}`}>Open</Link>{canEdit && <button className="icon-button" aria-label={`Delete ${doc.title}`} onClick={() => setTarget(doc)}><Trash2 size={15} /></button>}</div></td></tr>)}</tbody></table></div><div className="table-footer"><span>{filtered.length} of {docs.length} documents</span><span>Markdown workspace</span></div></>}<ConfirmDialog open={!!target} onClose={() => setTarget(null)} onConfirm={remove} title="Delete document?" description={`“${target?.title}” will be removed from this library and search. You can restore it after deleting.`} busy={busy} /></div>;
}
