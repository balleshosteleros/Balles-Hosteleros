"use client";

import { useState } from "react";
import { Camera, Mail, User as UserIcon, Sparkles, Loader2, RefreshCw, AlertTriangle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/contexts/auth-context";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { AvatarPickerDialog } from "@/features/auth/components/AvatarPickerDialog";
import { generateAiAvatar } from "@/features/auth/actions/avatar-ai-actions";
import { AnimatedAvatar } from "@/features/auth/components/AnimatedAvatar";

export function DatosPersonalesView() {
  const { profile, user, roles } = useAuth();
  const { empresaActual } = useEmpresa();
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const userEmail = profile?.email ?? user?.email ?? "";
  const userInitial = userEmail ? userEmail[0].toUpperCase() : "?";
  const nombreCompleto = profile?.nombre
    ? profile.apellidos
      ? `${profile.nombre} ${profile.apellidos}`
      : profile.nombre
    : (userEmail.split("@")[0] || "—");

  const realUrl = profile?.avatar_url ?? null;
  const aiUrl = profile?.avatar_ai_url ?? null;
  const rolLabel = roles[0]
    ? roles[0].charAt(0).toUpperCase() + roles[0].slice(1)
    : "—";

  async function regenerarConIA() {
    if (!user) return;
    if (!realUrl) {
      setAiError("Primero sube una foto real para que la IA pueda recrearla.");
      return;
    }
    setGeneratingAi(true);
    setAiError(null);
    try {
      const res = await generateAiAvatar(user.id, empresaActual?.id ?? null);
      if (!res.ok) {
        setAiError(res.error ?? "No se pudo generar la versión IA.");
        setGeneratingAi(false);
        return;
      }
      window.location.reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error inesperado.";
      setAiError(msg);
      setGeneratingAi(false);
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          Datos personales
        </h1>
        <p className="text-sm text-muted-foreground">
          Gestiona tu foto de perfil e información básica.
        </p>
      </div>

      {/* Foto de perfil */}
      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <h2 className="text-sm font-bold tracking-wide uppercase text-muted-foreground mb-4">
          Foto de perfil
        </h2>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Foto real */}
          <div className="flex flex-col items-center gap-3 rounded-xl border bg-muted/20 p-5">
            <Avatar className="h-32 w-32 ring-2 ring-border shadow">
              {realUrl ? (
                <AvatarImage src={realUrl} alt={`${nombreCompleto} (foto real)`} />
              ) : null}
              <AvatarFallback className="text-3xl font-bold bg-primary text-primary-foreground">
                {userInitial}
              </AvatarFallback>
            </Avatar>
            <div className="text-center">
              <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
                Foto real
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Tu cara — la base que usa la IA.
              </p>
            </div>
            <Button
              variant="default"
              size="sm"
              className="gap-2 w-full"
              onClick={() => setAvatarDialogOpen(true)}
            >
              <Camera className="h-4 w-4" />
              {realUrl ? "Cambiar foto" : "Añadir foto"}
            </Button>
          </div>

          {/* Foto IA con uniforme */}
          <div className="flex flex-col items-center gap-3 rounded-xl border border-fuchsia-200/60 bg-gradient-to-br from-violet-50 to-fuchsia-50 p-5 dark:from-violet-950/30 dark:to-fuchsia-950/30 dark:border-fuchsia-900/40">
            <AnimatedAvatar
              avatarAiUrl={aiUrl}
              avatarUrl={null}
              fallback={userInitial}
              alt={`${nombreCompleto} (versión IA)`}
              sizeClassName="h-32 w-32"
              hideAiBadge={!aiUrl}
              staticHover
            />
            <div className="text-center">
              <p className="text-[10px] font-bold tracking-widest uppercase text-fuchsia-700 dark:text-fuchsia-300 flex items-center justify-center gap-1">
                <Sparkles className="h-3 w-3" />
                Foto corporativa (IA)
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Tu cara con uniforme de <span className="font-semibold">{rolLabel}</span> y el logo de <span className="font-semibold">{empresaActual.nombre}</span>.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="gap-2 w-full"
              onClick={regenerarConIA}
              disabled={generatingAi || !realUrl}
            >
              {generatingAi ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generando…
                </>
              ) : aiUrl ? (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Regenerar con IA
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generar con IA
                </>
              )}
            </Button>
          </div>
        </div>

        {aiError && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">No se pudo generar la versión IA</p>
              <p className="text-xs opacity-90">{aiError}</p>
            </div>
          </div>
        )}

        {!realUrl && (
          <p className="mt-4 text-xs text-muted-foreground">
            Sube primero una foto real. Cuando la guardes, la IA recreará tu retrato con el uniforme corporativo y el logo de tu empresa automáticamente.
          </p>
        )}
      </section>

      {/* Información básica */}
      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <h2 className="text-sm font-bold tracking-wide uppercase text-muted-foreground mb-4">
          Información
        </h2>

        <dl className="grid gap-4 md:grid-cols-2">
          <div>
            <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <UserIcon className="h-3.5 w-3.5" />
              Nombre
            </dt>
            <dd className="mt-1 text-base font-medium text-foreground">
              {nombreCompleto}
            </dd>
          </div>

          <div>
            <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Mail className="h-3.5 w-3.5" />
              Email
            </dt>
            <dd className="mt-1 text-base font-medium text-foreground break-all">
              {userEmail || "—"}
            </dd>
          </div>
        </dl>
      </section>

      <AvatarPickerDialog
        open={avatarDialogOpen}
        onOpenChange={setAvatarDialogOpen}
      />
    </div>
  );
}
