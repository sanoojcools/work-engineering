import { InfoTooltip } from "../InfoTooltip";
import {
  HIRE_BANDS,
  HIRE_BAND_LABEL,
  HIRE_LEAVES,
  journeyNodeFill,
  journeyNodeLocked,
  type HireBand,
  type HireLeaf,
  type JourneyFill,
} from "../../lib/hireLeaves";

const STEPS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
const LANE_INDEX: Record<HireBand, number> = {
  automate: 0,
  augment: 1,
  human: 2,
  external: 3,
};

const PAD_LEFT = 132;
const PAD_RIGHT = 24;
const PAD_TOP = 36;
const PAD_BOTTOM = 28;
const COL_W = 220;
const ROW_H = 92;
const NODE_W = 100;
const NODE_H = 56;
const SIBLING_GAP = 12;

type Laid = {
  leaf: HireLeaf;
  x: number;
  y: number;
  w: number;
  fill: JourneyFill;
  locked: boolean;
};

function wrapName(name: string, max = 16): string[] {
  if (name.length <= max) return [name];
  const words = name.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (next.length > max && cur) {
      lines.push(cur);
      cur = word;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

/** x = yaml step. lane = band (not parent). Same step+band sit collinear. */
function layoutNodes(leaves: readonly HireLeaf[]): Laid[] {
  const groups = new Map<string, HireLeaf[]>();
  for (const leaf of leaves) {
    const key = `${leaf.step}:${leaf.band}`;
    const list = groups.get(key) ?? [];
    list.push(leaf);
    groups.set(key, list);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => a.id.localeCompare(b.id));
  }
  return leaves.map((leaf) => {
    const siblings = groups.get(`${leaf.step}:${leaf.band}`) ?? [leaf];
    const i = siblings.findIndex((s) => s.id === leaf.id);
    const n = siblings.length;
    const colCenter = PAD_LEFT + (leaf.step - 1) * COL_W + COL_W / 2;
    const w = n === 1 ? NODE_W : Math.min(NODE_W, (COL_W - 8 - (n - 1) * SIBLING_GAP) / n);
    const clusterW = n * w + (n - 1) * SIBLING_GAP;
    const x = colCenter - clusterW / 2 + i * (w + SIBLING_GAP);
    const y = PAD_TOP + LANE_INDEX[leaf.band] * ROW_H + (ROW_H - NODE_H) / 2;
    return {
      leaf,
      x,
      y,
      w,
      fill: journeyNodeFill(leaf),
      locked: journeyNodeLocked(leaf),
    };
  });
}

const FILL_LABEL: Record<JourneyFill, string> = {
  bind: "bind",
  not: "not",
  grey: "grey",
};

function LockMark({ x, y }: { x: number; y: number }) {
  return (
    <g data-testid="journey-lock" aria-label="lock" transform={`translate(${x}, ${y})`}>
      <rect x="2.5" y="7" width="11" height="8" rx="1.5" fill="var(--danger)" />
      <path
        d="M5 7 V5.2 a3 3 0 0 1 6 0 V7"
        fill="none"
        stroke="var(--danger)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </g>
  );
}

/** Hand-rolled SVG journey. No reactflow. Hours stay on Plan. */
export function JourneyCanvas() {
  const laid = layoutNodes(HIRE_LEAVES);
  const width = PAD_LEFT + STEPS.length * COL_W + PAD_RIGHT;
  const height = PAD_TOP + HIRE_BANDS.length * ROW_H + PAD_BOTTOM;

  return (
    <div className="card" style={{ marginBottom: 16 }} data-testid="journey-canvas">
      <h3 style={{ margin: "0 0 4px" }}>
        Journey{" "}
        <InfoTooltip
          term="Journey canvas"
          simple="Eighteen pieces on one picture. Across is the step. Down is the band — not the parent. Fill is bind, not, or grey. Dual employment is a lock. Hours stay on Plan."
          technical="x = packs/hr/hire_leaves.yaml step. lane = band (parent is collinear). Hand-rolled SVG. No reactflow. Fill is not a specification score; predicted stays grey."
        />
      </h3>
      <p className="hint" style={{ marginTop: 0, marginBottom: 10 }}>
        Eighteen pieces. Across is the step. Down is the band. Fill is bind, not, or grey. Dual employment is a
        lock. Hours stay on Plan, as two numbers — not on these pieces.
      </p>
      <div className="journey-legend" data-testid="journey-legend">
        {(["bind", "not", "grey"] as const).map((fill) => (
          <span key={fill} className="journey-legend-item">
            <span className={`journey-swatch journey-swatch-${fill}`} aria-hidden />
            {FILL_LABEL[fill]}
          </span>
        ))}
        <span className="journey-legend-item">
          <span className="journey-legend-lock" aria-hidden />
          lock
        </span>
      </div>
      <div className="journey-canvas-scroll">
        <svg
          className="journey-svg"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Journey: eighteen pieces by step and band"
        >
          {HIRE_BANDS.map((band, i) => {
            const y = PAD_TOP + i * ROW_H;
            return (
              <g key={band} data-testid={`journey-lane-${band}`}>
                <rect
                  x={0}
                  y={y}
                  width={width}
                  height={ROW_H}
                  className={i % 2 === 0 ? "journey-lane-even" : "journey-lane-odd"}
                />
                <text x={12} y={y + ROW_H / 2 + 4} className="journey-lane-label">
                  {HIRE_BAND_LABEL[band]}
                </text>
              </g>
            );
          })}
          {STEPS.map((step) => {
            const x = PAD_LEFT + (step - 1) * COL_W + COL_W / 2;
            return (
              <text key={step} x={x} y={22} textAnchor="middle" className="journey-step-label">
                {step}
              </text>
            );
          })}
          {laid.map((node) => {
            const lines = wrapName(node.leaf.name);
            const textStart = node.y + (node.locked ? 22 : 20);
            return (
              <g
                key={node.leaf.id}
                data-testid="journey-node"
                data-leaf-id={node.leaf.id}
                data-name={node.leaf.name}
                data-fill={node.fill}
                data-band={node.leaf.band}
                data-step={String(node.leaf.step)}
                data-parent={node.leaf.parent}
                data-lock={node.locked ? "true" : "false"}
              >
                <title>
                  {node.leaf.name}
                  {node.locked ? " — lock" : ""} · {node.fill}
                </title>
                <rect
                  x={node.x}
                  y={node.y}
                  width={node.w}
                  height={NODE_H}
                  rx={2}
                  className={`journey-node-fill journey-node-fill-${node.fill}`}
                />
                {node.locked && <LockMark x={node.x + node.w - 20} y={node.y + 4} />}
                <text x={node.x + node.w / 2} y={textStart} textAnchor="middle" className="journey-node-name">
                  {lines.map((line, i) => (
                    <tspan key={`${node.leaf.id}-${i}`} x={node.x + node.w / 2} dy={i === 0 ? 0 : 11}>
                      {line}
                    </tspan>
                  ))}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
