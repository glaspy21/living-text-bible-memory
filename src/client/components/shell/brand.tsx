import Link from "next/link";
import { Logo } from "@/client/components/brand/logo";

/** Logo mark + wordmark in the header's left column. */
export function Brand({ admin = false }: { admin?: boolean }) {
  return (
    <Link
      href={admin ? "/admin" : "/"}
      className="flex items-center gap-[10px] px-[18px] max-[520px]:pl-[14px] max-[520px]:pr-0"
    >
      <Logo
        variant="mark"
        height={34}
        className="shrink-0 max-[520px]:h-[30px] max-[520px]:w-[30px]"
      />
      <span className="shell-brand-name font-serif text-[13px] whitespace-nowrap tracking-[.22em] text-gold2">
        {admin ? "LIVING TEXT · ADMIN" : "LIVING TEXT"}
      </span>
    </Link>
  );
}
