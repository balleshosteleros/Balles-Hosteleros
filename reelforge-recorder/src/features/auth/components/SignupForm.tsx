"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Loader2 } from "lucide-react";

export function SignupForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const body = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      password: formData.get("password") as string,
    };

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Error al crear la cuenta");
      setLoading(false);
      return;
    }

    router.push("/login?registered=1");
  }

  return (
    <div className="space-y-6">
      <div className="text-center lg:text-left">
        <h1 className="text-3xl font-bold">Crea tu cuenta gratis</h1>
        <p className="text-muted-foreground mt-2">
          3 videos gratuitos por mes, sin tarjeta de crédito
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nombre</Label>
          <Input
            id="name"
            name="name"
            type="text"
            placeholder="Tu nombre"
            required
            autoComplete="name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="tu@empresa.com"
            required
            autoComplete="email"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="Mínimo 6 caracteres"
            required
            autoComplete="new-password"
            minLength={6}
          />
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive text-sm px-3 py-2 rounded-md">
            {error}
          </div>
        )}

        <Button type="submit" className="w-full" variant="gradient" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creando cuenta...
            </>
          ) : (
            "Crear cuenta gratis"
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Al registrarte aceptas nuestros{" "}
          <Link href="/terms" className="underline">Términos</Link> y{" "}
          <Link href="/privacy" className="underline">Política de privacidad</Link>
        </p>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="text-primary font-medium hover:underline">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
