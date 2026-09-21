import { cn } from "../lib/utils";

// A native select dressed as an underlined word inside a sentence. It inherits
// the sentence's font, so it sits on the same baseline as the words around it,
// and the browser still supplies the dropdown, keyboard handling and the name.
export function InlineSelect({
  label,
  value,
  onChange,
  className,
  children,
}: {
  label: string;
  value: number | string;
  onChange: (value: string) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "[font:inherit] [field-sizing:content] cursor-pointer appearance-none rounded-none border-0 border-b border-rubric bg-transparent px-0 py-0 text-foreground transition-colors hover:text-rubric focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
        className,
      )}
    >
      {children}
    </select>
  );
}
