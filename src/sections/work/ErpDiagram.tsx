import { useId, useRef, useState, type CSSProperties } from 'react';
import { useInView } from '../../lib/useInView';
import './erp-diagram.css';

/**
 * Fig. 04 — SGGS ERP at the level of its public description: a Django ERP,
 * integrated with a student portal through APIs, configured by its
 * environment and shipped through a deployment workflow. Generic by design:
 * no hostnames, no environment variable names, no schema, no student data.
 */
type NodeId = 'portal' | 'api' | 'erp' | 'db' | 'env' | 'source' | 'deploy' | 'server';

interface DiagramNode {
  id: NodeId;
  title: string;
  kicker: string;
  body: string;
}

const NODES: DiagramNode[] = [
  {
    id: 'portal',
    title: 'Student portal',
    kicker: 'Runtime',
    body: 'The student-facing portal that the ERP is integrated with.',
  },
  {
    id: 'api',
    title: 'API integration',
    kicker: 'Runtime',
    body: 'The ERP and the student portal are connected through API integration.',
  },
  {
    id: 'erp',
    title: 'Django ERP',
    kicker: 'Runtime',
    body: 'The institutional ERP application, built on Django.',
  },
  {
    id: 'db',
    title: 'Database',
    kicker: 'Runtime',
    body: 'Where the ERP keeps its records. Schema and data are deliberately not shown here.',
  },
  {
    id: 'env',
    title: 'Environment config',
    kicker: 'Configuration',
    body: 'Configuration is environment-driven: settings and secrets are supplied by the environment at runtime instead of being written into the code.',
  },
  {
    id: 'source',
    title: 'Source code',
    kicker: 'Delivery',
    body: 'The application code a deployment starts from.',
  },
  {
    id: 'deploy',
    title: 'Deployment workflow',
    kicker: 'Delivery',
    body: 'A defined, repeatable path that takes the code to the server.',
  },
  {
    id: 'server',
    title: 'Running service',
    kicker: 'Delivery',
    body: 'The deployed ERP, configured by its environment.',
  },
];

interface Edge {
  id: string;
  from: NodeId;
  to: NodeId;
  kind: 'flow' | 'config' | 'hosts';
  /** Packets travel both ways along request/response edges. */
  both?: boolean;
}

const EDGES: Edge[] = [
  { id: 'portal-api', from: 'portal', to: 'api', kind: 'flow', both: true },
  { id: 'api-erp', from: 'api', to: 'erp', kind: 'flow', both: true },
  { id: 'erp-db', from: 'erp', to: 'db', kind: 'flow', both: true },
  { id: 'env-erp', from: 'env', to: 'erp', kind: 'config' },
  { id: 'source-deploy', from: 'source', to: 'deploy', kind: 'flow' },
  { id: 'deploy-server', from: 'deploy', to: 'server', kind: 'flow' },
  { id: 'server-erp', from: 'server', to: 'erp', kind: 'hosts' },
];

interface Box {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

interface LayoutSpec {
  width: number;
  height: number;
  nodes: Record<NodeId, Box>;
  edges: Record<string, string>;
  labels: { x: number; y: number; text: string }[];
}

const WIDE: LayoutSpec = {
  width: 1000,
  height: 560,
  nodes: {
    portal: { cx: 150, cy: 110, w: 200, h: 64 },
    api: { cx: 430, cy: 110, w: 200, h: 64 },
    erp: { cx: 730, cy: 110, w: 220, h: 64 },
    db: { cx: 730, cy: 290, w: 220, h: 64 },
    env: { cx: 430, cy: 290, w: 200, h: 64 },
    source: { cx: 150, cy: 460, w: 200, h: 64 },
    deploy: { cx: 430, cy: 460, w: 200, h: 64 },
    server: { cx: 730, cy: 460, w: 220, h: 64 },
  },
  edges: {
    'portal-api': 'M250 110H330',
    'api-erp': 'M530 110H620',
    'erp-db': 'M730 142V258',
    'env-erp': 'M430 258V200H660V142',
    'source-deploy': 'M250 460H330',
    'deploy-server': 'M530 460H620',
    'server-erp': 'M840 460H920V110H840',
  },
  labels: [
    { x: 50, y: 40, text: 'RUNTIME' },
    { x: 50, y: 390, text: 'DELIVERY' },
    { x: 446, y: 190, text: 'INJECTED AT RUNTIME' },
    { x: 932, y: 290, text: 'HOSTS' },
  ],
};

const NARROW: LayoutSpec = {
  width: 360,
  height: 640,
  nodes: {
    portal: { cx: 180, cy: 52, w: 220, h: 50 },
    api: { cx: 180, cy: 142, w: 220, h: 50 },
    erp: { cx: 180, cy: 232, w: 220, h: 50 },
    db: { cx: 98, cy: 336, w: 150, h: 50 },
    env: { cx: 262, cy: 336, w: 150, h: 50 },
    source: { cx: 98, cy: 456, w: 150, h: 50 },
    deploy: { cx: 262, cy: 456, w: 150, h: 50 },
    server: { cx: 180, cy: 576, w: 220, h: 50 },
  },
  edges: {
    'portal-api': 'M180 77V117',
    'api-erp': 'M180 167V207',
    'erp-db': 'M120 257V284H98V311',
    'env-erp': 'M262 311V284H240V257',
    'source-deploy': 'M173 456H187',
    'deploy-server': 'M262 481V516H230V551',
    'server-erp': 'M70 576H22V232H70',
  },
  labels: [
    { x: 30, y: 404, text: 'DELIVERY' },
  ],
};

function connected(node: NodeId): Set<string> {
  return new Set(EDGES.filter((e) => e.from === node || e.to === node).map((e) => e.id));
}

function Diagram({ spec, selected, onSelect, idPrefix }: {
  spec: LayoutSpec;
  selected: NodeId;
  onSelect: (id: NodeId) => void;
  idPrefix: string;
}) {
  const active = connected(selected);
  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  const place = (box: Box): CSSProperties => ({
    left: pct(box.cx - box.w / 2, spec.width),
    top: pct(box.cy - box.h / 2, spec.height),
    width: pct(box.w, spec.width),
    height: pct(box.h, spec.height),
  });
  return (
    <div className="erp__canvas" style={{ aspectRatio: `${spec.width} / ${spec.height}` }}>
      <svg className="erp__wires" viewBox={`0 0 ${spec.width} ${spec.height}`} aria-hidden="true" focusable="false">
        <defs>
          <marker id={`${idPrefix}-arrow`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10z" className="erp__arrowhead" />
          </marker>
        </defs>
        {spec.labels.map((label) => (
          <text key={label.text} x={label.x} y={label.y} className="erp__label">
            {label.text}
          </text>
        ))}
        {EDGES.map((edge) => {
          const d = spec.edges[edge.id]!;
          const isActive = active.has(edge.id);
          return (
            <g key={edge.id} className={`erp__edge erp__edge--${edge.kind}${isActive ? ' is-active' : ''}`}>
              <path d={d} className="erp__wire" markerEnd={`url(#${idPrefix}-arrow)`} markerStart={edge.both ? `url(#${idPrefix}-arrow)` : undefined} />
              <path d={d} pathLength={100} className="erp__packet" />
              {edge.both && <path d={d} pathLength={100} className="erp__packet erp__packet--back" />}
            </g>
          );
        })}
      </svg>
      {/* One glass lens glides between components as the selection changes. */}
      <div className="erp__lens glass glass--prominent" aria-hidden="true" style={place(spec.nodes[selected])} />
      {NODES.map((node) => (
        <button
          key={node.id}
          type="button"
          className={`erp__node erp__node--${node.kicker.toLowerCase()}`}
          aria-pressed={selected === node.id}
          onClick={() => onSelect(node.id)}
          onFocus={() => onSelect(node.id)}
          style={place(spec.nodes[node.id])}
        >
          {node.kicker === 'Configuration' && <span className="erp__node-kicker">{node.kicker}</span>}
          <span className="erp__node-title">{node.title}</span>
        </button>
      ))}
    </div>
  );
}

export function ErpDiagram() {
  const [selected, setSelected] = useState<NodeId>('erp');
  const idPrefix = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const node = NODES.find((n) => n.id === selected)!;
  const rootRef = useRef<HTMLDivElement>(null);
  const onScreen = useInView(rootRef);

  return (
    <div ref={rootRef} className="erp" data-active={onScreen ? '' : undefined}>
      <div className="erp__stage erp__stage--wide">
        <Diagram spec={WIDE} selected={selected} onSelect={setSelected} idPrefix={`${idPrefix}w`} />
      </div>
      <div className="erp__stage erp__stage--narrow">
        <Diagram spec={NARROW} selected={selected} onSelect={setSelected} idPrefix={`${idPrefix}n`} />
      </div>
      <div className="erp__info" aria-live="polite">
        <p className="label erp__info-kicker">
          {node.kicker} · selected component
        </p>
        <p className="erp__info-title">{node.title}</p>
        <p className="erp__info-body">{node.body}</p>
      </div>
    </div>
  );
}
