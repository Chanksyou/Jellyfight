# Publishing the game to its claude.ai artifact

The artifact is <https://claude.ai/artifact/3XfF3gyDMg6L1pHhZn3xEW>. Its page is `index.html`; every other file the game loads is published next to it at the same path. Pushing `main` redeploys the game's own site (Cloudflare) by itself; the artifact is republished by hand, after the push.

1. **Read the artifact first** (`Artifact` tool, `action: "read"`), so you build on the live version. If its files differ from `main` before your change, someone edited it in place: find out before overwriting.
2. **List the files that changed** since the last publish, limited to what the game serves:
   `git diff --name-only <last published commit> HEAD | grep -E '^(src|content)/|^index.html$'`
   Files left out stay as they are; a removed file needs `null`.
3. **Publish** with `file_path: index.html`, the artifact's `url`, and `files` mapping each path to itself. `.kdl` content files need `{ "from": "content/x.kdl", "contentType": "text/plain" }`: the tool refuses an unknown extension.
4. Add a short `label` (`vN: what changed`). The artifact's "Version N" counts publishes, not `BUILD`.

## Leaderboard

`src/leaderboard.js` keeps scores in the artifact's database. A publish without `capabilities` keeps the stored ones; a first publish (or one that must reset them) passes:

`capabilities: { db: { rules: [ { path: "scores", read: "view", write: "owner" }, { path: "scores/{self}", write: "interact" } ] }, user: {} }`

Everyone reads the board; each player writes only `scores/<their id>`. Off claude.ai the board shows as offline and the game still works.
