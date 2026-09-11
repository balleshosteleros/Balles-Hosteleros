"use client";

import { useState, useTransition } from "react";
import { RefreshCw, Sparkles, HelpCircle, BookOpen } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { FaqAdminPanel } from "./faq-admin-panel";
import { ConocimientoAdminPanel } from "./conocimiento-admin-panel";
import { HuecosPanel } from "./huecos-panel";
import { reindexarManual } from "@/features/soporte/actions/conocimiento-actions";
import type {
  ConocimientoChunk,
  Faq,
  HuecoConocimiento,
} from "@/features/soporte/types";

/**
 * Ayuda, desde Dirección.
 *
 * Las tres piezas del circuito, en el orden en que se usan: lo que ya se publica
 * solo, lo que sabe el asistente, y lo que falta por explicarle.
 */

interface EstadoIndice {
  total: number;
  porFuente: Record<string, number>;
  porModulo: Record<string, number>;
  sinEmbedding: number;
}

interface AyudaDireccionViewProps {
  faqs: Faq[];
  conocimiento: ConocimientoChunk[];
  estadoConocimiento: EstadoIndice;
  huecos: HuecoConocimiento[];
}

export function AyudaDireccionView({
  faqs,
  conocimiento,
  estadoConocimiento,
  huecos,
}: AyudaDireccionViewProps) {
  const [aviso, setAviso] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reindexar() {
    setAviso(null);
    startTransition(async () => {
      const r = await reindexarManual();
      if (r.error) {
        setAviso(r.error);
        return;
      }
      setAviso(`Manual actualizado: ${r.resumen ?? "listo"}`);
    });
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6 md:py-8">
      <Tabs defaultValue="frecuentes" className="w-full">
        <div className="mb-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <TabsList>
            <TabsTrigger value="frecuentes" className="gap-1.5">
              <HelpCircle className="h-3.5 w-3.5" />
              Preguntas frecuentes
            </TabsTrigger>
            <TabsTrigger value="asistente" className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Lo que sabe el asistente
            </TabsTrigger>
            <TabsTrigger value="huecos" className="gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />
              Lo que falta
              {huecos.length > 0 && (
                <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  {huecos.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <Button variant="outline" size="sm" onClick={reindexar} disabled={isPending}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Actualizar el manual
          </Button>
        </div>

        {aviso && (
          <p className="mb-4 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            {aviso}
          </p>
        )}

        <TabsContent value="frecuentes" className="mt-0">
          <FaqAdminPanel initialFaqs={faqs} />
        </TabsContent>

        <TabsContent value="asistente" className="mt-0">
          <ConocimientoAdminPanel
            initialChunks={conocimiento}
            estado={estadoConocimiento}
          />
        </TabsContent>

        <TabsContent value="huecos" className="mt-0">
          <HuecosPanel huecos={huecos} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
