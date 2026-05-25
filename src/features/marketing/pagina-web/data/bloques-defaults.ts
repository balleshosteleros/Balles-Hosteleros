/**
 * Valores iniciales al insertar un bloque vacío desde la biblioteca.
 */
import type { Bloque, BloqueTipo } from "../types";

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function crearBloqueDefault(tipo: BloqueTipo, orden: number): Bloque {
  const base = { id: uuid(), orden, visible: true };

  switch (tipo) {
    case "hero":
      return {
        ...base,
        tipo,
        datos: {
          titulo: "Título principal",
          subtitulo: "Subtítulo corto",
          cta: { label: "Reservar", href: "#reservas" },
          overlay: 0.4,
        },
      };
    case "galeria":
      return { ...base, tipo, datos: { imagenes: [], layout: "grid" } };
    case "menu":
      return { ...base, tipo, datos: { fuente: "carta_items" } };
    case "reservas":
      return {
        ...base,
        tipo,
        datos: { modo: "formulario_propio", campos: ["nombre", "email", "telefono", "personas", "fecha"] },
      };
    case "testimonios":
      return { ...base, tipo, datos: { items: [] } };
    case "cta":
      return {
        ...base,
        tipo,
        datos: {
          titulo: "¿Listo para reservar?",
          texto: "Te esperamos en el restaurante.",
          boton: { label: "Reservar ahora", href: "#reservas", variante: "primary" },
        },
      };
    case "formulario":
      return {
        ...base,
        tipo,
        datos: {
          titulo: "Contacta con nosotros",
          mensaje_exito: "¡Gracias! Te responderemos pronto.",
          campos: [
            { name: "nombre", label: "Nombre", tipo: "text", required: true },
            { name: "email", label: "Email", tipo: "email", required: true },
            { name: "mensaje", label: "Mensaje", tipo: "textarea", required: false },
          ],
        },
      };
    case "mapa":
      return {
        ...base,
        tipo,
        datos: { lat: 40.4168, lng: -3.7038, zoom: 15, direccion_texto: "Dirección del restaurante" },
      };
    case "footer":
      return {
        ...base,
        tipo,
        datos: {
          columnas: [
            {
              titulo: "Navegación",
              items: [
                { label: "Inicio", href: "#" },
                { label: "Carta", href: "#menu" },
                { label: "Reservas", href: "#reservas" },
              ],
            },
          ],
          redes: [],
          texto_legal: "© Balles Hosteleros. Todos los derechos reservados.",
        },
      };
    case "texto_libre":
      return { ...base, tipo, datos: { html_seguro: "<p>Escribe aquí tu contenido…</p>" } };
    case "video":
      return {
        ...base,
        tipo,
        datos: { proveedor: "youtube", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", autoplay: false, muted: true },
      };
    case "bolsa_inspectores":
      return {
        ...base,
        tipo,
        datos: {
          titulo: "Únete a nuestra bolsa de inspectores",
          descripcion:
            "Colabora con inspecciones puntuales en nuestros locales.",
          cta_label: "Apuntarme a la bolsa",
        },
      };
  }
}
