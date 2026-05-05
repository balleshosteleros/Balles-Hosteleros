"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/shared/lib/utils";

type LoadingSpinnerProps = {
  className?: string;
  iconClassName?: string;
  size?: "sm" | "md" | "lg";
};

const SIZE_MAP: Record<NonNullable<LoadingSpinnerProps["size"]>, string> = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
};

export function LoadingSpinner({
  className,
  iconClassName,
  size = "md",
}: LoadingSpinnerProps) {
  return (
    <div className={cn("flex items-center justify-center py-6", className)}>
      <Loader2
        className={cn(
          SIZE_MAP[size],
          "animate-spin text-muted-foreground",
          iconClassName,
        )}
      />
    </div>
  );
}
