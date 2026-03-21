FROM mcr.microsoft.com/devcontainers/base:debian

RUN curl https://mise.run | sh

ENV MISE_NODE_VERIFY=false

RUN echo 'eval "$(~/.local/bin/mise activate bash)"' >> ~/.bashrc && \
    echo 'eval "$(~/.local/bin/mise activate zsh)"' >> ~/.zshrc

RUN apt-get update -y && \
apt-get install -y chromium
ENV CHROME_BIN=/usr/bin/chromium

ENV IN_DEV_CONTAINER=true
