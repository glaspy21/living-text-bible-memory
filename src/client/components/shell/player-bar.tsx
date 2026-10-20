import { Icon, type IconName } from "@/client/components/ui/icons";
import { cn } from "@/client/lib/cn";

function TransportButton({
  icon,
  label,
  play = false,
}: {
  icon: IconName;
  label: string;
  play?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled
      className={cn(
        "grid place-items-center rounded-full text-gold disabled:cursor-default",
        play ? "h-[60px] w-[60px] border-[1.5px] border-gold bg-[#0a0a0a]" : "h-10 w-10",
      )}
    >
      <Icon name={icon} size={play ? 28 : 26} />
    </button>
  );
}

/**
 * Player layout (matches mobile): progress + times, then
 * end mode | skip back | ring play | skip forward | genre.
 * Static until the audio engine lands (M10); controls are disabled.
 */
export function PlayerBar() {
  return (
    <footer className="shell-player" aria-label="Player">
      <div className="flex w-full max-w-[680px] flex-col gap-1 px-6">
        <div className="relative mt-1 h-1 rounded bg-[#2c2a26]" aria-hidden="true" />
        <div className="flex justify-between text-xs text-text">
          <span>0:00</span>
          <span>0:00</span>
        </div>
        <div className="flex items-center justify-between px-1.5 py-0.5">
          <TransportButton icon="next" label="When the verse ends: Next Verse" />
          <TransportButton icon="skipBack" label="Previous verse" />
          <TransportButton icon="play" label="Play" play />
          <TransportButton icon="skipForward" label="Next verse" />
          <TransportButton icon="note" label="Genre" />
        </div>
      </div>
    </footer>
  );
}
