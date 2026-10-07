"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/authContext';
import { Brand, Field, Notice, errorMessage } from './ui';
import { ExampleGraph } from './ExampleGraph';
export function AuthForm({
  register = false
}: {
  register?: boolean;
}) {
  const router = useRouter();
  const {
    refreshUser
  } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    document.title = `${register ? 'Create account' : 'Sign in'} | NexusDocs`;
  }, [register]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const next: Record<string, string> = {};
    if (register && !name.trim()) next.name = 'Enter your name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Enter a valid email address.';
    if (password.length < (register ? 8 : 1)) next.password = register ? 'Use at least 8 characters.' : 'Enter your password.';
    setErrors(next);
    if (Object.keys(next).length) {
      document.getElementById(Object.keys(next)[0])?.focus();
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (register) await api.register({
        email,
        password,
        display_name: name.trim()
      });else await api.login({
        email,
        password
      });
      await refreshUser();
      const ws = await api.listWorkspaces();
      router.push(ws.length ? `/workspaces/${ws[0].id}/dashboard` : '/');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return <div className="auth-layout"><aside className="auth-story"><Brand /><div className="auth-story-inner"><h2>Your next insight<br />is already connected.</h2><p>Bring your documents, decisions, and discoveries into one shared workspace.</p><div className="auth-graph" style={{
          position: 'relative'
        }}><ExampleGraph /></div></div><footer>Write. Connect. Discover.</footer></aside><main className="auth-main"><div className="auth-form"><h1>{register ? 'Create an account' : 'Sign in to your account'}</h1><p>{register ? 'Start building your team’s knowledge together.' : 'Welcome back. Your workspace is waiting.'}</p>{error && <Notice>{error}</Notice>}<form noValidate className="form-stack" onSubmit={submit}>{register && <Field id="name" label="Full Name" value={name} autoComplete="name" onChange={e => setName(e.target.value)} error={errors.name} placeholder="Your name" />}<Field id="email" label="Email Address" type="email" value={email} autoComplete="email" onChange={e => setEmail(e.target.value)} error={errors.email} placeholder="you@company.com" /><div className="field"><label htmlFor="password">Password</label><div className="password-field"><input id="password" type={show ? 'text' : 'password'} value={password} autoComplete={register ? 'new-password' : 'current-password'} onChange={e => setPassword(e.target.value)} aria-invalid={!!errors.password} aria-describedby={errors.password ? 'password-error' : undefined} placeholder={register ? 'At least 8 characters' : 'Enter your password'} /><button type="button" className="icon-button" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(v => !v)}>{show ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>{errors.password && <p className="field-error" id="password-error">{errors.password}</p>}</div><button className="button" disabled={busy}>{busy ? register ? 'Creating account...' : 'Signing in...' : register ? 'Create Account' : 'Sign In'}<ArrowRight size={16} /></button></form><div className="auth-bottom">{register ? 'Already have an account?' : 'New to NexusDocs?'} <Link className="text-link" href={register ? '/login' : '/register'}>{register ? 'Sign in' : 'Create one'}</Link></div>{!register && <div className="demo-roles"><p>Try the demo with a workspace role</p><div>{[['admin', 'Admin (Owner)'], ['editor', 'Editor'], ['viewer', 'Viewer']].map(([role, label]) => <button key={role} type="button" onClick={() => {
              setEmail(`${role}@nexusdocs.dev`);
              setPassword('DevPassword123!');
              setErrors({});
            }}>{label}</button>)}</div></div>}</div></main></div>;
}
