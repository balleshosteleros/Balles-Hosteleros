"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CalendarCheck, Users } from "lucide-react";
import { crearReservaPublicaAction } from "@/features/reservar-publica/actions/crear-reserva-publica";
import { toast } from "sonner";

interface Props {
  empresaSlug: string;
  empresaNombre: string;
  origen: string | null;
}

export function ReservaPublicaForm({ empresaSlug, empresaNombre, origen }: Props) {
  const [nombre, setNombre] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [hora, setHora] = useState("21:00");
  const [personas, setPersonas] = useState(2);
  const [notas, setNotas] = useState("");
  const [enviando, startTransition] = useTransition();
  const [exito, setExito] = useState(false);

  const valido = nombre.trim().length > 0 && telefono.trim().length >= 5 && personas > 0 && fecha && hora;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valido) return;
    startTransition(async () => {
      const r = await crearReservaPublicaAction({
        empresaSlug,
        origen,
        nombre: nombre.trim(),
        apellidos: apellidos.trim() || null,
        telefono: telefono.trim(),
        email: email.trim() || null,
        fecha,
        hora,
        personas,
        notas: notas.trim() || null,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setExito(true);
    });
  }

  if (exito) {
    return (
      <div className="max-w-md mx-auto py-12 px-6 text-center space-y-4">
        <CalendarCheck className="h-16 w-16 mx-auto text-emerald-500" />
        <h1 className="text-2xl font-bold">¡Reserva recibida!</h1>
        <p className="text-muted-foreground">
          Te confirmamos en breve por teléfono. Gracias por reservar en <strong>{empresaNombre}</strong>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="max-w-md mx-auto py-8 px-6 space-y-5">
      <header className="text-center space-y-1 mb-6">
        <h1 className="text-2xl font-bold">{empresaNombre}</h1>
        <p className="text-sm text-muted-foreground">Reserva tu mesa</p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="nombre">Nombre *</Label>
          <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required autoFocus />
        </div>
        <div>
          <Label htmlFor="apellidos">Apellidos</Label>
          <Input id="apellidos" value={apellidos} onChange={(e) => setApellidos(e.target.value)} />
        </div>
      </div>

      <div>
        <Label htmlFor="telefono">Teléfono *</Label>
        <Input id="telefono" type="tel" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} required placeholder="612345678" />
      </div>

      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="fecha">Fecha *</Label>
          <Input id="fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} min={new Date().toISOString().split("T")[0]} required />
        </div>
        <div>
          <Label htmlFor="hora">Hora *</Label>
          <Input id="hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} required />
        </div>
      </div>

      <div>
        <Label htmlFor="personas">Personas *</Label>
        <div className="flex items-center gap-3 mt-1">
          <Button type="button" variant="outline" size="icon" onClick={() => setPersonas((n) => Math.max(1, n - 1))}>-</Button>
          <div className="flex-1 flex items-center justify-center gap-2 text-lg font-semibold">
            <Users className="h-5 w-5 text-muted-foreground" />
            {personas}
          </div>
          <Button type="button" variant="outline" size="icon" onClick={() => setPersonas((n) => Math.min(50, n + 1))}>+</Button>
        </div>
      </div>

      <div>
        <Label htmlFor="notas">Notas (alergias, ocasión...)</Label>
        <Textarea id="notas" value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={!valido || enviando}>
        {enviando ? "Enviando..." : "Reservar mesa"}
      </Button>

      {origen && (
        <p className="text-[10px] text-center text-muted-foreground">
          Origen: <code>{origen}</code>
        </p>
      )}
    </form>
  );
}
