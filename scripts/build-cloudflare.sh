#!/bin/bash
set -e

root="./cloudflare-pages"

rm -rf "$root"
mkdir "$root"

echo "Building for CloudFlare..."

# redirect / to /demo
echo "/ /demo" > "$root/_redirects"
echo "/api-docs/ /api-docs/hls.js.hls.html" >> "$root/_redirects"
echo "/api-docs/index.html /api-docs/hls.js.hls.html" >> "$root/_redirects"
cp -r "./dist" "$root/dist"
cp -r "./demo" "$root/demo"
cp -r "./api-docs" "$root/api-docs"

echo "Built for CloudFlare."
