import { NextResponse } from "next/server";
import { auth } from "@/shared/lib/auth";
import { db } from "@/shared/lib/db";
import { videos, users } from "@/shared/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getTemplate } from "@/features/templates/data/templates";
import { generateVideoHtml } from "@/shared/lib/ai/generate-html";

const createVideoSchema = z.object({
  title: z.string().min(1).max(200),
  templateId: z.string(),
  variables: z.record(z.string()),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    if (user.rendersUsed >= user.rendersLimit) {
      return NextResponse.json(
        { error: "Límite de renders alcanzado. Actualiza tu plan para continuar." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = createVideoSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos: " + parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { title, templateId, variables } = parsed.data;

    const template = getTemplate(templateId);
    if (!template) {
      return NextResponse.json({ error: "Template no encontrado" }, { status: 404 });
    }

    // Generate HTML with AI or use template base
    const htmlContent = await generateVideoHtml(template, variables);

    // Create video record
    const [newVideo] = await db
      .insert(videos)
      .values({
        userId: session.user.id,
        title,
        templateId,
        prompt: JSON.stringify(variables),
        status: "pending",
        htmlContent,
        duration: template.duration,
        metadata: { variables, templateName: template.name },
      })
      .returning();

    // Update renders count
    await db
      .update(users)
      .set({ rendersUsed: user.rendersUsed + 1 })
      .where(eq(users.id, session.user.id));

    // In production: enqueue render job here
    // For MVP: simulate async render after short delay
    simulateRender(newVideo.id, htmlContent, template.duration);

    return NextResponse.json({ videoId: newVideo.id }, { status: 201 });
  } catch (err) {
    console.error("Error creating video:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

async function simulateRender(videoId: string, _htmlContent: string, duration: number) {
  const delay = Math.max(5000, duration * 200);

  setTimeout(async () => {
    try {
      await db
        .update(videos)
        .set({ status: "processing" })
        .where(eq(videos.id, videoId));

      setTimeout(async () => {
        await db
          .update(videos)
          .set({
            status: "completed",
            videoUrl: `/api/videos/${videoId}/download`,
            thumbnailUrl: null,
            updatedAt: new Date(),
          })
          .where(eq(videos.id, videoId));
      }, delay);
    } catch (err) {
      console.error("Render simulation error:", err);
      await db
        .update(videos)
        .set({ status: "failed", errorMessage: "Error en el render" })
        .where(eq(videos.id, videoId));
    }
  }, 1000);
}
