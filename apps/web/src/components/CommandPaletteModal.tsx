"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { documentHref } from '@/lib/documentLinks';
import { Dialog, SearchField, Notice, Loading, Snippet, errorMessage } from './ui';
import { SearchModes, type SearchMode } from './SearchModes';
export function CommandPaletteModal({
  workspaceId,
  isOpen,
  onClose
}: {
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('all');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [composing, setComposing] = useState(false);
  const sequence = useRef(0);
  useEffect(() => {
    const request = ++sequence.current;
    setError('');
    if (!isOpen || !query.trim() || composing) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.search(workspaceId, {
          q: query.trim(),
          mode,
          limit: 8
        });
        if (request === sequence.current) setResults(res.items || []);
      } catch (e) {
        if (request === sequence.current) setError(errorMessage(e));
      } finally {
        if (request === sequence.current) setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      sequence.current++;
    };
  }, [query, mode, workspaceId, isOpen, composing]);
  return <Dialog open={isOpen} onClose={onClose} title="Quick search"><SearchField label="Search workspace" placeholder="Search documents, sections, or concepts..." value={query} onChange={setQuery} onCompositionChange={setComposing} /><div style={{
      marginTop: 15
    }}><SearchModes mode={mode} onChange={setMode} /></div>{error ? <Notice>{error}</Notice> : loading ? <Loading label="Searching documents" /> : <div className="palette-results">{results.map(item => <Link className="palette-result" href={documentHref(workspaceId, item)} onClick={onClose} key={item.section_id}><strong>{item.title}</strong><span className="muted">{item.heading_path}</span><p style={{
          marginTop: 8
        }}><Snippet text={item.snippet || ''} /></p></Link>)}{!results.length && <p className="muted small" style={{
        padding: '25px 10px'
      }}>{query.trim() ? 'No documents matched. Try another phrase.' : 'Type a keyword or question to find connected ideas.'}</p>}</div>}<div className="palette-footer"><span><kbd>ESC</kbd> to close</span><Link className="text-link" onClick={onClose} href={`/workspaces/${workspaceId}/search?q=${encodeURIComponent(query)}&mode=${mode}`}>Full Search Page <ArrowRight size={14} /></Link></div></Dialog>;
}
