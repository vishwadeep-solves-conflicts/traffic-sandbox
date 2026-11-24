# shared/

This folder is the same in every app (Traffic Sandbox, Private Commit Heatmap, India City Livability Index, The Group Wants to Guess). It's what makes them look like one family with the portfolio and the hub.

| File | What it does |
|---|---|
| `theme.tsx` | `ThemeProvider` and `useTheme()`. Midnight, Navy or White, saved under the `vk-theme` key that the portfolio and hub also use. Midnight is the default. |
| `tokens.css` | The shared colours as `--vk-*` variables, one set per theme. |
| `AppBar.tsx` | The top bar: "← All apps", the app's name and the theme switcher. |
| `hub.ts` | Where "All apps" links to. |

**Don't change the theme logic or colours in just one app.** Change them in all of them, and in the portfolio's `src/theme.tsx`, so the theme keeps carrying over between apps.

App-specific colours live in the app's own `src/styles/` and are mapped onto the `--vk-*` variables there.
