import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { cn } from "@/client/lib/cn";

type Variant = "outline" | "solid" | "ghost";
type Size = "md" | "sm";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
};

const base =
  "inline-flex items-center justify-center gap-[9px] rounded-[7px] border transition-[background,box-shadow,border-color,color,transform] duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 [&_svg]:h-5 [&_svg]:w-5";

const variants: Record<Variant, string> = {
  outline:
    "wipe border-gold text-gold2 bg-[rgba(201,164,92,.07)] hover:shadow-[0_0_18px_rgba(201,164,92,.18)]",
  solid:
    "border-[#d8b872] bg-gradient-to-b from-[#e0c07a] to-[#a8843f] font-semibold text-[#120d03]",
  ghost: "wipe border-line text-muted",
};

const sizes: Record<Size, string> = {
  md: "px-5 py-[9px]",
  sm: "px-3 py-[5px] text-xs",
};

/** The overlay that sweeps across on hover: a dark-on-gold copy of the content. */
function WipeFill({ children }: { children: ReactNode }) {
  return (
    <span className="wipe-fill" aria-hidden="true">
      {children}
    </span>
  );
}

export function Button({
  variant = "outline",
  size = "md",
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  const wipes = variant !== "solid";
  return (
    <button type={type} className={cn(base, variants[variant], sizes[size], className)} {...rest}>
      {children}
      {wipes && <WipeFill>{children}</WipeFill>}
    </button>
  );
}

/** A link that looks like a Button (same wipe and variants), for navigation. */
export function ButtonLink({
  variant = "outline",
  size = "md",
  className,
  children,
  ...rest
}: Omit<ComponentProps<typeof Link>, "children"> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}) {
  const wipes = variant !== "solid";
  return (
    <Link className={cn(base, variants[variant], sizes[size], className)} {...rest}>
      {children}
      {wipes && <WipeFill>{children}</WipeFill>}
    </Link>
  );
}
