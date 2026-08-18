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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  getEmpresaPlaceInfo,
  getLocalVinculado,
  detectarPlaceIdEmpresa,
  buscarPlaceCustom,
  setEmpresaPlaceId,
} from "@/features/calidad/actions/resenas-actions";

interface Candidato {
  placeId: string;
  name: string;
  address: string;
}

export function FichaGooglePanel() {
  const { empresaActual } = useEmpresa();
  const empresaId = empresaActual?.id;

  const [cargando, setCargando] = useState(true);
  const [conectada, setConectada] = useState(false);
  const [apiKeyOk, setApiKeyOk] = useState(true);
  const [buscando, setBuscando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [candidato, setCandidato] = useState<Candidato | null>(null);
  const [queryManual, setQueryManual] = useState("");
  /** Qué local está vinculado (nombre + dirección), leído de Google. */
  const [local, setLocal] = useState<{ name: string; address: string } | null>(
    null,
  );

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setLocal(null);
    getEmpresaPlaceInfo().then((info) => {
      if (!vivo) return;
      const vinculada = !!info?.googlePlaceId;
      setConectada(vinculada);
      setApiKeyOk(info?.googleApiKeyConfigured ?? false);
      setCandidato(null);
      setQueryManual("");
      setCargando(false);
      // Se resuelve aparte para no retrasar la pantalla: implica una llamada
      // a Google. Si falla, se muestra el estado sin el nombre del local.
      if (vinculada) {
        getLocalVinculado().then((res) => {
          if (vivo && res.ok) setLocal(res.local);
        });
      }
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
    toast.success("Local vinculado. Las reseñas empezarán a entrar solas.");
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
    toast.success("Local desvinculado.");
  };

  return (
    <div className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Señala cuál es tu local en Google para que las reseñas entren solas
          cada día y la IA redacte la respuesta de cada una. Sin esto no entra
          ninguna reseña.
        </p>

        {/* Honestidad sobre el alcance: esto NO es un "conectar con Google" con
            cuenta y permisos, es señalar una ficha pública (place_id). Sirve
            para LEER, no para publicar. El acceso de escritura exige la Google
            Business Profile API, pendiente de aprobación. Sin este aviso, el
            restaurante da por hecho que ya se publica solo. */}
        <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs text-sky-900">
          <span className="font-medium">Esto es solo el primer paso.</span>{" "}
          Aquí únicamente indicas cuál es tu local, para poder leer sus reseñas
          públicas. Las respuestas se preparan solas, pero de momento hay que
          publicarlas a mano en Google. Para que se publiquen solas harás una
          conexión con tu cuenta de Google —entrando y aceptando permisos, como
          en cualquier otra app—, que estará disponible en cuanto Google nos
          apruebe el acceso.
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
            <div className="min-w-0">
              {/* Se muestra QUÉ local, no solo que hay uno: es la única forma
                  de comprobar que apunta al restaurante correcto y no a un
                  homónimo, en cuyo caso entrarían reseñas de otro negocio. */}
              {local ? (
                <>
                  <div className="flex items-start gap-1.5">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground">
                        {local.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {local.address}
                      </div>
                    </div>
                  </div>
                  <div className="mt-1.5 text-xs text-muted-foreground">
                    Las reseñas entran solas cada día y la IA prepara la
                    respuesta de cada una, lista para publicar.
                  </div>
                </>
              ) : (
                <>
                  <div className="text-sm font-medium text-foreground">
                    Local vinculado
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Las reseñas entran solas cada día y la IA prepara la
                    respuesta de cada una, lista para publicar.
                  </div>
                </>
              )}
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
              Cambiar local
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
    </div>
  );
}
