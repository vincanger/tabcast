import { useEffect, useState } from "react";

const entered = new Set<string>();

// True the first time a list mounts in this page load, false after. Lets a
// staged entrance play on arrival without replaying on every tab switch.
// The key is recorded in an effect, not in the initializer, because React's
// StrictMode runs initializers twice in development.
export function useEnterOnce(key: string): boolean {
  const [first] = useState(() => !entered.has(key));
  useEffect(() => {
    entered.add(key);
  }, [key]);
  return first;
}
