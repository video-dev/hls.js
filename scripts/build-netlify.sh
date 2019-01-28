#!/bin/bash
set -e

root="./netlify"

rm -rf "$root"
mkdir "$root"

echo "Building netlify..."

# redirect / to /demo
echo "/ /demo" > "$root/_redirects"
cp -r "./dist" "$root/dist"
cp -r "./demo" "$root/demo"
cp -r "./api-docs" "$root/api-docs"

echo "Built netlify."
