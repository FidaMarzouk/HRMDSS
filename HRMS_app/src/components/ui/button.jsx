import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/utils";

// Hierarchy by weight, not colour: one filled teal primary per view, outlined
// secondary, text-only ghost. Destructive actions are soft red.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-teal text-on-accent font-semibold hover:bg-teal-hi",
        secondary: "border border-edge bg-transparent text-ink hover:border-teal hover:bg-sunk",
        ghost: "text-ink-2 hover:bg-sunk hover:text-ink",
        danger: "border border-red/20 bg-red/10 text-red hover:bg-red/15",
        link: "h-auto px-0 text-teal underline-offset-4 hover:underline",
        // Names used before the redesign
        default: "bg-teal text-on-accent font-semibold hover:bg-teal-hi",
        outline: "border border-edge bg-transparent text-ink hover:border-teal hover:bg-sunk",
        destructive: "border border-red/20 bg-red/10 text-red hover:bg-red/15",
      },
      size: {
        sm: "h-8 px-2.5 text-[13px]",
        md: "h-10 px-3.5",
        lg: "h-11 px-5 text-[15px]",
        icon: "h-10 w-10",
        "icon-sm": "h-8 w-8",
        default: "h-10 px-3.5",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

const Button = forwardRef(({ className, variant, size, asChild = false, type = "button", ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...(asChild ? {} : { type })}
      {...props}
    />
  );
});
Button.displayName = "Button";

export { Button, buttonVariants };
