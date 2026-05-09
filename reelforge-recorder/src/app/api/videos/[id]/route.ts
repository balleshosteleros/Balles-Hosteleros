import { NextResponse } from "next/server";
import { auth } from "@/shared/lib/auth";
import { db } from "@/shared/lib/db";
import { videos } from "@/shared/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;

    const [video] = await db
      .select()
      .from(videos)
      .where(and(eq(videos.id, id), eq(videos.userId, session.user.id)))
      .limit(1);

    if (!video) {
      return NextResponse.json({ error: "Video no encontrado" }, { status: 404 });
    }

    return NextResponse.json(video);
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
