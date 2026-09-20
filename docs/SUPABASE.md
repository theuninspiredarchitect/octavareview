# Supabase accounts for Octava Review

The dedicated Octava Review Supabase project and runtime URL/publishable key are configured. The remaining production setup is Auth redirect URLs, an email provider and a verified first administrator account. Sign-in is implemented; registration and password-reset are gated by `SUPABASE_AUTH_EMAIL_READY` until email setup is verified. No Matt account has been created by this update.

## Service boundaries

Supabase handles account credentials, email verification, sessions and password reset. Existing D1 projects, membership and drawing records stay in D1; PDFs and attachments stay in R2. No public Supabase tables, storage buckets, service-role keys or Postgres migrations are needed for this integration.

## Activate accounts

1. Select or create a dedicated Supabase project for Octava Review. Confirm the organization and any project cost before creating it.
2. Keep the email provider enabled and email confirmation enabled. Membership is linked only through a verified email address.
3. Set the Auth Site URL to `https://octava-plan-review.mattusher.chatgpt.site`.
4. Add these exact Auth redirect URLs:
   - `https://octava-plan-review.mattusher.chatgpt.site/auth/confirm`
   - `https://octava-plan-review.mattusher.chatgpt.site/auth/confirm?recovery=1`
5. Configure a production SMTP provider for confirmation and password-reset email. Supabase's default email service is restricted to organization team addresses and is unsuitable for client registration. Keep provider credentials in Supabase's secure settings, never in this repository.
6. In the existing Site's runtime environment, set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` from this project. Use a current enabled publishable key, not a service-role or secret key. Publish with that environment revision.
7. Verify the email provider and redirect configuration, then set `SUPABASE_AUTH_EMAIL_READY=true` and publish that environment revision. Test registration and email confirmation in the same browser, sign-out/sign-in, password recovery, returning on another device, and a member account with the expected project role tag and permission. Test a guest workspace's first sign-in to ensure its existing projects, uploads and photo likes appear in the permanent account. Keep the flag false if setup is incomplete.

The server uses PKCE for email links. A verification or recovery link must be completed in the browser that started the flow. The callback exchanges the one-time code and returns refreshed HttpOnly cookies; tokens are never put in browser localStorage. The account UI explains this requirement. With embedded views, complete account registration in the standalone app tab so the confirmation link returns to the same cookie context.

For local development, copy `.env.example` to the ignored `.dev.vars` used by the Cloudflare development server, fill it with a separate test project's values, and add your local callback URLs to that test project's redirect allowlist. Do not commit real values or broaden the production redirect allowlist to arbitrary hosts.

## People and visibility

The administrator adds a person's name, email, role tag and permission in Project people. Copying the project link does not send an email. The person creates an account themselves and confirms the same email before joining. Internal, Owner, Builder and Other are classification tags, independent of administrator/editor/feedback permissions.

Everyone with access to a plan sees its markups, tasks and comments by default. The optional role filter changes the view, not access rights. Existing explicit plan audiences are retained and apply to all pages in a PDF. Attachment access checks the project, task and message. A review link has its own role tag and selected sheets; it remains usable without an account and can be revoked. Sheet-scoped links do not expose general project files, photos or specifications.

Projects, folders, photos and per-person likes are stored in D1/R2. Active plan/task views refresh every 2.5 seconds (15 seconds in the background), plus on reconnect and focus. Open task drafts are preserved when another device updates that task; the UI asks the editor to load the latest version before saving. A new whole-project link option exposes general files and presentations; existing sheet-scoped links are unchanged. Manual project backups and copy restoration are described in [BACKUPS.md](BACKUPS.md).

## Verification boundaries

`scripts/verify-auth.mjs` tests the server integration using an isolated Auth stub. It does not verify an actual Supabase project or its email provider. The app must not be described as having active permanent accounts until the live settings and real account flow are verified.

References: [Server-side Auth](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow), [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [Production email](https://supabase.com/docs/guides/auth/auth-smtp).
