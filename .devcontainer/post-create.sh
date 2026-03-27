#!/usr/bin/env bash
set -euo pipefail

echo "Installing nvm..."
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
export NVM_DIR="$HOME/.nvm"
\. "$NVM_DIR/nvm.sh"

echo "Installing node..."
nvm install $(cat .node-version)

echo "Installing chromium..."
sudo apt-get update -y
sudo apt-get install -y chromium

echo "Done!"
