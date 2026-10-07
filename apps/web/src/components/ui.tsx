"use client";

import { useEffect, useRef, useId, type ReactNode, type InputHTMLAttributes } from "react";
import Link from "next/link";
import { BookOpen, AlertCircle, X, Search, FileText, Upload } from "lucide-react";
export function Brand() {
  return <Link href="/" className="brand" aria-label="NexusDocs home"><span className="brand-mark"><BookOpen size={20} /></span><span>Nexus<span className="brand-light">Docs</span></span></Link>;
}
export function PageHeader({
  title,
  description,
  actions
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return <header className="page-heading"><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="actions">{actions}</div>}</header>;
}
export function Notice({
  children,
  kind = "error"
}: {
  children: ReactNode;
  kind?: "error" | "success" | "info";
}) {
  return <div className={`notice ${kind}`} role={kind === "error" ? "alert" : "status"}><AlertCircle size={17} /><div>{children}</div></div>;
}
export function EmptyState({
  title,
  description,
  action
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return <div className="empty-state"><span className="empty-icon"><FileText size={25} /></span><h2>{title}</h2><p>{description}</p>{action}</div>;
}
export function Loading({
  label = "Loading workspace"
}: {
  label?: string;
}) {
  return <div className="loading-state" role="status" aria-label={label}><span className="sr-only">{label}</span><div className="skeleton wide" /><div className="skeleton" /><div className="skeleton" /></div>;
}
export function Field({
  label,
  error,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
}) {
  const generated = useId();
  const fieldId = id || generated;
  return <div className="field"><label htmlFor={fieldId}>{label}</label><input {...props} id={fieldId} aria-invalid={!!error} aria-describedby={error ? `${fieldId}-error` : undefined} />{error && <p className="field-error" id={`${fieldId}-error`}>{error}</p>}</div>;
}
export function SearchField({
  value,
  onChange,
  placeholder = "Search documents",
  label = "Search",
  onSubmit,
  onCompositionChange
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  onSubmit?: () => void;
  onCompositionChange?: (active: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return <div className="search-field"><Search size={18} /><input ref={ref} type="search" aria-label={label} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} onCompositionStart={() => onCompositionChange?.(true)} onCompositionEnd={() => onCompositionChange?.(false)} onKeyDown={e => {
      if (e.key === "Enter" && !e.nativeEvent.isComposing && onSubmit) {
        e.preventDefault();
        onSubmit();
      }
    }} />{value && <button type="button" aria-label="Clear search" className="icon-button" onClick={() => {
      onChange("");
      ref.current?.focus();
    }}><X size={16} /></button>}</div>;
}
export function Dialog({
  open,
  onClose,
  title,
  children
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const el = ref.current;
    if (!el || !open) return;
    const previous = (document.activeElement as HTMLElement);
    el.showModal();
    return () => {
      el.close();
      previous?.focus();
    };
  }, [open]);
  if (!open) return null;
  return <dialog ref={ref} className="dialog" aria-labelledby={titleId} onCancel={e => {
    e.preventDefault();
    onClose();
  }}><div className="dialog-heading"><h2 id={titleId}>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={19} /></button></div>{children}</dialog>;
}
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  busy = false,
  action = "Delete"
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  busy?: boolean;
  action?: string;
}) {
  return <Dialog open={open} onClose={() => {
    if (!busy) onClose();
  }} title={title}><p className="muted">{description}</p><div className="dialog-actions"><button className="button secondary" autoFocus disabled={busy} onClick={onClose}>Cancel</button><button className="button danger" disabled={busy} onClick={onConfirm}>{busy ? "Working..." : action}</button></div></Dialog>;
}
export function ImportButton({
  busy,
  onFiles
}: {
  busy: boolean;
  onFiles: (files: File[]) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return <><input ref={ref} type="file" multiple accept=".md,.markdown,.txt" className="sr-only" tabIndex={-1} aria-label="Import Markdown files" onChange={e => {
      if (e.target.files?.length) onFiles(Array.from(e.target.files));
      e.target.value = "";
    }} /><button className="button secondary" disabled={busy} onClick={() => ref.current?.click()}><Upload size={16} />{busy ? "Importing..." : "Import .md Files"}</button></>;
}
export function Tags({
  tags
}: {
  tags?: Array<string | {
    id?: string;
    name: string;
  }>;
}) {
  return <div className="tags">{tags?.map(t => {
      const name = typeof t === "string" ? t : t.name;
      return <span className="tag" key={name}>{name}</span>;
    })}</div>;
}
export function dateLabel(value?: string) {
  return value ? new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value)) : "";
}
export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}
export function Snippet({
  text
}: {
  text: string;
}) {
  return <>{text.split(/(<\/?(?:mark|b)>)/gi).map((part, i, all) => /^<\/?(?:mark|b)>$/i.test(part) ? null : /^<(?:mark|b)>$/i.test(all[i - 1] || "") ? <mark key={i}>{part}</mark> : <span key={i}>{part}</span>)}</>;
}
