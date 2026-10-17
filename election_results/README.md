# 2026 Vancouver election results

This app is deliberately separate from the liveblog page and from homepage
election coverage. One validated database snapshot is shared by the results
endpoint; a visitor request never connects to the City's SFTP server.

## Before deploying this branch to staging or production

Provision these three secrets in the corresponding Google Cloud project **before**
the deployment workflow runs. The workflow copies Google secrets to Docker
secrets, and the WSGI service mounts them at `/run/secrets/`:

- `ELECTION_SFTP_USERNAME`
- `ELECTION_SFTP_PASSWORD`
- `ELECTION_SFTP_HOST_KEY_SHA256`

The last value must be the City's independently confirmed SSH host-key SHA256
fingerprint, with its `SHA256:` prefix. Do not commit the login, password or
fingerprint as code. The account supplied for the 2026 election expires on
October 31, 2026; arrange any needed renewal with the City.

## Editor setup

1. In Wagtail **Settings → 2026 election results**, choose the election
   live-updates article. Leave **Automatic updates enabled** off until election
   night. Use the article's **Default** layout. Set its normal live policy to **Live** when automatic
   fetching should begin.
2. Choose each of the five mayor portraits and profile articles, then the seven
   party logos. Missing art falls back to text; missing profile selection leaves
   the candidate's name unlinked.
3. Open **Election results** in the Wagtail menu. **Fetch from City SFTP now**
   imports the current City file even with automatic updates off. **Import
   uploaded JSON** is the fallback for an editor-supplied `arearesults.json`.
   Grant election-night editors the `change_electionresultssettings` permission;
   the importer is hidden from other accounts.
4. Preview the linked liveblog. It shows a waiting message until the first
   import. The public endpoint refreshes at most every 30 seconds, and readers
   poll it every 60 seconds. The server checks SFTP every five minutes only
   while the switch is on and the linked article is live.

For staging visual QA, `fixtures/staging-sample-arearesults.json` has clearly
synthetic vote totals and council names. Never upload this file to production.

The importer accepts only the two expected Vancouver contests, all five
tracked mayoral candidates, and at least 20 council candidates. It rejects an
older timestamp or malformed file without replacing the last good snapshot.
`isWinner == 1` is displayed as elected; `2` is not. This interpretation is
the newsroom's current assumption and must be confirmed against City data on
election night. Polls are labeled **closed**, not **reporting**, because the
City feed exposes a `globClosedPolls` count but its reporting semantics have
not been confirmed.

The WSGI service has four replicas, each running cron. The importer uses a
MySQL advisory lock and four-minute recent-check guard so those replicas do
not all fetch the same file. A failed scheduled update logs an error and keeps
the last good snapshot available.
