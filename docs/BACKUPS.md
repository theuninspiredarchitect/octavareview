# Project backups and recovery

Project administrators open **Files → Backups → Create backup now**. This is an explicit manual snapshot, not a scheduled backup service. Keep the window open until copying completes. Interrupted copies can be resumed.

Each snapshot captures the D1 project metadata in one transaction: drawings and revisions, annotations, tasks, conversations, plan folders, documents, photo groups, assignments, likes and membership metadata. Every original plan PDF, project document and task attachment is then streamed into an independent backup prefix in R2. The snapshot is marked complete only when each copy has been checked. Generated thumbnails are not backed up; originals are retained. Supabase passwords/sessions, browser guest sessions and live share tokens are never included.

**Restore copy** is administrator-only and creates a new private project with remapped IDs and copies of all original files. It does not overwrite the existing project or reactivate membership and review links. The administrator can add participants after checking the restored project. Original authorship and role classifications are retained.

**Download backup archive** streams a POSIX `.tar` archive containing `manifest.json` and every original file. The manifest maps original filenames to archive paths and includes the complete annotation/task records. Save this archive somewhere independent, such as the project's Drive folder. Same-bucket cloud copies do not protect against loss of the entire storage account. The app's restore button restores cloud snapshots; importing a downloaded archive after total account loss is an administrator recovery operation, not currently a user-facing import flow.

## Verification

`scripts/verify-review.mjs` runs `verify-portal.mjs` against isolated local D1/R2 instances. It verifies complete-file SHA-256 equality, archive contents, copy restoration, record relationships, photo groups/likes, original document access and permission isolation. These tests do not simulate provider-wide failure or verify an external scheduled backup service.

## Capacity

Every snapshot stores another copy of its original files, so storage grows with backup frequency and project size. No automated retention or deletion is enabled. Uploads use 8 MiB chunks, with automatic retry of transient part failures. General files, presentations and task attachments are limited to 200 MiB each; plan PDFs are limited to 64 MiB and 200 pages because they are parsed before publishing their sheets. Upload sessions expire after 24 hours; incomplete R2 multipart data follows the bucket's multipart lifecycle (R2's default is seven days). The browser must remain open while uploading or copying; cross-device resumption of file uploads is not implemented.
