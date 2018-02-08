#!/bin/bash

rm -Rf html/docs && npm run docs && git add docs/html && git commit docs/html -m 'Update docs'
