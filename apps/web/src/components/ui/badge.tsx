import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
    "inline-flex items-center gap-1 shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
    {
        variants: {
            variant: {
                default:
                    "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
                secondary:
                    "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
                destructive:
                    "border-transparent bg-destructive/10 text-destructive border-destructive/20",
                outline: "text-foreground border-border/80",
                emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-500",
                sky: "border-sky-500/20 bg-sky-500/10 text-sky-500",
                indigo: "border-indigo-500/20 bg-indigo-500/10 text-indigo-500",
                amber: "border-amber-500/20 bg-amber-500/10 text-amber-500"
            }
        },
        defaultVariants: {
            variant: "default"
        }
    }
);

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
    return (
        <div data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
    );
}

export { Badge, badgeVariants };
