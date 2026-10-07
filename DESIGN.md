---
version: alpha
name: NexusDocs
description: Connected documentation for engineering teams
colors:
  primary: "#176b53"
  background: "#f6f8f7"
  surface: "#ffffff"
  foreground: "#20352f"
  muted: "#64736d"
  border: "#dfe6e2"
  danger: "#a33836"
typography:
  sans:
    fontFamily: "Nimbus Sans, Arial, sans-serif"
  mono:
    fontFamily: "SFMono-Regular, Consolas, monospace"
rounded:
  DEFAULT: "8px"
  panel: "12px"
  dialog: "14px"
spacing:
  page: "40px"
  narrow-page: "20px"
  section-gap: "24px"
components:
  button: {}
  dialog: {}
  input: {}
  graph: {}
---

# NexusDocs design system

## Overview

NexusDocs is a developer knowledge workspace. The visual reference is an organized engineering notebook: clear document hierarchy, generous writing space, and a live map of linked ideas. The graph is the signature, not decorative imagery. The source ZIP and matching specification establish the audience, English language, and existing application routes.

The user requested a complete frontend overhaul. Retain NexusDocs, its book mark, routes, main navigation names, and API capabilities. The public introduction and authentication share the same identity as the task-focused application. Use design variance 6, motion intensity 3, and visual density 5. Avoid glowing dark dashboards, unrelated colors, status claims without data, and marketing copy inside core tasks.

Runtime CSS is canonical (Model B). `apps/web/src/app/globals.css` owns semantic variables. This document mirrors the accepted primary values; Tailwind adapters reference those CSS variables. Components consume semantic classes and variables. Cytoscape reads primary and foreground from the document root. Graph relationship colors are deliberate data categories, differentiated by line style and node shape too.

## Colors

Use the light canvas, white content surfaces, restrained green action color, and muted secondary text defined above. Tint `#e8f1eb` denotes selection and supporting panels. Error messages use danger with a pale background and explicit text. This release has one light theme; do not imply a dark-mode switch. Forced colors retain control borders and native scrollbars.

## Typography

Self-hosted Nimbus Sans carries interface text, 400 and 700 weights, with Arial fallback. Monospace is reserved for Markdown source, version data, and keyboard shortcuts. Product page titles use 27–32 px; text is 13–14 px. Labels are 11–12 px. Keep headings restrained and readable. Public display type is larger but uses the same family. The bundled font license accompanies the files.

## Layout

A 232 px persistent desktop sidebar and 65 px breadcrumb bar frame the workspace. At 767 px and below, navigation becomes a toggled drawer and page padding reduces to 20 px. Content is capped at 1440 px. The dashboard prioritizes recent documents beside a real graph, then topic browsing and an assistant entry point. Tables hide nonessential metadata on mobile while retaining document links and actions. Editing panels stack below 1200 px; inspector tools remain accessible below them on mobile. Settings forms use natural document scrolling.

## Elevation & Depth

Use borders and surface tones for normal content. Shadows belong to modal overlays, graph inspection, and the assistant composer. Avoid glowing buttons, gradient panels, and blurred content surfaces.

## Shapes

Controls use 8 px radii, panels 12 px, and modal dialogs 14 px. Topic tags use a compact 5 px radius. User initials are circular to distinguish people from documents. Document icons use a paper-like rectangular outline.

## Components

Shared owners: `components/ui.tsx` (buttons via CSS classes, fields, search input, notice, empty/loading state, dialogs, import trigger, tags); `SearchModes.tsx`; `GraphCanvas.tsx`; `MarkdownEditor.tsx`.

Buttons preserve size while busy, indicate disabled state, and have visible focus. Errors appear inline and retain form data. Search clearing is immediate and restores focus. Loading skeletons reserve a usable content region; empty states explain the next action. Dialogs use native modal focus containment and Escape behavior, with explicit Cancel for destructive actions.

Lucide is the existing icon family; retain it throughout, normally 15–20 px and 1.7 stroke. Use short, meaningful state transitions and respect reduced motion. Graph layouts do not animate. No ambient animation.

Write plain English labels. Dates use the user's local timezone and the English locale. Graph previews on public/auth routes are explicitly labeled examples; authenticated dashboards show real API data. Do not claim an AI answer is verified or hallucination-free.

## Do's and Don'ts

- Do keep writing, navigation, and sources more prominent than implementation detail.
- Do distinguish permissions, loading, failed retrieval, and an empty workspace.
- Do retain all existing backend contracts and source identities.
- Don't invent metrics, provider availability, infrastructure versions, or production readiness.
- Don't hide primary actions on mobile or rely on graph color alone.
