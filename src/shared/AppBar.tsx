import type { ReactNode } from "react";
import { THEMES, useTheme } from "./theme";
import { hubUrl } from "./hub";
import "./AppBar.css";

type Props = {
  /** App name shown next to the back link. */
  title: string;
  /** Extra controls for the right side, before the theme switcher. */
  children?: ReactNode;
};

/** The slim bar every app shares: back to the hub, the app's name, and the theme switcher. */
export default function AppBar({ title, children }: Props) {
  const { theme, setTheme } = useTheme();
  return (
    <header className="vk-bar">
      <a className="vk-bar__back" href={hubUrl()}>
        <span aria-hidden="true">←</span> All apps
      </a>
      <span className="vk-bar__title">{title}</span>
      <div className="vk-bar__end">
        {children}
        <div className="vk-themes" role="group" aria-label="Theme">
          {THEMES.map((t) => (
            <button key={t.key} type="button" aria-pressed={theme === t.key} onClick={() => setTheme(t.key)} title={t.label}>
              <i style={{ background: t.swatch }} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
