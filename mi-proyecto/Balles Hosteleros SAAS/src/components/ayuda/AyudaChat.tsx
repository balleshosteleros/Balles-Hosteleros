import { useState, useMemo } from "react";
import { useAyuda } from "@/contexts/AyudaContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { MensajeChat } from "@/data/ayuda";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, HelpCircle, CheckCircle, XCircle, ShieldAlert } from "lucide-react";

export function AyudaChat() {
  const { articulos, currentUserRol, addConsulta } = useAyuda();
  const { empresaActual } = useEmpresa();
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [input, setInput] = useState("");

  const articulosPermitidos = useMemo(
    () => articulos.filter((a) => a.rolesAutorizados.includes(currentUserRol)),
    [articulos, currentUserRol]
  );

  const buscarRespuesta = (pregunta: string) => {
    const q = pregunta.toLowerCase();
    const encontrado = articulosPermitidos.find((a) => {
      const textoCompleto = `${a.titulo} ${a.respuesta} ${a.etiquetas.join(" ")}`.toLowerCase();
      const palabras = q.split(/\s+/).filter((p) => p.length > 2);
      return palabras.some((p) => textoCompleto.includes(p));
    });

    // Check if there's a match in non-permitted articles (privacy check)
    if (!encontrado) {
      const enOtroRol = articulos.find((a) => {
        if (a.rolesAutorizados.includes(currentUserRol)) return false;
        const textoCompleto = `${a.titulo} ${a.respuesta} ${a.etiquetas.join(" ")}`.toLowerCase();
        const palabras = q.split(/\s+/).filter((p) => p.length > 2);
        return palabras.some((p) => textoCompleto.includes(p));
      });
      if (enOtroRol) {
        return { tipo: "sin_permiso" as const, texto: "Esta ayuda no está disponible para tu perfil. No tienes permisos para consultar esta información." };
      }
    }

    if (encontrado) {
      return { tipo: "encontrado" as const, texto: encontrado.respuesta, articuloId: encontrado.id };
    }

    return { tipo: "no_encontrado" as const, texto: "No he encontrado información relacionada con tu consulta en la base de conocimiento." };
  };

  const enviar = () => {
    if (!input.trim()) return;
    const pregunta = input.trim();
    setInput("");

    const msgUser: MensajeChat = {
      id: `msg-${Date.now()}-u`, tipo: "usuario", texto: pregunta,
      fecha: new Date().toISOString().slice(0, 16).replace("T", " "),
    };

    const resultado = buscarRespuesta(pregunta);

    const msgSistema: MensajeChat = {
      id: `msg-${Date.now()}-s`, tipo: "sistema", texto: resultado.texto,
      articuloId: resultado.tipo === "encontrado" ? resultado.articuloId : undefined,
      fecha: new Date().toISOString().slice(0, 16).replace("T", " "),
      feedbackDado: false,
    };

    setMensajes((prev) => [...prev, msgUser, msgSistema]);
  };

  const darFeedback = (msgId: string, positivo: boolean) => {
    setMensajes((prev) =>
      prev.map((m) => m.id === msgId ? { ...m, feedbackDado: true, feedbackPositivo: positivo } : m)
    );

    if (!positivo) {
      const msg = mensajes.find((m) => m.id === msgId);
      const userMsg = mensajes[mensajes.indexOf(msg!) - 1];
      addConsulta({
        id: `consulta-${Date.now()}`,
        usuario: "Usuario Actual",
        empresaId: empresaActual.id,
        empresaNombre: empresaActual.nombre,
        modulo: "General",
        rolUsuario: currentUserRol,
        pregunta: userMsg?.texto ?? "",
        respuestaMostrada: msg?.texto ?? "",
        fecha: new Date().toISOString().slice(0, 16).replace("T", " "),
        estado: "pendiente",
      });
    }
  };

  return (
    <div className="flex flex-col h-[600px]">
      <div className="flex items-center gap-2 p-4 border-b bg-muted/30">
        <HelpCircle className="h-5 w-5 text-primary" />
        <div>
          <h3 className="font-semibold text-sm text-foreground">Centro de Ayuda</h3>
          <p className="text-xs text-muted-foreground">
            Rol activo: <Badge variant="outline" className="ml-1 text-[10px]">{currentUserRol}</Badge>
          </p>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        {mensajes.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-16 text-muted-foreground">
            <HelpCircle className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">¿En qué podemos ayudarte?</p>
            <p className="text-xs mt-1">Escribe tu consulta y buscaremos en la base de conocimiento.</p>
            <div className="mt-4 flex flex-wrap gap-2 justify-center max-w-md">
              {articulosPermitidos.slice(0, 3).map((a) => (
                <button
                  key={a.id}
                  onClick={() => { setInput(a.titulo); }}
                  className="text-xs bg-muted hover:bg-muted/80 px-3 py-1.5 rounded-full text-foreground transition-colors"
                >
                  {a.titulo.length > 40 ? a.titulo.slice(0, 40) + "..." : a.titulo}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          {mensajes.map((msg) => (
            <div key={msg.id} className={`flex ${msg.tipo === "usuario" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] ${msg.tipo === "usuario"
                ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2.5"
                : "space-y-2"
              }`}>
                {msg.tipo === "usuario" ? (
                  <p className="text-sm">{msg.texto}</p>
                ) : (
                  <>
                    <Card className="border-muted">
                      <CardContent className="p-4">
                        {msg.texto.includes("No tienes permisos") ? (
                          <div className="flex items-start gap-2 text-destructive">
                            <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
                            <p className="text-sm">{msg.texto}</p>
                          </div>
                        ) : (
                          <p className="text-sm text-foreground">{msg.texto}</p>
                        )}
                      </CardContent>
                    </Card>

                    {!msg.feedbackDado && (
                      <div className="flex items-center gap-2 px-1">
                        <span className="text-xs text-muted-foreground">¿Ha resuelto tu duda?</span>
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => darFeedback(msg.id, true)}>
                          <CheckCircle className="h-3.5 w-3.5 text-green-500" /> SÍ
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => darFeedback(msg.id, false)}>
                          <XCircle className="h-3.5 w-3.5 text-destructive" /> NO
                        </Button>
                      </div>
                    )}

                    {msg.feedbackDado && (
                      <p className="text-xs text-muted-foreground px-1">
                        {msg.feedbackPositivo
                          ? "✓ Gracias por tu feedback."
                          : "Tu duda ha sido registrada. Un administrador la revisará."}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="p-4 border-t bg-muted/20">
        <form onSubmit={(e) => { e.preventDefault(); enviar(); }} className="flex gap-2">
          <Input
            value={input} onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe tu consulta..."
            className="flex-1"
          />
          <Button type="submit" size="icon"><Send className="h-4 w-4" /></Button>
        </form>
      </div>
    </div>
  );
}
