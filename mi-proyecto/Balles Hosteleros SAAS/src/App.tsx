import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EmpresaProvider } from "@/contexts/EmpresaContext";
import { AyudaProvider } from "@/contexts/AyudaContext";
import { MarketingProvider } from "@/contexts/MarketingContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Gerencia from "./pages/Gerencia";
import GerenciaDescuentos from "./pages/GerenciaDescuentos";
import GerenciaRatios from "./pages/GerenciaRatios";
import GerenciaVencimientos from "./pages/GerenciaVencimientos";
import DireccionEstructura from "./pages/DireccionEstructura";
import DireccionDocumentacion from "./pages/DireccionDocumentacion";
import DireccionAperturas from "./pages/DireccionAperturas";
import Contabilidad from "./pages/Contabilidad";
import ContabilidadContactos from "./pages/ContabilidadContactos";
import ContabilidadOperaciones from "./pages/ContabilidadOperaciones";
import ContabilidadFacturas from "./pages/ContabilidadFacturas";
import ContabilidadImpuestos from "./pages/ContabilidadImpuestos";
import ContabilidadTransacciones from "./pages/ContabilidadTransacciones";
import ContabilidadConciliacion from "./pages/ContabilidadConciliacion";
import ContabilidadCalendario from "./pages/ContabilidadCalendario";
import ContabilidadEscenarios from "./pages/ContabilidadEscenarios";
import ContabilidadBancos from "./pages/ContabilidadBancos";
import ContabilidadEtiquetas from "./pages/ContabilidadEtiquetas";
import ContabilidadReglas from "./pages/ContabilidadReglas";
import Gestoria from "./pages/Gestoria";
import GestoriaPresentaciones from "./pages/GestoriaPresentaciones";
import Juridico from "./pages/Juridico";
import JuridicoProcesos from "./pages/JuridicoProcesos";
import RRHH from "./pages/RRHH";
import RRHHEmpleados from "./pages/RRHHEmpleados";
import RRHHReclutamiento from "./pages/RRHHReclutamiento";
import RRHHBoarding from "./pages/RRHHBoarding";
import RRHHEncuestas from "./pages/RRHHEncuestas";
import RRHHBonus from "./pages/RRHHBonus";
import RRHHSalarios from "./pages/RRHHSalarios";
import RRHHComunicados from "./pages/RRHHComunicados";
import RRHHPagos from "./pages/RRHHPagos";
import RRHHFichajes from "./pages/RRHHFichajes";
import RRHHCalendarios from "./pages/RRHHCalendarios";
import RRHHHorarios from "./pages/RRHHHorarios";
import FichaEmpleadoPage from "./pages/FichaEmpleadoPage";
import Marketing from "./pages/Marketing";
import MarketingCalendario from "./pages/MarketingCalendario";
import MarketingContenido from "./pages/MarketingContenido";
import FichasTecnicas from "./pages/FichasTecnicas";
import Partidas from "./pages/Partidas";
import Mantenimiento from "./pages/Mantenimiento";
import LogisticaProductos from "./pages/LogisticaProductos";
import LogisticaPedidos from "./pages/LogisticaPedidos";
import LogisticaStock from "./pages/LogisticaStock";
import LogisticaInventarios from "./pages/LogisticaInventarios";
import LogisticaElaboraciones from "./pages/LogisticaElaboraciones";
import LogisticaProveedores from "./pages/LogisticaProveedores";
import SalaReservas from "./pages/SalaReservas";
import SalaClientes from "./pages/SalaClientes";
import SalaTemperaturas from "./pages/SalaTemperaturas";
import CocinaTemperaturas from "./pages/CocinaTemperaturas";
import RRHHFormacion from "./pages/RRHHFormacion";
import PortalFormativo from "./pages/PortalFormativo";
import Accesos from "./pages/Accesos";
import Ajustes from "./pages/Ajustes";
import Ayuda from "./pages/Ayuda";
import ConsultasPendientes from "./pages/ConsultasPendientes";
import PortalEmpleoPublico from "./pages/PortalEmpleoPublico";
import FichaPublica from "./pages/FichaPublica";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <EmpresaProvider>
            <AyudaProvider>
              <MarketingProvider>
                <Routes>
                  {/* Public routes */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/portal-empleo/:empresaId" element={<PortalEmpleoPublico />} />
                  <Route path="/portal-formativo/:empresaId" element={<PortalFormativo />} />
                  <Route path="/ficha-publica/:token" element={<FichaPublica />} />
                  
                  {/* Protected app routes */}
                  <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                    <Route path="/" element={<Navigate to="/direccion/estructura" replace />} />
                    <Route path="/direccion/estructura" element={<DireccionEstructura />} />
                    <Route path="/direccion/documentacion" element={<DireccionDocumentacion />} />
                    <Route path="/direccion/aperturas" element={<DireccionAperturas />} />
                    <Route path="/gerencia" element={<Gerencia />} />
                    <Route path="/contabilidad" element={<Contabilidad />} />
                    <Route path="/contabilidad/contactos" element={<ContabilidadContactos />} />
                    <Route path="/contabilidad/operaciones" element={<ContabilidadOperaciones />} />
                    <Route path="/contabilidad/facturas" element={<ContabilidadFacturas />} />
                    <Route path="/contabilidad/impuestos" element={<ContabilidadImpuestos />} />
                    <Route path="/contabilidad/transacciones" element={<ContabilidadTransacciones />} />
                    <Route path="/contabilidad/conciliacion" element={<ContabilidadConciliacion />} />
                    <Route path="/contabilidad/calendario" element={<ContabilidadCalendario />} />
                    <Route path="/contabilidad/escenarios" element={<ContabilidadEscenarios />} />
                    <Route path="/contabilidad/bancos" element={<ContabilidadBancos />} />
                    <Route path="/contabilidad/etiquetas" element={<ContabilidadEtiquetas />} />
                    <Route path="/contabilidad/reglas" element={<ContabilidadReglas />} />
                    <Route path="/gestoria" element={<Gestoria />} />
                    <Route path="/gestoria/presentaciones" element={<GestoriaPresentaciones />} />
                    <Route path="/juridico" element={<Juridico />} />
                    <Route path="/juridico/procesos" element={<JuridicoProcesos />} />
                    <Route path="/rrhh" element={<RRHH />} />
                    <Route path="/rrhh/empleados" element={<RRHHEmpleados />} />
                    <Route path="/rrhh/empleados/:id" element={<FichaEmpleadoPage />} />
                    <Route path="/rrhh/reclutamiento" element={<RRHHReclutamiento />} />
                    <Route path="/rrhh/fichajes" element={<RRHHFichajes />} />
                    <Route path="/rrhh/calendarios" element={<RRHHCalendarios />} />
                    <Route path="/rrhh/horarios" element={<RRHHHorarios />} />
                    <Route path="/rrhh/boarding" element={<RRHHBoarding />} />
                    <Route path="/rrhh/bonus" element={<RRHHBonus />} />
                    <Route path="/rrhh/salarios" element={<RRHHSalarios />} />
                    <Route path="/rrhh/pagos" element={<RRHHPagos />} />
                    <Route path="/rrhh/formacion" element={<RRHHFormacion />} />
                    <Route path="/gerencia/encuestas" element={<RRHHEncuestas />} />
                    <Route path="/gerencia/comunicados" element={<RRHHComunicados />} />
                    <Route path="/marketing" element={<Marketing />} />
                    <Route path="/marketing/calendario" element={<MarketingCalendario />} />
                    <Route path="/marketing/contenido" element={<MarketingContenido />} />
                    <Route path="/gerencia/mantenimiento" element={<Mantenimiento />} />
                    <Route path="/gerencia/descuentos" element={<GerenciaDescuentos />} />
                    <Route path="/gerencia/vencimientos" element={<GerenciaVencimientos />} />
                    <Route path="/gerencia/ratios" element={<GerenciaRatios />} />
                    <Route path="/cocina/fichas-tecnicas" element={<FichasTecnicas />} />
                    <Route path="/cocina/partidas" element={<Partidas />} />
                    <Route path="/cocina/elaboraciones" element={<LogisticaElaboraciones />} />
                    <Route path="/logistica/productos" element={<LogisticaProductos />} />
                    <Route path="/logistica/pedidos" element={<LogisticaPedidos />} />
                    <Route path="/logistica/proveedores" element={<LogisticaProveedores />} />
                    <Route path="/logistica/stock" element={<LogisticaStock />} />
                    <Route path="/logistica/inventarios" element={<LogisticaInventarios />} />
                    <Route path="/sala/reservas" element={<SalaReservas />} />
                    <Route path="/sala/clientes" element={<SalaClientes />} />
                    <Route path="/sala/temperaturas" element={<SalaTemperaturas />} />
                    <Route path="/cocina/temperaturas" element={<CocinaTemperaturas />} />
                    <Route path="/accesos" element={<Accesos />} />
                    <Route path="/ajustes" element={<Ajustes />} />
                    <Route path="/ayuda" element={<Ayuda />} />
                    <Route path="/consultas-pendientes" element={<ConsultasPendientes />} />
                  </Route>
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </MarketingProvider>
            </AyudaProvider>
          </EmpresaProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
