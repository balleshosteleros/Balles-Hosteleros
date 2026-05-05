"use client";

import { useState } from "react";
import { Camera } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/contexts/auth-context";
import { AvatarPickerDialog } from "@/features/auth/components/AvatarPickerDialog";
import { DatosPersonalesForm } from "./DatosPersonalesForm";
import type { DatosPersonalesCompletos } from "@/features/mi-panel/actions/datos-personales-actions";

interface Props {
  initial: DatosPersonalesCompletos;
}

export function DatosPersonalesView({ initial }: Props) {
  const { profile, user } = useAuth();
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);

  const userEmail = profile?.email ?? user?.email ?? initial.email ?? "";
  const userInitial = userEmail ? userEmail[0].toUpperCase() : "?";
  const nombreCompleto = profile?.nombre
    ? profile.apellidos
      ? `${profile.nombre} ${profile.apellidos}`
      : profile.nombre
    : (userEmail.split("@")[0] || "—");

  const realUrl = profile?.avatar_url ?? null;

  return (
    <>
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Datos personales
          </h1>
          <p className="text-sm text-muted-foreground">
            Tu ficha personal completa. Estos datos los usa RRHH para contratos,
            nóminas y emergencias.
          </p>
        </div>

        <section className="rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="text-sm font-bold tracking-wide uppercase text-muted-foreground mb-4">
            Foto de perfil
          </h2>

          <div className="flex flex-col items-center gap-3 rounded-xl border bg-muted/20 p-5 max-w-sm mx-auto">
            <Avatar className="h-32 w-32 ring-2 ring-border shadow">
              {realUrl ? (
                <AvatarImage src={realUrl} alt={nombreCompleto} />
              ) : null}
              <AvatarFallback className="text-3xl font-bold bg-primary text-primary-foreground">
                {userInitial}
              </AvatarFallback>
            </Avatar>
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
        </section>

        <DatosPersonalesForm initial={initial} />
      </div>

      <AvatarPickerDialog
        open={avatarDialogOpen}
        onOpenChange={setAvatarDialogOpen}
      />
    </>
  );
}
