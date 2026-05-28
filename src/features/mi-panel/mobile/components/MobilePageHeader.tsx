import Link from "next/link";
import { ChevronLeft } from "lucide-react";

interface Props {
  title: string;
  subtitle?: string;
  backHref?: string;
}

export function MobilePageHeader({ title, subtitle, backHref = "/m" }: Props) {
  return (
    <header className="sticky top-0 z-40 flex items-center gap-2 border-b border-border/60 bg-background/95 px-3 pt-[max(env(safe-area-inset-top),10px)] pb-3 backdrop-blur">
      <Link
        href={backHref}
        className="-ml-1 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
        aria-label="Volver"
      >
        <ChevronLeft className="h-5 w-5" />
      </Link>
      <div className="min-w-0">
        <h1 className="truncate text-base font-semibold leading-tight">{title}</h1>
        {subtitle && (
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
    </header>
  );
}
