import Link from "next/link";
import Image from "next/image";
import {
  XCircle,
  Clock,
  UserX,
  IdCard,
  TicketX,
} from "lucide-react";
import { getFirmaContext } from "@/features/calidad/inspecciones/actions";
import { fetchEmpresaThemeFromQrToken } from "@/features/calidad/inspecciones/public-data";
import { FirmaForm } from "@/features/calidad/inspecciones/components/FirmaForm";
import type { EmpresaTheme } from "@/features/calidad/inspecciones/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Firmar inspección · Balles Hosteleros",
};

interface Props {
  params: Promise<{ token: string }>;
}

export default async function VerificarInspeccionPage({ params }: Props) {
  const { token } = await params;

  const [result, empresa] = await Promise.all([
    getFirmaContext(token),
    fetchEmpresaThemeFromQrToken(token),
  ]);

  if (result.ok) {
    return <FirmaForm qrToken={token} ctx={result.data} empresa={empresa} />;
  }

  switch (result.motivo) {
    case "ya_verificado":
    case "token_usado":
      return (
        <Shell empresa={empresa} icon={<TicketX className="h-12 w-12" />}>
          <h1 className="text-xl font-bold">QR ya utilizado</h1>
          <p className="text-sm text-muted-foreground">
            Este código ya se usó para firmar
            {result.envio?.numero_secuencial
              ? ` la inspección #${result.envio.numero_secuencial}`
              : " una inspección anterior"}
            {result.envio?.verificado_por_nombre
              ? ` (firmada por ${result.envio.verificado_por_nombre})`
              : ""}
            . No es válido para una nueva firma.
          </p>
          <Link
            href="/mi-panel/inspecciones"
            className="inline-flex items-center justify-center rounded-md border px-5 py-2.5 text-sm font-medium hover:bg-muted/50"
          >
            Ver en Mi Panel
          </Link>
        </Shell>
      );
    case "token_caducado":
      return (
        <Shell empresa={empresa} icon={<Clock className="h-12 w-12" />}>
          <h1 className="text-xl font-bold">QR caducado</h1>
          <p className="text-sm text-muted-foreground">
            El código ha caducado (más de 2 horas desde su generación). Pide
            al inspector que pulse <strong>Regenerar QR</strong> en su
            pantalla y vuelve a escanear.
          </p>
        </Shell>
      );
    case "token_revocado":
      return (
        <Shell empresa={empresa} icon={<XCircle className="h-12 w-12" />}>
          <h1 className="text-xl font-bold">Código revocado</h1>
          <p className="text-sm text-muted-foreground">
            El inspector generó un nuevo QR que invalida este. Pídele el QR
            actual.
          </p>
        </Shell>
      );
    case "sin_jefe_sala_asignado":
      return (
        <Shell empresa={empresa} icon={<UserX className="h-12 w-12" />}>
          <h1 className="text-xl font-bold">No se puede firmar</h1>
          <p className="text-sm text-muted-foreground">
            El inspector no marcó qué empleado era el jefe de sala durante
            la visita. Sin ese dato no podemos pedirle que firme.
          </p>
        </Shell>
      );
    case "jefe_sala_sin_dni":
      return (
        <Shell empresa={empresa} icon={<IdCard className="h-12 w-12" />}>
          <h1 className="text-xl font-bold">No se puede firmar todavía</h1>
          <p className="text-sm text-muted-foreground">
            El empleado seleccionado como jefe de sala no tiene su DNI
            registrado todavía. Mientras no se complete su ficha, el QR no
            puede firmarse. Avisa al responsable para regularizarlo.
          </p>
        </Shell>
      );
    case "token_invalido":
    default:
      return (
        <Shell empresa={empresa} icon={<XCircle className="h-12 w-12" />}>
          <h1 className="text-xl font-bold">Código no válido</h1>
          <p className="text-sm text-muted-foreground">
            No hemos podido verificar este QR. Comprueba el enlace o pide al
            inspector que regenere el código.
          </p>
        </Shell>
      );
  }
}

function Shell({
  empresa,
  icon,
  children,
}: {
  empresa: EmpresaTheme | null;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const bg = empresa?.color ?? "hsl(210 50% 20%)";
  const accent =
    empresa?.color_secundario ?? empresa?.color ?? "#10b981";

  return (
    <main
      className="min-h-screen flex items-center justify-center p-6"
      style={{ backgroundColor: bg }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl p-8 text-center space-y-4">
        {empresa?.logo_url && (
          <div className="mx-auto mb-2 flex h-12 items-center justify-center">
            <Image
              src={empresa.logo_url}
              alt={empresa.nombre}
              width={120}
              height={48}
              className="object-contain h-12 w-auto"
            />
          </div>
        )}
        <div
          className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full"
          style={{ backgroundColor: `${accent}22`, color: accent }}
        >
          {icon}
        </div>
        {children}
      </div>
    </main>
  );
}
