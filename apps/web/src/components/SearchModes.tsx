"use client";

export type SearchMode = 'all' | 'keyword' | 'semantic';
export function SearchModes({
  mode,
  onChange
}: {
  mode: SearchMode;
  onChange: (mode: SearchMode) => void;
}) {
  return <div className="segmented" aria-label="Search mode">{([['all', 'Hybrid (RRF)'], ['keyword', 'Keyword'], ['semantic', 'Semantic']] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={mode === value} onClick={() => onChange(value)}>{label}</button>)}</div>;
}
