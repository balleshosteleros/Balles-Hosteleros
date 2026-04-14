"use client";

import { useMemo, useState } from "react";
import { Search, ChevronRight, UserRound, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { FaqAdminPanel } from "./faq-admin-panel";
import { SoporteDrawer } from "./soporte-drawer";
import { FormacionRolViewer } from "@/features/formacion/components/FormacionRolViewer";
import type { Faq, FaqsByCategory } from "@/features/soporte/types";

interface AyudaPortalProps {
  viewerData: FaqsByCategory[];
  adminData: Faq[] | null; // null si el usuario no puede editar
  userRoles?: string[];    // roles del usuario para filtrar formación
}

export function AyudaPortal({ viewerData, adminData, userRoles = [] }: AyudaPortalProps) {
  const canEdit = adminData !== null;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6 md:py-8">
      <Tabs defaultValue="ver" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="ver">Ver ayuda</TabsTrigger>
          <TabsTrigger value="formacion" className="gap-1.5">
            <GraduationCap className="h-3.5 w-3.5" />
            Ver Formación Inicial de nuevo
          </TabsTrigger>
          {canEdit && (
            <TabsTrigger value="gestionar">Editar contenido</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="ver" className="mt-0">
          <AyudaViewer data={viewerData} />
        </TabsContent>

        <TabsContent value="formacion" className="mt-0">
          <FormacionRolViewer userRoles={userRoles} />
        </TabsContent>

        {canEdit && (
          <TabsContent value="gestionar" className="mt-0">
            <FaqAdminPanel initialFaqs={adminData!} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function AyudaViewer({ data }: { data: FaqsByCategory[] }) {
  const [selectedTema, setSelectedTema] = useState<string | null>(
    data[0]?.categoria ?? null
  );
  const [search, setSearch] = useState("");

  const visibleAyudas = useMemo(() => {
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return data.flatMap((cat) =>
        cat.faqs.filter(
          (f) =>
            f.pregunta.toLowerCase().includes(q) ||
            f.respuesta.toLowerCase().includes(q)
        )
      );
    }
    if (!selectedTema) return [];
    return data.find((cat) => cat.categoria === selectedTema)?.faqs ?? [];
  }, [search, selectedTema, data]);

  if (data.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-dashed bg-muted/30 p-10 text-center">
          <p className="text-base font-medium text-foreground">
            Todavía no hay ayudas escritas.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Mientras tanto, pulsa el botón verde de abajo a la derecha para hablar con una persona.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Buscador grande */}
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          ¿Qué necesitas saber?
        </label>
        <div className="relative mt-2">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Escribe lo que quieras buscar… ej: cómo fichar"
            className="w-full rounded-xl border bg-background py-3 pl-12 pr-4 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Tarjetas de temas — solo cuando NO hay búsqueda */}
      {!search.trim() && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Elige un tema
          </p>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {data.map((cat) => (
              <button
                key={cat.categoria}
                type="button"
                onClick={() => setSelectedTema(cat.categoria)}
                className={cn(
                  "flex items-center justify-between rounded-xl border bg-card p-4 text-left transition-all hover:border-primary hover:shadow-sm",
                  selectedTema === cat.categoria &&
                    "border-primary bg-primary/5 shadow-sm",
                )}
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {cat.categoria}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {cat.faqs.length}{" "}
                    {cat.faqs.length === 1 ? "explicación" : "explicaciones"}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Lista de ayudas */}
      <div className="rounded-2xl border bg-card">
        <div className="border-b px-5 py-3">
          <p className="text-sm font-semibold text-foreground">
            {search.trim()
              ? `Resultados para "${search}"`
              : selectedTema ?? "Selecciona un tema"}
          </p>
        </div>
        <div className="p-5">
          {visibleAyudas.length === 0 ? (
            <div className="space-y-3 text-center">
              <p className="text-sm text-muted-foreground">
                {search.trim()
                  ? "No hemos encontrado nada con esas palabras."
                  : "Elige un tema arriba para ver las explicaciones."}
              </p>
              {search.trim() && (
                <SoporteDrawer>
                  <Button size="sm">
                    <UserRound className="mr-1 h-4 w-4" />
                    Hablar con una persona
                  </Button>
                </SoporteDrawer>
              )}
            </div>
          ) : (
            <ul className="space-y-5">
              {visibleAyudas.map((ayuda) => (
                <li key={ayuda.id} className="border-b pb-5 last:border-b-0">
                  <h3 className="text-base font-semibold text-foreground">
                    {ayuda.pregunta}
                  </h3>
                  <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {ayuda.respuesta}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Banner pedir ayuda a una persona */}
      <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 sm:flex-row sm:items-center dark:border-emerald-900/50 dark:bg-emerald-950/30">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-emerald-600 p-2 text-white">
            <UserRound className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              ¿No encuentras lo que buscas?
            </p>
            <p className="text-xs text-muted-foreground">
              Habla con una persona. Te responde alguien del equipo.
            </p>
          </div>
        </div>
        <SoporteDrawer>
          <Button className="bg-emerald-600 text-white hover:bg-emerald-700">
            <UserRound className="mr-1 h-4 w-4" />
            Hablar con una persona
          </Button>
        </SoporteDrawer>
      </div>
    </div>
  );
}
