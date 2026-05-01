"use client";

import * as React from "react";
import { Settings } from "lucide-react";

import { Button, type ButtonProps } from "@/shared/components/ui/button";
import { cn } from "@/lib/utils";

type ConfigButtonProps = Omit<ButtonProps, "children"> & {
  iconClassName?: string;
};

export const ConfigButton = React.forwardRef<HTMLButtonElement, ConfigButtonProps>(
  ({ className, iconClassName, variant = "ghost", size = "icon", title = "Configuración", ...props }, ref) => {
    return (
      <Button
        ref={ref}
        type="button"
        variant={variant}
        size={size}
        title={title}
        aria-label={title}
        className={cn("text-foreground/80 hover:text-foreground", className)}
        {...props}
      >
        <Settings className={cn("h-5 w-5", iconClassName)} strokeWidth={1.75} />
      </Button>
    );
  },
);
ConfigButton.displayName = "ConfigButton";

type ConfigButtonFloatingProps = ConfigButtonProps & {
  containerClassName?: string;
};

export const ConfigButtonFloating = React.forwardRef<HTMLButtonElement, ConfigButtonFloatingProps>(
  ({ containerClassName, className, ...props }, ref) => {
    return (
      <div className={cn("absolute top-4 right-4 z-20", containerClassName)}>
        <ConfigButton ref={ref} className={className} {...props} />
      </div>
    );
  },
);
ConfigButtonFloating.displayName = "ConfigButtonFloating";
