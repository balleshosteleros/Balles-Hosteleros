import PlaceholderPage from "./PlaceholderPage";
import { Calculator } from "lucide-react";
import { AccesosDirectos } from "@/components/accesos/AccesosDirectos";
export default function Contabilidad() {
  return (
    <div className="space-y-6">
      <PlaceholderPage title="CONTABILIDAD" icon={Calculator} description="Control contable, facturas y balances." />
      <div className="px-4 md:px-6"><AccesosDirectos departamento="Contabilidad" /></div>
    </div>
  );
}
