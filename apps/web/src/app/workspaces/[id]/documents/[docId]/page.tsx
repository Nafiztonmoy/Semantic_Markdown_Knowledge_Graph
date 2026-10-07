"use client";

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { MarkdownEditor } from '@/components/MarkdownEditor';
import { Loading, Notice, errorMessage } from '@/components/ui';
export default function DocumentPage({
  params
}: {
  params: Promise<{
    id: string;
    docId: string;
  }>;
}) {
  const {
    id,
    docId
  } = use(params);
  const [doc, setDoc] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.getDocument(docId).then(d => {
      if (active) {
        setDoc(d);
        document.title = `${d.title} | NexusDocs`;
      }
    }).catch(e => {
      if (active) setError(errorMessage(e));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [docId, retry]);
  if (loading) return <Loading label="Loading document" />;
  if (error) return <div className="page"><Notice>{error}</Notice><div className="actions"><button className="button" onClick={() => setRetry(v => v + 1)}>Try again</button><Link className="button secondary" href={`/workspaces/${id}/documents`}>Back to documents</Link></div></div>;
  return <MarkdownEditor key={docId} workspaceId={id} initialDocument={doc} onSaveSuccess={setDoc} />;
}
