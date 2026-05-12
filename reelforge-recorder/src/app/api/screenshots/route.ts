import { NextResponse } from "next/server";
import { auth } from "@/shared/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";

const SCREENSHOTS_DIR = path.join(process.cwd(), "captures", "screenshots");

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("screenshot") as File | null;
    const label = (formData.get("label") as string) || "";

    if (!file) {
      return NextResponse.json({ error: "Imagen requerida" }, { status: 400 });
    }

    await mkdir(SCREENSHOTS_DIR, { recursive: true });

    const id = nanoid();
    const ext = file.type.includes("png") ? "png" : "jpg";
    const fileName = `${id}.${ext}`;
    const filePath = path.join(SCREENSHOTS_DIR, fileName);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    return NextResponse.json({
      id,
      url: `/api/captures/screenshots/${fileName}`,
      filePath: `captures/screenshots/${fileName}`,
      label,
      size: buffer.length,
    });
  } catch {
    return NextResponse.json({ error: "Error al guardar screenshot" }, { status: 500 });
  }
}
