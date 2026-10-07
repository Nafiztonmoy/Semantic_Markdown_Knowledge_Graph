"use client";

import { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { X, ArrowUpRight, Share2 } from 'lucide-react';
import { api } from '@/lib/api';
import { GraphCanvas } from '@/components/GraphCanvas';
import { PageHeader, Notice, Loading, Tags, EmptyState, errorMessage } from '@/components/ui';
export default function GraphPage({
  params
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const {
    id
  } = use(params);
  const [data, setData] = useState<any>({
    nodes: [],
    edges: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [wiki, setWiki] = useState(true);
  const [tags, setTags] = useState(true);
  const [semantic, setSemantic] = useState(true);
  const [similarity, setSimilarity] = useState(.65);
  const [tag, setTag] = useState('');
  const [allTags, setAllTags] = useState<string[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [edge, setEdge] = useState<any>(null);
  const [retry, setRetry] = useState(0);
  const seq = useRef(0);
  useEffect(() => {
    api.listDocuments(id).then(d => setAllTags(Array.from(new Set<string>(d.flatMap(x => x.tags.map((t: any) => t.name)))))).catch(() => {});
  }, [id]);
  useEffect(() => {
    const request = ++seq.current;
    setLoading(true);
    setError('');
    setSelected(null);
    setEdge(null);
    const timer = setTimeout(async () => {
      try {
        const g = await api.getGraph(id, {
          includeWikiLinks: wiki,
          includeTags: tags,
          includeSemanticEdges: semantic,
          minSimilarity: similarity,
          selectedTag: tag || undefined
        });
        if (seq.current === request) setData(g);
      } catch (e) {
        if (seq.current === request) setError(errorMessage(e));
      } finally {
        if (seq.current === request) setLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      seq.current++;
    };
  }, [id, wiki, tags, semantic, similarity, tag, retry]);
  return <div className="page"><PageHeader title="Knowledge Graph" description="Follow a connection. Find a new way to see what you already know." actions={<span className="muted small">{data.total_nodes || 0} nodes / {data.total_edges || 0} connections</span>} />{error && <Notice>{error} <button className="text-link" onClick={() => setRetry(v => v + 1)}>Try again</button></Notice>}<div className="graph-workspace"><aside className="graph-filters"><h2>Graph Controls</h2><div className="graph-filter-options"><div><h3>Connections</h3>{[['Wiki Links', wiki, setWiki, ''], ['Shared Tags', tags, setTags, 'dashed'], ['Semantic Similarity', semantic, setSemantic, 'dotted']].map(([label, checked, setter, style]: any) => <label className="check-row" key={label}><i className={`line-key ${style}`} />{label}<input type="checkbox" checked={checked} onChange={e => setter(e.target.checked)} /></label>)}</div><div><h3><label htmlFor="similarity">Minimum similarity · {Math.round(similarity * 100)}%</label></h3><input id="similarity" type="range" min="0.5" max="0.95" step="0.05" value={similarity} disabled={!semantic} onChange={e => setSimilarity(Number(e.target.value))} style={{
              width: '100%'
            }} /><p className="muted small" style={{
              marginTop: 7
            }}>Increase to show only closer connections.</p><h3><label htmlFor="graph-tag">Filter by topic</label></h3><select id="graph-tag" value={tag} onChange={e => setTag(e.target.value)}><option value="">All topics</option>{allTags.map(t => <option value={t} key={t}>{t}</option>)}</select></div></div><details className="graph-options"><summary className="text-link small">Select a node</summary>{data.nodes.map((n: any) => <button key={n.id} onClick={() => {
            setSelected(n);
            setEdge(null);
          }}>{n.label}</button>)}</details><details className="graph-options"><summary className="text-link small">Inspect a connection</summary>{data.edges.map((e: any) => <button key={e.id} onClick={() => {
            setEdge(e);
            setSelected(null);
          }}>{data.nodes.find((n: any) => n.id === e.source)?.label} → {data.nodes.find((n: any) => n.id === e.target)?.label}</button>)}</details></aside><div className="graph-stage">{loading ? <Loading label="Loading knowledge graph" /> : !data.nodes.length ? <EmptyState title="No connections to show" description="Try different filters, or add wiki links and tags to your documents." /> : <GraphCanvas nodes={data.nodes} edges={data.edges} onSelectNode={n => {
          setSelected(n);
          setEdge(null);
        }} onSelectEdge={e => {
          setEdge(e);
          setSelected(null);
        }} />}{(selected || edge) && <section className="graph-inspector" aria-label="Graph selection"><div className="dialog-heading"><span className="muted small">{selected ? `${selected.type} node` : 'Connection details'}</span><button className="icon-button" aria-label="Close graph details" onClick={() => {
              setSelected(null);
              setEdge(null);
            }}><X size={16} /></button></div>{selected ? <><h2>{selected.label}</h2><Tags tags={selected.tags} />{selected.document_id ? <Link className="button" href={`/workspaces/${id}/documents/${selected.document_id}`}>Open Document <ArrowUpRight size={15} /></Link> : <p className="muted small">{selected.type === 'unresolved' ? 'This wiki link does not have a matching document yet.' : 'This topic connects documents with a shared tag.'}</p>}</> : <><h2>{edge.type.replaceAll('_', ' ')}</h2>{edge.type === 'semantic_similarity' && <p className="score">Similarity: {Math.round(edge.score * 100)}%</p>}<p className="muted small">{edge.explainability || 'A relationship extracted from your workspace documents.'}</p></>}</section>}</div></div></div>;
}
