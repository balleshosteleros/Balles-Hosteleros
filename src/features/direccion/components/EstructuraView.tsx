"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  ConnectionMode,
  useNodesState,
  useEdgesState,
  useReactFlow,
  addEdge,
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  type EdgeTypes,
  type EdgeProps,
  Handle,
  Position,
  type NodeProps,
  NodeResizer,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toast } from "sonner";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  orgChartsPorEmpresa,
  defaultOrgChart,
  getDeptPalette,
  normalizeArea,
  DEPT_COLOR_SWATCHES,
  ZONE_COLORS,
  type OrgChart,
  type OrgNode,
  type OrgEdge,
  type AreaType,
  type AreaZone,
} from "@/features/direccion/data/direccion";
import {
  getOrganigrama,
  saveOrganigrama,
} from "@/features/direccion/actions/organigrama-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2, Save, X, Loader2, Info } from "lucide-react";

const AREA_LABELS: Record<string, string> = {
  administrativa: "Área Administrativa",
  operativa: "Área Operativa",
};

const FIXED_ZONE_IDS = new Set(["zone-admin", "zone-oper"]);

const FIXED_ZONE_DEFAULTS: Record<string, AreaZone> = {
  "zone-admin": {
    id: "zone-admin",
    label: "Área Administrativa",
    area: "administrativa",
    x: -10,
    y: -90,
    width: 1250,
    height: 370,
  },
  "zone-oper": {
    id: "zone-oper",
    label: "Área Operativa",
    area: "operativa",
    x: 30,
    y: 340,
    width: 1280,
    height: 370,
  },
};

/* ── Zone node (resizable, draggable) ── */
function AreaZoneNode({ data, selected }: NodeProps) {
  const palette = ZONE_COLORS[normalizeArea(data.area)];
  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={200}
        minHeight={120}
        lineClassName="!border-primary/30"
        handleClassName="!w-2.5 !h-2.5 !bg-primary/50 !border-primary"
      />
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
    </>
  );
}

/* ── Org block node (vívido, redimensionable, conectable por 4 lados) ── */
function OrgChartNode({ id, data, selected }: NodeProps) {
  const area = normalizeArea(data.area);
  const customColor = (data as { color?: string }).color;
  const palette = getDeptPalette(id, area, customColor);
  const hasDescripcion = typeof data.descripcion === "string" && (data.descripcion as string).trim().length > 0;
  const handleStyle: React.CSSProperties = {
    background: "#ffffff",
    border: `2px solid ${palette.ring}`,
    width: 12,
    height: 12,
    opacity: selected ? 1 : 0.85,
  };
  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={110}
        minHeight={44}
        lineClassName="!border-primary/40"
        handleClassName="!w-2 !h-2 !bg-primary/60 !border-primary"
      />
      <div
        className="relative rounded-xl px-5 py-3 text-center transition-all w-full h-full flex items-center justify-center"
        style={{
          background: palette.bg,
          color: "#ffffff",
          minWidth: 130,
          minHeight: 44,
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
        {/* Handles en los 4 lados — con ConnectionMode.Loose se pueden enlazar de cualquiera a cualquiera */}
        <Handle id="t" type="source" position={Position.Top} style={handleStyle} />
        <Handle id="b" type="source" position={Position.Bottom} style={handleStyle} />
        <Handle id="l" type="source" position={Position.Left} style={handleStyle} />
        <Handle id="r" type="source" position={Position.Right} style={handleStyle} />
        <span className="leading-tight">{data.label as string}</span>
        {hasDescripcion && (
          <Info
            className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-white p-0.5 shadow"
            style={{ color: palette.bg }}
            aria-label="Tiene descripción"
          />
        )}
      </div>
    </>
  );
}

const nodeTypes: NodeTypes = { orgNode: OrgChartNode, areaZone: AreaZoneNode };

/* ── Edge con botón de papelera al seleccionarlo ── */
function DeletableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  style,
  markerEnd,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  const { setEdges } = useReactFlow();
  const stroke = selected
    ? "hsl(var(--destructive))"
    : ((style?.stroke as string) ?? "hsl(var(--border))");
  const strokeWidth = selected ? 2.5 : ((style?.strokeWidth as number) ?? 1.5);
  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{ ...style, stroke, strokeWidth }}
        markerEnd={markerEnd}
      />
      {selected && (
        <EdgeLabelRenderer>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setEdges((eds) => eds.filter((ed) => ed.id !== id));
            }}
            className="nodrag nopan absolute flex items-center justify-center h-7 w-7 rounded-full bg-destructive text-destructive-foreground shadow-md hover:scale-110 transition-transform border-2 border-background"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "all",
            }}
            aria-label="Eliminar conexión"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const edgeTypes: EdgeTypes = { deletable: DeletableEdge };

/* ── Convert data to ReactFlow nodes/edges ── */
function dataToFlow(chart: {
  nodes: OrgNode[];
  edges: { id: string; source: string; target: string }[];
  zones: AreaZone[];
}): { nodes: Node[]; edges: Edge[] } {
  const zoneNodes: Node[] = chart.zones.map((z) => {
    const isFixed = FIXED_ZONE_IDS.has(z.id);
    return {
      id: z.id,
      type: "areaZone",
      position: { x: z.x, y: z.y },
      data: {
        label: z.label,
        area: normalizeArea(z.area),
        w: z.width,
        h: z.height,
        fixed: isFixed,
      },
      style: { width: z.width, height: z.height },
      draggable: true,
      selectable: true,
      deletable: !isFixed,
      zIndex: -1,
    };
  });

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
    ...(typeof n.width === "number" && typeof n.height === "number"
      ? { style: { width: n.width, height: n.height } }
      : {}),
    draggable: true,
  }));

  const edges: Edge[] = chart.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: "deletable",
    style: { stroke: "hsl(var(--border))", strokeWidth: 1.5 },
  }));

  return { nodes: [...zoneNodes, ...orgNodes], edges };
}

function flowToData(nodes: Node[], edges: Edge[]): OrgChart {
  const orgNodes: OrgNode[] = [];
  const zones: AreaZone[] = [];
  for (const n of nodes) {
    if (n.type === "areaZone") {
      const styleW = (n.style as { width?: number } | undefined)?.width;
      const styleH = (n.style as { height?: number } | undefined)?.height;
      const dataW = (n.data as { w?: number }).w;
      const dataH = (n.data as { h?: number }).h;
      zones.push({
        id: n.id,
        label: (n.data.label as string) ?? "",
        area: normalizeArea(n.data.area),
        x: n.position.x,
        y: n.position.y,
        width: typeof n.width === "number" ? n.width : (typeof styleW === "number" ? styleW : (dataW ?? 600)),
        height: typeof n.height === "number" ? n.height : (typeof styleH === "number" ? styleH : (dataH ?? 250)),
      });
    } else {
      const descripcion = (n.data as { descripcion?: string }).descripcion;
      const color = (n.data as { color?: string }).color;
      const styleW = (n.style as { width?: number } | undefined)?.width;
      const styleH = (n.style as { height?: number } | undefined)?.height;
      const w = typeof n.width === "number" ? n.width : (typeof styleW === "number" ? styleW : undefined);
      const h = typeof n.height === "number" ? n.height : (typeof styleH === "number" ? styleH : undefined);
      orgNodes.push({
        id: n.id,
        label: (n.data.label as string) ?? "",
        area: normalizeArea(n.data.area),
        x: n.position.x,
        y: n.position.y,
        ...(descripcion && descripcion.trim().length > 0 ? { descripcion } : {}),
        ...(color && color.trim().length > 0 ? { color } : {}),
        ...(typeof w === "number" ? { width: w } : {}),
        ...(typeof h === "number" ? { height: h } : {}),
      });
    }
  }
  const orgEdges: OrgEdge[] = edges.map((e) => ({ id: e.id, source: e.source, target: e.target }));
  return { nodes: orgNodes, edges: orgEdges, zones };
}

export function EstructuraView() {
  const { empresaActual } = useEmpresa();
  const key = empresaActual?.id || "habana";

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newArea, setNewArea] = useState<AreaType>("operativa");
  const [editLabel, setEditLabel] = useState("");
  const [editArea, setEditArea] = useState<AreaType>("operativa");
  const [editDescripcion, setEditDescripcion] = useState("");
  const [editColor, setEditColor] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const idCounter = useRef(100);
  const skipDirtyRef = useRef(true);

  // Cargar organigrama desde Supabase (con seed estático como fallback)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    skipDirtyRef.current = true;
    setSelectedNode(null);
    getOrganigrama(key)
      .then((remote) => {
        if (cancelled) return;
        const seed = orgChartsPorEmpresa[key] || defaultOrgChart;
        const baseChart = remote && remote.nodes.length > 0 ? remote : seed;
        const missingFixed = [...FIXED_ZONE_IDS].filter(
          (id) => !baseChart.zones.some((z) => z.id === id),
        );
        const chart =
          missingFixed.length > 0
            ? {
                ...baseChart,
                zones: [
                  ...baseChart.zones,
                  ...missingFixed.map((id) => FIXED_ZONE_DEFAULTS[id]),
                ],
              }
            : baseChart;
        const flow = dataToFlow(chart);
        setNodes(flow.nodes);
        setEdges(flow.edges);
        const restoredFromRemote =
          remote != null && remote.nodes.length > 0 && missingFixed.length > 0;
        setDirty(restoredFromRemote);
        if (restoredFromRemote) {
          toast.info("Zona fija restaurada. Pulsa Guardar para conservarla.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          // Permitir que los próximos cambios marquen dirty (tras el primer render)
          setTimeout(() => {
            skipDirtyRef.current = false;
          }, 0);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [key, setNodes, setEdges]);

  // Marcar dirty ante cualquier cambio del usuario (drag, edit, add, delete, connect…)
  useEffect(() => {
    if (skipDirtyRef.current) return;
    setDirty(true);
  }, [nodes, edges]);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge(
          { ...params, type: "deletable", style: { stroke: "hsl(var(--border))", strokeWidth: 1.5 } },
          eds
        )
      );
    },
    [setEdges]
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    const chart = flowToData(nodes, edges);
    const res = await saveOrganigrama(key, chart);
    setSaving(false);
    if (res.ok) {
      setDirty(false);
      toast.success("Organigrama guardado");
    } else {
      toast.error(`No se pudo guardar: ${res.error ?? "error desconocido"}`);
    }
  }, [nodes, edges, key]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setEditLabel(node.data.label as string);
    setEditArea(normalizeArea(node.data.area));
    setEditDescripcion(((node.data as { descripcion?: string }).descripcion) ?? "");
    setEditColor(((node.data as { color?: string }).color) ?? "");
  }, []);

  const handleAddNode = () => {
    if (!newLabel.trim()) return;
    const id = `node-${++idCounter.current}`;
    const newNode: Node = {
      id,
      type: "orgNode",
      position: {
        x: 400 + Math.random() * 200,
        y: newArea === "administrativa" ? 150 : 500,
      },
      data: { label: newLabel.toUpperCase(), area: newArea, descripcion: "" },
      draggable: true,
    };
    setNodes((nds) => [...nds, newNode]);
    setNewLabel("");
    setNewArea("operativa");
    setShowAdd(false);
  };

  const handleDeleteNode = () => {
    if (!selectedNode) return;
    if ((selectedNode.data as { fixed?: boolean }).fixed) {
      toast.error("Esta zona es fija y no puede eliminarse.");
      return;
    }
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
    setSelectedNode(null);
  };

  const handleUpdateNode = () => {
    if (!selectedNode) return;
    if (selectedNode.type === "areaZone") {
      // Only update label for zone nodes
      setNodes((nds) =>
        nds.map((n) =>
          n.id === selectedNode.id
            ? { ...n, data: { ...n.data, label: editLabel } }
            : n
        )
      );
    } else {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === selectedNode.id
            ? {
                ...n,
                data: {
                  ...n.data,
                  label: editLabel.toUpperCase(),
                  area: editArea,
                  descripcion: editDescripcion,
                  color: editColor || undefined,
                },
              }
            : n
        )
      );
    }
    setSelectedNode(null);
  };

  const isZoneSelected = selectedNode?.type === "areaZone";
  const isFixedSelected =
    (selectedNode?.data as { fixed?: boolean } | undefined)?.fixed === true;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-card shrink-0">
        <Button variant="primary" size="sm" onClick={() => setShowAdd(true)} disabled={loading}>
          <Plus className="h-4 w-4" />Nuevo
        </Button>
        {selectedNode && !isFixedSelected && (
          <>
            <Button size="sm" variant="destructive" onClick={handleDeleteNode}>
              <Trash2 className="h-4 w-4 mr-1" /> Eliminar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedNode(null)}>
              <X className="h-4 w-4 mr-1" /> Deseleccionar
            </Button>
          </>
        )}
        <div className="ml-auto flex items-center gap-4">
          <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground">
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
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!dirty || saving || loading}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            Guardar
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          connectionMode={ConnectionMode.Loose}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          snapToGrid
          snapGrid={[20, 20]}
          deleteKeyCode={["Delete", "Backspace"]}
          className="bg-background"
        >
          <Background gap={20} size={1} color="hsl(var(--border) / 0.3)" />
          <Controls
            showInteractive={false}
            className="!bg-card !border-border !shadow-sm [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-foreground"
          />
        </ReactFlow>

        {/* Side panel for editing (hidden for fixed zones — solo se permite mover/redimensionar) */}
        {selectedNode && !isFixedSelected && (() => {
          const palette = !isZoneSelected
            ? getDeptPalette(
                selectedNode.id,
                normalizeArea(selectedNode.data.area),
                editColor || undefined,
              )
            : null;
          return (
            <div className="absolute top-4 right-4 w-80 bg-card border rounded-lg shadow-xl p-4 z-10 space-y-4 max-h-[calc(100%-2rem)] overflow-y-auto">
              {palette && (
                <div
                  className="rounded-lg px-3 py-2 text-white text-xs font-bold uppercase tracking-widest text-center"
                  style={{
                    background: palette.bg,
                    boxShadow: `0 4px 10px ${palette.shadow}`,
                  }}
                >
                  {editLabel || (selectedNode.data.label as string)}
                </div>
              )}
              <h3 className="text-sm font-semibold text-foreground">
                {isZoneSelected ? "Editar zona de área" : "Editar departamento"}
              </h3>
              <div className="space-y-2">
                <Label className="text-xs">Nombre</Label>
                <Input
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              {!isZoneSelected && (
                <>
                  <div className="space-y-2">
                    <Label className="text-xs">Área</Label>
                    <Select value={editArea} onValueChange={(v) => setEditArea(v as AreaType)}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(AREA_LABELS).map(([val, label]) => (
                          <SelectItem key={val} value={val}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">
                      Descripción / Responsabilidades
                    </Label>
                    <Textarea
                      value={editDescripcion}
                      onChange={(e) => setEditDescripcion(e.target.value)}
                      placeholder="Qué hace este departamento, de qué se ocupa, a quién reporta… para que cualquier empleado lo entienda."
                      className="text-sm min-h-[140px] resize-none"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Visible para todos los empleados al pulsar el bloque.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Color</Label>
                      {editColor && (
                        <button
                          type="button"
                          onClick={() => setEditColor("")}
                          className="text-[11px] text-muted-foreground hover:text-foreground underline"
                        >
                          Restablecer
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-8 gap-1.5">
                      {DEPT_COLOR_SWATCHES.map((c) => {
                        const active = editColor.toLowerCase() === c.toLowerCase();
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setEditColor(c)}
                            className={`h-6 w-6 rounded-md border transition-transform hover:scale-110 ${
                              active
                                ? "ring-2 ring-offset-1 ring-foreground"
                                : "border-border"
                            }`}
                            style={{ background: c }}
                            aria-label={`Color ${c}`}
                          />
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="color"
                        value={editColor || "#3b82f6"}
                        onChange={(e) => setEditColor(e.target.value)}
                        className="h-8 w-10 rounded border border-border bg-transparent cursor-pointer"
                        aria-label="Selector de color personalizado"
                      />
                      <Input
                        value={editColor}
                        onChange={(e) => setEditColor(e.target.value)}
                        placeholder="#3b82f6"
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  </div>
                </>
              )}
              {isZoneSelected && (
                <p className="text-xs text-muted-foreground">
                  Arrastra los bordes para redimensionar la zona.
                </p>
              )}
              <div className="flex gap-2">
                <Button size="sm" onClick={handleUpdateNode} className="flex-1">
                  <Save className="h-3 w-3 mr-1" /> Aplicar
                </Button>
                {!isFixedSelected && (
                  <Button size="sm" variant="destructive" onClick={handleDeleteNode}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground text-center pt-1 border-t">
                Pulsa <span className="font-semibold">Guardar</span> arriba para persistir.
              </p>
            </div>
          );
        })()}
      </div>

      {/* Add dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Añadir nuevo bloque</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Ej: RECEPCIÓN"
              />
            </div>
            <div className="space-y-2">
              <Label>Área</Label>
              <Select value={newArea} onValueChange={(v) => setNewArea(v as AreaType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(AREA_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddNode}>Añadir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
