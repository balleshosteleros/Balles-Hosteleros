import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Mail, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import logoBalles from "@/assets/logo-balles.png";

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Introduce tu correo y contraseña");
      return;
    }
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast.error("Credenciales incorrectas. Comprueba tu correo y contraseña.");
    } else {
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg border">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="flex justify-center">
            <img src={logoBalles} alt="Balles Hosteleros" className="w-44" />
          </div>
          <div>
            <CardTitle className="text-xl font-bold text-foreground">Acceso al portal</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Introduce tus credenciales para acceder</p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-bold text-muted-foreground">CORREO ELECTRÓNICO</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@empresa.es"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                  autoComplete="email"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-bold text-muted-foreground">CONTRASEÑA</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 pr-10"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full gap-2" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Accediendo..." : "Entrar al portal"}
            </Button>
          </form>

          <div className="mt-6 p-3 rounded-lg bg-muted/50 border">
            <p className="text-xs font-bold text-foreground mb-2">Credenciales de prueba:</p>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p><strong>Admin:</strong> admin@balles.es / admin123456</p>
              <p><strong>Empleado:</strong> empleado@balles.es / empleado123</p>
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground text-center mt-4">
            Software de gestión · BALLES HOSTELEROS
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
