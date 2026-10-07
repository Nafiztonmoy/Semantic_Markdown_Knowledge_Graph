import Link from 'next/link';
export default function NotFound() {
  return <main className="welcome-workspace"><p className="eyebrow">Page not found</p><h1>This page isn’t here.</h1><p className="muted">The link may have changed, or the document may no longer exist.</p><Link className="button" style={{
      marginTop: 24
    }} href="/">Return to your workspace</Link></main>;
}
