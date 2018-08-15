#!/bin/bash
set -e

id=$(git rev-parse HEAD)
base="./gh-pages/$id"
latest="./gh-pages/latest"
topReadme="./gh-pages/README.md"
tag=$(git describe --exact-match --tags HEAD 2>/dev/null || echo "")

echo "Building gh-pages for $id"

mkdir -p "$base"
cp "./README.md" "$base/README.md"
cp -r "./dist" "$base/dist"
cp -r "./demo" "$base/demo"
cp -r "./docs" "$base/docs"
cp -r "./api-docs" "$base/api-docs"

if [ ! -z "$tag" ]; then
  echo "Detected tag: $tag"
  tagloc="./gh-pages/$tag"
  rm -rf "$tagloc"
  # would be nicer as a symlink, but doesn't work on travis
  cp -r "./gh-pages/$id" "$tagloc"
fi

rm -rf "$latest"
cp -r "./gh-pages/$id" "$latest"

rm -f "$topReadme"
cp "./README.md" "$topReadme"

echo "Built gh-pages."
