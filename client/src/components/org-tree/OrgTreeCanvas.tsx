import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { ROLE_VISUALS } from "@/lib/merchantRoles";
import type { MerchantRole } from "@shared/merchantHierarchy";
import { OrgRoleLane } from "./OrgRoleLane";
import type { OrgNodeCardData } from "./OrgNodeCard";

export type OrgNode = OrgNodeCardData & { parentId: number | null };

// Fixed top-to-bottom row order, independent of actual tree depth - a
// manager that directly parents a sales_rep (checkParentAssignment allows
// skipping levels) still renders the sales_rep in the sales_rep row, with a
// connector line spanning the gap, rather than nesting it one row below the
// manager.
const LANE_ORDER: MerchantRole[] = ["manager", "leader", "supervisor", "sales_rep"];

interface PathDatum {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  fromHex: string;
  toHex: string;
}

interface Edge {
  parentId: number;
  childId: number;
  fromRole: MerchantRole;
  toRole: MerchantRole;
}

export function OrgTreeCanvas({ nodes }: { nodes: OrgNode[] }) {
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [paths, setPaths] = useState<PathDatum[]>([]);
  // svg has no intrinsic content, so as a CSS replaced element its "auto"
  // width/height falls back to the UA default (300x150) instead of
  // stretching to fill `inset-0` the way a plain div would - track
  // contentRef's real size explicitly and size the svg to match.
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  const contentRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const toggle = (id: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const { roots, childrenByParent, effectiveParentId } = useMemo(() => {
    const idSet = new Set(nodes.map((n) => n.id));
    const byParent = new Map<number, OrgNode[]>();
    const getParent = (n: OrgNode) => (n.parentId != null && idSet.has(n.parentId) ? n.parentId : null);
    for (const n of nodes) {
      const parentId = getParent(n);
      if (parentId == null) continue;
      const siblings = byParent.get(parentId) ?? [];
      siblings.push(n);
      byParent.set(parentId, siblings);
    }
    const rootNodes = nodes.filter((n) => getParent(n) == null);
    return { roots: rootNodes, childrenByParent: byParent, effectiveParentId: getParent };
  }, [nodes]);

  // DFS order so children cluster near their parent once bucketed into rows
  // by role below - a pure role-group filter without this ordering pass
  // would scatter siblings arbitrarily across their row.
  const visibleNodes = useMemo(() => {
    const visible: OrgNode[] = [];
    const visit = (node: OrgNode) => {
      visible.push(node);
      if (collapsed.has(node.id)) return;
      for (const child of childrenByParent.get(node.id) ?? []) visit(child);
    };
    for (const root of roots) visit(root);
    return visible;
  }, [roots, childrenByParent, collapsed]);

  const lanes = useMemo(() => {
    return LANE_ORDER
      .map((role) => ({ role, nodes: visibleNodes.filter((n) => n.role === role) }))
      .filter((lane) => lane.nodes.length > 0);
  }, [visibleNodes]);

  // Every visible non-root node's parent is, by construction of visit()
  // above, also visible (DFS only descends into a node's children when that
  // node itself isn't collapsed) - no extra visibility filter needed here.
  const edges = useMemo<Edge[]>(() => {
    const result: Edge[] = [];
    for (const node of visibleNodes) {
      const parentId = effectiveParentId(node);
      if (parentId == null) continue;
      const parent = nodes.find((n) => n.id === parentId);
      if (!parent) continue;
      result.push({ parentId, childId: node.id, fromRole: parent.role, toRole: node.role });
    }
    return result;
  }, [visibleNodes, effectiveParentId, nodes]);

  const descendantCountOf = useMemo(() => {
    const cache = new Map<number, number>();
    const count = (id: number): number => {
      if (cache.has(id)) return cache.get(id)!;
      const children = childrenByParent.get(id) ?? [];
      const total = children.reduce((acc, child) => acc + 1 + count(child.id), 0);
      cache.set(id, total);
      return total;
    };
    return count;
  }, [childrenByParent]);

  useLayoutEffect(() => {
    const containerEl = contentRef.current;
    if (!containerEl) return;

    const recompute = () => {
      const containerRect = containerEl.getBoundingClientRect();
      setCanvasSize({ width: containerRect.width, height: containerRect.height });
      const next: PathDatum[] = [];
      for (const edge of edges) {
        const parentEl = nodeRefs.current.get(edge.parentId);
        const childEl = nodeRefs.current.get(edge.childId);
        if (!parentEl || !childEl) continue;
        const pRect = parentEl.getBoundingClientRect();
        const cRect = childEl.getBoundingClientRect();
        next.push({
          id: `${edge.parentId}-${edge.childId}`,
          x1: pRect.left + pRect.width / 2 - containerRect.left,
          y1: pRect.bottom - containerRect.top,
          x2: cRect.left + cRect.width / 2 - containerRect.left,
          y2: cRect.top - containerRect.top,
          fromHex: ROLE_VISUALS[edge.fromRole].hex,
          toHex: ROLE_VISUALS[edge.toRole].hex,
        });
      }
      setPaths(next);
    };

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(containerEl);
    window.addEventListener("resize", recompute);
    // Cairo (loaded via Google Fonts) can swap in after first paint and
    // reflow card widths - one more pass once it's actually ready avoids
    // lines drawn against pre-font-swap positions.
    if (document.fonts?.ready) {
      document.fonts.ready.then(recompute).catch(() => {});
    }

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recompute);
    };
  }, [edges]);

  return (
    <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card/30 backdrop-blur-sm p-8">
      <div ref={contentRef} className="relative w-fit min-w-full flex flex-col gap-16">
        <svg
          className="absolute inset-0 pointer-events-none overflow-visible"
          width={canvasSize.width}
          height={canvasSize.height}
        >
          <defs>
            {paths.map((p) => (
              <linearGradient key={p.id} id={`org-edge-${p.id}`} gradientUnits="userSpaceOnUse" x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2}>
                <stop offset="0%" stopColor={p.fromHex} stopOpacity={0.7} />
                <stop offset="100%" stopColor={p.toHex} stopOpacity={0.7} />
              </linearGradient>
            ))}
          </defs>
          {paths.map((p) => {
            const dy = Math.max(40, Math.abs(p.y2 - p.y1) / 2);
            const d = `M ${p.x1} ${p.y1} C ${p.x1} ${p.y1 + dy}, ${p.x2} ${p.y2 - dy}, ${p.x2} ${p.y2}`;
            return (
              <path
                key={p.id}
                d={d}
                fill="none"
                stroke={`url(#org-edge-${p.id})`}
                strokeWidth={2}
                strokeLinecap="round"
                style={{ filter: "drop-shadow(0 0 3px rgba(167,139,250,0.35))" }}
              />
            );
          })}
        </svg>

        {lanes.map((lane) => (
          <OrgRoleLane
            key={lane.role}
            role={lane.role}
            nodes={lane.nodes}
            registerNodeRef={(id) => (el) => {
              if (el) nodeRefs.current.set(id, el);
              else nodeRefs.current.delete(id);
            }}
            childrenCountOf={(id) => (childrenByParent.get(id) ?? []).length}
            descendantCountOf={descendantCountOf}
            collapsed={collapsed}
            onToggle={toggle}
          />
        ))}
      </div>
    </div>
  );
}
