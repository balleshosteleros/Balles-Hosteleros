"use client";

/**
 * PRP-087 · Fases 5, 6 y 7 — Crear una campaña desde el software.
 *
 * Tres pasos, uno por cada nivel de Meta, contados como los entiende un
 * hostelero y no como los llama la API:
 *   1. Qué quieres conseguir  → la campaña
 *   2. A quién y con cuánto   → el conjunto de anuncios
 *   3. Qué le enseñas         → el anuncio (imagen, vídeo o carrusel)
 * Y al final: publicar ahora, programar o dejarla en borrador.
 */

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { NumberInput } from "@/shared/components/NumberInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, X, Upload, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import {
  crearCampanaCompletaAction,
  type CrearCampanaCompletaInput,
} from "@/features/marketing/meta-ads/actions/creacion-actions";
import {
  buscarCiudadesMetaAction,
  buscarInteresesMetaAction,
  type InteresMeta,
  type UbicacionMeta,
} from "@/features/marketing/meta-ads/actions/catalogos-actions";
import {
  estadoVideoMetaAction,
  presignVideoMetaAction,
  registrarVideoMetaAction,
  subirImagenMetaAction,
} from "@/features/marketing/meta-ads/actions/medios-actions";

/** Los mismos objetivos que entiende el servidor, contados en cristiano. */
const OBJETIVOS = [
  { clave: "RECONOCIMIENTO", titulo: "Que me conozcan", ayuda: "Llegar al máximo de gente posible." },
  { clave: "TRAFICO", titulo: "Visitas a la web", ayuda: "Llevar gente a la carta o a reservar." },
  { clave: "INTERACCION", titulo: "Interacción", ayuda: "Más me gusta, comentarios y mensajes." },
  { clave: "CONTACTOS", titulo: "Conseguir contactos", ayuda: "Que dejen su teléfono o su correo." },
  { clave: "RESERVAS", titulo: "Reservas y ventas", ayuda: "Que acaben reservando mesa." },
] as const;

const BOTONES = [
  { clave: "RESERVAR", texto: "Reservar" },
  { clave: "SABER_MAS", texto: "Más información" },
  { clave: "VER_MENU", texto: "Ver menú" },
  { clave: "PEDIR", texto: "Pedir ahora" },
  { clave: "LLAMAR", texto: "Llamar" },
  { clave: "CONTACTAR", texto: "Contactar" },
] as const;

interface TarjetaCarrusel {
  imageHash: string;
  url: string | null;
  titular: string;
}

export function AsistenteCampana({
  abierto,
  onCerrar,
  onCreada,
  hayInstagram,
}: {
  abierto: boolean;
  onCerrar: () => void;
  onCreada: () => void;
  hayInstagram: boolean;
}) {
  const [paso, setPaso] = useState(1);
  const [guardando, setGuardando] = useState(false);

  // Paso 1 — la campaña
  const [nombre, setNombre] = useState("");
  const [objetivo, setObjetivo] = useState<string>("TRAFICO");

  // Paso 2 — el público
  const [presupuesto, setPresupuesto] = useState(10);
  const [edadMin, setEdadMin] = useState(18);
  const [edadMax, setEdadMax] = useState(65);
  const [genero, setGenero] = useState<"todos" | "hombres" | "mujeres">("todos");
  const [ciudades, setCiudades] = useState<UbicacionMeta[]>([]);
  const [intereses, setIntereses] = useState<InteresMeta[]>([]);
  const [plataformas, setPlataformas] = useState<Array<"facebook" | "instagram">>(
    hayInstagram ? ["facebook", "instagram"] : ["facebook"],
  );

  // Paso 3 — el anuncio
  const [formato, setFormato] = useState<"imagen" | "video" | "carrusel">("imagen");
  const [texto, setTexto] = useState("");
  const [titular, setTitular] = useState("");
  const [enlace, setEnlace] = useState("");
  const [boton, setBoton] = useState<string>("RESERVAR");
  const [imageHash, setImageHash] = useState<string | null>(null);
  const [imagenUrl, setImagenUrl] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [videoEstado, setVideoEstado] = useState<string | null>(null);
  const [tarjetas, setTarjetas] = useState<TarjetaCarrusel[]>([]);
  const [subiendo, setSubiendo] = useState(false);

  // Paso 4 — publicación
  const [publicacion, setPublicacion] = useState<"borrador" | "ahora" | "programar">("borrador");
  const [programarPara, setProgramarPara] = useState("");

  const reiniciar = () => {
    setPaso(1);
    setNombre("");
    setObjetivo("TRAFICO");
    setPresupuesto(10);
    setEdadMin(18);
    setEdadMax(65);
    setGenero("todos");
    setCiudades([]);
    setIntereses([]);
    setPlataformas(hayInstagram ? ["facebook", "instagram"] : ["facebook"]);
    setFormato("imagen");
    setTexto("");
    setTitular("");
    setEnlace("");
    setBoton("RESERVAR");
    setImageHash(null);
    setImagenUrl(null);
    setVideoId(null);
    setVideoEstado(null);
    setTarjetas([]);
    setPublicacion("borrador");
    setProgramarPara("");
  };

  const cerrar = () => {
    reiniciar();
    onCerrar();
  };

  // ─── Subida de medios ─────────────────────────────────────

  const subirImagen = async (archivo: File, paraCarrusel: boolean) => {
    setSubiendo(true);
    const fd = new FormData();
    fd.append("archivo", archivo);
    const res = await subirImagenMetaAction(fd);
    setSubiendo(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if (paraCarrusel) {
      if (tarjetas.length >= 10) {
        toast.error("Un carrusel admite como mucho 10 imágenes.");
        return;
      }
      setTarjetas((t) => [...t, { imageHash: res.data.imageHash, url: res.data.url, titular: "" }]);
    } else {
      setImageHash(res.data.imageHash);
      setImagenUrl(res.data.url);
    }
  };

  /**
   * El vídeo va directo del navegador a nuestro almacén y de ahí a Meta: no
   * pasa por el servidor, porque un reel puede pesar cientos de megas.
   */
  const subirVideo = async (archivo: File) => {
    setSubiendo(true);
    try {
      const firma = await presignVideoMetaAction({
        nombre: archivo.name,
        tipo: archivo.type,
        bytes: archivo.size,
      });
      if (!firma.ok) {
        toast.error(firma.error);
        return;
      }

      const subida = await fetch(firma.data.urlSubida, { method: "PUT", body: archivo });
      if (!subida.ok) {
        toast.error("No se ha podido subir el vídeo. Revisa la conexión.");
        return;
      }

      const registro = await registrarVideoMetaAction({
        clave: firma.data.clave,
        nombre: archivo.name,
      });
      if (!registro.ok) {
        toast.error(registro.error);
        return;
      }

      setVideoId(registro.data.videoId);
      setVideoEstado("procesando");
      toast.success("Vídeo enviado a Meta. Está procesándolo.");
      void vigilarVideo(registro.data.videoId);
    } finally {
      setSubiendo(false);
    }
  };

  /** Pregunta cada 5 segundos si Meta ya terminó de procesar el vídeo. */
  const vigilarVideo = async (id: string) => {
    for (let intento = 0; intento < 60; intento++) {
      await new Promise((r) => setTimeout(r, 5000));
      const res = await estadoVideoMetaAction(id);
      if (!res.ok) continue;
      setVideoEstado(res.data.estado);
      if (res.data.estado === "listo") {
        toast.success("El vídeo ya está listo para publicarse.");
        return;
      }
      if (res.data.estado === "error") {
        toast.error("Meta no ha podido procesar el vídeo. Prueba con otro archivo.");
        return;
      }
    }
  };

  // ─── Guardar ──────────────────────────────────────────────

  const crear = async () => {
    setGuardando(true);
    const entrada: CrearCampanaCompletaInput = {
      nombre,
      objetivo,
      presupuestoDiarioEuros: presupuesto,
      edadMin,
      edadMax,
      genero,
      ciudades: ciudades.map((c) => c.clave),
      // Sin ciudades concretas, España entera: mejor eso que un anuncio sin sitio.
      paises: ciudades.length ? [] : ["ES"],
      intereses: intereses.map((i) => ({ id: i.id, name: i.name })),
      plataformas,
      formato,
      texto,
      titular,
      enlace,
      boton,
      imageHash: imageHash ?? undefined,
      videoId: videoId ?? undefined,
      tarjetas: formato === "carrusel"
        ? tarjetas.map((t) => ({ imageHash: t.imageHash, titular: t.titular || titular }))
        : undefined,
      publicacion,
      programarPara: publicacion === "programar" ? programarPara : undefined,
      confirmado: publicacion === "ahora",
    };

    const res = await crearCampanaCompletaAction(entrada);
    setGuardando(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }

    const comoQueda =
      res.data.estado === "activa"
        ? "publicada y ya está saliendo"
        : res.data.estado === "programada"
          ? "programada"
          : "guardada en borrador, en pausa";
    toast.success(`Campaña creada y ${comoQueda}.`);
    if (res.data.avisoGasto) toast.warning(res.data.avisoGasto);

    cerrar();
    onCreada();
  };

  const gastoMaximoMes = presupuesto * 30;

  const puedeSeguir =
    paso === 1
      ? nombre.trim().length > 0
      : paso === 2
        ? presupuesto > 0 && plataformas.length > 0 && edadMin <= edadMax
        : paso === 3
          ? texto.trim().length > 0 &&
            titular.trim().length > 0 &&
            enlace.trim().length > 0 &&
            (formato === "imagen"
              ? Boolean(imageHash)
              : formato === "video"
                ? Boolean(videoId)
                : tarjetas.length >= 2)
          : true;

  return (
    <Sheet open={abierto} onOpenChange={(o) => !o && cerrar()}>
      <SheetContent className="w-full overflow-y-auto pb-28 sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Nueva campaña</SheetTitle>
          <SheetDescription>
            {paso === 1 && "Paso 1 de 4 — qué quieres conseguir"}
            {paso === 2 && "Paso 2 de 4 — a quién se lo enseñamos"}
            {paso === 3 && "Paso 3 de 4 — qué le enseñamos"}
            {paso === 4 && "Paso 4 de 4 — cuándo sale"}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 py-4">
          {/* ─── Paso 1: la campaña ─── */}
          {paso === 1 && (
            <>
              <div className="space-y-1.5">
                <Label>Nombre de la campaña</Label>
                <Input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Terraza de verano"
                />
                <p className="text-xs text-muted-foreground">
                  Es para que la reconozcas tú; no lo ve el cliente.
                </p>
              </div>

              <div className="space-y-2">
                <Label>¿Qué quieres conseguir?</Label>
                <div className="space-y-2">
                  {OBJETIVOS.map((o) => (
                    <button
                      key={o.clave}
                      type="button"
                      onClick={() => setObjetivo(o.clave)}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${
                        objetivo === o.clave ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{o.titulo}</span>
                        {objetivo === o.clave && <Check className="h-4 w-4 text-primary" />}
                      </div>
                      <p className="text-xs text-muted-foreground">{o.ayuda}</p>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ─── Paso 2: el público ─── */}
          {paso === 2 && (
            <>
              <div className="space-y-1.5">
                <Label>Presupuesto al día (€)</Label>
                <NumberInput min={1} value={presupuesto} onValueChange={setPresupuesto} />
                <p className="text-xs text-muted-foreground">
                  Como mucho gastaría {gastoMaximoMes.toLocaleString("es-ES")} € en un mes entero.
                </p>
              </div>

              <div className="space-y-2">
                <Label>¿Dónde quieres que salga?</Label>
                <div className="flex gap-2">
                  {(["facebook", "instagram"] as const).map((p) => {
                    const puesta = plataformas.includes(p);
                    const bloqueada = p === "instagram" && !hayInstagram;
                    return (
                      <button
                        key={p}
                        type="button"
                        disabled={bloqueada}
                        onClick={() =>
                          setPlataformas((prev) =>
                            prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
                          )
                        }
                        className={`flex-1 rounded-lg border p-3 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                          puesta ? "border-primary bg-primary/5 font-medium" : "hover:bg-muted/40"
                        }`}
                      >
                        {p === "facebook" ? "Facebook" : "Instagram"}
                      </button>
                    );
                  })}
                </div>
                {!hayInstagram && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Tu página no tiene Instagram profesional vinculado, así que de momento solo puede salir en
                    Facebook. Se vincula desde el Business Manager de Meta.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Edad desde</Label>
                  <NumberInput min={13} max={65} decimales={false} value={edadMin} onValueChange={setEdadMin} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Edad hasta</Label>
                  <NumberInput min={13} max={65} decimales={false} value={edadMax} onValueChange={setEdadMax} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Género</Label>
                  <Select value={genero} onValueChange={(v) => setGenero(v as typeof genero)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="hombres">Hombres</SelectItem>
                      <SelectItem value="mujeres">Mujeres</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <BuscadorCiudades elegidas={ciudades} onCambio={setCiudades} />
              <BuscadorIntereses elegidos={intereses} onCambio={setIntereses} />
            </>
          )}

          {/* ─── Paso 3: el anuncio ─── */}
          {paso === 3 && (
            <>
              <div className="space-y-2">
                <Label>Formato</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(["imagen", "video", "carrusel"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFormato(f)}
                      className={`rounded-lg border p-3 text-sm capitalize transition-colors ${
                        formato === f ? "border-primary bg-primary/5 font-medium" : "hover:bg-muted/40"
                      }`}
                    >
                      {f === "video" ? "Vídeo" : f}
                    </button>
                  ))}
                </div>
              </div>

              {formato === "imagen" && (
                <SubirArchivo
                  etiqueta="Imagen del anuncio"
                  acepta="image/jpeg,image/png,image/webp"
                  ayuda="JPG, PNG o WEBP, hasta 8 MB."
                  subiendo={subiendo}
                  onArchivo={(f) => subirImagen(f, false)}
                  vistaPrevia={imagenUrl}
                />
              )}

              {formato === "video" && (
                <div className="space-y-2">
                  <SubirArchivo
                    etiqueta="Vídeo del anuncio"
                    acepta="video/mp4,video/quicktime"
                    ayuda="MP4 o MOV. Se sube directo, sin pasar por el servidor."
                    subiendo={subiendo}
                    onArchivo={subirVideo}
                    vistaPrevia={null}
                  />
                  {videoEstado && (
                    <p
                      className={`text-xs ${
                        videoEstado === "listo"
                          ? "text-emerald-600"
                          : videoEstado === "error"
                            ? "text-red-600"
                            : "text-muted-foreground"
                      }`}
                    >
                      {videoEstado === "listo"
                        ? "Vídeo listo para publicar."
                        : videoEstado === "error"
                          ? "Meta no ha podido procesar el vídeo."
                          : "Meta está procesando el vídeo. Puedes seguir rellenando mientras."}
                    </p>
                  )}
                </div>
              )}

              {formato === "carrusel" && (
                <div className="space-y-2">
                  <SubirArchivo
                    etiqueta={`Imágenes del carrusel (${tarjetas.length} de 10)`}
                    acepta="image/jpeg,image/png,image/webp"
                    ayuda="Añade entre 2 y 10 imágenes, en el orden en que quieres que se vean."
                    subiendo={subiendo}
                    onArchivo={(f) => subirImagen(f, true)}
                    vistaPrevia={null}
                  />
                  {tarjetas.length > 0 && (
                    <div className="space-y-2">
                      {tarjetas.map((t, i) => (
                        <div key={t.imageHash + i} className="flex items-center gap-2 rounded-lg border p-2">
                          {t.url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={t.url} alt="" className="h-12 w-12 rounded object-cover" />
                          )}
                          <Input
                            value={t.titular}
                            placeholder={`Título de la imagen ${i + 1}`}
                            onChange={(e) =>
                              setTarjetas((prev) =>
                                prev.map((x, j) => (j === i ? { ...x, titular: e.target.value } : x)),
                              )
                            }
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => setTarjetas((prev) => prev.filter((_, j) => j !== i))}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Texto del anuncio</Label>
                <Textarea
                  rows={3}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder="Este verano, cena en nuestra terraza con vistas. Menús desde 25 €."
                />
              </div>

              <div className="space-y-1.5">
                <Label>Título</Label>
                <Input
                  value={titular}
                  onChange={(e) => setTitular(e.target.value)}
                  placeholder="Reserva tu mesa de verano"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Botón</Label>
                  <Select value={boton} onValueChange={setBoton}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BOTONES.map((b) => (
                        <SelectItem key={b.clave} value={b.clave}>{b.texto}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>A dónde lleva</Label>
                  <Input
                    value={enlace}
                    onChange={(e) => setEnlace(e.target.value)}
                    placeholder="https://…"
                  />
                </div>
              </div>
            </>
          )}

          {/* ─── Paso 4: cuándo sale ─── */}
          {paso === 4 && (
            <>
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <p className="font-medium">{nombre}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {OBJETIVOS.find((o) => o.clave === objetivo)?.titulo} · {presupuesto} € al día ·{" "}
                  {plataformas.map((p) => (p === "facebook" ? "Facebook" : "Instagram")).join(" y ")} ·{" "}
                  {formato === "video" ? "vídeo" : formato}
                </p>
                <p className="mt-2 text-xs">
                  De activarse todo el mes, gastaría como mucho{" "}
                  <span className="font-semibold">{gastoMaximoMes.toLocaleString("es-ES")} €</span>.
                </p>
              </div>

              <div className="space-y-2">
                {[
                  { clave: "borrador", titulo: "Dejarla preparada", ayuda: "Se crea en pausa. No gasta nada hasta que la actives." },
                  { clave: "programar", titulo: "Programarla", ayuda: "Arranca sola el día y la hora que digas." },
                  { clave: "ahora", titulo: "Publicar ahora", ayuda: "Empieza a salir y a gastar en cuanto Meta la apruebe." },
                ].map((o) => (
                  <button
                    key={o.clave}
                    type="button"
                    onClick={() => setPublicacion(o.clave as typeof publicacion)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      publicacion === o.clave ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{o.titulo}</span>
                      {publicacion === o.clave && <Check className="h-4 w-4 text-primary" />}
                    </div>
                    <p className="text-xs text-muted-foreground">{o.ayuda}</p>
                  </button>
                ))}
              </div>

              {publicacion === "programar" && (
                <div className="space-y-1.5">
                  <Label>¿Cuándo quieres que arranque?</Label>
                  <Input
                    type="datetime-local"
                    value={programarPara}
                    onChange={(e) => setProgramarPara(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Es la hora del restaurante, no la de tu ordenador.
                  </p>
                </div>
              )}

              {publicacion === "ahora" && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:bg-amber-950/30">
                  <p className="text-xs text-amber-800 dark:text-amber-300/80">
                    Al darle a crear, la campaña empieza a salir y a gastar dinero de tu cuenta de Meta.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Barra de pasos, siempre abajo */}
        <div className="fixed inset-x-0 bottom-0 flex items-center justify-between gap-2 border-t bg-background p-4 sm:max-w-xl">
          <Button
            variant="outline"
            onClick={() => (paso === 1 ? cerrar() : setPaso((p) => p - 1))}
            disabled={guardando}
            className="gap-1.5"
          >
            <ChevronLeft className="h-4 w-4" />
            {paso === 1 ? "Cancelar" : "Atrás"}
          </Button>

          {paso < 4 ? (
            <Button onClick={() => setPaso((p) => p + 1)} disabled={!puedeSeguir} className="gap-1.5">
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={crear} disabled={guardando}>
              {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Piezas auxiliares ──────────────────────────────────────

function SubirArchivo({
  etiqueta,
  acepta,
  ayuda,
  subiendo,
  onArchivo,
  vistaPrevia,
}: {
  etiqueta: string;
  acepta: string;
  ayuda: string;
  subiendo: boolean;
  onArchivo: (f: File) => void;
  vistaPrevia: string | null;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{etiqueta}</Label>
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-sm text-muted-foreground hover:bg-muted/40">
        {subiendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {subiendo ? "Subiendo…" : "Elegir archivo"}
        <input
          type="file"
          accept={acepta}
          className="hidden"
          disabled={subiendo}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onArchivo(f);
            e.target.value = "";
          }}
        />
      </label>
      {vistaPrevia && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={vistaPrevia} alt="" className="max-h-40 rounded-lg object-contain" />
      )}
      <p className="text-xs text-muted-foreground">{ayuda}</p>
    </div>
  );
}

function BuscadorCiudades({
  elegidas,
  onCambio,
}: {
  elegidas: UbicacionMeta[];
  onCambio: (v: UbicacionMeta[]) => void;
}) {
  const [texto, setTexto] = useState("");
  const [opciones, setOpciones] = useState<UbicacionMeta[]>([]);
  const [buscando, setBuscando] = useState(false);

  const buscar = async (q: string) => {
    setTexto(q);
    if (q.trim().length < 2) {
      setOpciones([]);
      return;
    }
    setBuscando(true);
    const res = await buscarCiudadesMetaAction(q);
    setBuscando(false);
    if (res.ok) setOpciones(res.data.filter((o) => !elegidas.some((e) => e.clave === o.clave)));
  };

  return (
    <div className="space-y-1.5">
      <Label>Ciudades</Label>
      <Input
        value={texto}
        onChange={(e) => buscar(e.target.value)}
        placeholder="Escribe una ciudad: Madrid, Valencia…"
      />
      {buscando && <p className="text-xs text-muted-foreground">Buscando…</p>}
      {opciones.length > 0 && (
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border p-1">
          {opciones.map((o) => (
            <button
              key={o.clave}
              type="button"
              className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
              onClick={() => {
                onCambio([...elegidas, o]);
                setTexto("");
                setOpciones([]);
              }}
            >
              {o.nombre} <span className="text-xs text-muted-foreground">{o.detalle}</span>
            </button>
          ))}
        </div>
      )}
      {elegidas.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {elegidas.map((c) => (
            <Badge key={c.clave} variant="secondary" className="gap-1">
              {c.nombre}
              <button type="button" onClick={() => onCambio(elegidas.filter((x) => x.clave !== c.clave))}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      {elegidas.length === 0 && (
        <p className="text-xs text-muted-foreground">Si no eliges ninguna, se anuncia en toda España.</p>
      )}
    </div>
  );
}

function BuscadorIntereses({
  elegidos,
  onCambio,
}: {
  elegidos: InteresMeta[];
  onCambio: (v: InteresMeta[]) => void;
}) {
  const [texto, setTexto] = useState("");
  const [opciones, setOpciones] = useState<InteresMeta[]>([]);

  const buscar = async (q: string) => {
    setTexto(q);
    if (q.trim().length < 2) {
      setOpciones([]);
      return;
    }
    const res = await buscarInteresesMetaAction(q);
    if (res.ok) setOpciones(res.data.filter((o) => !elegidos.some((e) => e.id === o.id)));
  };

  return (
    <div className="space-y-1.5">
      <Label>Intereses (opcional)</Label>
      <Input
        value={texto}
        onChange={(e) => buscar(e.target.value)}
        placeholder="Restaurantes, gastronomía, vinos…"
      />
      {opciones.length > 0 && (
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border p-1">
          {opciones.map((o) => (
            <button
              key={o.id}
              type="button"
              className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
              onClick={() => {
                onCambio([...elegidos, o]);
                setTexto("");
                setOpciones([]);
              }}
            >
              {o.name}
              {o.audiencia != null && (
                <span className="text-xs text-muted-foreground">
                  {" "}
                  · {o.audiencia.toLocaleString("es-ES")} personas
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      {elegidos.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {elegidos.map((i) => (
            <Badge key={i.id} variant="secondary" className="gap-1">
              {i.name}
              <button type="button" onClick={() => onCambio(elegidos.filter((x) => x.id !== i.id))}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
