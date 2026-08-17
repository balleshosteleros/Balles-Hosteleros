"use client";

/**
 * Conexión de la empresa con su ficha de Google (Integraciones).
 *
 * Vive aquí, junto al resto de conectores, porque es exactamente eso: una
 * conexión con un servicio externo. Antes solo se podía hacer desde dentro de
 * /calidad/resenas y había que saber que el botón estaba ahí, así que una
 * empresa que no pasara por esa pantalla no contestaba una sola reseña y nadie
 * se enteraba — no falla nada visible, simplemente no entra ninguna reseña.
 *
 * Los agentes IA que redactan las respuestas ya vienen sembrados en toda
 * empresa nueva (src/lib/seeds/resenas-agentes-ia.ts): en cuanto se conecta la
 * ficha, el restaurante empieza a contestar solo sin tocar nada más.
 */

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Star,
  Plug,
  Loader2,
  CheckCircle2,
  Search,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  getEmpresaPlaceInfo,
  detectarPlaceIdEmpresa,
  buscarPlaceCustom,
  setEmpresaPlaceId,
} from "@/features/calidad/actions/resenas-actions";

interface Candidato {
  placeId: string;
  name: string;
  address: string;
}

export function FichaGoogleCard() {
  const { empresaActual } = useEmpresa();
  const empresaId = empresaActual?.id;

  const [cargando, setCargando] = useState(true);
  const [conectada, setConectada] = useState(false);
  const [apiKeyOk, setApiKeyOk] = useState(true);
  const [buscando, setBuscando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [candidato, setCandidato] = useState<Candidato | null>(null);
  const [queryManual, setQueryManual] = useState("");

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    getEmpresaPlaceInfo().then((info) => {
      if (!vivo) return;
      setConectada(!!info?.googlePlaceId);
      setApiKeyOk(info?.googleApiKeyConfigured ?? false);
      setCandidato(null);
      setQueryManual("");
      setCargando(false);
    });
    return () => {
      vivo = false;
    };
  }, [empresaId]);

  // Traduce los códigos internos a algo que el restaurante entienda.
  const mostrarError = (error: string) => {
    const map: Record<string, string> = {
      MISSING_GOOGLE_MAPS_API_KEY:
        "Falta configurar la clave de Google en el servidor. Avisa a soporte.",
      "Empresa sin nombre":
        "La empresa no tiene nombre comercial. Complétalo en Datos generales.",
    };
    toast.error(map[error] ?? error);
  };

  const detectar = async () => {
    setBuscando(true);
    const res = await detectarPlaceIdEmpresa();
    setBuscando(false);
    if (!res.ok) {
      mostrarError(res.error);
      return;
    }
    setCandidato(res.candidate);
  };

  const buscarManual = async () => {
    if (!queryManual.trim()) return;
    setBuscando(true);
    const res = await buscarPlaceCustom(queryManual);
    setBuscando(false);
    if (!res.ok) {
      mostrarError(res.error);
      return;
    }
    setCandidato(res.candidate);
  };

  const confirmar = async () => {
    if (!candidato) return;
    setGuardando(true);
    const res = await setEmpresaPlaceId(candidato.placeId);
    setGuardando(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setConectada(true);
    setCandidato(null);
    setQueryManual("");
    toast.success("Ficha de Google conectada. Las reseñas empezarán a entrar solas.");
  };

  const desconectar = async () => {
    setGuardando(true);
    const res = await setEmpresaPlaceId(null);
    setGuardando(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setConectada(false);
    toast.success("Ficha de Google desconectada.");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Star className="h-5 w-5 text-amber-500" />
          Ficha de Google
          {conectada ? (
            <Badge className="ml-auto gap-1 bg-emerald-100 font-normal text-emerald-700 hover:bg-emerald-100">
              <CheckCircle2 className="h-3 w-3" /> Conectada
            </Badge>
          ) : (
            <Badge variant="secondary" className="ml-auto font-normal">
              Sin conectar
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Plug className="mt-0.5 h-4 w-4 shrink-0" />
          Conecta el local con su ficha de Google para que las reseñas entren
          solas cada día y la IA redacte la respuesta de cada una. Sin conectar
          la ficha no entra ninguna reseña.
        </p>

        {!apiKeyOk && !cargando ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
            Falta configurar la clave de Google en el servidor. Avisa a soporte
            para poder conectar la ficha.
          </p>
        ) : null}

        {cargando ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Comprobando…
          </div>
        ) : conectada ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
            <div>
              <div className="text-sm font-medium text-foreground">
                Reseñas activas
              </div>
              <div className="text-xs text-muted-foreground">
                Entran solas cada día y la IA prepara la respuesta de cada una.
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={desconectar}
              disabled={guardando}
            >
              {guardando ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : null}
              Desconectar
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Camino principal: el sistema busca la ficha por el nombre y la
                dirección que la empresa ya tiene guardados. Un solo clic. */}
            <Button onClick={detectar} disabled={buscando || !apiKeyOk}>
              {buscando ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-1.5 h-4 w-4" />
              )}
              Buscar mi ficha en Google
            </Button>

            {/* Salida de emergencia: si la detección automática falla o
                propone otro local (nombres parecidos, franquicias). */}
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">
                ¿No la encuentra? Búscala escribiendo el nombre y la dirección
                del local.
              </p>
              <div className="flex flex-wrap gap-2">
                <Input
                  placeholder="Ej. Restaurante Bacanal, Calle Mayor 1, Madrid"
                  value={queryManual}
                  onChange={(e) => setQueryManual(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") buscarManual();
                  }}
                  disabled={buscando || !apiKeyOk}
                  className="min-w-[240px] flex-1"
                />
                <Button
                  variant="outline"
                  onClick={buscarManual}
                  disabled={buscando || !queryManual.trim() || !apiKeyOk}
                >
                  Buscar
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmación: NUNCA se guarda sin que el restaurante valide que el
            local propuesto es el suyo. Google devuelve homónimos con
            facilidad y conectar la ficha equivocada haría que entraran las
            reseñas de otro negocio. */}
        {candidato ? (
          <div className="space-y-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-3">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
              <div>
                <div className="text-sm font-medium text-sky-900">
                  {candidato.name}
                </div>
                <div className="text-xs text-sky-800">{candidato.address}</div>
              </div>
            </div>
            <p className="text-xs text-sky-900">
              ¿Es este tu local? Comprueba que la dirección es correcta antes de
              conectarlo.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={confirmar} disabled={guardando}>
                {guardando ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : null}
                Sí, es mi local
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCandidato(null)}
                disabled={guardando}
              >
                No es este
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
