#!/bin/bash
set -e

$(git diff --exit-code docs/API.md > /dev/null) && exit_status=$? || exit_status=$?
if [[ $exit_status -ne 0 ]]; then
  echo "API.md is not in sync. Please run 'npm run docs' and commit that change"
  exit 1
fi

echo "Docs up to date"
