# Recovery And Backup

## Goal

ClawKB is a personal desktop knowledge base. The safest recovery strategy is simple: keep the `.mv2` knowledge base file under regular local backup, and treat the desktop file as the only source of truth.

## What To Back Up

- Your primary `.mv2` knowledge base files
- Any additional registered local KB files you actively use
- Optional local notes or exports you keep alongside the KB

Browser-side UI state such as draft recovery and workspace tabs can be rebuilt. Your source of truth is the local KB file itself.

## Recommended Backup Rhythm

### Daily or before heavy editing

- Copy the active `.mv2` file to a dated backup location
- Or let Time Machine / Synology Drive / another local backup tool capture the file automatically

### Before risky operations

- Before large imports
- Before bulk tag changes
- Before cross-library cleanup
- Before testing a new desktop build on your main KB

## Restore Procedure

1. Quit the desktop app.
2. Replace the damaged `.mv2` file with the latest healthy backup copy.
3. Reopen ClawKB and open that restored file.
4. Check search, document workspace, and recent imports before continuing normal edits.

## Browser Preview Reminder

- Browser preview is not your recovery target.
- It only helps validate runtime messaging and front-end guardrails.
- Real recovery always happens from desktop-local KB files and their backups.

## Failure Triage

### If a KB path no longer opens

- Confirm the file still exists on disk
- Confirm the path is the intended `.mv2` file
- Try the latest backup copy before deeper troubleshooting

### If a draft seems missing

- Check whether it was only browser-side draft state or actually saved back into the KB
- Reopen the desktop KB and search for `workspace-draft`

### If imports look wrong

- Stop bulk work
- Restore the last healthy backup
- Re-run the import on a copy of the KB first
