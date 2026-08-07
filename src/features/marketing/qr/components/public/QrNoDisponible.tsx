import { QrCode } from "lucide-react";

/**
 * Lo que ve un CLIENTE cuando escanea un QR que no lleva a ningún sitio.
 *
 * La ve alguien real, sentado en la mesa, con el móvil en la mano. Por eso no dice
 * "404" ni "código no encontrado": dice qué hacer ahora (pedir la carta al
 * camarero). Un error técnico aquí solo consigue que el cliente piense que el
 * restaurante funciona mal.
 */
export function QrNoDisponible({
  motivo,
  nombre,
}: {
  motivo: "NO_EXISTE" | "INACTIVO";
  nombre?: string;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
          <QrCode className="h-7 w-7 text-gray-400" aria-hidden />
        </div>

        <h1 className="text-lg font-semibold text-gray-900">
          Este código no está disponible
        </h1>

        <p className="mt-2 text-sm text-gray-600">
          {motivo === "INACTIVO"
            ? "El enlace está desactivado en este momento."
            : "No hemos podido encontrar a dónde lleva este código."}
        </p>

        <p className="mt-4 text-sm text-gray-500">
          Pregunta al personal y te atendemos enseguida.
        </p>

        {nombre ? (
          <p className="mt-6 text-xs text-gray-400">{nombre}</p>
        ) : null}
      </div>
    </main>
  );
}
