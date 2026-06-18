<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Trashium Coding Conventions

- **Server Component vs Client Component Split**: Fetch data and handle auth checks on the server side (`page.tsx`). Keep all interactive elements and animation UI in client components (`*-content.tsx`) using `"use client"`.
- **Database & RPC Access**: Use the defined RPC functions (`log_daily_action`, `get_daily_status`, `redeem_marketplace_item`, `get_household_leaderboard`) for write transactions and secure views. Avoid direct updates from the client.
- **Eco Tiers & Gamification**: Eco-level data and badges are managed through `lib/gamification.ts` and `lib/badges.ts`. Never hardcode points, tiers, or unlock thresholds.
- **Aesthetics & Motion**: Follow the warm earth-toned palette (Espresso: `#2A2218`, Sage: `#8FA57E`, Copper: `#C2793D`, Cream: `#F4EFE3`) and tactile feel (WebGL Ribbons + grain overlay) defined in `app/globals.css`. All micro-animations must support accessibility overrides (`prefers-reduced-motion`).

