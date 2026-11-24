// Where "All apps" points. On the self-hosted server the hub is the site root.
// On GitHub Pages and Netlify there is no hub at the root, so use the portfolio's apps page.
// Set VITE_HUB_URL at build time to override.
const PORTFOLIO_APPS = "https://vishwadeep-s.netlify.app/apps/";

export function hubUrl(): string {
  const fromEnv = import.meta.env.VITE_HUB_URL as string | undefined;
  if (fromEnv) return fromEnv;
  const host = window.location.hostname;
  if (host.endsWith("github.io") || host.endsWith("netlify.app")) return PORTFOLIO_APPS;
  return "/";
}
