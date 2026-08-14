/**
 * Layout aislado de la vista previa del editor de páginas web.
 *
 * La preview vivía bajo (main), así que heredaba el layout del software
 * (sidebar, barra de herramientas, avatar) y se veía la app dentro de la
 * propia preview. Una web pública no lleva nada de eso: aquí el iframe
 * renderiza SOLO los bloques, igual que lo verá el cliente final.
 */
export default function PaginaWebPreviewLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-white">{children}</div>;
}
