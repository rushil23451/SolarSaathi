import { useEffect } from "react";

/** Each step gets its own <title> (Vercel guideline: accurate page titles). */
export function useTitle(title: string) {
  useEffect(() => {
    document.title = `${title} | SolarSaathi`;
  }, [title]);
}
