import { cn } from "@/client/lib/cn";

/**
 * Small square beside a recent chapter. A plain gold-on-dark tile for now; real thumbnails wait on
 * the owner's photography decision (PROJECT.md §8).
 */
export function ChapterTile({ chapter, className }: { chapter: number; className?: string }) {
  return (
    <span
      className={cn(
        "grid h-10 w-10 flex-none place-items-center rounded-[5px] border border-line bg-[radial-gradient(circle_at_85%_10%,rgba(232,203,138,.3),transparent_65%),#0d0c09] font-serif text-lg text-gold",
        className,
      )}
      aria-hidden="true"
    >
      {chapter}
    </span>
  );
}
