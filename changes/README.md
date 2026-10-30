# Notes for the next build

A pull request that changes the game adds one file here, named after its branch
(`changes/act3-blanket.md`), holding its changelog entry without a version number:

```
smooths the knit blanket on Act 3's bed to a shallow fold, so the jelly can walk across it.
```

Don't touch `BUILD` in `src/main.js` or the changelog's version lines. After the pull
request merges, the "Number the build" workflow (`tools/number-build.mjs`) gives
each note the next number, adds it to CHANGELOG.md as `v330 smooths the knit blanket…`,
deletes the note and commits that to main. Separate files never conflict, so
parallel pull requests no longer re-bump or re-run Game checks for each other.
