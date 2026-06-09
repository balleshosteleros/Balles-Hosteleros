"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeTypes,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Info, X } from "lucide-react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  orgChartsPorEmpresa,
  getDeptPalette,
  normalizeArea,
  ZONE_COLORS,
  type OrgNode,
  type AreaZone,
} from "@/features/direccion/data/direccion";
import { getOrganigrama } from "@/features/direccion/actions/organigrama-actions";

function AreaZoneNode({ data }: NodeProps) {
  const palette = ZONE_COLORS[normalizeArea(data.area)];
  return (
    <div
      className="w-full h-full rounded-xl"
      style={{
        background: palette.bg,
        border: `1.5px dashed ${palette.border}`,
      }}
    >
      <span
        className="absolute top-3 left-4 text-[11px] font-semibold uppercase tracking-widest select-none"
        style={{ color: palette.label }}
      >
        {data.label as string}
      </span>
    </div>
  );
}

function OrgChartNode({ id, data, selected }: NodeProps) {
  const area = normalizeArea(data.area);
  const customColor = (data as { color?: string }).color;
  const palette = getDeptPalette(id, area, customColor);
  const hasDescripcion = typeof data.descripcion === "string" && (data.descripcion as string).trim().length > 0;
  return (
    <div
      className="relative rounded-xl px-5 py-3 text-center transition-all cursor-pointer"
      style={{
        background: palette.bg,
        color: "#ffffff",
        minWidth: 130,
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: "0.04em",
        boxShadow: selected
          ? `0 0 0 3px ${palette.ring}, 0 10px 20px ${palette.shadow}`
          : `0 6px 14px ${palette.shadow}, inset 0 1px 0 rgba(255,255,255,0.18)`,
        border: `1px solid ${palette.ring}`,
        textShadow: "0 1px 1px rgba(0,0,0,0.18)",
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-white/60 !w-2 !h-2 !border-white" />
      {data.label as string}
      {hasDescripcion && (
        <Info
          className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-white p-0.5 shadow"
          style={{ color: palette.bg }}
          aria-label="Tiene descripción"
        />
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-white/60 !w-2 !h-2 !border-white" />
    </div>
  );
}

const nodeTypes: NodeTypes = { orgNode: OrgChartNode, areaZone: AreaZoneNode };

function dataToFlow(chart: {
  nodes: OrgNode[];
  edges: { id: string; source: string; target: string }[];
  zones: AreaZone[];
}): { nodes: Node[]; edges: Edge[] } {
  const zoneNodes: Node[] = chart.zones.map((z) => ({
    id: z.id,
    type: "areaZone",
    position: { x: z.x, y: z.y },
    data: { label: z.label, area: normalizeArea(z.area) },
    style: { width: z.width, height: z.height },
    draggable: false,
    selectable: false,
    zIndex: -1,
  }));

  const orgNodes: Node[] = chart.nodes.map((n) => ({
    id: n.id,
    type: "orgNode",
    position: { x: n.x, y: n.y },
    data: {
      label: n.label,
      area: normalizeArea(n.area),
      descripcion: n.descripcion ?? "",
      color: n.color,
    },
    draggable: false,
    selectable: true,
  }));

  const edges: Edge[] = chart.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: "smoothstep",
    style: { stroke: "hsl(var(--border))", strokeWidth: 1.5 },
  }));

  return { nodes: [...zoneNodes, ...orgNodes], edges };
}

export function EquipoOrganigramaView() {
  const { empresaActual } = useEmpresa();
  const key = empresaActual?.id || "habana";

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.type === "areaZone") return;
    setSelectedNode(node);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getOrganigrama(key)
      .then((remote) => {
        if (cancelled) return;
        const seed = orgChartsPorEmpresa[key] || orgChartsPorEmpresa.habana;
        const chart = remote && remote.nodes.length > 0 ? remote : seed;
        const flow = dataToFlow(chart);
        setNodes(flow.nodes);
        setEdges(flow.edges);
      })
      .catch(() => {
        const seed = orgChartsPorEmpresa[key] || orgChartsPorEmpresa.habana;
        const flow = dataToFlow(seed);
        setNodes(flow.nodes);
        setEdges(flow.edges);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-card shrink-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5" />
          Pulsa cualquier puesto para ver sus responsabilidades.
        </div>
        <div className="ml-auto hidden md:flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ background: ZONE_COLORS.administrativa.bg, border: `1px dashed ${ZONE_COLORS.administrativa.border}` }}
            />
            Área Administrativa
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ background: ZONE_COLORS.operativa.bg, border: `1px dashed ${ZONE_COLORS.operativa.border}` }}
            />
            Área Operativa
          </span>
        </div>
      </div>

      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={true}
          panOnDrag
          zoomOnScroll
          className="bg-background"
        >
          <Background gap={20} size={1} color="hsl(var(--border) / 0.3)" />
          <Controls
            showInteractive={false}
            className="!bg-card !border-border !shadow-sm [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-foreground"
          />
        </ReactFlow>

        {selectedNode && (() => {
          const area = normalizeArea(selectedNode.data.area);
          const customColor = (selectedNode.data as { color?: string }).color;
          const palette = getDeptPalette(selectedNode.id, area, customColor);
          const label = (selectedNode.data.label as string) ?? "";
          const descripcion = (selectedNode.data.descripcion as string) ?? "";
          const areaLabel =
            area === "administrativa" ? "Área Administrativa" : "Área Operativa";
          return (
            <div className="absolute top-4 right-4 w-80 bg-card border rounded-lg shadow-xl z-10 max-h-[calc(100%-2rem)] overflow-y-auto">
              <div
                className="px-4 py-3 text-white"
                style={{
                  background: palette.bg,
                  boxShadow: `0 6px 14px ${palette.shadow}`,
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-widest opacity-80">
                      {areaLabel}
                    </p>
                    <h3 className="text-base font-extrabold tracking-wide truncate">
                      {label}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedNode(null)}
                    className="rounded-full p-1 hover:bg-white/15 transition-colors shrink-0"
                    aria-label="Cerrar"
                  >
                    <X className="h-4 w-4 text-white" />
                  </button>
                </div>
              </div>
              <div className="p-4 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Responsabilidades
                </p>
                {descripcion.trim().length > 0 ? (
                  <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                    {descripcion}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    Aún no hay descripción para este puesto. Dirección puede añadirla desde el editor del organigrama.
                  </p>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
