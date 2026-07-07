import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

// La app es de tema CLARO (no hay ThemeProvider de next-themes montado). Sonner,
// si lee el tema del sistema, pintaba el texto en blanco (tema dark) sobre el
// fondo claro del toast → ilegible. Fijamos `theme="light"` para que coincida
// con la app y forzamos colores explícitos que no dependen del tema.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white group-[.toaster]:text-slate-900 group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          title: "group-[.toast]:text-slate-900 group-[.toast]:font-medium",
          description: "group-[.toast]:text-slate-600",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-slate-700",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
