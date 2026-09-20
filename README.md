# Octava Review

A focused PDF drawing review application for internal coordination, client feedback and site visits. A minimal charcoal interface keeps the drawing at the center, with compact tools and a live stroke thickness slider.

[Open Octava Review](https://octava-plan-review.mattusher.chatgpt.site) · [Hosting and deployment](docs/HOSTING.md) · [Supabase account setup](docs/SUPABASE.md)

No sign-in is required to try the app or open a shared review. The repository contains application source; project data and uploaded client drawings stay in the hosted database and file storage.

## Product workflow

Start at Projects, open a project, then browse Plans in small tiles or a full-width gallery. Group drawings into discipline folders such as Architectural, Electrical or Mechanical; the same groups appear in the drawing sidebar and revisions stay together. Search by drawing name, number or revision. Create a project and import a PDF. Each page becomes a drawing. Use the pen, arrow, shape or callout tools, then adjust the stroke with the vertical slider (0.5–24 px). Click directly on the plan to type a speech-bubble callout, choose its font size beside the note, and double-click existing text to edit it. Pin tasks, record notes, assign priorities and update status. Each task opens in a large central window with its plan and pin location. The conversation accepts text, site photos and files, with a separate attachment gallery.

The project sidebar contains Plans, Tasks, Photos, Files and Specifications. Photos aggregates project uploads and task conversation images, with All photos, My photos and Liked photos collections. Hearts save likes per person in the cloud. Files accepts project documents and includes task attachments; Specifications holds specification PDFs. Phone layouts use a compact five-section bottom navigation outside the drawing view.

Calibrate each drawing against a known dimension before measuring distances or polygon areas. Place measurement endpoints individually or drag between them. A magnified crosshair, axis constraint, snapping to existing markup endpoints, adjustable 2–4 decimal precision and editable endpoint handles improve point placement. Choose Rectangle to drag a rectangular area, or Polyline for a concave closed outline. Crossing edges are rejected. Use the bottom-right unit selector to switch all measurements between meters and feet without recalibrating; areas convert to square meters or square feet. The eraser removes whole markups along a continuous sweep, including intersections between pointer events; a sweep is one undo action. Task pins preview before placement and anchor exactly at their tip. Mouse, touch and stylus use pointer events, with two-finger navigation and zoom centered at the pointer. Every new revision requires its own calibration. Revisions preserve their own feedback. Export the visible sheet and a task report as a PDF.

Review links grant client feedback or internal editor access without sign-in. They include only selected drawings, with all feedback on those accessible drawings visible by default. Optional role filters change the view, not privacy. Clients can adjust and erase their own markups; server ownership checks protect other reviewers’ annotations. Complete PDF files must be included together to prevent excluded-page disclosure. Review links are revocable and stored as hashes. Sheet-scoped links do not expose general project documents.

## Persistence and access

Supabase Auth provides optional permanent email/password accounts after the deployment is configured. The demo and client review links remain available without sign-in. Sign-in claims the current guest workspace, so existing plans and tasks are retained. Sessions use server-only HttpOnly cookies and server-validated Supabase users. See [account activation](docs/SUPABASE.md) for the required project, redirect and email settings.

D1 stores projects, membership, plan folders, sheets, markups, tasks, comments, file metadata, photo likes and hashed review links. R2 stores original PDFs, photos, files, specifications and task attachments. Project administrators add people by email and assign a role tag (Internal, Owner, Builder, Other) separately from editing permission. Everyone sees accessible plan feedback by default. Membership requires the matching verified account email; self-selected profile tags do not grant project access. Legacy explicit plan restrictions are retained and apply to every page in the same PDF.

Plan and task views refresh automatically every 2.5 seconds while active, every 15 seconds in the background, and on focus or reconnect. Photos/files refresh every 3 seconds while visible and projects every 5 seconds. Conflicting remote edits do not replace an open local task draft. PDF imports save file metadata and all pages atomically.

Anonymous visitors receive an isolated 30-day guest workspace using an opaque HttpOnly cookie, with only its hash stored server-side. Clearing cookies removes guest access. Project ownership and membership are checked on every request. Record versions prevent silent concurrent overwrites. Unsaved drawing changes remain on screen with a retry action. Saving requires an internet connection; offline editing is not implemented.

The sample Casa Canopy project is demonstration content and is created for each new owner. Actual PDF files can be imported into an empty project.

## Computer, iPad and iPhone

Open the published URL in a browser. The device button explains desktop installation and Safari Add to Home Screen. The manifest and app icons enable standalone web app installation in supporting browsers. An internet connection is required; there is no offline saving.

Once accounts are configured, sign in on each device to access your projects. Client and Team review links also provide access without sign-in. Guest ownership is browser-specific and expires after 30 days. Installation does not convert a guest session into a permanent account. Review links can be pasted into the installed app, and a reviewer can explicitly choose to remember a review as the installed app’s launch target. This local preference stores only the link capability; project content remains server-backed.

## Technical notes

Vinext and React run as a Cloudflare Worker. PDF.js renders uploaded files in the browser; pdf-lib validates uploads and produces review exports. Drawing annotations use plan-space SVG coordinates. The original PDF is stored separately and remains unchanged. Exports flatten the visible drawing and markups into a high-resolution image and append a task summary.

Dependencies use the included pnpm lockfile. Applied migrations are append-only. No production data or credentials are included in this repository.

## Local development

Use Node.js 22.13 or newer and pnpm 11.25.0, as pinned in `package.json`. Run these commands from the project directory after cloning:

```sh
pnpm install --frozen-lockfile
pnpm build
```

Development and build commands copy the PDF.js worker, fonts, character maps and WASM files from the locked dependency into `public/pdf/`. These generated assets and their accompanying licenses are included in the built app; they do not need to be committed to Git.

The build also creates `dist/server/wrangler.json`, which configures local D1 and R2 emulation. Initialize a **new local database once**, in this order:

```sh
pnpm exec wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_mixed_hannibal_king.sql
pnpm exec wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_bitter_next_avengers.sql
pnpm exec wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_unknown_rick_jones.sql
pnpm exec wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0003_whole_klaw.sql
pnpm exec wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0004_plan_folders.sql
pnpm exec wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0005_project_documents_and_photo_likes.sql
pnpm dev
```

Open the local URL printed by the server (normally `http://localhost:5173`). Local data is stored in the ignored `.wrangler/state` directory and is separate from the live app. No cloud credentials are required for this local workflow. Do not rerun the initialization SQL on an existing database; apply only new migrations in order. These explicit local commands do not maintain a migration ledger.

For later development sessions, use `pnpm dev`. To check a production build locally, run `pnpm build` followed by `pnpm start`. The start command serves the built Worker locally; it does not publish the app. A clean clone uses the portable execution profile. Sites-managed checkouts select their own local execution profile automatically.

The current production deployment uses Sites with Cloudflare Workers, D1 and R2. GitHub publishing does not configure automatic deployments, and this project is not a drop-in Vercel deployment. See the [hosting guide](docs/HOSTING.md) before changing providers.

## Verification

After `pnpm build`, run `node scripts/verify-review.mjs` and `node scripts/verify-auth.mjs`. They use isolated in-memory Worker storage. Review checks cover drawing persistence, project isolation, role tags, folders, revision grouping, atomic PDF imports, chat/project media, per-person likes and conflicts. Auth checks use a mocked Auth service to verify the session contract, workspace/media/like transfer and email-readiness gate without creating real users or sending email. Run `node --experimental-strip-types scripts/verify-sync.mjs` and `node --experimental-strip-types scripts/verify-callouts.mjs` for merge-race and callout geometry checks. Production email confirmation and recovery must also be verified after Supabase configuration; the first administrator account and production email setup remain pending.
