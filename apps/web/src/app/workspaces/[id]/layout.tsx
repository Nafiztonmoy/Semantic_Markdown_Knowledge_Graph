"use client";

import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, FileText, Share2, Search, Sparkles, Settings, Plus, LogOut, ChevronRight, Menu, X, PanelLeft, BookOpen } from "lucide-react";
import { useAuth } from "@/lib/authContext";
import { api } from "@/lib/api";
import { WorkspaceContext } from "@/lib/workspaceContext";
import { CommandPaletteModal } from "@/components/CommandPaletteModal";
import { Brand, Loading, Notice, errorMessage } from "@/components/ui";
export default function WorkspaceLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{
    id: string;
  }>;
}) {
  const {
    id
  } = use(params);
  const pathname = usePathname();
  const router = useRouter();
  const {
    user,
    loading,
    logout
  } = useAuth();
  const [workspace, setWorkspace] = useState<any>(null);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [error, setError] = useState("");
  const refresh = useCallback(() => {
    if (!user) return;
    setError("");
    Promise.all([api.getWorkspace(id), api.listWorkspaces()]).then(([ws, list]) => {
      setWorkspace(ws);
      setWorkspaces(list);
    }).catch(e => setError(errorMessage(e)));
  }, [id, user]);
  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);
  useEffect(() => {
    setWorkspace(null);
    refresh();
  }, [refresh]);
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && !e.isComposing) {
        e.preventDefault();
        setSearchOpen(v => !v);
      }
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  const nav = ([['Dashboard', 'dashboard', LayoutDashboard], ['Documents', 'documents', FileText], ['Knowledge Graph', 'graph', Share2], ['Hybrid Search', 'search', Search], ['AI Assistant', 'ask', Sparkles], ['Settings', 'settings', Settings]] as const);
  const active = nav.find(n => pathname.includes(`/${n[1]}`))?.[0] || 'Workspace';
  useEffect(() => {
    document.title = `${active} | NexusDocs`;
  }, [active]);
  if (loading || !user) return <Loading label="Checking your session" />;
  return <WorkspaceContext.Provider value={{
    workspace,
    refresh
  }}><a className="skip-link" href="#main-content">Skip to content</a><div className="app-shell"><aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}><Brand /><div className="workspace-switch"><span className="workspace-initial">{workspace?.name?.[0] || 'N'}</span><div><select aria-label="Switch workspace" value={id} onChange={e => router.push(`/workspaces/${e.target.value}/dashboard`)}>{workspaces.length ? workspaces.map(ws => <option key={ws.id} value={ws.id}>{ws.name}</option>) : <option value={id}>Loading workspace</option>}</select><div className="muted small">{workspace?.user_role || 'Workspace'}</div></div></div><div className="sidebar-actions">{workspace && workspace.user_role !== 'viewer' && <Link className="button" href={`/workspaces/${id}/documents/new`}><Plus size={16} />New Document</Link>}<button className="sidebar-search" onClick={() => setSearchOpen(true)}><span><Search size={15} />Quick search</span><kbd>⌘ K</kbd></button></div><div><p className="nav-label">Workspace</p><nav aria-label="Main navigation">{nav.map(([name, route, Icon]) => <Link key={route} href={`/workspaces/${id}/${route}`} className={`nav-item ${active === name ? 'active' : ''}`} aria-current={active === name ? 'page' : undefined}><Icon size={18} />{name}</Link>)}</nav></div><div className="sidebar-bottom"><div className="sidebar-note"><strong>Your ideas, connected.</strong>Link documents with <span className="mono">[[wiki links]]</span> to grow your knowledge graph.</div><div className="user-row"><span className="avatar">{user.display_name.slice(0, 2).toUpperCase()}</span><div className="user-detail"><strong>{user.display_name}</strong><small>{user.email}</small></div><button className="icon-button" aria-label="Sign out" title="Sign out" onClick={async () => {
              try {
                await logout();
                router.push('/login');
              } catch (e) {
                setError(errorMessage(e));
              }
            }}><LogOut size={16} /></button></div></div></aside><div className="app-main"><header className="topbar"><button className="icon-button mobile-toggle" aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileOpen} onClick={() => setMobileOpen(v => !v)}>{mobileOpen ? <X size={20} /> : <Menu size={20} />}</button><div className="breadcrumb"><PanelLeft size={15} /><span>{workspace?.name || 'Workspace'}</span><ChevronRight size={13} /><strong>{active}</strong></div><div className="topbar-meta"><BookOpen size={14} /><span>Connected knowledge workspace</span></div></header><main id="main-content">{error ? <div className="page"><Notice>{error}</Notice><button className="button secondary" onClick={refresh}>Try again</button></div> : workspace ? children : <Loading />}</main></div></div><CommandPaletteModal workspaceId={id} isOpen={searchOpen} onClose={() => setSearchOpen(false)} /></WorkspaceContext.Provider>;
}
