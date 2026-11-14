#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ "$(uname -s)" != Darwin ]]; then
  echo 'This setup is for macOS.' >&2
  exit 1
fi
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if [[ "${1:-preview}" == install ]]; then
  if ! command -v brew >/dev/null 2>&1; then
    installer="$(mktemp -t mac-setup-homebrew)"
    trap 'rm -f "$installer"' EXIT
    curl --fail --location https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh --output "$installer"
    /bin/bash "$installer"
    rm -f "$installer"
    trap - EXIT
  fi
  brew install python git
fi
python_bin="$(command -v python3 || true)"
if [[ -z "$python_bin" ]] || { [[ "$python_bin" == /usr/bin/python3 ]] && ! xcode-select -p >/dev/null 2>&1; }; then
  echo 'Run bash setup.sh install first to install Homebrew and Python.' >&2
  exit 1
fi
exec "$python_bin" setup.py "$@"
