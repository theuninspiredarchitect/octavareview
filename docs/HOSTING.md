# Hosting Octava Review

## Current setup

Live app: [octava-plan-review.mattusher.chatgpt.site](https://octava-plan-review.mattusher.chatgpt.site)

| Responsibility | Current service |
| --- | --- |
| Source code and version history | [theuninspiredarchitect/octavareview](https://github.com/theuninspiredarchitect/octavareview) on GitHub |
| App and API hosting | Sites, running a Cloudflare Worker |
| Projects, annotations, tasks, comments and access links | Cloudflare D1, bound as `DB` |
| Original PDFs and task attachments | Cloudflare R2, bound as `BUCKET` |
| Permanent identities | Supabase Auth, when runtime settings are configured |
| Computer, iPad and iPhone access | The same HTTPS app URL; optional browser installation |

Vercel is not required. Supabase Auth is integrated for permanent accounts and needs its own project and runtime settings. D1 and R2 retain the existing project data and files; this change does not move them into Supabase. See [Supabase setup](SUPABASE.md). GitHub stores the source; pushing code there does not move project data, upload drawings, or deploy a new version of the live app.

GitHub Pages alone cannot run this application: its APIs need a Worker, D1 and R2. There is no GitHub Actions deployment workflow configured in this repository.

## Publishing updates to the existing app

Use the existing Octava Review project in Sites. The project identity and binding names are in `.openai/hosting.json`; this file is configuration, not a credential. Keep the project identity when updating the existing app so it retains its database, files and URL.

The Sites workflow builds the application, records the source commit, saves a deployable version and publishes that version to the existing project. Schema changes use the append-only SQL migrations in `drizzle/`. Source commits and deployment versions are separate: a documentation-only GitHub update does not require a new live app deployment.

## If moving hosting later

The server currently imports `env` from `cloudflare:workers` and requires the D1 `DB` and R2 `BUCKET` bindings. The UI uses Vinext's Next-compatible router, but the runtime is a Cloudflare Worker.

An independently managed Cloudflare deployment can retain these services, but needs real resource IDs, production configuration, a deployment pipeline and a data migration plan. The database ID in `vite.config.ts` is a local placeholder, not a production database. Generated files under `dist/` are build output, not a standalone production configuration to deploy unchanged.

The current platform can inject trusted `oai-authenticated-user-*` identity headers. When hosting outside Sites, remove the platform header identity path and use the Supabase server-validated identity instead. Do not accept those headers directly from public requests. Guest sessions and review links must keep their server-side ownership checks.

Moving to Vercel with Supabase would require porting the Worker-specific backend, replacing D1 database queries and R2 file operations, preserving the Supabase authentication flow, and migrating existing data. Connecting the repository to those services alone will not make this version work there. No such migration is needed to use the currently hosted app.

## Sharing and device access

Send a Client review link from the app for client feedback, or a Team editor link for internal review on another device. These links grant access without sign-in and can be revoked by the owner. The main app URL starts an isolated workspace for a new visitor; it does not automatically open your project.

On iPad or iPhone, open the app in Safari and use Share → Add to Home Screen. On a computer, use the browser's install option when available or bookmark the app. Installation still uses the same hosted backend. Saving requires an internet connection; offline editing is not implemented.

Anonymous owner sessions are tied to the browser, last 30 days and are lost when its cookies are cleared. Installing the app does not create a permanent owner account. Permanent account registration, sign-in, email confirmation and password reset are implemented through Supabase Auth and become available after the account setup is completed.

## What belongs in Git

Commit application source, the dependency lockfile, migrations and required static assets. Keep environment secrets, local database state, build output, uploaded client PDFs and project data out of the repository. Existing `.gitignore` rules exclude the local runtime and environment files. Hosted data needs a separate backup process; a GitHub source copy is not a project-data backup.

Provider references: [Cloudflare Workers](https://developers.cloudflare.com/workers/), [D1](https://developers.cloudflare.com/d1/), [R2](https://developers.cloudflare.com/r2/), [Vercel Next.js hosting](https://vercel.com/docs/frameworks/full-stack/nextjs), [Supabase](https://supabase.com/docs).
