import { redirect } from "next/navigation";

// "Más" se fusionó dentro de Inicio.
export default function MasPage() {
  redirect("/m");
}
