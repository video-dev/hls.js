#!/bin/bash
set -e

if [[ $(git rev-parse --is-shallow-repository) = "true" ]]; then
  # make sure everything is fetched
  git fetch --unshallow
fi

npx -y npm-ci-please@1
node ./scripts/set-package-version.js
npm run lint
npm run type-check
npm run build:ci
npm run docs
./scripts/build-netlify.sh
