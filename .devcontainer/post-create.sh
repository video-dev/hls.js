#!/usr/bin/env bash
set -euo pipefail

echo "Installing nvm..."
# v0.40.4
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/62387b8f92aa012d48202747fd75c40850e5e261/install.sh | bash
export NVM_DIR="$HOME/.nvm"
\. "$NVM_DIR/nvm.sh"

echo "Installing node..."
nvm install "$(< .node-version)"

echo "Installing chromium..."
sudo apt-get update -y
sudo apt-get install -y chromium

echo "Done!"
