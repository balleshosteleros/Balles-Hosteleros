"use client";

import { useState, useCallback } from "react";
import { Plus, CalendarDays, Link2, FileText, Target, BarChart3 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { useMarketing } from "@/features/marketing/contexts/marketing-context";
import { ItemCalendario, Comentario, REDES_SOCIALES, ESTADOS_PUBLICACION } from "@/features/marketing/data/marketing";
import { CalendarioView } from "@/features/marketing/components/CalendarioView";
import { PublicacionModal } from "@/features/marketing/components/PublicacionModal";
import { DetallePanel } from "@/features/marketing/components/DetallePanel";
import { CuentasConectadas } from "@/features/marketing/components/CuentasConectadas";

const tabs = [
  { id: "calendario", label: "Calendario", icon: CalendarDays },
  { id: "cuentas", label: "Cuentas conectadas", icon: Link2 },
  { id: "contenidos", label: "Contenidos", icon: FileText },
  { id: "campanas", label: "Campañas", icon: Target },
  { id: "resultados", label: "Resultados", icon: BarChart3 },
];

export function CalendarioMarketingView({ embedded }: { embedded?: boolean } = {}) {
  const { empresaActual } = useEmpresa();
  const { getItems, setItems } = useMarketing();
  const items = getItems(empresaActual.id);

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<ItemCalendario | null>(null);
  const [detalleItem, setDetalleItem] = useState<ItemCalendario | null>(null);
  const [detalleOpen, setDetalleOpen] = useState(false);

  const handleSelect = (item: ItemCalendario) => { setDetalleItem(item); setDetalleOpen(true); };

  const handleSave = useCallback((item: ItemCalendario) => {
    setItems(empresaActual.id, (prev) => {
      const exists = prev.find((i) => i.id === item.id);
      if (exists) return prev.map((i) => i.id === item.id ? item : i);
      return [...prev, item];
    });
    setEditItem(null);
  }, [empresaActual.id, setItems]);

  const handleDelete = useCallback((id: string) => {
    setItems(empresaActual.id, (prev) => prev.filter((i) => i.id !== id));
  }, [empresaActual.id, setItems]);

  const handleEdit = (item: ItemCalendario) => {
    setDetalleOpen(false);
    setEditItem(item);
    setModalOpen(true);
  };

  const handleAddComment = useCallback((itemId: string, comment: Comentario) => {
    setItems(empresaActual.id, (prev) =>
      prev.map((i) => i.id === itemId ? { ...i, comentarios: [...i.comentarios, comment] } : i)
    );
    setDetalleItem((prev) => prev && prev.id === itemId ? { ...prev, comentarios: [...prev.comentarios, comment] } : prev);
  }, [empresaActual.id, setItems]);

  const pubCount = items.filter((i) => i.tipo === "publicacion").length;
  const evtCount = items.filter((i) => i.tipo === "evento").length;
  const progCount = items.filter((i) => i.estado === "programada").length;

  return (
    <div className={embedded ? "space-y-5" : "p-4 md:p-6 space-y-5"}>
      <div className="flex items-center justify-end">
        <Button className="gap-1.5" onClick={() => { setEditItem(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4" /> Nueva publicación
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-foreground">{items.length}</p><p className="text-xs text-muted-foreground">Total elementos</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-foreground">{pubCount}</p><p className="text-xs text-muted-foreground">Publicaciones</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-foreground">{evtCount}</p><p className="text-xs text-muted-foreground">Eventos</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-primary">{progCount}</p><p className="text-xs text-muted-foreground">Programadas</p></CardContent></Card>
      </div>

      <Tabs defaultValue="calendario" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          {tabs.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="gap-1.5 text-xs data-[state=active]:bg-background">
              <t.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="calendario">
          <CalendarioView onSelect={handleSelect} onNew={() => { setEditItem(null); setModalOpen(true); }} />
        </TabsContent>

        <TabsContent value="cuentas">
          <CuentasConectadas />
        </TabsContent>

        <TabsContent value="contenidos">
          <Card>
            <CardHeader><CardTitle className="text-base">Contenidos</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {items.filter((i) => i.tipo === "publicacion").length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No hay contenidos creados.</p>
                ) : (
                  items.filter((i) => i.tipo === "publicacion").map((it) => {
                    const pub = it as import("@/features/marketing/data/marketing").Publicacion;
                    const redInfo = REDES_SOCIALES.find((r) => r.id === pub.redSocial);
                    return (
                      <button key={it.id} onClick={() => handleSelect(it)}
                        className="w-full flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors text-left">
                        <div className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: redInfo?.color ?? "hsl(var(--muted))" }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate text-foreground">{pub.titulo}</p>
                          <p className="text-xs text-muted-foreground">{redInfo?.label} · {pub.tipoContenido} · {pub.fecha}</p>
                        </div>
                        <Badge variant="outline" className="text-[10px] shrink-0">{ESTADOS_PUBLICACION.find((e) => e.value === pub.estado)?.label}</Badge>
                      </button>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campanas">
          <Card>
            <CardHeader><CardTitle className="text-base">Campañas</CardTitle></CardHeader>
            <CardContent>
              {(() => {
                const campañas = [...new Set(items.map((i) => i.campaña).filter(Boolean))];
                if (campañas.length === 0) return <p className="text-sm text-muted-foreground text-center py-8">No hay campañas definidas.</p>;
                return (
                  <div className="space-y-3">
                    {campañas.map((c) => {
                      const count = items.filter((i) => i.campaña === c).length;
                      return (
                        <div key={c} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                          <div>
                            <p className="text-sm font-medium text-foreground">{c}</p>
                            <p className="text-xs text-muted-foreground">{count} elemento{count !== 1 ? "s" : ""}</p>
                          </div>
                          <Badge variant="outline" className="text-[10px]">Activa</Badge>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resultados">
          <Card>
            <CardHeader><CardTitle className="text-base">Resultados</CardTitle></CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">Analíticas próximamente</p>
                <p className="text-xs mt-1">Cuando las cuentas estén conectadas, aquí aparecerán métricas de rendimiento.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <PublicacionModal
        open={modalOpen} onClose={() => { setModalOpen(false); setEditItem(null); }}
        onSave={handleSave} editItem={editItem} empresaId={empresaActual.id}
      />
      <DetallePanel
        item={detalleItem} open={detalleOpen} onClose={() => setDetalleOpen(false)}
        onEdit={handleEdit} onDelete={handleDelete} onAddComment={handleAddComment}
      />
    </div>
  );
}
