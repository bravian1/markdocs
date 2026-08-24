import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional class names (shadcn standard helper). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
