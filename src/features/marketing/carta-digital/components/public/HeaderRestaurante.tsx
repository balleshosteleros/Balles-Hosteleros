import type { CartaEmpresaPublica } from "../../types";

export function HeaderRestaurante({ empresa }: { empresa: CartaEmpresaPublica }) {
  return (
    <header className="mb-6 text-center">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{empresa.nombre}</h1>
      {empresa.carta_descripcion ? (
        <p className="mt-2 text-base text-stone-600">{empresa.carta_descripcion}</p>
      ) : null}
    </header>
  );
}
