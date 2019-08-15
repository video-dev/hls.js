# Performing A Release
Releases are performed automatically with travis.

1. `git tag -a v<major>.<minor>.<patch>` or `git tag -a v<major>.<minor>.<patch>-<prerelease>`   _('v' required)_ where anything before the first `.` in `<prerelease>` will be become the [npm dist-tag](https://docs.npmjs.com/cli/dist-tag).
1. `git push`
1. `git push --tag`
1. Wait for travis to create a new draft GitHub release with the build attached. At this point the new npm package should have been published.
1. Add the release notes to the new draft GitHub release.
1. Publish the GitHub release.

## Examples
- `git tag -a v1.2.3` will result in `1.2.3` being published with the `latest` npm tag.
- `git tag -a v1.2.3-beta` will result in `1.2.3-beta` being published with the `beta` npm tag.
- `git tag -a v1.2.3-beta.1` will result in `1.2.3-beta.1` being published with the `beta` npm tag.
