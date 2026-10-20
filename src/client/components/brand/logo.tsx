import { useId } from "react";
import { LOGO_SHAPES } from "./logo-shapes";

type LogoProps = {
  /** "mark" is the LT monogram; "lockup" adds LIVING TEXT and the rule. */
  variant?: "mark" | "lockup";
  /** "gold" paints the metallic gradient (dark backgrounds). "flat" uses the current text color. */
  tone?: "gold" | "flat";
  /** Rendered height in px; width follows the artwork's proportions. */
  height?: number;
  className?: string;
};

export function Logo({ variant = "mark", tone = "gold", height = 40, className }: LogoProps) {
  const gradientId = useId();
  const { viewBox, paths } = LOGO_SHAPES[variant];
  const [, , w, h] = viewBox.split(" ").map(Number);

  return (
    <svg
      viewBox={viewBox}
      height={height}
      width={(height * w) / h}
      role="img"
      aria-label={variant === "lockup" ? "Living Text" : "Living Text monogram"}
      className={className}
    >
      {tone === "gold" && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f0d89a" />
            <stop offset="0.35" stopColor="#c9a15a" />
            <stop offset="0.6" stopColor="#e6c98c" />
            <stop offset="1" stopColor="#b98d4d" />
          </linearGradient>
        </defs>
      )}
      <g fill={tone === "gold" ? `url(#${gradientId})` : "currentColor"}>
        {paths.map(({ d, transform }, i) => (
          <path key={i} d={d} transform={transform} />
        ))}
      </g>
    </svg>
  );
}
