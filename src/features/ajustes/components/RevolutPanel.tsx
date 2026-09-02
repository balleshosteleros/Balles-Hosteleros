"use client";

/**
 * Configuración del cobro con Revolut para los productos de tipo Ticket.
 *
 * Las claves se guardan cifradas y no vuelven al navegador: una vez guardadas
 * solo se ve una máscara (sk_l****Lmkw). Para cambiarlas hay que pegarlas de
 * nuevo.
 */

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import {
  getRevolutConfig,
  guardarRevolutConfig,
  probarRevolutConfig,
  conectarWebhookRevolut,
  type RevolutConfigVista,
} from "@/features/ajustes/actions/revolut-config-actions";

export function RevolutPanel() {
  const [cfg, setCfg] = useState<RevolutConfigVista | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [probando, setProbando] = useState(false);
  const [conectando, setConectando] = useState(false);

  const [secretKey, setSecretKey] = useState("");
  const [publicKey, setPublicKey] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    const c = await getRevolutConfig();
    setCfg(c);
    setPublicKey(c.publicKey ?? "");
    setCargando(false);
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);


  async function guardar() {
    setGuardando(true);
    const r = await guardarRevolutConfig({
      secretKey: secretKey.trim() || undefined,
      publicKey: publicKey.trim() || undefined,
    });
    setGuardando(false);

    if (!r.ok) { toast.error(r.error); return; }
    toast.success("Guardado");
    setSecretKey("");
    await cargar();
  }

  async function conectarAviso() {
    setConectando(true);
    const r = await conectarWebhookRevolut();
    setConectando(false);
    if (!r.ok) { toast.error(r.error); return; }
    toast.success(r.mensaje);
    await cargar();
  }

  async function probar() {
    setProbando(true);
    const r = await probarRevolutConfig();
    setProbando(false);
    if (r.ok) toast.success(r.mensaje);
    else toast.error(r.error);
  }

  async function cambiarActivo(activo: boolean) {
    const r = await guardarRevolutConfig({ activo });
    if (!r.ok) { toast.error(r.error); return; }
    toast.success(activo ? "Cobro activado" : "Cobro desactivado");
    await cargar();
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Cargando…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs text-muted-foreground">
          El dinero entra en la cuenta de Revolut de esta empresa. Cada empresa
          usa sus propias claves.
        </p>
        {cfg?.configurado && (
          <Badge variant={cfg.activo ? "default" : "secondary"} className="shrink-0">
            {cfg.activo ? "Activo" : "Inactivo"}
          </Badge>
        )}
      </div>

      {/* ── Claves ─────────────────────────────────────────────── */}
      <div className="space-y-4 rounded-lg border p-4">
        <div className="space-y-1.5">
          <Label htmlFor="rev-secret" className="text-xs">
            Clave secreta de producción
          </Label>
          <Input
            id="rev-secret"
            type="password"
            autoComplete="off"
            placeholder={cfg?.secretKeyMascara ?? "sk_…"}
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
          />
          <p className="text-[11px] text-muted-foreground">
            {cfg?.configurado
              ? `Guardada (${cfg.secretKeyMascara}). Déjalo vacío para no cambiarla.`
              : "Se guarda cifrada. No se puede volver a leer desde aquí."}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rev-public" className="text-xs">
            Clave pública de producción
          </Label>
          <Input
            id="rev-public"
            autoComplete="off"
            placeholder="pk_…"
            value={publicKey}
            onChange={(e) => setPublicKey(e.target.value)}
          />
        </div>
      </div>

      {/* ── Aviso de pagos ─────────────────────────────────────
          El panel de Revolut NO deja crear esto a mano, así que el botón lo da
          de alta por el restaurante. Sin este aviso Revolut cobra pero no nos
          avisa, y el cliente pagaría sin recibir su código. */}
      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-xs font-semibold">Aviso de pagos</h4>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Permite que Revolut nos avise en cuanto un cliente paga. Sin esto,
              el cobro entra pero el código no se envía.
            </p>
          </div>
          {cfg?.webhookConfigurado && (
            <Badge variant="default" className="shrink-0">Conectado</Badge>
          )}
        </div>

        <Button
          variant={cfg?.webhookConfigurado ? "outline" : "default"}
          onClick={conectarAviso}
          disabled={conectando || !cfg?.configurado}
          className="w-full"
        >
          {conectando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {cfg?.webhookConfigurado ? "Volver a conectar" : "Conectar aviso de pagos"}
        </Button>

        {!cfg?.configurado && (
          <p className="text-[11px] text-muted-foreground">
            Guarda antes la clave secreta.
          </p>
        )}
      </div>

      {/* ── Activación ─────────────────────────────────────────── */}
      {cfg?.configurado && (
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <p className="text-xs font-medium">Cobrar con Revolut</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Si lo desactivas, los productos de pago dejan de venderse.
            </p>
          </div>
          <Switch checked={cfg.activo} onCheckedChange={cambiarActivo} />
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button onClick={guardar} disabled={guardando}>
          {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Guardar
        </Button>
        {cfg?.configurado && cfg.activo && (
          <Button variant="outline" onClick={probar} disabled={probando}>
            {probando
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <ShieldCheck className="mr-2 h-4 w-4" />}
            Probar conexión
          </Button>
        )}
      </div>
    </div>
  );
}
