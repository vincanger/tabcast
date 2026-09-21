import { cn } from "../lib/utils";

const base =
  "flex items-center justify-center transition-[opacity,filter,scale] duration-300 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none";
const shown = "scale-100 opacity-100 blur-0";
const hidden = "scale-[0.25] opacity-0 blur-[4px]";

// Cross-fades between two icons. Both stay in the DOM, one stacked on the
// other, so the swap animates in both directions without a motion library.
export function IconSwap({
  active,
  activeIcon,
  inactiveIcon,
  className,
}: {
  active: boolean;
  activeIcon: React.ReactNode;
  inactiveIcon: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)} aria-hidden="true">
      <span className={cn("absolute inset-0", base, active ? shown : hidden)}>{activeIcon}</span>
      <span className={cn(base, active ? hidden : shown)}>{inactiveIcon}</span>
    </span>
  );
}
