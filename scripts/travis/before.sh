#!/bin/bash
# https://docs.travis-ci.com/user/customizing-the-build/#Implementing-Complex-Build-Steps
set -ev

if [ "${TRAVIS_MODE}" = "funcTests" ]; then
	echo "Starting web server..."
    nohup python -m SimpleHTTPServer 8000 > /dev/null 2>&1 &
    # wait until server started
    until curl -s 127.0.0.1:8000; do true; done > /dev/null
    echo "Started web server."
fi
