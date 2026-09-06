"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SwitchProps extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    "onChange"
> {
    checked: boolean;
    onCheckedChange?: (checked: boolean) => void;
}

export function Switch({ checked, onCheckedChange, disabled, className, ...props }: SwitchProps) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => onCheckedChange?.(!checked)}
            className={cn(
                "group relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-border/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                checked ? "bg-foreground border-foreground" : "bg-muted/60 hover:bg-muted",
                className
            )}
            {...props}
        >
            <span
                className={cn(
                    "pointer-events-none block size-3.5 rounded-full transition-transform",
                    checked
                        ? "translate-x-4 bg-background shadow-xs"
                        : "translate-x-0.5 bg-muted-foreground"
                )}
            />
        </button>
    );
}
