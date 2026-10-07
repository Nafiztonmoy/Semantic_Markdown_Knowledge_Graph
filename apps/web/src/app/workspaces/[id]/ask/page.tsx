"use client";

import { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Sparkles, ArrowUpRight, ArrowUp, BookOpen, RotateCcw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api } from '@/lib/api';
import { documentHref } from '@/lib/documentLinks';
import { PageHeader, Notice, Loading, errorMessage } from '@/components/ui';
type Message = {
  role: 'user' | 'assistant';
  content: string;
  citations?: any[];
  metadata?: any;
  providerStatus?: string;
  fallbackQuery?: string;
  error?: boolean;
};
export default function AskPage({
  params
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const {
    id
  } = use(params);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const lock = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);
  const [composing, setComposing] = useState(false);
  const [validation, setValidation] = useState('');
  const suggestions = ['How does authentication work?', 'Explain our deployment process', 'What happens during an incident?', 'How are documents connected?'];
  const ask = async (text = question) => {
    if (lock.current) return;
    if (text.trim().length < 2) {
      setValidation('Ask a question with at least 2 characters.');
      return;
    }
    const q = text.trim();
    lock.current = true;
    setLoading(true);
    setValidation('');
    setQuestion('');
    setMessages(old => [...old, {
      role: 'user',
      content: q
    }]);
    try {
      const res = await api.ask(id, {
        question: q
      });
      setMessages(old => [...old, {
        role: 'assistant',
        content: res.answer,
        citations: res.citations,
        metadata: res.retrieval_metadata,
        providerStatus: res.provider_status,
        fallbackQuery: res.fallback_search_query
      }]);
    } catch (e) {
      setQuestion(q);
      setMessages(old => [...old, {
        role: 'assistant',
        content: errorMessage(e),
        error: true
      }]);
    } finally {
      setLoading(false);
      lock.current = false;
    }
  };
  useEffect(() => {
    if (messages.length) bottom.current?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      block: 'nearest'
    });
  }, [messages.length, loading]);
  return <div className="chat-page"><PageHeader title="AI Assistant" description="Answers grounded in your workspace, with sources you can follow." actions={messages.length > 0 && <button className="button secondary small-button" disabled={loading} onClick={() => {
      setMessages([]);
      setQuestion('');
    }}><RotateCcw size={14} />New conversation</button>} />{!messages.length ? <section className="chat-welcome"><span className="chat-symbol"><Sparkles size={26} /></span><h2>What would you like<br />to understand?</h2><p>Ask about your architecture, a decision, or a process. Start with your team’s own knowledge.</p><div className="search-examples">{suggestions.map(s => <button className="suggestion" key={s} onClick={() => ask(s)}>{s}<ArrowUpRight size={16} /></button>)}</div></section> : <div className="chat-messages" aria-live="polite" aria-busy={loading}>{messages.map((m, i) => <article className={`message ${m.role}`} key={i}><div className="message-label">{m.role === 'assistant' ? <><Sparkles size={14} />NexusDocs</> : 'You'}</div>{m.error ? <Notice>{m.content} Your question is below; try sending it again.</Notice> : <><div className="markdown-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown></div>{m.providerStatus === 'disabled_no_key' && <Notice kind="info">AI generation isn’t configured. These are retrieved source excerpts from your workspace.</Notice>}{!!m.citations?.length && <div style={{
            marginTop: 22
          }}><h3 className="small"><BookOpen size={14} style={{
                display: 'inline',
                marginRight: 7
              }} />Sources ({m.citations.length})</h3><div className="citations">{m.citations.map((c: any, j: number) => <Link className="citation" href={documentHref(id, c)} key={c.section_id || j}><strong>{c.document_title} <ArrowUpRight size={12} style={{
                    display: 'inline'
                  }} /></strong><span className="muted small">{c.heading_path}</span><p>{c.excerpt}</p></Link>)}</div></div>}{m.fallbackQuery && <Link style={{
            marginTop: 15,
            fontSize: 12
          }} className="text-link" href={`/workspaces/${id}/search?q=${encodeURIComponent(m.fallbackQuery)}`}>Continue in Hybrid Search <ArrowUpRight size={14} /></Link>}{m.metadata && <details className="small muted" style={{
            marginTop: 16
          }}><summary>Retrieval details</summary><p>{m.metadata.sections_considered} source sections considered / {Math.round(m.metadata.latency_ms)} ms / {m.metadata.provider}</p></details>}</>}</article>)}{loading && <Loading label="Searching your documents and preparing an answer" />}<div ref={bottom} /></div>}<div className="chat-compose">{validation && <Notice>{validation}</Notice>}<form noValidate className="chat-input" onSubmit={e => {
        e.preventDefault();
        if (!composing) ask();
      }}><textarea className="resize-none" aria-label="Ask a question" placeholder="Ask a question about your workspace..." value={question} maxLength={2000} rows={2} onChange={e => setQuestion(e.target.value)} onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)} onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            ask();
          }
        }} /><button className="button" aria-label="Send question" disabled={loading || question.trim().length < 2}><ArrowUp size={19} /></button></form><small>Answers depend on your source documents. Check the citations before acting.</small></div></div>;
}
