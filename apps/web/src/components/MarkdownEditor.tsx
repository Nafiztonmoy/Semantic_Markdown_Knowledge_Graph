"use client";

import { useEffect, useRef, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import CodeMirror from '@uiw/react-codemirror';
import { markdown as markdownLang } from '@codemirror/lang-markdown';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Save, Eye, Edit3, Columns, ArrowLeft, Check, X, FileText, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';
import { useWorkspace } from '@/lib/workspaceContext';
import { headingId } from '@/lib/documentLinks';
import { Notice, Loading, ConfirmDialog, dateLabel, errorMessage } from './ui';
interface Props {
  workspaceId: string;
  initialDocument?: any;
  isNew?: boolean;
  onSaveSuccess?: (doc: any) => void;
}
export function MarkdownEditor({
  workspaceId,
  initialDocument,
  isNew = false,
  onSaveSuccess
}: Props) {
  const router = useRouter();
  const {
    workspace
  } = useWorkspace();
  const canEdit = workspace?.user_role !== 'viewer';
  const [title, setTitle] = useState(initialDocument?.title || 'Untitled Document');
  const [markdown, setMarkdown] = useState(initialDocument?.markdown ?? '# Untitled Document\n\n');
  const [tags, setTags] = useState<string[]>(initialDocument?.tags?.map((t: any) => t.name) || []);
  const [tagInput, setTagInput] = useState('');
  const [view, setView] = useState<'edit' | 'split' | 'preview'>(canEdit ? 'split' : 'preview');
  const [tab, setTab] = useState('toc');
  const [status, setStatus] = useState(isNew ? 'unsaved' : 'saved');
  const [error, setError] = useState('');
  const [revisions, setRevisions] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [restoreId, setRestoreId] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [leave, setLeave] = useState('');
  const draft = useRef({
    title,
    markdown,
    tags
  });
  draft.current = {
    title,
    markdown,
    tags
  };
  const saving = useRef(false);
  const lastSaved = useRef(JSON.stringify(draft.current));
  const hasEdits = JSON.stringify(draft.current) !== lastSaved.current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const composing = useRef(false);
  const onSaved = useRef(onSaveSuccess);
  onSaved.current = onSaveSuccess;
  const executeSave = async () => {
    if (saving.current || !canEdit) return;
    const current = {
      ...draft.current
    };
    if (!current.title.trim()) {
      setError('Give this document a title before saving.');
      document.getElementById('document-title')?.focus();
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    saving.current = true;
    setStatus('saving');
    setError('');
    try {
      const result = isNew ? await api.createDocument(workspaceId, current) : await api.updateDocument(initialDocument.id, current);
      lastSaved.current = JSON.stringify(current);
      setStatus(JSON.stringify(draft.current) === lastSaved.current ? 'saved' : 'unsaved');
      onSaved.current?.(result);
    } catch (e) {
      setStatus('error');
      setError(`Could not save your document. ${errorMessage(e)}`);
    } finally {
      saving.current = false;
    }
  };
  const saveRef = useRef(executeSave);
  saveRef.current = executeSave;
  useEffect(() => {
    if (!isNew && hasEdits && canEdit && !restoreId && !restoring && status !== 'error' && !composing.current) {
      timer.current = setTimeout(() => saveRef.current(), 3000);
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [title, markdown, tags, isNew, canEdit, status, hasEdits, restoreId, restoring]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && !e.isComposing) {
        e.preventDefault();
        saveRef.current();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  useEffect(() => {
    if (!hasEdits) return;
    const unload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    const nav = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest('a');
      if (!link || e.defaultPrevented || e.ctrlKey || e.metaKey || e.shiftKey || link.target === '_blank') return;
      const url = new URL(link.href);
      if (url.origin === location.origin && url.pathname === location.pathname && url.search === location.search) return;
      e.preventDefault();
      e.stopPropagation();
      setLeave(link.href);
    };
    window.addEventListener('beforeunload', unload);
    document.addEventListener('click', nav, true);
    return () => {
      window.removeEventListener('beforeunload', unload);
      document.removeEventListener('click', nav, true);
    };
  }, [hasEdits]);
  useEffect(() => {
    if (location.hash) {
      setView('preview');
      const t = setTimeout(() => document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({
        block: 'center'
      }), 100);
      return () => clearTimeout(t);
    }
  }, [initialDocument?.id]);
  const edit = (fn: () => void) => {
    fn();
    setStatus('unsaved');
  };
  const addTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing && tagInput.trim()) {
      e.preventDefault();
      const clean = tagInput.trim().replace(/^#/, '').toLowerCase();
      if (!tags.includes(clean)) edit(() => setTags([...tags, clean]));
      setTagInput('');
    }
  };
  const loadHistory = async () => {
    setTab('revisions');
    setHistoryLoading(true);
    setError('');
    try {
      setRevisions(await api.listRevisions(initialDocument.id));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setHistoryLoading(false);
    }
  };
  const restore = async () => {
    if (saving.current || restoring) return;
    setRestoring(true);
    if (timer.current) clearTimeout(timer.current);
    try {
      const d = await api.restoreRevision(initialDocument.id, restoreId);
      const next = {
        title: d.title,
        markdown: d.markdown,
        tags: d.tags?.map((t: any) => t.name) || tags
      };
      lastSaved.current = JSON.stringify(next);
      setTitle(next.title);
      setMarkdown(next.markdown);
      setTags(next.tags);
      setStatus('saved');
      setRestoreId('');
      onSaved.current?.(d);
      await loadHistory();
    } catch (e) {
      setError(errorMessage(e));
      setRestoreId('');
    } finally {
      setRestoring(false);
    }
  };
  const outline = useMemo(() => {
    let fence = false;
    const counts: Record<string, number> = {};
    return markdown.split('\n').flatMap((line: string) => {
      if (/^\s*(```|~~~)/.test(line)) fence = !fence;
      if (fence) return [];
      const m = line.match(/^(#{1,6})\s+(.+)$/);
      if (!m) return [];
      const text = m[2].replace(/[*_`]/g, '').replace(/\s+#+$/, '');
      const base = headingId(text);
      const count = counts[base] || 0;
      counts[base] = count + 1;
      return [{
        text,
        level: m[1].length,
        id: base + (count ? `-${count}` : '')
      }];
    });
  }, [markdown]);
  const headingPlugin = useMemo(() => () => (tree: any) => {
    const counts: Record<string, number> = {};
    const stack: Record<number, string> = {};
    const plain = (n: any): string => n.type === 'text' ? n.value : (n.children || []).map(plain).join('');
    const walk = (node: any) => {
      if (/^h[1-6]$/.test(node.tagName || '')) {
        const text = plain(node);
        const level = Number(node.tagName[1]);
        Object.keys(stack).forEach(k => {
          if (Number(k) >= level) delete stack[Number(k)];
        });
        stack[level] = text;
        const path = Object.keys(stack).map(k => stack[Number(k)]).join(' > ');
        const base = headingId(text);
        const count = counts[base] || 0;
        counts[base] = count + 1;
        node.properties = {
          ...node.properties,
          id: base + (count ? `-${count}` : '')
        };
        const section = initialDocument?.sections?.find((s: any) => s.heading_path === path);
        if (section) node.children.unshift({
          type: 'element',
          tagName: 'span',
          properties: {
            id: `section-${section.id}`
          },
          children: []
        });
      }
      node.children?.forEach(walk);
    };
    walk(tree);
  }, [initialDocument?.sections]);
  const preview = markdown.replace(/\[\[([^\]]+)\]\]/g, (_m: string, target: string) => {
    const [name, heading] = target.split('#');
    const resolved = initialDocument?.outgoing_links?.find((l: any) => l.raw_target_title.toLowerCase() === name.toLowerCase() && l.target_document_id);
    const href = resolved ? `/workspaces/${workspaceId}/documents/${resolved.target_document_id}${heading ? '#' + headingId(heading) : ''}` : `/workspaces/${workspaceId}/documents?search=${encodeURIComponent(name)}`;
    return `[${target}](${href})`;
  });
  if (!canEdit && isNew) return <div className="page"><Notice kind="info">You have viewer access. Ask an owner to grant editor access before creating documents.</Notice><Link className="button secondary" href={`/workspaces/${workspaceId}/documents`}>Back to documents</Link></div>;
  return <div className="editor-page"><header className="editor-toolbar"><Link className="text-link small" href={`/workspaces/${workspaceId}/documents`}><ArrowLeft size={15} />Document Library</Link><div className="actions"><span className="small" role="status">{status === 'saved' && <Check size={14} />} {isNew ? 'New document' : status === 'saving' ? 'Saving...' : status === 'saved' ? 'All changes saved' : status === 'error' ? 'Save failed' : 'Unsaved edits'}</span>{canEdit && <div className="segmented" aria-label="Editor view">{([['edit', Edit3, 'Edit Only'], ['split', Columns, 'Split View'], ['preview', Eye, 'Preview Only']] as const).map(([mode, Icon, label]) => <button key={mode} aria-label={label} title={label} aria-pressed={view === mode} onClick={() => setView(mode)}><Icon size={15} /><span className="hidden sm:inline">{mode}</span></button>)}</div>}{canEdit && <button className="button" disabled={status === 'saving' || restoring} onClick={executeSave}><Save size={15} />{status === 'saving' ? 'Saving...' : 'Save'}</button>}</div></header><div className="editor-meta"><h1 className="sr-only">{isNew ? 'New document' : title}</h1><input id="document-title" className="editor-title" aria-label="Document Title" placeholder="Document Title" value={title} maxLength={500} readOnly={!canEdit} onChange={e => edit(() => setTitle(e.target.value))} /><div className="editor-tags">{tags.map(t => <span className="tag" key={t}>{t}{canEdit && <button aria-label={`Remove tag ${t}`} onClick={() => edit(() => setTags(tags.filter(x => x !== t)))}><X size={12} /></button>}</span>)}{canEdit && <input aria-label="Add tag" placeholder="+ Add tag, press Enter" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={addTag} />}<span className="muted small" style={{
          marginLeft: 'auto'
        }}>{isNew ? 'Markdown' : `Version ${initialDocument?.version_number}`}</span></div>{error && <Notice>{error}</Notice>}{!canEdit && <p className="muted small" style={{
        marginTop: 10
      }}>Read-only document / Viewer access</p>}</div><div className="editor-workbench"><div className={`editor-panes ${view === 'split' ? 'split' : ''}`}>{view !== 'preview' && <section className="editor-pane"><div className="pane-label"><span>MARKDOWN SOURCE</span><span>{markdown.length} characters</span></div><div className="editor-code" onCompositionStart={() => {
            composing.current = true;
          }} onCompositionEnd={() => {
            composing.current = false;
            setStatus('unsaved');
          }}><CodeMirror value={markdown} extensions={[markdownLang()]} theme="light" editable={canEdit} onChange={v => edit(() => setMarkdown(v))} basicSetup={{
              foldGutter: false,
              highlightActiveLine: true
            }} aria-label="Markdown source" /></div></section>}{view !== 'edit' && <section className="editor-pane"><div className="pane-label"><span>RENDERED PREVIEW</span><Eye size={13} /></div><div className="markdown-body editor-preview"><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[headingPlugin]}>{preview}</ReactMarkdown></div></section>}</div><aside className="editor-inspector"><div className="inspector-tabs" aria-label="Document inspector">{[['toc', 'Outline'], ['links', 'Links'], ['revisions', 'History'], ['related', 'AI Related']].map(([value, label]) => <button key={value} disabled={isNew && value !== 'toc'} aria-pressed={tab === value} onClick={() => value === 'revisions' ? loadHistory() : setTab(value)}>{label}</button>)}</div><div className="inspector-content">{tab === 'toc' && <><h2>On this page</h2>{outline.map((h: any) => <a className="outline-link" key={h.id} href={`#${h.id}`} style={{
              paddingLeft: Math.min(h.level - 1, 3) * 10
            }} onClick={() => setView('preview')}>{h.text}</a>)}{!outline.length && <p className="muted small">Add a Markdown heading to build an outline.</p>}</>}{tab === 'links' && <><h2>Outgoing Wiki Links</h2>{initialDocument?.outgoing_links?.length ? initialDocument.outgoing_links.map((l: any) => <div className="inspector-card" key={l.id}>{l.target_document_id ? <Link className="text-link" href={`/workspaces/${workspaceId}/documents/${l.target_document_id}${l.target_heading ? '#' + headingId(l.target_heading) : ''}`}>{l.raw_target_title}<ExternalLink size={12} /></Link> : <span>{l.raw_target_title}</span>}<p>{l.is_resolved ? 'Linked document' : 'Unresolved link'}</p></div>) : <p className="muted small">Use [[Document Title]] to link another document.</p>}<h2>Backlinks</h2>{initialDocument?.backlinks?.length ? initialDocument.backlinks.map((l: any) => <Link className="inspector-card text-link" key={l.id} href={`/workspaces/${workspaceId}/documents/${l.source_document_id}`}>{l.target_title || 'Linked document'}<ExternalLink size={12} /></Link>) : <p className="muted small">No other documents link here yet.</p>}</>}{tab === 'revisions' && <><h2>Version history</h2>{historyLoading ? <Loading label="Loading revision history" /> : revisions.length ? revisions.map(r => <div className="inspector-card" key={r.id}><strong>Version {r.version_number}</strong><p>{dateLabel(r.created_at)}</p><details><summary className="small text-link">View snapshot</summary><pre className="revision-preview">{r.markdown}</pre></details>{canEdit && <button className="button secondary small-button" style={{
                marginTop: 12
              }} disabled={status === 'saving' || restoring} onClick={() => setRestoreId(r.id)}>Restore This Version</button>}</div>) : <p className="muted small">Save your document to create a revision.</p>}</>}{tab === 'related' && <><h2>Related documents</h2>{initialDocument?.related_documents?.length ? initialDocument.related_documents.map((r: any) => <Link className="inspector-card" key={r.id} href={`/workspaces/${workspaceId}/documents/${r.id}`}><strong>{r.title}</strong><p>{Math.round(r.score * 100)}% similarity</p></Link>) : <p className="muted small">No related documents found yet. New connections appear after indexing.</p>}</>}</div></aside></div><ConfirmDialog open={!!restoreId} onClose={() => setRestoreId('')} onConfirm={restore} busy={restoring} title="Restore this revision?" description="This will replace the current document content. Unsaved edits will be discarded; saved versions remain in history." action="Restore revision" /><ConfirmDialog open={!!leave} onClose={() => setLeave('')} onConfirm={() => {
      const target = leave;
      setLeave('');
      lastSaved.current = JSON.stringify(draft.current);
      if (timer.current) clearTimeout(timer.current);
      router.push(target);
    }} title="Leave without saving?" description="Your latest edits have not been saved. Stay here to save them, or leave and discard the changes." action="Leave document" /></div>;
}
