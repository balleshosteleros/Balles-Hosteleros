import { ClientClock } from "./ClientClock";

interface Props {
  saludo: string;
  nombre: string;
}

export function HomeHeader({ saludo, nombre }: Props) {
  return (
    <header className="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),12px)] pb-3">
      <div>
        <p className="text-sm text-muted-foreground">{saludo}</p>
        <p className="text-xl font-semibold leading-tight">{nombre}</p>
      </div>
      <ClientClock />
    </header>
  );
}
