# Contributing to Hls.js

Thanks for contributing to hls.js. Your time and input are appreciated. To get the most out of the project, please consider the following.

## General Guidelines

### API Reference

Are you having trouble getting started with hls.js, configuration, or integration? If so, please check the [API reference](https://github.com/video-dev/hls.js/blob/master/docs/API.md)
before submitting an issue here.

### Code of Conduct

Please review the project [Code of Conduct](https://github.com/video-dev/hls.js/blob/master/CODE_OF_CONDUCT.md) and adhere to the pledge and standards for behavior when filing issues, submitting changes or interacting with maintainers.

## Reporting bugs

First, if you found an issue, **ensure the bug was not already reported** by searching on GitHub under [Issues](https://github.com/video-dev/hls.js/issues).

If you're unable to find an open issue addressing the problem, open a new one using the [bug report template](https://github.com/video-dev/hls.js/issues/new?template=bug_report.md). As part of your issue, make sure to include:

- Test stream/page (if possible)
- hls.js configuration
- Steps to reproduce
- Expected behavior
- Actual behavior

Please be as detailed as possible, provide everything another contributor would need to reproduce and issue, and understand its impact on playback and the end-user experience.

If the issue is related to your stream, and you cannot share the stream, please include all the information we would need to reproduce the problem. This includes how to generate a stream if necessary.

## Feature Requests

File feature requests using the [Feature request template](https://github.com/video-dev/hls.js/issues/new?assignees=&labels=&template=feature_request.md) filling out all parts.

Like with bug reports, please be as detailed as possible and try to make sure other contributors have everything they need to understand your request and how it will improve the project.

## Creating PRs

Pull requests are welcome and pair well with bug reports and feature requests. Here are some tips to follow before submitting your first PR:

- Use [EditorConfig](https://editorconfig.org) or at least stay consistent to the file formats defined in the `.editorconfig` file.
- Develop in a topic branch (bugfix/describe-your-fix, feature/describe-your-feature), not master
- The pre-commit hook will cover some tasks, but be sure to run `npm run prettier` before staging your commits.
- Make sure your changes pass all the required build and test tasks using `npm run sanity-check`
- Run functional integration tests locally using `npm run test:func`

## Contact

If you aren't already a member, consider joining video-dev on Slack https://video-dev.herokuapp.com/ and chatting with us in the `#hlsjs` channel.
