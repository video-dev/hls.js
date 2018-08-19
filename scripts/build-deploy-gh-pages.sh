#!/bin/bash
set -e

id=$(git rev-parse HEAD)
root="./gh-pages"
base="$root/$id"
latest="$root/latest"
stable="$root/stable"
topDemo="$root/demo"
topDist="$root/dist"
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
  tagloc="./gh-pages/$tag"
  rm -rf "$tagloc"
  # would be nicer as a symlink, but doesn't work on github
  cp -r "$root/$id" "$tagloc"
  rm -rf "$stable"
  cp -r "$root/$id" "$stable"
  rm -rf "$topDemo"
  cp -r "./demo" "$topDemo"
  rm -rf "$topDist"
  cp -r "./dist" "$topDist"
fi

rm -rf "$latest"
cp -r "$root/$id" "$latest"

echo "Built gh-pages."

echo "Deploying gh-pages."
cd "$root"
git add -A
if ! git diff --cached --quiet; then
  git -c user.name="HLS.JS CI" commit -m "gh-pages for $id"
  # GITHUB_TOKEN set in travis
  git push "https://${GITHUB_TOKEN}@github.com/video-dev/hls.js.git"
else
  echo "No changed to deploy."
fi
cd ..
echo "Deployed gh-pages."
