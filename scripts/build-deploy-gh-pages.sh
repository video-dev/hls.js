#!/bin/bash
set -e

id=$(git rev-parse HEAD)
root="./gh-pages"
base="$root/$id"
latest="$root/latest"
stable="$root/stable"
topReadme="$root/README.md"
tag=$(git describe --exact-match --tags HEAD 2>/dev/null || echo "")

echo "Cloning current gh-pages..."

rm -rf "$root"
mkdir "$root"
cd "$root"
git clone --depth 1 "https://${GITHUB_TOKEN}@github.com/video-dev/hls.js.git" -b gh-pages .
cd ..

echo "Building gh-pages for $id"

mkdir -p "$base"
cp "./README.md" "$base/README.md"
cp -r "./dist" "$base/dist"
cp -r "./demo" "$base/demo"
cp -r "./docs" "$base/docs"
cp -r "./api-docs" "$base/api-docs"

if [ ! -z "$tag" ] && [[ $tag == v* ]]; then
  echo "Detected tag: $tag"
  symlink="$root/$tag"
  rm -f "$symlink"
  ln -s "./$id" "$symlink"
  rm -f "$stable"
  ln -s "./$id" "$stable"
fi

rm -f "$latest"
ln -s "./$id" "$latest"

rm -f "$topReadme"
cp "./README.md" "$topReadme"

echo "Built gh-pages."

echo "Deploying gh-pages."
cd "$root"
git add -A
git commit -m "gh-pages: $id"
# GITHUB_TOKEN set in travis
git push "https://${GITHUB_TOKEN}@github.com/video-dev/hls.js.git"
cd ..
echo "Deployed gh-pages."
