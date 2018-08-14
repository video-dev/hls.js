#!/bin/bash
set -e

id=$(git rev-parse HEAD)
base="./gh-pages/$id"
latest="./gh-pages/latest"
tag=$(git describe --exact-match --tags HEAD 2>/dev/null || echo "")

echo "Building gh-pages for $id"

mkdir -p "$base"
cp "./README.md" "$base/README.md"
cp -r "./dist" "$base/dist"
cp -r "./demo" "$base/demo"
cp -r "./docs" "$base/docs"

if [ ! -z "$tag" ]; then
  echo "Detected tag: $tag"
  symlink="./gh-pages/$tag"
  rm -f "$symlink"
  ln -s "./$id" "$symlink"
fi

symlink="./gh-pages/"
rm -f "$latest"
ln -s "./$id" "$latest"

echo "Built gh-pages."
