import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/client/lib/cn";
import { Icon, type IconName } from "./icons";

type BarProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: IconName;
  title: string;
  subtitle?: string;
};

function BarContent({ icon, title, subtitle }: Pick<BarProps, "icon" | "title" | "subtitle">) {
  return (
    <>
      {icon && <Icon name={icon} size={34} className="shrink-0 text-gold" />}
      <span>
        <span className="block font-serif text-2xl font-medium text-text">{title}</span>
        {subtitle && <span className="block font-serif text-[15px] text-muted">{subtitle}</span>}
      </span>
      <span className="ml-auto text-2xl text-gold" aria-hidden="true">
        ›
      </span>
    </>
  );
}

const barClass =
  "wipe flex w-full items-center gap-[18px] rounded-xl border border-gold bg-[rgba(20,18,12,.8)] px-6 py-[22px] text-left transition-shadow duration-[250ms] hover:shadow-[0_0_26px_rgba(212,168,79,.18)] max-sm:gap-[14px] max-sm:px-4 max-sm:py-[14px]";

/** Full-width option bar (Continue, Browse Scripture, Memorize choices). Gold wipe on hover. */
export function Bar({ icon, title, subtitle, className, type = "button", ...rest }: BarProps) {
  const content: ReactNode = <BarContent icon={icon} title={title} subtitle={subtitle} />;
  return (
    <button type={type} className={cn(barClass, className)} {...rest}>
      {content}
      <span className="wipe-fill" aria-hidden="true">
        {content}
      </span>
    </button>
  );
}

/** A Bar that navigates. */
export function BarLink({
  href,
  icon,
  title,
  subtitle,
  className,
}: Pick<BarProps, "icon" | "title" | "subtitle" | "className"> & { href: string }) {
  const content: ReactNode = <BarContent icon={icon} title={title} subtitle={subtitle} />;
  return (
    <Link href={href} className={cn(barClass, className)}>
      {content}
      <span className="wipe-fill" aria-hidden="true">
        {content}
      </span>
    </Link>
  );
}
