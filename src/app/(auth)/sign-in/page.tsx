import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/client/components/brand/logo";
import { Sun } from "@/client/components/ui/sun";
import { safeCallbackPath } from "@/server/auth/allowlist";
import { signInWithGoogle } from "@/server/auth/actions";

const ERRORS: Record<string, string> = {
  AccessDenied: "That Google account isn't on the administrator list.",
};

async function SignInForm({
  searchParams,
}: {
  searchParams: PageProps<"/sign-in">["searchParams"];
}) {
  const { error, callbackUrl } = await searchParams;
  const message =
    typeof error === "string" ? (ERRORS[error] ?? "Sign-in failed. Please try again.") : null;
  return (
    <form action={signInWithGoogle} className="flex flex-col gap-4">
      <input type="hidden" name="callbackUrl" value={safeCallbackPath(callbackUrl)} />
      {message && (
        <p role="alert" className="rounded-md border border-err/50 px-3 py-2 text-sm text-err">
          {message}
        </p>
      )}
      <button
        type="submit"
        className="rounded-[7px] border border-[#d8b872] bg-gradient-to-b from-[#e0c07a] to-[#a8843f] px-5 py-[10px] font-semibold text-[#120d03] active:scale-[0.97]"
      >
        Continue with Google
      </button>
    </form>
  );
}

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-bg px-4">
      <Sun />
      <div className="relative z-10 w-full max-w-[360px] rounded-2xl border border-line bg-[rgba(10,10,10,.8)] p-8 text-center">
        <Logo variant="mark" height={56} className="mx-auto mb-4" />
        <h1 className="font-serif text-[26px] font-medium text-heading">Administrator sign-in</h1>
        <p className="mt-1 mb-6 text-sm text-muted">For the Living Text music workspace.</p>
        <Suspense fallback={null}>
          <SignInForm searchParams={searchParams} />
        </Suspense>
        <Link href="/" className="mt-6 inline-block text-sm text-gold-dim hover:text-gold">
          ← Back to the app
        </Link>
      </div>
    </main>
  );
}
