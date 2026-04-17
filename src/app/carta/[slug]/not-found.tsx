export default function CartaNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-3xl font-bold">Carta no encontrada</h1>
      <p className="text-stone-600">
        Esta carta no existe o aún no ha sido publicada.
      </p>
    </div>
  );
}
