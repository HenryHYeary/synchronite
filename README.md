# synchronite
Enables cloud saves for RetroArch and detects file conflicts.

Think of it as a CLI version of Steam's cloud save support.

## Installation and Setup
1. Navigate to the project directory and run `npm install && npm run build` followed by `npm link` to use the CLI.
2. Run `synchronite init` to set up your configuration, specifying your RetroArch `saves` and `states` folders. (Make sure to select Dropbox as the provider as the other providers are not supported yet).
3. Run `synchronite` and allow your local files to sync with **Dropbox** (more providers to come).
4. Repeat this setup on all of your desktop devices to maintain synced files between play sessions on any device.

## How it works
Synchronite watches your RetroArch save/state folders, hashes files to detect 
changes, and syncs them to Dropbox. If the same save is modified on two devices 
before syncing, [explain what actually happens — flagged? merged? kept both?].

## Limitations (v1)
- Dropbox only (more providers planned)
- OAuth setup still manual / in progress