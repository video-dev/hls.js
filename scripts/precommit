#!/bin/bash

git status --porcelain | grep .js$ | awk 'match($1, "M"){print $2}' | xargs ./node_modules/.bin/eslint
