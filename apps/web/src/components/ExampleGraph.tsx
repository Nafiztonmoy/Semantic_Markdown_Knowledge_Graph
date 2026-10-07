"use client";

import { useState } from 'react';
import { GraphCanvas } from './GraphCanvas';
const labels = ['System architecture', 'Authentication', 'API conventions', 'Deployment guide', 'Database notes', 'Caching strategy', 'Incident runbook', 'Observability', 'backend', 'infrastructure', 'Testing strategy'];
const nodes = labels.map((label, i) => ({
  id: `example-${i}`,
  label,
  type: i === 8 || i === 9 ? 'tag' : 'document'
}));
const pairs = [[0, 1], [0, 2], [0, 3], [0, 4], [4, 5], [3, 6], [3, 7], [1, 8], [2, 8], [4, 8], [3, 9], [7, 9], [10, 2], [10, 6], [5, 7], [4, 1]];
const edges = pairs.map(([s, t], i) => ({
  id: `edge-${i}`,
  source: `example-${s}`,
  target: `example-${t}`,
  type: t > 7 ? 'shared_tag' : i > 13 ? 'semantic_similarity' : 'wiki_link'
}));
export function ExampleGraph() {
  const [selected, setSelected] = useState('System architecture');
  return <><GraphCanvas nodes={nodes} edges={edges} compact onSelectNode={node => {
      if (node) setSelected(node.label);
    }} onSelectEdge={() => {}} /><div className="visual-caption"><div><strong>{selected}</strong><small>Illustrative graph of connected engineering documents.</small></div><span className="mono">[[linked ideas]]</span></div></>;
}
