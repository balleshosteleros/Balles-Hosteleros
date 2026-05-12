import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db, withNeonRetry } from "@/shared/lib/db";
import { users } from "@/shared/lib/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(6).max(100),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos: " + parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { name, email, password } = parsed.data;

    const [existing] = await withNeonRetry(() =>
      db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
    );

    if (existing) {
      return NextResponse.json(
        { error: "Ya existe una cuenta con ese email" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await withNeonRetry(() =>
      db.insert(users).values({
        id: nanoid(),
        name,
        email,
        password: passwordHash,
        plan: "free",
        rendersUsed: 0,
        rendersLimit: 3,
      })
    );

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error("[register] error:", err);
    const message = err instanceof Error ? err.message : "Error interno del servidor";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
