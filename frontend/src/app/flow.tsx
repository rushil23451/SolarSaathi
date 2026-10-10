// State that lives across the steps of a check: what the AI read, what the person changed,
// where the home is, and the latest quote review. Kept in sessionStorage so a refresh in the
// middle of a check doesn't lose it; the document preview lives in memory only.
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Bill, QuoteReport, Roof } from "../types/api";

export type BillField = "discom" | "category" | "sanctioned_load_kw" | "units_billed" | "billing_period_days" | "history";

export interface Place {
  lat: number;
  lon: number;
  label: string;
}

export interface FlowState {
  billRead: Bill | null; // exactly what the AI returned
  bill: Bill | null; // what the person confirmed (or typed)
  edited: BillField[];
  manual: boolean;
  place: Place | null;
  roof: Roof | null;
  quote: QuoteReport | null;
  quoteFromReport: string | null;
}

const EMPTY: FlowState = {
  billRead: null,
  bill: null,
  edited: [],
  manual: false,
  place: null,
  roof: null,
  quote: null,
  quoteFromReport: null,
};

const KEY = "solarsaathi.flow";

function load(): FlowState {
  try {
    return { ...EMPTY, ...JSON.parse(sessionStorage.getItem(KEY) || "{}") };
  } catch {
    return EMPTY;
  }
}

interface Preview {
  url: string;
  type: string;
  name: string;
}

interface FlowApi {
  state: FlowState;
  update: (patch: Partial<FlowState>) => void;
  reset: () => void;
  preview: Record<"bill" | "quote", Preview | null>;
  setPreview: (kind: "bill" | "quote", file: File | null) => void;
}

const FlowContext = createContext<FlowApi | null>(null);

export function FlowProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FlowState>(load);
  const [preview, setPreviewState] = useState<FlowApi["preview"]>({ bill: null, quote: null });
  const urls = useRef<string[]>([]);

  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage full or blocked: the flow still works in memory */
    }
  }, [state]);

  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const api = useMemo<FlowApi>(
    () => ({
      state,
      update: (patch) => setState((s) => ({ ...s, ...patch })),
      reset: () => setState(EMPTY),
      preview,
      setPreview: (kind, file) => {
        if (!file) return setPreviewState((p) => ({ ...p, [kind]: null }));
        const url = URL.createObjectURL(file);
        urls.current.push(url);
        setPreviewState((p) => ({ ...p, [kind]: { url, type: file.type, name: file.name } }));
      },
    }),
    [state, preview],
  );
  return <FlowContext.Provider value={api}>{children}</FlowContext.Provider>;
}

export function useFlow() {
  const ctx = useContext(FlowContext);
  if (!ctx) throw new Error("useFlow outside FlowProvider");
  return ctx;
}

/** The last report made on this device, for "Your last report" on the landing page. */
export const lastReport = {
  get(): { id: string; date: string } | null {
    try {
      return JSON.parse(localStorage.getItem("solarsaathi.last") || "null");
    } catch {
      return null;
    }
  },
  set(id: string) {
    try {
      localStorage.setItem("solarsaathi.last", JSON.stringify({ id, date: new Date().toISOString() }));
    } catch {
      /* ignore */
    }
  },
};
