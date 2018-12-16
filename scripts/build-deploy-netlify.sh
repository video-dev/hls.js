#!/bin/bash
set -e

# GITHUB_TOKEN and NETLIFY_ACCESS_TOKEN set in travis

id=$(git rev-parse HEAD)
root="./netlify"
tag=$(git describe --exact-match --tags HEAD 2>/dev/null || echo "")
idShort=$(echo "$id" | cut -c 1-8)
if [ ! -z "$tag" ] && [[ $tag == v* ]]; then
  idShort="$idShort ($tag)"
fi
latestSiteId="642d9ad4-f002-4104-9309-40ed9cd81a1f"
stableSiteId="deef7ecf-4c3e-4de0-b6bb-676b02e1c20e"

rm -rf "$root"
mkdir "$root"

echo "Building netlify for $id"

# redirect / to /demo
echo "/ /demo" > "$root/_redirects"
cp -r "./dist" "$root/dist"
cp -r "./demo" "$root/demo"
cp -r "./api-docs" "$root/api-docs"

echo "Built netlify."

deploy () {
  siteId=$1
  echo "Deploying netlify to '$siteId'."
  ./node_modules/.bin/netlify deploy -d "$root" -m "deploy for $id" -s "$siteId" --prod -a "$NETLIFY_ACCESS_TOKEN"
  echo "Deployed netlify to '$siteId'."
}

echo "Creating site for current commit."
uuid=$(uuidgen)
commitSiteName="hls-js-$uuid"
commitSiteId=$(curl --fail -d "{\"name\":\"$commitSiteName\"}" -H "Content-Type: application/json" -X POST "https://api.netlify.com/api/v1/sites?access_token=$NETLIFY_ACCESS_TOKEN" | jq -r '.site_id')
echo "Created site '$commitSiteId'."

deploy "$commitSiteId"
deploy "$latestSiteId"
if [ ! -z "$tag" ] && [[ $tag == v* ]]; then
  echo "Detected tag: $tag"
  deploy "$stableSiteId"
fi
echo "Finished deploying to netlify."

echo "Updating deployments branch."
git clone --depth 1 "https://${GITHUB_TOKEN}@github.com/video-dev/hls.js.git" -b deployments "$root/deployments"
cd "$root/deployments"
echo "- [\`$idShort\`](https://github.com/video-dev/hls.js/commit/$id): [https://$commitSiteName.netlify.com/](https://$commitSiteName.netlify.com/)" >> "README.md"
git add "README.md"
git -c user.name="HLS.JS CI" commit -m "update for $id"
git push "https://${GITHUB_TOKEN}@github.com/video-dev/hls.js.git"
cd ..
echo "Updated deployments branch."
