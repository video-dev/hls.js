# Performing A Release

Releases are performed automatically with [GitHub actions](https://github.com/video-dev/hls.js/actions?query=workflow%3ABuild+branch%3Amaster).

1. `git tag v<major>.<minor>.<patch>` or `git tag v<major>.<minor>.<patch>-<prerelease>` _('v' required)_ where anything before the first `.` in `<prerelease>` will be become the [npm dist-tag](https://docs.npmjs.com/cli/dist-tag).
1. `git push`
1. `git push --tag`
1. Wait for the GitHub action to create a new draft GitHub release with the build attached. The publish to npm should happen around the same time from a different step.
1. Update the release notes to the new draft GitHub release if needed.
1. Publish the GitHub release.

## Examples

- `git tag -a v1.2.3` will result in `1.2.3` being published with the `latest` npm tag.
- `git tag -a v1.2.3-beta` will result in `1.2.3-beta` being published with the `beta` npm tag.
- `git tag -a v1.2.3-beta.1` will result in `1.2.3-beta.1` being published with the `beta` npm tag.
