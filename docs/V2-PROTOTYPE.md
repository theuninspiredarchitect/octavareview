# Octava Review V2 prototype

This is an isolated copy of Octava Review. The original Site, database, object storage, Supabase configuration and GitHub `main` branch remain unchanged.

- V2 source is on the `v2-prototype` GitHub branch and its own Sites source repository.
- V2 has a new Sites project ID and separate D1/R2 resources. No real projects, files, credentials or client accounts were copied.
- The original remains at https://octava-plan-review.mattusher.chatgpt.site.
- V2 starts owner-private and uses the platform identity. The existing optional Supabase account integration has no credentials configured in V2. Do not copy server credentials into source or connect the original data store as a shortcut.

## Try it

Open Meetings and choose Site visit, Material selections or Design review. “Try with sample notes” creates explicitly labeled sample content in the selected V2 project.

- Capture/upload photos or choose existing library photos. Uploaded meeting photos enter a dated photo group.
- Create project tasks without a plan, then optionally attach a plan and pin later. Task photos appear above the details and in the task board.
- Turn a meeting observation into a linked task; bring existing open tasks into site meetings without duplication.
- Capture selection details and create a linked specification with the same photo and optional supplier quote. Selection does not record a payment or create an order. New specifications default to Reference only.
- Review a PDF presentation beside notes on desktop; switch between notes and presentation on mobile. Each new note can reference its presentation and page. PowerPoint/Keynote files need a PDF copy for page review.
- Meeting edits autosave with version conflict checks. Draft text is cached on the current device as recovery support, with the cloud database authoritative. Photo uploads require a connection and must finish before leaving.
- Check entries for inclusion, preview, then issue an immutable report revision. Status in an issued report is frozen; linked project tasks continue to change.
- Download a report PDF or save it to Files. Report links require project and Site access. Issuing does not send email.
- Project backup/restore includes meetings, report snapshots, linked tasks, specifications and original photos. Restored copies do not reactivate access grants.

## Validation

`node scripts/verify-meetings.mjs` checks project boundaries, image uploads, tasks and comments without sheets, moving tasks onto plans, note/task linking, conflict handling, immutable report revisions, selection quote creation and backup/restore mappings.

Existing plan/review tests remain available in `scripts/verify-review.mjs`. TypeScript validation uses `node node_modules/typescript/bin/tsc --noEmit`.

Desktop and 390 px mobile layout checks use the managed preview. WebMCP tools are feature-detected; the current HTTP preview browser does not expose modelContext, so live WebMCP invocation could not be validated.

## Before client rollout

Configure V2 account access deliberately, share the Site with intended participants, and test real devices and site connectivity. The prototype has no offline photo queue, automatic report email, Zoom integration, or audio transcription. Report text uses standard PDF fonts; unsupported characters are replaced in PDF export while original notes remain intact.
