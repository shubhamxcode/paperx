export type ClassValue = string | number | null | boolean | undefined | ClassDictionary | ClassArray;
interface ClassDictionary { [id: string]: any }
interface ClassArray extends Array<ClassValue> {}

/**
 * Internal utility function to build classnames.
 */
function clsx(...args: ClassValue[]): string {
  let classes: string[] = [];
  for (const arg of args) {
    if (!arg) continue;
    if (typeof arg === "string" || typeof arg === "number") {
      classes.push(String(arg));
    } else if (Array.isArray(arg)) {
      if (arg.length) {
        const inner = clsx(...arg);
        if (inner) classes.push(inner);
      }
    } else if (typeof arg === "object") {
      for (const key in arg) {
        if ((arg as ClassDictionary)[key]) classes.push(key);
      }
    }
  }
  return classes.join(" ");
}

/**
 * Fallback implementation of tailwind-merge that simply joins classes
 * and removes duplicates (doesn't handle conflicts).
 */
function twMerge(...inputs: string[]): string {
  const seen = new Set<string>();
  return inputs
    .join(" ")
    .split(/\s+/)
    .filter((cls) => !!cls && !seen.has(cls) && seen.add(cls))
    .join(" ");
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(...inputs));
}
