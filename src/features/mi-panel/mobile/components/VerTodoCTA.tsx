import Link from "next/link";
import { LayoutGrid } from "lucide-react";

export function VerTodoCTA() {
  return (
    <div className="px-5 pt-4 pb-2">
      <Link
        href="/m/mas"
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-background py-3.5 text-sm font-medium text-muted-foreground active:bg-muted"
      >
        <LayoutGrid className="h-4 w-4" />
        Ver todo Mis Paneles
      </Link>
    </div>
  );
}
