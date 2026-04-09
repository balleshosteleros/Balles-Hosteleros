import { useState, useCallback, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  Handle,
  Position,
  type NodeProps,
  NodeResizer,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { orgChartsPorEmpresa, type OrgNode, type AreaType, type AreaZone } from "@/data/direccion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Trash2, Save, X } from "lucide-react";

const AREA_LABELS: Record<string, string> = {
  administrativa: "Área Administrativa",
  operativa: "Área Operativa",
  externo: "Externo (Socios)",
};

/* ── Zone node (resizable, draggable) ── */
function AreaZoneNode({ data, selected }: NodeProps) {
  const isAdmin = data.area === "administrativa";
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
          background: isAdmin
            ? "hsla(var(--primary) / 0.03)"
            : "hsla(var(--muted) / 0.4)",
          border: `1.5px dashed ${isAdmin ? "hsla(var(--primary) / 0.2)" : "hsl(var(--border))"}`,
        }}
      >
        <span
          className="absolute top-3 left-4 text-[11px] font-semibold uppercase tracking-widest select-none"
          style={{
            color: isAdmin
              ? "hsl(var(--primary))"
              : "hsl(var(--muted-foreground))",
          }}
        >
          {data.label as string}
        </span>
      </div>
    </>
  );
}

/* ── Org block node ── */
function OrgChartNode({ data, selected }: NodeProps) {
  const area = data.area as AreaType;
  const isExterno = area === "externo";
  const isAdmin = area === "administrativa";
  return (
    <div
      className="rounded-lg px-5 py-3 text-center shadow-sm transition-shadow"
      style={{
        background: isExterno
          ? "hsl(var(--accent))"
          : isAdmin
            ? "hsl(var(--card))"
            : "hsl(var(--muted))",
        border: `2px solid ${selected ? "hsl(var(--primary))" : "hsl(var(--border))"}`,
        color: isExterno
          ? "hsl(var(--accent-foreground))"
          : isAdmin
            ? "hsl(var(--card-foreground))"
            : "hsl(var(--muted-foreground))",
        minWidth: 120,
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: "0.03em",
        boxShadow: selected ? "0 0 0 2px hsla(var(--primary) / 0.25)" : undefined,
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-border !w-2 !h-2" />
      {data.label as string}
      <Handle type="source" position={Position.Bottom} className="!bg-border !w-2 !h-2" />
    </div>
  );
}

const nodeTypes: NodeTypes = { orgNode: OrgChartNode, areaZone: AreaZoneNode };

/* ── Convert data to ReactFlow nodes/edges ── */
function dataToFlow(chart: {
  nodes: OrgNode[];
  edges: { id: string; source: string; target: string }[];
  zones: AreaZone[];
}): { nodes: Node[]; edges: Edge[] } {
  const zoneNodes: Node[] = chart.zones.map((z) => ({
    id: z.id,
    type: "areaZone",
    position: { x: z.x, y: z.y },
    data: { label: z.label, area: z.area },
    style: { width: z.width, height: z.height },
    draggable: true,
    selectable: true,
    zIndex: -1,
  }));

  const orgNodes: Node[] = chart.nodes.map((n) => ({
    id: n.id,
    type: "orgNode",
    position: { x: n.x, y: n.y },
    data: { label: n.label, area: n.area },
    draggable: true,
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

export default function DireccionEstructura() {
  const { empresaActual } = useEmpresa();
  const key = empresaActual?.id || "habana";
  const chartData = orgChartsPorEmpresa[key] || orgChartsPorEmpresa.habana;
  const initial = dataToFlow(chartData);

  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newArea, setNewArea] = useState<AreaType>("operativa");
  const [editLabel, setEditLabel] = useState("");
  const [editArea, setEditArea] = useState<AreaType>("operativa");
  const idCounter = useRef(100);

  // Reset when empresa changes
  const lastKey = useRef(key);
  if (key !== lastKey.current) {
    lastKey.current = key;
    const fresh = dataToFlow(orgChartsPorEmpresa[key] || orgChartsPorEmpresa.habana);
    setNodes(fresh.nodes);
    setEdges(fresh.edges);
    setSelectedNode(null);
  }

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge(
          { ...params, type: "smoothstep", style: { stroke: "hsl(var(--border))", strokeWidth: 1.5 } },
          eds
        )
      );
    },
    [setEdges]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setEditLabel(node.data.label as string);
    setEditArea((node.data.area as AreaType) || "operativa");
  }, []);

  const handleAddNode = () => {
    if (!newLabel.trim()) return;
    const id = `node-${++idCounter.current}`;
    const newNode: Node = {
      id,
      type: "orgNode",
      position: {
        x: 400 + Math.random() * 200,
        y: newArea === "externo" ? -60 : newArea === "administrativa" ? 150 : 500,
      },
      data: { label: newLabel.toUpperCase(), area: newArea },
      draggable: true,
    };
    setNodes((nds) => [...nds, newNode]);
    setNewLabel("");
    setNewArea("operativa");
    setShowAdd(false);
  };

  const handleDeleteNode = () => {
    if (!selectedNode) return;
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
            ? { ...n, data: { ...n.data, label: editLabel.toUpperCase(), area: editArea } }
            : n
        )
      );
    }
    setSelectedNode(null);
  };

  const isZoneSelected = selectedNode?.type === "areaZone";

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-card shrink-0">
        <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-1" /> Añadir bloque
        </Button>
        {selectedNode && (
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
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "hsl(var(--accent))", border: "1px solid hsl(var(--border))" }} />
              Externo (Socios)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "hsla(var(--primary) / 0.12)", border: "1px dashed hsla(var(--primary) / 0.4)" }} />
              Área Administrativa
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "hsl(var(--muted))", border: "1px dashed hsl(var(--border))" }} />
              Área Operativa
            </span>
          </div>
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
          fitView
          fitViewOptions={{ padding: 0.15 }}
          snapToGrid
          snapGrid={[20, 20]}
          deleteKeyCode="Delete"
          className="bg-background"
        >
          <Background gap={20} size={1} color="hsl(var(--border) / 0.3)" />
          <Controls
            showInteractive={false}
            className="!bg-card !border-border !shadow-sm [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-foreground"
          />
          <MiniMap
            nodeColor={(n) => {
              if (n.type === "areaZone") return "transparent";
              if (n.data?.area === "externo") return "hsl(var(--accent))";
              return n.data?.area === "administrativa"
                ? "hsl(var(--primary) / 0.2)"
                : "hsl(var(--muted))";
            }}
            maskColor="hsl(var(--muted) / 0.5)"
            className="!bg-card !border-border"
          />
        </ReactFlow>

        {/* Side panel for editing */}
        {selectedNode && (
          <div className="absolute top-4 right-4 w-72 bg-card border rounded-lg shadow-lg p-4 z-10 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">
              {isZoneSelected ? "Editar zona de área" : "Editar bloque"}
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
            )}
            {isZoneSelected && (
              <p className="text-xs text-muted-foreground">
                Arrastra los bordes para redimensionar la zona.
              </p>
            )}
            <div className="flex gap-2">
              <Button size="sm" onClick={handleUpdateNode} className="flex-1">
                <Save className="h-3 w-3 mr-1" /> Guardar
              </Button>
              <Button size="sm" variant="destructive" onClick={handleDeleteNode}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
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
