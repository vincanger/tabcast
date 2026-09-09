import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Shadcn's class merge helper. Its `radix-luma` preset imports this from a bare
// "cn" package, which is an unrelated package on npm, so we define it here and
// point the generated components at this file.
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
