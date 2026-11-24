import type { ReactNode } from "react";

const icon = (children: ReactNode, extra: Record<string, string> = {}) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...extra}>
    {children}
  </svg>
);

const TOOLS: { tool: string; label: string; key: string; title: string; svg: ReactNode }[] = [
  { tool: "select", label: "Select", key: "V", title: "Select and edit (V)", svg: icon(<path d="M5 3l14 7-6 2-2 6z" />, { strokeLinejoin: "round" }) },
  {
    tool: "pan",
    label: "Hand",
    key: "H",
    title: "Move the map (H). Arrow keys also move it.",
    svg: icon(
      <>
        <path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11" />
        <path d="M11 10.5V4a1.5 1.5 0 0 1 3 0v6.5" />
        <path d="M14 10.5V5.5a1.5 1.5 0 0 1 3 0V13" />
        <path d="M8 11.5V9.5a1.5 1.5 0 0 0-3 0V14c0 4 2.5 7 6.5 7h1c3.5 0 5.5-2.5 5.5-6v-2" />
      </>,
      { strokeLinecap: "round", strokeLinejoin: "round" }
    ),
  },
  {
    tool: "road",
    label: "Road",
    key: "R",
    title: "Draw road (R)",
    svg: icon(
      <>
        <path d="M7 21L10 3M17 21L14 3" />
        <path d="M12 6v2M12 11v2M12 16v2" />
      </>,
      { strokeLinecap: "round" }
    ),
  },
  {
    tool: "bridge",
    label: "Flyover",
    key: "F",
    title: "Draw flyover (F)",
    svg: icon(
      <>
        <path d="M2 9h20" />
        <path d="M2 9c3 0 4 3 4 6M22 9c-3 0-4 3-4 6" />
        <path d="M9 9v10M15 9v10" />
      </>,
      { strokeLinecap: "round" }
    ),
  },
  { tool: "delete", label: "Delete", key: "D", title: "Delete (D)", svg: icon(<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />, { strokeLinecap: "round" }) },
];

/** The tools on the left of the map. The engine handles the clicks (see map/input.js). */
export default function ToolRail() {
  return (
    <nav id="rail" aria-label="Tools">
      {TOOLS.map((t) => (
        <button key={t.tool} className={`tool ${t.tool === "select" ? "on" : ""}`} data-tool={t.tool} title={t.title}>
          {t.svg}
          {t.label}
          <kbd>{t.key}</kbd>
        </button>
      ))}
      <div className="undo-row">
        <button className="tool mini" id="undoBtn" title="Undo (Ctrl+Z)" disabled>
          {icon(
            <>
              <path d="M9 14L4 9l5-5" />
              <path d="M4 9h11a5 5 0 0 1 0 10h-3" />
            </>,
            { strokeLinecap: "round", strokeLinejoin: "round" }
          )}
          Undo
        </button>
        <button className="tool mini" id="redoBtn" title="Redo (Ctrl+Shift+Z)" disabled>
          {icon(
            <>
              <path d="M15 14l5-5-5-5" />
              <path d="M20 9H9a5 5 0 0 0 0 10h3" />
            </>,
            { strokeLinecap: "round", strokeLinejoin: "round" }
          )}
          Redo
        </button>
      </div>
    </nav>
  );
}
