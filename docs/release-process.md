# Performing A Release
Releases are performed automatically with travis.

1. `git tag v<major>.<minor>.<patch>` _('v' required)_
2. `git push --tag`
3. Wait for travis to create a new draft GitHub release with the build attached. At this point the new npm package should have been published.
4. Add the release notes to the new draft GitHub release.
5. Publish the GitHub release.
