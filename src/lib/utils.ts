export type ClassValue =
  | string
  | number
  | null
  | boolean
  | undefined
  | ClassValue[]
  | { [className: string]: ClassValue };

/** Internal utility function to build class names. */
function clsx(...args: ClassValue[]): string {
  const classes: string[] = [];
  for (const arg of args) {
    if (!arg) continue;
    if (typeof arg === "boolean") continue;
    if (typeof arg === "string" || typeof arg === "number") {
      classes.push(String(arg));
    } else if (Array.isArray(arg)) {
      const inner = clsx(...arg);
      if (inner) classes.push(inner);
    } else {
      for (const key in arg) {
        if (arg[key]) classes.push(key);
      }
    }
  }
  return classes.join(" ");
}

/** Join class names and remove exact duplicates. */
function twMerge(...inputs: string[]): string {
  const seen = new Set<string>();
  return inputs
    .join(" ")
    .split(/\s+/)
    .filter((className) => Boolean(className) && !seen.has(className) && seen.add(className))
    .join(" ");
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(...inputs));
}
