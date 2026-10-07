"use client";

import Link from 'next/link';
import { Notice } from '@/components/ui';
export default function ErrorPage({
  reset
}: {
  reset: () => void;
}) {
  return <div className="page narrow"><h1>This view couldn’t load</h1><Notice>Try loading the page again. Your saved documents are still in your workspace.</Notice><div className="actions"><button className="button" onClick={reset}>Try again</button><Link className="button secondary" href="/">Return home</Link></div></div>;
}
