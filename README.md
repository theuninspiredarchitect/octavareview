# Octava Review

A focused PDF drawing review application for internal coordination, client feedback and site visits. A minimal charcoal interface keeps the drawing at the center, with a vertical tool dock and a live stroke thickness slider.

[Open Octava Review](https://octava-plan-review.mattusher.chatgpt.site) · [Hosting and deployment](docs/HOSTING.md)

No sign-in is required to try the app or open a shared review. The repository contains application source; project data and uploaded client drawings stay in the hosted database and file storage.

## Product workflow

Create a project and import a PDF. Each page becomes a drawing. Use the pen, arrow, shape or text tools, then adjust the stroke with the vertical slider (0.5–24 px). Pin tasks, record notes, assign priorities, update status and add comments.

Calibrate each drawing against a known dimension before measuring distances or polygon areas. Place measurement endpoints individually or drag between them. A magnified crosshair, axis constraint, snapping to existing markup endpoints, adjustable 2–4 decimal precision and editable endpoint handles improve point placement. Area measurements accept concave closed polylines and reject crossing edges. Existing two-point area records still render as rectangles. The eraser removes whole markups along a continuous sweep, including intersections between pointer events; a sweep is one undo action. Task pins preview before placement and anchor exactly at their tip. Mouse, touch and stylus use pointer events, with two-finger navigation and zoom centered at the pointer. Every new revision requires its own calibration. Revisions preserve their own feedback. Export the visible sheet and a task report as a PDF.

Review links grant client feedback or internal editor access without sign-in. Client responses only include selected drawings and client visible feedback. Clients can adjust and erase their own markups; server ownership checks protect other reviewers’ annotations. Internal comments are excluded on the server. Complete PDF files must be included together to prevent excluded-page disclosure. Review links are revocable and are stored as hashes.

## Persistence and access

D1 stores projects, sheets, markups, tasks, comments and hashed review links. R2 stores original PDF documents. Anonymous visitors receive an isolated guest workspace using an opaque HttpOnly cookie, with only its hash stored server-side. The guest session lasts 30 days; clearing cookies removes access, so export reviews to keep a copy. When supplied, platform authenticated identity takes priority. Project ownership is checked server-side for every request, including file downloads. Record versions prevent silent concurrent overwrites. Unsaved drawing changes are retained on screen with a retry action. This app requires a network connection for saving and is not an offline application.

The sample Casa Canopy project is demonstration content and is created for each new owner. Actual PDF files can be imported into an empty project.

## Computer, iPad and iPhone

Open the published URL in a browser. The device button explains desktop installation and Safari Add to Home Screen. The manifest and app icons enable standalone web app installation in supporting browsers. An internet connection is required; there is no offline saving.

Use a Team editor link to access the same project on another device, or a Client review link for client feedback. Guest ownership is browser-specific and expires after 30 days. Installation does not convert a guest session into a permanent account. Review links can be pasted into the installed app, and a reviewer can explicitly choose to remember a review as the installed app’s launch target. This local preference stores only the link capability; project content remains server-backed.

## Technical notes

Vinext and React run as a Cloudflare Worker. PDF.js renders uploaded files in the browser; pdf-lib validates uploads and produces review exports. Drawing annotations use plan-space SVG coordinates. The original PDF is stored separately and remains unchanged. Exports flatten the visible drawing and markups into a high-resolution image and append a task summary.

Dependencies use the included pnpm lockfile. Applied migrations are append-only. No production data or credentials are included in this repository.

## Local development

Use Node.js 22.13 or newer and pnpm 11.25.0, as pinned in `package.json`. Run these commands from the project directory after cloning:

```sh
pnpm install --frozen-lockfile
pnpm build
```

The build creates `dist/server/wrangler.json`, which configures local D1 and R2 emulation. Initialize a **new local database once**, in this order:

```sh
pnpm exec wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_mixed_hannibal_king.sql
pnpm exec wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_bitter_next_avengers.sql
pnpm exec wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_unknown_rick_jones.sql
pnpm dev
```

Open the local URL printed by the server (normally `http://localhost:5173`). Local data is stored in the ignored `.wrangler/state` directory and is separate from the live app. No cloud credentials are required for this local workflow. Do not rerun the initialization SQL on an existing database; apply only new migrations in order. These explicit local commands do not maintain a migration ledger.

For later development sessions, use `pnpm dev`. To check a production build locally, run `pnpm build` followed by `pnpm start`. The start command serves the built Worker locally; it does not publish the app. A clean clone uses the portable execution profile. Sites-managed checkouts select their own local execution profile automatically.

The current production deployment uses Sites with Cloudflare Workers, D1 and R2. GitHub publishing does not configure automatic deployments, and this project is not a drop-in Vercel deployment. See the [hosting guide](docs/HOSTING.md) before changing providers.
