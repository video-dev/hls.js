# Deploying 🚀

We deploy our forked version of HLS.js via npm.

## Steps to Deploy

1. run `npm version` from the `master` branch, fill out the form, and push up your commit
1. run `npm login` and log into `npm` using the NPM credentials in 1Password
1. run `npm publish`

For the version number, we keep the base version that we are currently forked against from Hls.js _plus_ a semver prelease version. E.g. `1.0.4-4`.

## Creating a Github Release

To help us keep track of Wistia HLS changes, it is also expected to create an associated Github Release.

To keep things simple, our release version number should make that of the NPM version we have just deployed.

The release message should try and document all the big changes that have happened and a link to the diff between versions.

```
* my awesome change
* some other thing
* BREAKING:
  * Now only supports dog videos

https://github.com/wistia/hls.js/compare/v1.2.3-1...v1.2.4-1

```

## Updating player-modern

You will also need to go and update player-modern with your new npm release and deploy the player
