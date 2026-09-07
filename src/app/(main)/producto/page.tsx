import { redirect } from "next/navigation";

// El módulo PRODUCTO no tiene portada propia: entra directo en CLIENTES, que es
// su submódulo principal.
export default function ProductoPage() {
  redirect("/producto/clientes");
}
