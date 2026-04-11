"use client";

import { useMemo, useState } from "react";
import { HelpCircle, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FaqAdminPanel } from "./faq-admin-panel";
import type { Faq, FaqsByCategory } from "@/features/soporte/types";

interface AyudaPortalProps {
  viewerData: FaqsByCategory[];
  adminData: Faq[] | null; // null si el usuario no puede editar
}

export function AyudaPortal({ viewerData, adminData }: AyudaPortalProps) {
  const canEdit = adminData !== null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8">
      <div className="mb-6 flex items-center gap-3">
        <HelpCircle className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Centro de Ayuda</h1>
          <p className="text-sm text-muted-foreground">
            Preguntas frecuentes y documentación
          </p>
        </div>
      </div>

      {canEdit ? (
        <Tabs defaultValue="ver" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="ver">Ver FAQs</TabsTrigger>
            <TabsTrigger value="gestionar">Gestionar contenido</TabsTrigger>
          </TabsList>
          <TabsContent value="ver" className="mt-0">
            <FaqViewer data={viewerData} />
          </TabsContent>
          <TabsContent value="gestionar" className="mt-0">
            <FaqAdminPanel initialFaqs={adminData!} />
          </TabsContent>
        </Tabs>
      ) : (
        <FaqViewer data={viewerData} />
      )}
    </div>
  );
}

function FaqViewer({ data }: { data: FaqsByCategory[] }) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    data[0]?.categoria ?? null
  );
  const [search, setSearch] = useState("");

  const visibleFaqs = useMemo(() => {
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
    if (!selectedCategory) return [];
    return data.find((cat) => cat.categoria === selectedCategory)?.faqs ?? [];
  }, [search, selectedCategory, data]);

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 p-10 text-center text-sm text-muted-foreground">
        <p className="font-medium text-foreground">
          No hay preguntas frecuentes disponibles todavía.
        </p>
        <p className="mt-2">
          Contacta con un administrador para añadir contenido.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card">
      {/* Buscador */}
      <div className="border-b p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar en la ayuda..."
            className="w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <div className="flex min-h-[400px]">
        {/* Índice lateral de categorías — oculto en móvil y cuando hay búsqueda activa */}
        {!search.trim() && (
          <nav className="hidden w-56 shrink-0 overflow-y-auto border-r bg-muted/30 p-3 md:block">
            <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Categorías
            </p>
            <ul className="space-y-0.5">
              {data.map((cat) => (
                <li key={cat.categoria}>
                  <button
                    type="button"
                    onClick={() => setSelectedCategory(cat.categoria)}
                    className={cn(
                      "w-full rounded-md px-3 py-2 text-left text-xs font-medium transition-colors",
                      selectedCategory === cat.categoria
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    {cat.categoria}
                    <span className="ml-1 opacity-60">
                      ({cat.faqs.length})
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {/* Panel de preguntas */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Selector de categoría solo en móvil */}
          {!search.trim() && (
            <div className="mb-4 md:hidden">
              <select
                value={selectedCategory ?? ""}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                {data.map((cat) => (
                  <option key={cat.categoria} value={cat.categoria}>
                    {cat.categoria} ({cat.faqs.length})
                  </option>
                ))}
              </select>
            </div>
          )}

          {visibleFaqs.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              {search.trim()
                ? "No se encontraron resultados para tu búsqueda."
                : "Selecciona una categoría a la izquierda."}
            </p>
          ) : (
            <ul className="space-y-5">
              {visibleFaqs.map((faq) => (
                <li key={faq.id} className="border-b pb-5 last:border-b-0">
                  <h3 className="text-sm font-semibold text-foreground">
                    {faq.pregunta}
                  </h3>
                  <div className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                    {faq.respuesta}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
