#!/bin/bash
set -e

if [[ $(node ./scripts/check-already-published.js) = "not published" ]]; then
  # write the token to config
  # see https://docs.npmjs.com/private-modules/ci-server-config
  echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" >> .npmrc
  if [[  -z "$TAG" ]]; then
    npm publish --tag canary
    echo "Published canary."
    curl https://purge.jsdelivr.net/npm/hls.js@canary
    curl https://purge.jsdelivr.net/npm/hls.js@canary/dist/hls-demo.js
    echo "Cleared jsdelivr cache."
  else
    tag=$(node ./scripts/get-version-tag.js)
    if [ "${tag}" = "canary" ]; then
      # canary is blocked because this is handled separately on every commit
      echo "canary not supported as explicit tag"
      exit 1
    fi
    echo "Publishing tag: ${tag}"
    npm publish --tag "${tag}"
    curl "https://purge.jsdelivr.net/npm/hls.js@${tag}"
    echo "Published."
  fi
else
  echo "Already published."
fi
