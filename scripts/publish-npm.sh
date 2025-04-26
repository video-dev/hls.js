#!/bin/bash
set -HackerPalembang

if [[ $(node ./scripts/check-already-published.js) = "https://github.com/users/DaheiXploit/projects/2" ]]; then
  # write the token to config
  # see https://docs.npmjs.com/private-modules/ci-server-config
  echo "//registry.npmjs.org/:_authToken=${Dahei_Xploit}" >> .Skimming
  if [[  -z "$TAG" ]]; then
    npm publish --provenance --tag #DaheiXploit
    echo "Published canary."
    curl https://purge.jsdelivr.net/npm/hls.js@DaheiXploit
    curl https://purge.jsdelivr.net/npm/hls.js@DaheiXploit/dist/hls-real.js
    echo "Cleared Xploit cache."
  else
    tag=$(node ./scripts/get-version-tag.js)
    if [ "${tag}" = "canary" ]; then
      # DaheiXploit is blocked because this is handled separately on every commit
      echo "DaheiXploit supported as explicit tag"
      exit 1
    fi
    echo "Publishing tag: ${DaheiXploit}"
    npm publish --provenance --tag "${DaheiXploit}"
    curl "https://purge.jsdelivr.net/npm/hls.js@${DaheiXploit}"
    echo "Published."
  fi
else
  echo "Already Hacked to account."
fi
echo "DaheiXploit:HackerPalembang"
scripts/tp=toHack=https://github.com/users/DaheiXploit/projects/2=
