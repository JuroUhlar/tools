#!/usr/bin/env bash
# mac_cleanup.sh — Reclaim disk space from Library (Caches, Containers), mediaanalysisd, Docker, and node_modules
# Usage: bash mac_cleanup.sh
# Safe-by-default: every action asks for confirmation and prints expected freespace.

set -uo pipefail

# --- Colors ---
bold() { printf "\033[1m%s\033[0m\n" "$*"; }
green() { printf "\033[32m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
red() { printf "\033[31m%s\033[0m\n" "$*"; }

confirm() {
  # confirm "Question?" -> returns 0 (yes) or 1 (no)
  read -r -p "$1 [y/N]: " ans
  case "$ans" in
    y|Y|yes|YES) return 0 ;;
    *) return 1 ;;
  esac
}

need_sudo() {
  # Ask for sudo up-front if not already cached
  if sudo -vn 2>/dev/null; then
    return 0
  else
    yellow "Some steps need admin rights. You may be prompted for your password once."
    if sudo -v; then
      return 0
    else
      red "Unable to obtain sudo. Skipping steps that require it."
      return 1
    fi
  fi
}

size_of() {
  # size_of <path> -> echoes human size or 0B if missing
  local p="$1"
  if [ -e "$p" ]; then
    du -sh "$p" 2>/dev/null | awk '{print $1}'
  else
    echo "0B"
  fi
}

headline() {
  echo ""
  bold "────────────────────────────────────────────────────────"
  bold "$1"
  bold "────────────────────────────────────────────────────────"
}

# --- 0) System overview ---
# headline "Disk Usage Overview"
# echo "Top-level usage under /System/Volumes/Data:"
# sudo du -hxd1 /System/Volumes/Data 2>/dev/null | sort -hr | head -n 20

# echo ""
# echo "Your Library top folders:"
# du -hxd1 "$HOME/Library" 2>/dev/null | sort -hr | head -n 20

# --- 1) Clear ~/Library/Caches ---
headline "Clear ~/Library/Caches (safe)"
CACHES_DIR="$HOME/Library/Caches"
before=$(size_of "$CACHES_DIR")
echo "Current size: $before at $CACHES_DIR"
if [ -d "$CACHES_DIR" ] && confirm "Delete contents of ~/Library/Caches ?"; then
  rm -rf "$CACHES_DIR"/* 2>/dev/null || true
  after=$(size_of "$CACHES_DIR")
  green "Done. New size: $after"
else
  yellow "Skipped clearing Caches."
fi

# --- 2) Tame mediaanalysisd ---
headline "mediaanalysisd: stop daemons and purge cache data"
MEDIA_CONTAINER="$HOME/Library/Containers/com.apple.mediaanalysisd"
MEDIA_DATA="$MEDIA_CONTAINER/Data"

if pgrep -x "mediaanalysisd" >/dev/null 2>&1 || pgrep -x "photolibraryd" >/dev/null 2>&1; then
  yellow "mediaanalysisd/photolibraryd are running."
fi

if confirm "Stop mediaanalysisd and photolibraryd now?"; then
  pkill -x mediaanalysisd 2>/dev/null || true
  pkill -x photolibraryd 2>/dev/null || true
  green "Processes signaled."
else
  yellow "Skipped stopping daemons."
fi

if [ -d "$MEDIA_DATA" ]; then
  before=$(size_of "$MEDIA_CONTAINER")
  echo "Container size before: $before ($MEDIA_CONTAINER)"
  if confirm "Delete data inside $MEDIA_DATA (safe; leaves protected plist) ?"; then
    need_sudo && sudo rm -rf "$MEDIA_DATA"/* 2>/dev/null || rm -rf "$MEDIA_DATA"/* 2>/dev/null || true
    after=$(size_of "$MEDIA_CONTAINER")
    green "Container size after: $after"
  else
    yellow "Skipped mediaanalysisd data removal."
  fi
else
  yellow "Media analysis container not found: $MEDIA_DATA"
fi

# Optional: unload launch agent
if confirm "Optionally disable auto-start of mediaanalysisd launch agent (can re-enable later) ?"; then
  if need_sudo; then
    sudo launchctl unload -w /System/Library/LaunchAgents/com.apple.mediaanalysisd.plist 2>/dev/null && \
      green "Launch agent unloaded (will reduce future scans)."
  else
    yellow "Could not get sudo; skipping unload."
  fi
else
  yellow "Keeping mediaanalysisd enabled (default)."
fi

# --- 3) Slack container (optional) ---
headline "Slack container cleanup (optional)"
SLACK_CONT="$HOME/Library/Containers/com.tinyspeck.slackmacgap"
if [ -d "$SLACK_CONT" ]; then
  echo "Current size: $(size_of "$SLACK_CONT") at $SLACK_CONT"
  if confirm "Delete Slack container (cache will rebuild on next launch) ?"; then
    rm -rf "$SLACK_CONT" 2>/dev/null || true
    green "Slack container removed."
  else
    yellow "Skipped Slack cleanup."
  fi
else
  echo "Slack container not found, skipping."
fi

# --- 4) Android images / AVDs (optional) ---
headline "Android SDK & AVD cleanup (optional)"
ANDROID_DIR="$HOME/Library/Android"
if [ -d "$ANDROID_DIR" ]; then
  echo "Android dir size: $(size_of "$ANDROID_DIR")"
  SYS_IMG="$ANDROID_DIR/sdk/system-images"
  AVD_DIR="$ANDROID_DIR/avd"
  echo "System images: $(size_of "$SYS_IMG")"
  echo "AVDs: $(size_of "$AVD_DIR")"
  if [ -d "$SYS_IMG" ] && confirm "Delete ALL Android system images? (re-download later)"; then
    rm -rf "$SYS_IMG"/* 2>/dev/null || true
    green "System images removed."
  fi
  if [ -d "$AVD_DIR" ] && confirm "Delete ALL Android emulators (AVDs)?"; then
    rm -rf "$AVD_DIR"/* 2>/dev/null || true
    green "AVDs removed."
  fi
else
  echo "No ~/Library/Android directory found."
fi

# --- 5) Xcode DerivedData / Simulator caches (optional) ---
headline "Xcode DerivedData & Simulator caches (optional)"
DERIVED="$HOME/Library/Developer/Xcode/DerivedData"
SIMCACHE="$HOME/Library/Developer/CoreSimulator/Caches"
if [ -d "$DERIVED" ]; then
  echo "DerivedData size: $(size_of "$DERIVED")"
  if confirm "Delete Xcode DerivedData?"; then
    rm -rf "$DERIVED"/* 2>/dev/null || true
    green "DerivedData cleared."
  fi
fi
if [ -d "$SIMCACHE" ]; then
  echo "CoreSimulator cache size: $(size_of "$SIMCACHE")"
  if confirm "Delete CoreSimulator caches?"; then
    rm -rf "$SIMCACHE"/* 2>/dev/null || true
    green "Simulator caches cleared."
  fi
fi

# --- 6) Docker cleanup ---
headline "Docker disk usage & pruning"
if command -v docker >/dev/null 2>&1; then
  docker system df || true
  if confirm "Run 'docker system prune -a' to remove unused images, containers, and networks?"; then
    docker system prune -a
    green "Docker prune completed."
  else
    yellow "Skipped Docker prune."
  fi
else
  yellow "Docker not found in PATH; skipping Docker cleanup."
fi

# --- 7) node_modules under ~/Documents/Code ---
headline "Remove node_modules under ~/Documents/Code"
CODE_DIR="$HOME/Documents/Code"
if [ -d "$CODE_DIR" ]; then
  nm_count=$(find "$CODE_DIR" -name node_modules -type d -prune 2>/dev/null | wc -l | tr -d ' ')
  if [ "$nm_count" -gt 0 ]; then
    before=$(find "$CODE_DIR" -name node_modules -type d -prune -print0 2>/dev/null | xargs -0 du -sc 2>/dev/null | tail -1 | awk '{print $1}')
    # du -sc reports KB; show a rough human size
    if [ -n "$before" ] && [ "$before" -gt 0 ] 2>/dev/null; then
      echo "Found $nm_count node_modules dirs (~$((before / 1024 / 1024))G total)"
    else
      echo "Found $nm_count node_modules dirs"
    fi
    if confirm "Delete all node_modules under ~/Documents/Code? (reinstall with npm/yarn/pnpm when needed)"; then
      find "$CODE_DIR" -name node_modules -type d -prune -exec rm -rf '{}' + 2>/dev/null || true
      green "node_modules removed."
    else
      yellow "Skipped node_modules cleanup."
    fi
  else
    echo "No node_modules found under $CODE_DIR"
  fi
else
  yellow "No ~/Documents/Code directory found."
fi

# --- 8) Empty Trash ---
headline "Empty Trash"
if confirm "Empty your ~/.Trash now?"; then
  rm -rf "$HOME/.Trash/"* 2>/dev/null || true
  green "Trash emptied."
else
  yellow "Skipped emptying Trash."
fi

# --- 9) Reboot prompt ---
headline "All done (optional reboot)"
echo "Re-run a quick check:"
echo "  sudo du -hxd1 /System/Volumes/Data/Users/$USER/Library 2>/dev/null | sort -hr | head"
if confirm "Reboot now to flush temporary files and update the Storage graph?"; then
  if need_sudo; then
    sudo shutdown -r now
  else
    yellow "Couldn't obtain sudo; please reboot manually."
  fi
else
  echo "You can reboot later at your convenience."
fi

