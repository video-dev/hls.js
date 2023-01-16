#!/bin/bash
set -e

root="./netlify"

rm -rf "$root"
mkdir "$root"

echo "Building netlify..."

# redirect / to /demo
echo "/ /demo" > "$root/_redirects"

# rediect /api-docs to github API.md
echo "/api-docs https://github.com/video-dev/hls.js/tree/master/docs/API.md" > "$root/_redirects"

cp -r "./dist" "$root/dist"
cp -r "./demo" "$root/demo"


echo "Built netlify."
