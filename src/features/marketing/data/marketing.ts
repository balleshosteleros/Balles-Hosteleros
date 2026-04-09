export type RedSocial = "facebook" | "instagram" | "tiktok" | "youtube";
export type EstadoPublicacion = "borrador" | "programada" | "publicada" | "fallida" | "cancelada";
export type TipoContenido = "imagen" | "video" | "carrusel" | "story" | "reel" | "short" | "live" | "texto" | "enlace";
export type TipoEvento = "publicidad" | "inicio_campaña" | "fin_campaña" | "directo" | "grabacion" | "sesion_fotos" | "reunion" | "lanzamiento" | "promocion";

export const REDES_SOCIALES: { id: RedSocial; label: string; color: string; icon: string }[] = [
  { id: "facebook", label: "Facebook", color: "hsl(220 70% 50%)", icon: "F" },
  { id: "instagram", label: "Instagram", color: "hsl(330 70% 55%)", icon: "I" },
  { id: "tiktok", label: "TikTok", color: "hsl(0 0% 10%)", icon: "T" },
  { id: "youtube", label: "YouTube", color: "hsl(0 80% 50%)", icon: "Y" },
];

export const TIPOS_CONTENIDO: { value: TipoContenido; label: string }[] = [
  { value: "imagen", label: "Imagen" },
  { value: "video", label: "Vídeo" },
  { value: "carrusel", label: "Carrusel" },
  { value: "story", label: "Story" },
  { value: "reel", label: "Reel" },
  { value: "short", label: "Short" },
  { value: "live", label: "Directo" },
  { value: "texto", label: "Texto" },
  { value: "enlace", label: "Enlace" },
];

export const ESTADOS_PUBLICACION: { value: EstadoPublicacion; label: string }[] = [
  { value: "borrador", label: "Borrador" },
  { value: "programada", label: "Programada" },
  { value: "publicada", label: "Publicada" },
  { value: "fallida", label: "Fallida" },
  { value: "cancelada", label: "Cancelada" },
];

export const TIPOS_EVENTO: { value: TipoEvento; label: string }[] = [
  { value: "publicidad", label: "Publicidad activa" },
  { value: "inicio_campaña", label: "Inicio de campaña" },
  { value: "fin_campaña", label: "Fin de campaña" },
  { value: "directo", label: "Directo / Live" },
  { value: "grabacion", label: "Grabación de contenido" },
  { value: "sesion_fotos", label: "Sesión de fotos" },
  { value: "reunion", label: "Reunión de marketing" },
  { value: "lanzamiento", label: "Lanzamiento" },
  { value: "promocion", label: "Promoción especial" },
];

export interface Comentario {
  id: string;
  autor: string;
  texto: string;
  fecha: string;
}

export interface Publicacion {
  id: string;
  tipo: "publicacion";
  redSocial: RedSocial;
  empresaId: string;
  cuentaConectada: string;
  tipoContenido: TipoContenido;
  titulo: string;
  texto: string;
  descripcion: string;
  fecha: string;
  hora: string;
  imagenUrl: string;
  enlace: string;
  hashtags: string;
  responsable: string;
  estado: EstadoPublicacion;
  campaña: string;
  comentarios: Comentario[];
  // YouTube specific
  miniatura: string;
  etiquetas: string;
}

export interface EventoMarketing {
  id: string;
  tipo: "evento";
  tipoEvento: TipoEvento;
  redSocialRelacionada: RedSocial | "";
  empresaId: string;
  titulo: string;
  fecha: string;
  hora: string;
  descripcion: string;
  responsable: string;
  estado: EstadoPublicacion;
  campaña: string;
  comentarios: Comentario[];
}

export type ItemCalendario = Publicacion | EventoMarketing;

export interface CuentaConectada {
  id: string;
  redSocial: RedSocial;
  empresaId: string;
  nombreCuenta: string;
  conectada: boolean;
  ultimaSincronizacion: string;
}

export function buildSamplePublicaciones(empresaId: string): ItemCalendario[] {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  return [
    {
      id: `${empresaId}-pub-1`, tipo: "publicacion", redSocial: "instagram", empresaId,
      cuentaConectada: "@restaurante", tipoContenido: "imagen", titulo: "Nuevo plato del día",
      texto: "¡Descubre nuestro nuevo plato estrella! 🌟", descripcion: "Post para promocionar el menú del día",
      fecha: `${y}-${String(m + 1).padStart(2, "0")}-10`, hora: "12:00", imagenUrl: "", enlace: "",
      hashtags: "#gastronomia #restaurante #foodie", responsable: "María López",
      estado: "programada", campaña: "Menú semanal", comentarios: [], miniatura: "", etiquetas: "",
    },
    {
      id: `${empresaId}-pub-2`, tipo: "publicacion", redSocial: "facebook", empresaId,
      cuentaConectada: "Restaurante", tipoContenido: "enlace", titulo: "Reserva tu mesa",
      texto: "Haz tu reserva online y disfruta de nuestra carta.", descripcion: "Campaña de reservas",
      fecha: `${y}-${String(m + 1).padStart(2, "0")}-15`, hora: "18:00", imagenUrl: "", enlace: "https://ejemplo.com/reservas",
      hashtags: "#reservas", responsable: "Admin", estado: "borrador", campaña: "Reservas online",
      comentarios: [{ id: "c1", autor: "María", texto: "Pendiente aprobar copy", fecha: `${y}-${String(m + 1).padStart(2, "0")}-08 10:00` }],
      miniatura: "", etiquetas: "",
    },
    {
      id: `${empresaId}-pub-3`, tipo: "publicacion", redSocial: "tiktok", empresaId,
      cuentaConectada: "@restaurante_tk", tipoContenido: "video", titulo: "Behind the scenes cocina",
      texto: "Un día en nuestra cocina 🔥", descripcion: "Video making-of de la cocina",
      fecha: `${y}-${String(m + 1).padStart(2, "0")}-20`, hora: "19:00", imagenUrl: "", enlace: "",
      hashtags: "#cocina #behindthescenes #tiktok", responsable: "Carlos",
      estado: "programada", campaña: "", comentarios: [], miniatura: "", etiquetas: "",
    },
    {
      id: `${empresaId}-pub-4`, tipo: "publicacion", redSocial: "youtube", empresaId,
      cuentaConectada: "Canal Restaurante", tipoContenido: "video", titulo: "Tour completo del restaurante",
      texto: "", descripcion: "Vídeo de presentación del local con entrevistas al chef y al equipo",
      fecha: `${y}-${String(m + 1).padStart(2, "0")}-25`, hora: "10:00", imagenUrl: "", enlace: "",
      hashtags: "", responsable: "Admin", estado: "borrador", campaña: "Branding",
      comentarios: [], miniatura: "", etiquetas: "restaurante, tour, gastronomia",
    },
    {
      id: `${empresaId}-evt-1`, tipo: "evento", tipoEvento: "sesion_fotos", redSocialRelacionada: "instagram",
      empresaId, titulo: "Sesión de fotos nueva carta", fecha: `${y}-${String(m + 1).padStart(2, "0")}-08`,
      hora: "09:00", descripcion: "Fotografiar los 10 nuevos platos de temporada", responsable: "María López",
      estado: "programada", campaña: "Nueva carta", comentarios: [],
    },
    {
      id: `${empresaId}-evt-2`, tipo: "evento", tipoEvento: "directo", redSocialRelacionada: "instagram",
      empresaId, titulo: "Directo con el chef", fecha: `${y}-${String(m + 1).padStart(2, "0")}-18`,
      hora: "20:00", descripcion: "Live cooking session con el chef principal", responsable: "Carlos",
      estado: "programada", campaña: "", comentarios: [],
    },
  ];
}

export function buildSampleCuentas(empresaId: string): CuentaConectada[] {
  return [
    { id: `${empresaId}-fb`, redSocial: "facebook", empresaId, nombreCuenta: "", conectada: false, ultimaSincronizacion: "" },
    { id: `${empresaId}-ig`, redSocial: "instagram", empresaId, nombreCuenta: "", conectada: false, ultimaSincronizacion: "" },
    { id: `${empresaId}-tk`, redSocial: "tiktok", empresaId, nombreCuenta: "", conectada: false, ultimaSincronizacion: "" },
    { id: `${empresaId}-yt`, redSocial: "youtube", empresaId, nombreCuenta: "", conectada: false, ultimaSincronizacion: "" },
  ];
}
