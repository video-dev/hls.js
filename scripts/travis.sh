#!/bin/bash
# https://docs.travis-ci.com/user/customizing-the-build/#Implementing-Complex-Build-Steps
set -ev

echo "travis_fold:start:npm_install"
npm ci
echo "travis_fold:end:npm_install"

if [ "${TRAVIS_MODE}" = "build" ]; then
  echo "travis_fold:start:lint"
  npm run lint
  echo "travis_fold:end:lint"
  echo "travis_fold:start:build"
  npm run type-check
  npm run build
  echo "travis_fold:end:build"
  echo "travis_fold:start:docs"
  npm run docs
  echo "travis_fold:end:docs"
  # check that hls.js doesn't error if requiring in node
  # see https://github.com/video-dev/hls.js/pull/1642
  node -e 'require("./" + require("./package.json").main)'
elif [ "${TRAVIS_MODE}" = "unitTests" ]; then
  npm run test:unit
elif [ "${TRAVIS_MODE}" = "funcTests" ]; then
  npm run build
  n=0
  maxRetries=1
  until [ $n -ge ${maxRetries} ]
  do
    if [ $n -gt 0 ]; then
      echo "Retrying... Attempt: $((n+1))"
      delay=$((n*60))
      echo "Waiting ${delay} seconds..."
      sleep $delay
    fi
    npm run test:func && break
    n=$[$n+1]
  done
  if [ ${n} = ${maxRetries} ]; then
    exit 1
  fi
elif [ "${TRAVIS_MODE}" = "release" ] || [ "${TRAVIS_MODE}" = "releaseAlpha" ] || [ "${TRAVIS_MODE}" = "netlifyPr" ] || [ "${TRAVIS_MODE}" = "netlifyBranch" ]; then
  # update the version
  if [[ $(git rev-parse --is-shallow-repository) = "true" ]]; then
    # make sure everything is fetched https://github.com/travis-ci/travis-ci/issues/3412
    git fetch --unshallow
  fi
  node ./scripts/set-package-version.js
  npm run lint
  npm run type-check
  npm run build:ci

  if [ "${TRAVIS_MODE}" = "release" ] || [ "${TRAVIS_MODE}" = "releaseAlpha" ]; then
    # unit tests don't work on netlify because they need chrome
    npm run test:unit

    if [[ $(node ./scripts/check-already-published.js) = "not published" ]]; then
      # write the token to config
      # see https://docs.npmjs.com/private-modules/ci-server-config
      echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" >> .npmrc
      if [ "${TRAVIS_MODE}" = "releaseAlpha" ]; then 
        npm publish --tag alpha
        echo "Published alpha."
        curl https://purge.jsdelivr.net/npm/hls.js@alpha
        curl https://purge.jsdelivr.net/npm/hls.js@alpha/dist/hls-demo.js
        echo "Cleared jsdelivr cache."
      elif [ "${TRAVIS_MODE}" = "release" ]; then
        tag=$(node ./scripts/get-version-tag.js)
        if [ "${tag}" = "alpha" ]; then
          # alpha (previously canary) is blacklisted because this is handled separately on every commit
          echo "alpha (previously canary) not supported as explicit tag"
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
  fi
  npm run docs

  ./scripts/build-netlify.sh
  if [ "${TRAVIS_MODE}" = "release" ] || [ "${TRAVIS_MODE}" = "releaseAlpha" ]; then
    ./scripts/deploy-netlify.sh
  fi
else
  echo "Unknown travis mode: ${TRAVIS_MODE}" 1>&2
  exit 1
fi
