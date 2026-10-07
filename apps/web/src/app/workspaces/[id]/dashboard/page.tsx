"use client";

import { use, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { FileText, Share2, Tag, Plus, ArrowUpRight, ArrowRight, Sparkles, Link2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useWorkspace } from '@/lib/workspaceContext';
import { GraphCanvas } from '@/components/GraphCanvas';
import { PageHeader, Loading, Notice, ImportButton, EmptyState, dateLabel, errorMessage } from '@/components/ui';
export default function Dashboard({
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
  const base = `/workspaces/${id}`;
  const [docs, setDocs] = useState<any[]>([]);
  const [graph, setGraph] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [d, g] = await Promise.all([api.listDocuments(id), api.getGraph(id, {
        limit: 40
      })]);
      setDocs(d);
      setGraph(g);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);
  const importFiles = async (files: File[]) => {
    setImporting(true);
    setMessage('');
    try {
      const r = await api.importMarkdownFiles(id, files);
      setMessage(`${r.succeeded} file(s) imported${r.failed ? `; ${r.failed} failed. ${r.results.filter((x: any) => x.status === 'error').map((x: any) => `${x.filename}: ${x.error}`).join(' ')}` : '. Indexing runs in the background.'}`);
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setImporting(false);
    }
  };
  const tags = Array.from(new Set<string>(docs.flatMap(d => d.tags.map((t: any) => t.name))));
  return <div className="page"><PageHeader title={workspace.name} description={workspace.description || 'A shared home for your team’s knowledge. Pick up where you left off.'} actions={workspace.user_role !== 'viewer' && <><ImportButton busy={importing} onFiles={importFiles} /><Link className="button" href={`${base}/documents/new`}><Plus size={16} />Create Document</Link></>} />{error && <Notice>{error} <button className="text-link" onClick={load}>Try again</button></Notice>}{message && <Notice kind="info">{message}</Notice>}{loading ? <Loading /> : <><div className="metrics">{[[FileText, 'Documents', docs.length, 'Notes, guides & decisions'], [Share2, 'Knowledge Graph Nodes', graph?.total_nodes || 0, 'Documents & topics'], [Link2, 'Connections', graph?.total_edges || 0, 'Links & related ideas'], [Tag, 'Topics', tags.length, 'Across your workspace']].map(([Icon, label, value, detail]: any) => <div className="metric" key={label}><div className="metric-label"><Icon size={15} />{label}</div><div className="metric-value">{value}</div><div className="metric-detail">{detail}</div></div>)}</div><div className="dashboard-grid"><section className="panel dashboard-documents"><div className="section-heading"><h2>Recently updated</h2><Link className="text-link" href={`${base}/documents`}>All documents <ArrowRight size={14} /></Link></div>{docs.slice(0, 5).map(doc => <Link className="document-row" key={doc.id} href={`${base}/documents/${doc.id}`}><span className="doc-icon"><FileText size={18} /></span><div className="document-row-content"><span className="doc-title">{doc.title}</span><div className="doc-meta">{doc.tags?.slice(0, 2).map((t: any) => t.name).join(' / ') || 'Document'} <span className="mono"> · v{doc.version_number}</span></div></div><time>{dateLabel(doc.updated_at)}</time><ArrowUpRight size={15} className="muted" /></Link>)}{!docs.length && <EmptyState title="Start with one idea" description="Create or import a Markdown document to begin connecting your knowledge." action={workspace.user_role !== 'viewer' && <Link className="button" href={`${base}/documents/new`}>Create Document</Link>} />}</section><section className="panel graph-panel"><div className="section-heading"><h2>Your knowledge, connected</h2><Link className="text-link" href={`${base}/graph`}>Explore <ArrowUpRight size={15} /></Link></div><div className="graph-preview">{graph?.nodes?.length ? <GraphCanvas nodes={graph.nodes} edges={graph.edges} compact onSelectNode={() => {}} onSelectEdge={() => {}} /> : <EmptyState title="A graph starts with a connection" description="Add wiki links or shared tags to your documents." />}</div><div className="graph-caption"><span><i className="line-key" />Wiki links</span><span><i className="line-key dashed" />Shared topics</span><span><i className="line-key dotted" />Related</span></div></section></div><div className="dashboard-secondary"><section className="ask-card"><div><Sparkles size={20} className="text-link" /><h2 style={{
              marginTop: 12
            }}>Find an answer in your docs.</h2><p>Ask a question. Follow the sources back to the original ideas.</p></div><Link className="button secondary" href={`${base}/ask`}>Ask AI <ArrowUpRight size={15} /></Link></section><section className="tag-section"><div className="section-heading"><h2>Browse by topic</h2><Tag size={16} className="muted" /></div><div className="tags">{tags.map(tag => <Link className="tag-link" href={`${base}/documents?tag=${encodeURIComponent(tag)}`} key={tag}>{tag}<small>{docs.filter(d => d.tags.some((t: any) => t.name === tag)).length}</small></Link>)}{!tags.length && <p className="muted small">Add tags in the editor to organize your documents.</p>}</div></section></div></>}</div>;
}
