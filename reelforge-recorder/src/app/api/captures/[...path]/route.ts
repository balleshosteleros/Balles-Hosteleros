import { NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";

const CAPTURES_DIR = path.join(process.cwd(), "captures");

// Tipos MIME soportados
const MIME_TYPES: Record<string, string> = {
  ".webm": "video/webm",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".html": "text/html",
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: segments } = await params;

    // Validar que solo accedemos dentro de captures/
    const relativePath = segments.join("/");
    if (relativePath.includes("..") || relativePath.includes("~")) {
      return NextResponse.json({ error: "Ruta inválida" }, { status: 400 });
    }

    const filePath = path.join(CAPTURES_DIR, relativePath);

    // Verificar que el archivo existe
    await stat(filePath);

    const buffer = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(buffer.length),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
  }
}
