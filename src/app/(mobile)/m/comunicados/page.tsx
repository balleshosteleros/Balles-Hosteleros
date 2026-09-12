import { MobilePageHeader } from "@/features/mi-panel/mobile/components/MobilePageHeader";
import { MisComunicadosMobile } from "@/features/mi-panel/mobile/components/MisComunicadosMobile";
import { BannerAltaMedica } from "@/features/mi-panel/components/BannerAltaMedica";

export const dynamic = "force-dynamic";

export default function MobileComunicadosPage() {
  return (
    <>
      <MobilePageHeader title="Comunicados" />
      <div className="px-4 py-4">
        {/* Quien está de baja llega aquí desde el aviso del fichaje: el botón de
            comunicar el alta tiene que estar donde le mandamos. */}
        <BannerAltaMedica />
        <MisComunicadosMobile />
      </div>
    </>
  );
}
