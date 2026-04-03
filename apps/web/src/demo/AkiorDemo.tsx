import AkiorCore, { useAkiorAudioLevel, type AkiorState } from "./AkiorCore";
import "./akior.css";
import { useMemo, useState } from "react";

export default function AkiorDemo() {
  const [state, setState] = useState<AkiorState>("idle");

  // Example: no actual stream connected here
  const audioLevel = 0.45;

  const nextState = useMemo(() => {
    switch (state) {
      case "idle":
        return "listening";
      case "listening":
        return "speaking";
      case "speaking":
        return "thinking";
      default:
        return "idle";
    }
  }, [state]);

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#020913" }}>
      <div style={{ display: "grid", gap: 16, justifyItems: "center" }}>
        <AkiorCore state={state} size={480} audioLevel={audioLevel} />
        <button
          onClick={() => setState(nextState)}
          style={{
            background: "#0b1a24",
            border: "1px solid rgba(115,251,255,0.2)",
            color: "#9ffcff",
            padding: "10px 16px",
            borderRadius: 12,
            cursor: "pointer",
          }}
        >
          Cycle state
        </button>
      </div>
    </div>
  );
}
