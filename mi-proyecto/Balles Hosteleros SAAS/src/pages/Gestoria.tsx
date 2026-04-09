import { Navigate } from "react-router-dom";

export default function Gestoria() {
  const last = sessionStorage.getItem("gestoria_last") || "/gestoria/presentaciones";
  return <Navigate to={last} replace />;
}
