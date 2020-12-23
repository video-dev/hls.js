#!/bin/bash
set -e

npm run lint:fix
npm run pretty-quick
npm run type-check
