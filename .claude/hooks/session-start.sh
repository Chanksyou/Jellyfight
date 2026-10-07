#!/bin/bash
# Cloud sessions: make `node tests/run.mjs` and `node tests/check.mjs` work with no setup.
#  - the test runner's Playwright (tests/node_modules)
#  - three.js for the tests, unpacked into tests/.three (the sandbox can't reach the CDN;
#    tests/lib.mjs finds it there)
#  - the repo's git hooks (.githooks: the pre-push guardrail)
set -euo pipefail
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then exit 0; fi
cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

THREE_VERSION=$(grep -o "three@[0-9.]*" index.html | head -1 | cut -d@ -f2)   # the version the import map loads

(cd tests && npm install --no-audit --no-fund --loglevel=error)

if [ ! -f "tests/.three/package/build/three.module.js" ] || ! grep -q "\"version\": \"$THREE_VERSION\"" tests/.three/package/package.json; then
  rm -rf tests/.three && mkdir -p tests/.three
  (cd tests/.three && npm pack "three@$THREE_VERSION" --silent >/dev/null && tar xzf "three-$THREE_VERSION.tgz" && rm "three-$THREE_VERSION.tgz")
fi

git config core.hooksPath .githooks
