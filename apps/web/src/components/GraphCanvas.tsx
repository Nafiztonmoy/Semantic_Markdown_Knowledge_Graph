"use client";

import { useEffect, useRef } from 'react';
import cytoscape, { type Core } from 'cytoscape';
import { ZoomIn, ZoomOut, Maximize2, RotateCcw } from 'lucide-react';
interface Props {
  nodes: any[];
  edges: any[];
  onSelectNode: (node: any) => void;
  onSelectEdge: (edge: any) => void;
  compact?: boolean;
}
export function GraphCanvas({
  nodes,
  edges,
  onSelectNode,
  onSelectEdge,
  compact = false
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const graph = useRef<Core | null>(null);
  const handlers = useRef({
    onSelectNode,
    onSelectEdge
  });
  handlers.current = {
    onSelectNode,
    onSelectEdge
  };
  useEffect(() => {
    if (!container.current) return;
    const tokens = getComputedStyle(document.documentElement);
    const primary = tokens.getPropertyValue('--primary').trim();
    const text = tokens.getPropertyValue('--foreground').trim();
    const cy = cytoscape({
      container: container.current,
      elements: [...nodes.map(n => ({
        data: {
          ...n
        }
      })), ...edges.filter(e => nodes.some(n => n.id === e.source) && nodes.some(n => n.id === e.target)).map(e => ({
        data: {
          ...e
        }
      }))],
      minZoom: .15,
      maxZoom: 3,
      wheelSensitivity: .25,
      style: [{
        selector: 'node',
        style: {
          label: 'data(label)',
          'font-family': 'Nimbus Sans, Arial',
          'font-size': compact ? 11 : 12,
          color: text,
          'background-color': primary,
          'border-color': '#b8d7c2',
          'border-width': 4,
          width: compact ? 19 : 26,
          height: compact ? 19 : 26,
          'text-valign': 'bottom',
          'text-margin-y': 8,
          'text-background-color': '#fbfcfa',
          'text-background-opacity': .9,
          'text-background-padding': '3px',
          'text-wrap': 'wrap',
          'text-max-width': '115px'
        }
      }, {
        selector: 'node[type="tag"]',
        style: {
          shape: 'diamond',
          'background-color': '#8fa68c',
          'border-color': '#d4e1ce',
          width: 15,
          height: 15
        }
      }, {
        selector: 'node[type="unresolved"]',
        style: {
          'background-color': '#bd735c',
          'border-color': '#ecd8d0',
          'border-style': 'dashed'
        }
      }, {
        selector: 'node:selected',
        style: {
          'border-color': '#20352f',
          'border-width': 5
        }
      }, {
        selector: 'edge',
        style: {
          width: 1.3,
          'line-color': '#a8c5b2',
          'curve-style': 'bezier',
          opacity: .65
        }
      }, {
        selector: 'edge[type="wiki_link"]',
        style: {
          'line-color': '#659f7e',
          'target-arrow-color': '#659f7e',
          'target-arrow-shape': 'triangle',
          'arrow-scale': .65
        }
      }, {
        selector: 'edge[type="shared_tag"]',
        style: {
          'line-style': 'dashed',
          'line-color': '#91a594'
        }
      }, {
        selector: 'edge[type="semantic_similarity"]',
        style: {
          'line-style': 'dotted',
          'line-color': '#a98b50',
          width: 2
        }
      }, {
        selector: 'edge:selected',
        style: {
          width: 3,
          'line-color': primary
        }
      }],
      layout: ({
        name: 'cose',
        animate: false,
        randomize: false,
        padding: compact ? 32 : 50,
        nodeRepulsion: () => 6000,
        idealEdgeLength: () => 90,
        nodeOverlap: 12,
        gravity: .2,
        numIter: 400
      } as any)
    });
    graph.current = cy;
    cy.on('tap', 'node', e => handlers.current.onSelectNode(e.target.data()));
    cy.on('tap', 'edge', e => handlers.current.onSelectEdge(e.target.data()));
    cy.on('tap', e => {
      if (e.target === cy) {
        handlers.current.onSelectNode(null);
        handlers.current.onSelectEdge(null);
      }
    });
    const observer = new ResizeObserver(() => {
      cy.resize();
      cy.fit(undefined, compact ? 35 : 50);
    });
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      cy.destroy();
      graph.current = null;
    };
  }, [nodes, edges, compact]);
  return <div className="graph-canvas"><div ref={container} className="graph-container" role="img" aria-label={`Knowledge graph containing ${nodes.length} nodes and ${edges.length} connections.${compact ? "" : " Use the node and connection lists for keyboard selection."}`} />{!compact && <div className="canvas-controls"><button className="icon-button" title="Zoom in" aria-label="Zoom in" onClick={() => {
        const cy = graph.current;
        if (cy) cy.zoom({
          level: cy.zoom() * 1.3,
          renderedPosition: {
            x: cy.width() / 2,
            y: cy.height() / 2
          }
        });
      }}><ZoomIn size={17} /></button><button className="icon-button" title="Zoom out" aria-label="Zoom out" onClick={() => {
        const cy = graph.current;
        if (cy) cy.zoom({
          level: cy.zoom() / 1.3,
          renderedPosition: {
            x: cy.width() / 2,
            y: cy.height() / 2
          }
        });
      }}><ZoomOut size={17} /></button><button className="icon-button" aria-label="Fit canvas" title="Fit canvas" onClick={() => graph.current?.fit(undefined, 50)}><Maximize2 size={16} /></button><button className="icon-button" aria-label="Center graph" title="Center graph" onClick={() => graph.current?.center()}><RotateCcw size={16} /></button></div>}</div>;
}
