# CONTRIBUTING

Thanks for taking the time to contribute. If you aren't already a member consider joining video-dev on Slack https://video-dev.herokuapp.com/ and chatting with us in the `#hlsjs` channel.

## Creating PRs

Pull requests are welcome. Here are some tips to follow before submitting your first PR:

- Use [EditorConfig](https://editorconfig.org) or at least stay consistent to the file formats defined in the `.editorconfig` file.
- Develop in a topic branch (bugfix/describe-your-fix, feature/describe-your-feature), not master
- Prettier should run automatically in the pre-commit hook, but if it doesn't, run `npm run prettier`.
- Make sure your branch passes all the required build and test tasks using `npm run sanity-check`
- Run functional integration tests locally using `npm run test:func`

## Reporting bugs

File issues using the [Bug Report Template](https://github.com/video-dev/hls.js/issues/new?template=bug_report.md) as part of your issue, making sure to include:

- Test stream/page (if possible)
- Steps to reproduce
- Expected behavior
- Actual behavior

If the issue is related to your stream, and you cannot share the stream, please include all the information we would need to reproduce the issue. This includes how generate a stream that reproduces the issue.
