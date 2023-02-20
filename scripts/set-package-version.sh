#!/bin/bash
set -e

VERSION="$(node ./scripts/get-package-version.js)"
echo "Setting version to '$VERSION'"
npm version --git-tag-version false "$VERSION"
