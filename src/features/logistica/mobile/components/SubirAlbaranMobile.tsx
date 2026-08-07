"use client";

/**
 * Subir albarán por foto desde el móvil (captura → OCR → verificar → guardar en Revisión).
 * La resolución fina (vincular/crear/ignorar líneas) se queda en escritorio: aquí solo se
 * captura y se deja lista para que alguien la remate desde el ordenador.
 */

import { useState } from "react";
import Link from "next/link";
import { Camera, Upload, FileImage, Loader2, X, CheckCircle2, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useSubirAlbaran } from "@/features/logistica/hooks/use-subir-albaran";
import { ProveedorCombobox } from "@/features/logistica/components/productos/ProveedorCombobox";
import { formatNumero } from "@/shared/lib/numero";

export function SubirAlbaranMobile() {
  const [exito, setExito] = useState<{ id: string; numero?: string } | null>(null);
  const [motivoOverride, setMotivoOverride] = useState("");

  const {
    paso,
    file,
    preview,
    fallo,
    duplicado,
    setDuplicado,
    cabecera,
    proveedor,
    setProveedor,
    fecha,
    setFecha,
    numeroProveedor,
    setNumeroProveedor,
    lineas,
    ligadas,
    totalLineas,
    nReconocidas,
    handleFile,
    analizar,
    reintentar,
    setLineaCampo,
    guardar,
    reset,
    setFile,
    setPreview,
  } = useSubirAlbaran({
    onCreado: (id, numero) => setExito({ id, numero }),
  });

  if (exito) {
    return (
      <div className="flex min-h-[65vh] flex-col items-center justify-center px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
          <CheckCircle2 className="h-9 w-9" />
        </div>
        <h2 className="mt-4 text-lg font-bold">
          {exito.numero ? `Albarán ${exito.numero} guardado` : "Albarán guardado"}
        </h2>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          Se ha guardado en Revisión. Las líneas sin reconocer se resuelven desde el ordenador
          (Logística → Pedidos → Albaranes).
        </p>
        <div className="mt-6 flex w-full max-w-xs flex-col gap-2">
          <Button onClick={() => setExito(null)}>Subir otro albarán</Button>
          <Button variant="outline" asChild>
            <Link href="/m/pedidos">Volver</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-[calc(var(--nav-h)+4.5rem)]">
      {paso === "elegir" && !preview && (
        <div className="space-y-3">
          <label className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 p-8 active:scale-[0.98] transition-all cursor-pointer">
            <Camera className="h-10 w-10 text-primary" />
            <span className="text-sm font-semibold text-foreground">Hacer foto</span>
            <span className="text-xs text-muted-foreground text-center">
              Foto del albarán del proveedor
            </span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] || null)}
            />
          </label>
          <label className="flex flex-col items-center justify-center gap-2 rounded-2xl border bg-card p-5 active:scale-[0.98] transition-all cursor-pointer">
            <Upload className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Adjuntar archivo</span>
            <span className="text-xs text-muted-foreground text-center">PDF o imagen</span>
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] || null)}
            />
          </label>
        </div>
      )}

      {paso === "elegir" && preview && (
        <div className="space-y-3">
          <div className="relative rounded-2xl overflow-hidden border bg-muted/30">
            {file?.type.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Preview albarán" className="w-full max-h-[320px] object-contain" />
            ) : (
              <div className="flex items-center justify-center gap-3 p-8">
                <FileImage className="h-10 w-10 text-primary" />
                <div>
                  <p className="font-medium text-foreground text-sm">{file?.name}</p>
                  <p className="text-xs text-muted-foreground">{((file?.size || 0) / 1024).toFixed(0)} KB</p>
                </div>
              </div>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-2 right-2 h-8 w-8 bg-background/80 hover:bg-background"
              onClick={() => { setFile(null); setPreview(null); }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          {fallo && (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3.5 text-sm">
              <p className="font-medium text-destructive">{fallo.message}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">Código: {fallo.traceId}</p>
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => { setFile(null); setPreview(null); }}>
              Cambiar
            </Button>
            <Button className="flex-1" onClick={fallo ? reintentar : analizar}>
              {fallo ? "Reintentar" : "Analizar"}
            </Button>
          </div>
        </div>
      )}

      {(paso === "subiendo" || paso === "analizando" || paso === "guardando") && (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            {paso === "subiendo"
              ? "Subiendo el documento…"
              : paso === "analizando"
                ? "Leyendo el albarán con IA…"
                : "Guardando el albarán…"}
          </p>
        </div>
      )}

      {paso === "verificar" && (
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-3 p-3.5">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Proveedor</label>
                <ProveedorCombobox value={proveedor} onChange={setProveedor} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Fecha</label>
                  <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="h-10" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Nº albarán</label>
                  <Input
                    value={numeroProveedor}
                    onChange={(e) => setNumeroProveedor(e.target.value)}
                    className="h-10"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <p className="px-1 text-xs text-muted-foreground">
            {nReconocidas} de {lineas.length} líneas reconocidas. Las demás se resuelven después
            desde el ordenador.
          </p>

          <div className="space-y-2.5">
            {lineas.map((l) => {
              const ligado = ligadas.get(l.id)?.ligadoAuto ?? null;
              return (
                <Card key={l.id}>
                  <CardContent className="space-y-2.5 p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 truncate font-medium leading-tight">{l.nombre}</p>
                      {ligado ? (
                        <span className="inline-flex shrink-0 items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" /> {ligado.nombre}
                        </span>
                      ) : (
                        <span className="inline-flex shrink-0 items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
                          <HelpCircle className="h-3.5 w-3.5" /> Sin reconocer
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-muted-foreground">Cantidad</label>
                        <Input
                          className="h-9 text-right"
                          inputMode="decimal"
                          defaultValue={String(l.cantidad)}
                          onBlur={(e) => setLineaCampo(l.id, "cantidad", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-muted-foreground">Precio ud.</label>
                        <Input
                          className="h-9 text-right"
                          inputMode="decimal"
                          defaultValue={l.precioUnitario != null ? String(l.precioUnitario) : ""}
                          onBlur={(e) => setLineaCampo(l.id, "precioUnitario", e.target.value)}
                        />
                      </div>
                    </div>
                    <p className="text-right text-xs text-muted-foreground tabular-nums">
                      {formatNumero(l.importe ?? (l.precioUnitario ?? 0) * l.cantidad)} €
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <p className="px-1 text-xs text-muted-foreground">
            Suma de líneas: <span className="font-semibold tabular-nums">{formatNumero(totalLineas)} €</span>
            {cabecera.total != null && Math.abs(cabecera.total - totalLineas) > 0.05 && (
              <span className="mt-1 block text-orange-600">
                El documento dice {formatNumero(cabecera.total)} € — revisa cantidades/precios.
              </span>
            )}
          </p>

          {duplicado && (
            <div className="space-y-2.5 rounded-2xl border border-orange-300 bg-orange-50 p-3.5 dark:border-orange-800 dark:bg-orange-950/30">
              <p className="text-sm font-medium text-orange-800 dark:text-orange-300">
                Posible duplicado: ya existe el albarán {duplicado.numero} de {duplicado.proveedorNombre}
                {duplicado.numeroProveedor ? ` (nº proveedor ${duplicado.numeroProveedor})` : ""} con fecha{" "}
                {duplicado.fecha}.
              </p>
              <p className="text-xs text-orange-700 dark:text-orange-400">
                Si es el mismo papel, no lo registres otra vez. Si de verdad es otro documento,
                explica por qué y registra.
              </p>
              <Input
                placeholder="Motivo (obligatorio para registrar)"
                value={motivoOverride}
                onChange={(e) => setMotivoOverride(e.target.value)}
                className="h-10 bg-background"
              />
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { setDuplicado(null); setMotivoOverride(""); }}>
                  Revisar datos
                </Button>
                <Button
                  className="flex-1"
                  disabled={!motivoOverride.trim()}
                  onClick={() => guardar({ posibleDuplicadoDe: duplicado.id, motivo: motivoOverride.trim() })}
                >
                  Registrar de todos modos
                </Button>
              </div>
            </div>
          )}

          <div className="fixed inset-x-0 bottom-[calc(var(--nav-h)+0.75rem)] z-30 mx-auto max-w-screen-sm px-3">
            <div className="flex gap-2">
              <Button variant="outline" className="shrink-0" onClick={reset}>
                Empezar de nuevo
              </Button>
              <Button className="flex-1 shadow-lg" size="lg" onClick={() => guardar()} disabled={!!duplicado}>
                Guardar en Revisión
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
