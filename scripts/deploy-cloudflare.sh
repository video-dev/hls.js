#!/bin/bash
set -e

# GITHUB_TOKEN and CLOUDFLARE_API_TOKEN required
accountId="0b5dddd7f1257d8d0b3594dbe325053c"
stableProjectName="hls-js"
latestProjectName="hls-js-dev"

currentCommit=$(git rev-parse HEAD)

root="./cloudflare-pages"
version="$(jq -r -e '.version' "./package.json")"
commitShort="$(echo "$currentCommit" | cut -c 1-8)"

deploy () {
  projectName=$1
  echo "Deploying on CloudFlare to '$projectName'."
  CLOUDFLARE_ACCOUNT_ID="$accountId" ./node_modules/.bin/wrangler pages publish --project-name "$projectName" --commit-dirty=true --branch=master --commit-hash="$currentCommit" $root
  echo "Deployed on CloudFlare to '$projectName'."
}

deploy "$latestProjectName"

if [[ $version != *"-"* ]]; then
  echo "Detected new version: $version"
  deploy "$stableProjectName"
fi

echo "Finished deploying to CloudFlare."

echo "Fetching deployment urls."

deploymentUrl=`curl -X GET --fail "https://api.cloudflare.com/client/v4/accounts/$accountId/pages/projects/$latestProjectName/deployments" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H "Content-Type:application/json" | jq --raw-output --exit-status '[.result[] | select(.deployment_trigger.metadata.commit_hash == "'"$currentCommit"'")][0].url'`

echo "Updating deployments branch."
git clone --depth 1 "https://${GITHUB_TOKEN}@github.com/video-dev/hls.js.git" -b deployments "$root/deployments"
cd "$root/deployments"

jq '.stable = "https://hlsjs.video-dev.org/"' deployments.json > deployments.json.tmp
mv deployments.json.tmp deployments.json

jq '.latest = "https://hlsjs-dev.video-dev.org/"' deployments.json > deployments.json.tmp
mv deployments.json.tmp deployments.json

jq \
  --arg version "$version" \
  --arg commit "$currentCommit" \
  --arg url "$deploymentUrl/" \
  '.individual += [{
  "version": $version,
  "commit": $commit,
  "url": $url,
}]' deployments.json > deployments.json.tmp
mv deployments.json.tmp deployments.json

node ../../scripts/build-deployments-readme.js './deployments.json' '.'

git add "deployments.json"
git add "deployments.txt"
git add "README.md"

git -c user.name="hlsjs-ci" -c user.email="40664919+hlsjs-ci@users.noreply.github.com" commit -m "update for $commitShort"
git push "https://${GITHUB_TOKEN}@github.com/video-dev/hls.js.git"
cd ..
echo "Updated deployments branch."
