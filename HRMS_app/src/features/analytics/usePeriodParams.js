import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { presetRange } from "./period";

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

// Period, department, compare and tab live in the URL so a view can be shared.
export function usePeriodParams() {
  const [params, setParams] = useSearchParams();
  const fallback = presetRange("last30");
  const from = DAY_KEY.test(params.get("from") || "") ? params.get("from") : fallback.from;
  const to = DAY_KEY.test(params.get("to") || "") ? params.get("to") : fallback.to;
  const update = useCallback(
    (changes) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          Object.entries(changes).forEach(([k, v]) => (v == null || v === "" ? next.delete(k) : next.set(k, v)));
          return next;
        },
        { replace: true }
      ),
    [setParams]
  );
  return { params, period: { from, to }, compare: params.get("compare") !== "0", update };
}
