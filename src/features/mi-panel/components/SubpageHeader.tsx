"use client";

import Link from "next/link";
import { ArrowLeft, type LucideIcon } from "lucide-react";

interface Props {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
}

export function SubpageHeader({ title, subtitle, icon: Icon }: Props) {
  return (
    <div className="flex items-start gap-3">
      <Link
        href="/mi-panel"
        className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-muted transition-colors"
        title="Volver a Mi panel"
      >
        <ArrowLeft className="h-4 w-4" />
      </Link>
      <div className="flex-1 min-w-0">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Mi panel</p>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Icon className="h-6 w-6 text-primary" />
          {title}
        </h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}
