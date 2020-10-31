#!/bin/bash
set -e

# GITHUB_TOKEN and NETLIFY_ACCESS_TOKEN required

currentCommit=$(git rev-parse HEAD)

id=$currentCommit
root="./netlify"
version=$(jq -r -e '.version' "./package.json")
idShort="$(echo "$id" | cut -c 1-8) ($version)"
stableSiteId="deef7ecf-4c3e-4de0-b6bb-676b02e1c20e"

deploy () {
  siteId=$1
  echo "Deploying netlify to '$siteId'."
  ./node_modules/.bin/netlify deploy -d "$root" -m "deploy for $id" -s "$siteId" --prod -a "$NETLIFY_ACCESS_TOKEN"
  echo "Deployed netlify to '$siteId'."
}

echo "Creating site for current commit ($id)."
uuid=$(uuidgen)
commitSiteName="hls-js-$uuid"
commitSiteId=$(curl --fail -d "{\"name\":\"$commitSiteName\"}" -H "Content-Type: application/json" -X POST "https://api.netlify.com/api/v1/hls-js/sites?access_token=$NETLIFY_ACCESS_TOKEN" | jq -r '.site_id')
echo "Created site '$commitSiteId'."

deploy "$commitSiteId"

if [[ $version != *"-"* ]]; then
  echo "Detected new version: $version"
  deploy "$stableSiteId"
fi
echo "Finished deploying to netlify."

echo "Updating deployments branch."
git clone --depth 1 "https://${GITHUB_TOKEN}@github.com/video-dev/hls.js.git" -b deployments "$root/deployments"
cd "$root/deployments"
echo "- [\`$idShort\`](https://github.com/video-dev/hls.js/commit/$id): [https://$commitSiteName.netlify.app/](https://$commitSiteName.netlify.app/)" >> "README.md"
git add "README.md"
git -c user.name="HLS.JS CI" commit -m "update for $id"
git push "https://${GITHUB_TOKEN}@github.com/video-dev/hls.js.git"
cd ..
echo "Updated deployments branch."
