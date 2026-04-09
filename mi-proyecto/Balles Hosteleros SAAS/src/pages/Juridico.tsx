import { Navigate } from "react-router-dom";

export default function Juridico() {
  const last = sessionStorage.getItem("juridico_last") || "/juridico/procesos";
  return <Navigate to={last} replace />;
}
