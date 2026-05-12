import { NextResponse } from "next/server";
import { auth } from "@/shared/lib/auth";
import { db } from "@/shared/lib/db";
import { videos } from "@/shared/lib/db/schema";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";

// Directorio de capturas — relativo a la raíz del proyecto
const CAPTURES_DIR = path.join(process.cwd(), "captures");
const RECORDINGS_DIR = path.join(CAPTURES_DIR, "recordings");

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title = (formData.get("title") as string) || "Grabación sin título";
    const duration = parseInt(formData.get("duration") as string) || 0;
    const mimeType = (formData.get("mimeType") as string) || "video/webm";

    if (!file) {
      return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
    }

    // Crear directorio captures/recordings si no existe
    await mkdir(RECORDINGS_DIR, { recursive: true });

    // Generar nombre de archivo único
    const fileId = nanoid();
    const ext = mimeType.includes("mp4") ? "mp4" : "webm";
    const fileName = `${fileId}.${ext}`;
    const filePath = path.join(RECORDINGS_DIR, fileName);

    // Guardar archivo en captures/recordings/
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const fileSize = buffer.length;
    // URL para servir el archivo vía API
    const videoUrl = `/api/captures/recordings/${fileName}`;

    const { withNeonRetry } = await import("@/shared/lib/db");

    // Guardar registro en DB con reintentos — id UUID generado por PostgreSQL
    const [newVideo] = await withNeonRetry(() => 
      db
        .insert(videos)
        .values({
          userId: session.user.id,
          type: "recording",
          title,
          templateId: "none",
          status: "completed",
          videoUrl,
          filePath: `captures/recordings/${fileName}`,
          fileSize,
          duration,
          isPublic: false,
          shareToken: nanoid(12),
          metadata: { mimeType, quality: "recorded", originalSize: fileSize },
        })
        .returning()
    );

    return NextResponse.json(
      {
        videoId: newVideo.id,
        url: videoUrl,
        duration,
        fileSize,
      },
      { status: 201 }
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("Error saving recording:", errorMessage);
    return NextResponse.json(
      { error: "Error al guardar la grabación", details: errorMessage },
      { status: 500 }
    );
  }
}
