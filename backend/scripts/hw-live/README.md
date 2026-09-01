# Live homework diagnostics

Scripts used to diagnose "parents can't see homework / homework images" on the live
client database (2026-09-01).

They read the live URI from the **commented-out** `MONGODB_URI` under
`##live client mongo url` in `backend/.env`, so running them never repoints the app.

`liveConnect.js` connects with **`autoIndex: false`** on purpose. `src/config/database.js`
sets `autoIndex: env.NODE_ENV !== 'production'` and `.env` says `NODE_ENV=development`, so
connecting through the app's own `connectDB` would make mongoose start **building indexes
on the live database** the moment it connects. Never swap these over to `connectDB`.

## Read-only (safe to run any time)

| script | what it answers |
| --- | --- |
| `00-probe.js` | which database the live URI lands on, and collection sizes |
| `01-diagnose.js` | indexes, duplicate phones, per-school totals, attachment integrity |
| `02-simulate.js` | replays the real homework feed for **every** parent and buckets the results |
| `03-classes.js` | per school: roster grades vs class list vs homework actually filed |
| `04-teachers.js` | every teacher's authorization surface for publishing homework |
| `06-parent-detail.js` | characterises the parents who see nothing |
| `07-orphans.js` | where the school-less "Parent User" accounts came from |
| `09-classoptions.js` | raw `listClasses` output (school view) |
| `10-teacher-form.js` | what each teacher's "Add Homework" form would actually offer them |
| `11-attribution.js` | classifies every parent into one definite root cause |
| `13-index-check.js` | live index options vs what the schema declares |
| `14-thumbnail-impact.js` | how many homework cards gain a photo from the thumbnail fallback |
| `15-final-integrity.js` | collection counts, and whether any test row was left behind |

## Writes to the live database

Both clean up after themselves and print a before/after diff proving it.

| script | what it writes | cleanup |
| --- | --- | --- |
| `08-publish-test.js` | one homework + 2 attachments, published as a real teacher | hard-deletes exactly the ids it created, in a `finally`, then diffs the full id set |
| `12-parent-image-test.js` | a login session for the built-in demo parent (`9300000001`) | deletes the session row and restores `loginCount`/`lastLoginAt` |

`08` needs teacher credentials:

```sh
LIVE_TEACHER_PASSWORD='...' node scripts/hw-live/08-publish-test.js
```

Note that `08` uploads two small files to the server's `private-uploads/`. The database
rows are removed but the two files themselves stay on the server's disk — a few hundred
bytes, named `homework-<timestamp>-<hash>.jpg`.
