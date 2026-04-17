"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Switch } from "@/shared/components/ui/switch";
import { Label } from "@/shared/components/ui/label";
import { setSlugEmpresa, togglePublicarCarta, actualizarDescripcionCarta } from "../../actions/slug-actions";
import type { CartaEmpresaPublica } from "../../types";
import { normalizarSlug } from "../../services/slug-validator";

export function SlugConfigCard({
  empresa,
  baseUrl,
}: {
  empresa: CartaEmpresaPublica;
  baseUrl: string;
}) {
  const [slug, setSlug] = useState(empresa.carta_slug ?? "");
  const [descripcion, setDescripcion] = useState(empresa.carta_descripcion ?? "");
  const [publicada, setPublicada] = useState(empresa.carta_publicada);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const cleanSlug = normalizarSlug(slug);
  const urlPreview = cleanSlug ? `${baseUrl}/carta/${cleanSlug}` : `${baseUrl}/carta/...`;

  const handleSlug = () => {
    setMsg(null);
    startTransition(async () => {
      const res = await setSlugEmpresa(slug);
      if (!res.ok) {
        setMsg({ kind: "err", text: res.error });
        return;
      }
      setSlug(res.slug);
      setMsg({ kind: "ok", text: `Slug guardado: /carta/${res.slug}` });
    });
  };

  const handleDescripcion = () => {
    setMsg(null);
    startTransition(async () => {
      const res = await actualizarDescripcionCarta(descripcion);
      if (!res.ok) {
        setMsg({ kind: "err", text: res.error ?? "Error" });
        return;
      }
      setMsg({ kind: "ok", text: "Descripción guardada." });
    });
  };

  const handleTogglePub = (next: boolean) => {
    setPublicada(next);
    startTransition(async () => {
      const res = await togglePublicarCarta(next);
      if (!res.ok) {
        setPublicada(!next);
        setMsg({ kind: "err", text: res.error ?? "Error" });
      } else {
        setMsg({
          kind: "ok",
          text: next ? "Carta publicada (visible al público)." : "Carta despublicada.",
        });
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>URL pública y publicación</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="slug">Slug público</Label>
          <div className="flex gap-2">
            <Input
              id="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="mi-restaurante"
              maxLength={40}
            />
            <Button onClick={handleSlug} disabled={pending} variant="primary" size="lg">
              Guardar
            </Button>
          </div>
          <p className="text-sm text-stone-600">
            URL: <span className="font-mono text-stone-900">{urlPreview}</span>
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="desc">Descripción del restaurante</Label>
          <textarea
            id="desc"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            maxLength={500}
            rows={3}
            className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
            placeholder="Cocina mediterránea de mercado..."
          />
          <Button onClick={handleDescripcion} disabled={pending} variant="primary" size="lg">
            Guardar descripción
          </Button>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-stone-50 p-3">
          <div>
            <p className="font-medium">Publicar carta</p>
            <p className="text-sm text-stone-600">
              {publicada ? "Visible para clientes en la URL pública." : "Sólo visible en admin."}
            </p>
          </div>
          <Switch checked={publicada} onCheckedChange={handleTogglePub} disabled={pending || !slug} />
        </div>

        {msg ? (
          <p
            className={`text-sm ${msg.kind === "ok" ? "text-emerald-700" : "text-red-700"}`}
          >
            {msg.text}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
