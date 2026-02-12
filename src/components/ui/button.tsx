"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-sm border text-xs font-semibold uppercase tracking-[0.08em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "border-primary/50 bg-primary/15 text-foreground hover:bg-primary/24",
        secondary: "border-secondary/80 bg-secondary/55 text-secondary-foreground hover:bg-secondary/75",
        ghost: "border-transparent bg-transparent text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground",
        destructive: "border-destructive/45 bg-destructive/14 text-destructive hover:bg-destructive/22",
        outline: "border-input bg-background/70 text-foreground hover:bg-muted",
      },
      size: {
        default: "h-8 px-3 py-1.5",
        sm: "h-7 px-2.5",
        lg: "h-9 px-4",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
