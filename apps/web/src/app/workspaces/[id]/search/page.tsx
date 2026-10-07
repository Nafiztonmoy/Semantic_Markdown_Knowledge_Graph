"use client";

import { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowUpRight, Search, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { documentHref } from '@/lib/documentLinks';
import { SearchField, Loading, Notice, EmptyState, Tags, Snippet, errorMessage } from '@/components/ui';
import { SearchModes, type SearchMode } from '@/components/SearchModes';
export default function SearchPage({
  params
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const {
    id
  } = use(params);
  const sp = useSearchParams();
  const [query, setQuery] = useState(sp.get('q') || '');
  const initialMode = sp.get('mode');
  const [mode, setMode] = useState<SearchMode>(initialMode === 'keyword' || initialMode === 'semantic' ? initialMode : 'all');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const seq = useRef(0);
  const committed = useRef('');
  const [composing, setComposing] = useState(false);
  const run = async (q = query, m = mode) => {
    const request = ++seq.current;
    committed.current = `${id}:${q.trim()}:${m}`;
    setError('');
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }
    setQuery(q);
    setMode(m);
    setLoading(true);
    setSearched(true);
    const p = new URLSearchParams({
      q: q.trim(),
      mode: m
    });
    window.history.replaceState(null, '', `${window.location.pathname}?${p}`);
    try {
      const res = await api.search(id, {
        q: q.trim(),
        mode: m,
        limit: 25
      });
      if (request === seq.current) setResults(res.items || []);
    } catch (e) {
      if (request === seq.current) {
        setError(errorMessage(e));
        setResults([]);
      }
    } finally {
      if (request === seq.current) setLoading(false);
    }
  };
  useEffect(() => {
    const q = sp.get('q') || '';
    const raw = sp.get('mode');
    const m: SearchMode = raw === 'keyword' || raw === 'semantic' ? raw : 'all';
    if (committed.current !== `${id}:${q.trim()}:${m}`) {
      setQuery(q);
      setMode(m);
      run(q, m);
    }
  }, [id, sp]);
  useEffect(() => () => {
    seq.current++;
  }, []);
  const change = (value: string) => {
    seq.current++;
    setQuery(value);
    setLoading(false);
    if (!value) {
      setResults([]);
      setSearched(false);
      setError('');
      window.history.replaceState(null, '', window.location.pathname);
    }
  };
  return <div className="page narrow"><div className="search-hero"><h1>Hybrid Semantic Search</h1><p className="muted" style={{
        marginTop: 12
      }}>Find exactly what you need, even when you don’t know the exact words.</p><form noValidate onSubmit={e => {
        e.preventDefault();
        if (!composing) run();
      }}><div className="large-search"><SearchField value={query} onChange={change} label="Search across documents" placeholder="Search across documents, ideas, and code..." onCompositionChange={setComposing} /><button className="button" disabled={loading || !query.trim()}>{loading ? 'Searching...' : 'Search'}<ArrowRight size={16} /></button></div><SearchModes mode={mode} onChange={m => {
          setMode(m);
          if (query.trim()) run(query, m);
        }} /></form><p className="muted small" style={{
        marginTop: 12
      }}>{mode === 'all' ? 'Combines keyword matches with meaning-based discovery.' : mode === 'keyword' ? 'Find exact terms and phrases in your documents.' : 'Discover related ideas, even with different wording.'}</p></div>{error && <Notice>{error} <button className="text-link" onClick={() => run()}>Try again</button></Notice>}{loading ? <Loading label="Searching workspace" /> : searched && !error ? <><div className="section-heading" style={{
        borderBottom: '1px solid var(--border)',
        paddingBottom: 14
      }}><p className="muted small" role="status">Found {results.length} result(s)</p><span className="mono muted">{mode === 'all' ? 'Hybrid ranking' : `${mode} ranking`}</span></div>{results.map(item => <article className="result-item" key={item.section_id}><div className="result-top"><div><Link href={documentHref(id, item)}><h2>{item.title} <ArrowUpRight size={15} style={{
                  display: 'inline'
                }} /></h2></Link><span className="muted small">{item.heading_path}</span></div><span className="score">{mode === 'all' ? 'RRF' : 'Score'}: {Number(item.score).toFixed(4)}</span></div><p><Snippet text={item.snippet || ''} /></p><div className="result-footer"><span>{item.relevance_explanation}</span><Tags tags={item.tags} /></div></article>)}{!results.length && <EmptyState title="No matches this time" description="Try a broader phrase, or switch between keyword and semantic search." />}</> : !error && <div style={{
      padding: '25px 0'
    }}><div className="section-heading"><h2>Start with a question or a concept</h2><Search size={18} className="muted" /></div><div className="search-examples">{['How does authentication work?', 'Database indexing strategy', 'Deployment and rollback', 'Caching and performance'].map(q => <button className="suggestion" key={q} onClick={() => run(q)}>{q}<ArrowUpRight size={16} /></button>)}</div></div>}</div>;
}
