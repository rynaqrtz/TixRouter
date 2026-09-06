"use client";

import * as React from "react";
import { useTheme } from "@/context/Theme";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { Check, Info, AlertTriangle, X, Loader2 } from "lucide-react";

const Toaster = ({ ...props }: ToasterProps) => {
    const { theme } = useTheme();

    return (
        <Sonner
            theme={theme as ToasterProps["theme"]}
            className="toaster group font-mono"
            icons={{
                success: <Check className="size-3.5 text-foreground stroke-[2.5]" />,
                info: <Info className="size-3.5 text-foreground" />,
                warning: <AlertTriangle className="size-3.5 text-foreground" />,
                error: <X className="size-3.5 text-foreground stroke-[2.5]" />,
                loading: <Loader2 className="size-3.5 animate-spin text-foreground" />
            }}
            style={
                {
                    "--normal-bg": "var(--card)",
                    "--normal-text": "var(--foreground)",
                    "--normal-border": "var(--border)",
                    "--success-bg": "var(--card)",
                    "--success-text": "var(--foreground)",
                    "--success-border": "var(--border)",
                    "--error-bg": "var(--card)",
                    "--error-text": "var(--foreground)",
                    "--error-border": "var(--border)",
                    "--warning-bg": "var(--card)",
                    "--warning-text": "var(--foreground)",
                    "--warning-border": "var(--border)",
                    "--info-bg": "var(--card)",
                    "--info-text": "var(--foreground)",
                    "--info-border": "var(--border)"
                } as React.CSSProperties
            }
            toastOptions={{
                classNames: {
                    toast: "group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border/80 group-[.toaster]:shadow-xl group-[.toaster]:rounded-xl group-[.toaster]:font-mono group-[.toaster]:text-xs group-[.toaster]:p-3.5",
                    title: "group-[.toast]:font-semibold group-[.toast]:text-foreground",
                    description:
                        "group-[.toast]:text-muted-foreground group-[.toast]:text-[11px] group-[.toast]:mt-0.5",
                    actionButton:
                        "group-[.toast]:bg-foreground group-[.toast]:text-background group-[.toast]:font-semibold group-[.toast]:rounded-lg group-[.toast]:text-xs",
                    cancelButton:
                        "group-[.toast]:bg-muted group-[.toast]:text-foreground group-[.toast]:rounded-lg group-[.toast]:text-xs",
                    closeButton:
                        "group-[.toast]:bg-background group-[.toast]:text-muted-foreground group-[.toast]:border-border/80 hover:group-[.toast]:text-foreground hover:group-[.toast]:bg-muted"
                }
            }}
            {...props}
        />
    );
};

export { Toaster };
