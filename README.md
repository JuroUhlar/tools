# tools

Personal macOS setup and maintenance tools.

## [Mac setup](./mac-setup)

Transfer selected system preferences, app configuration, editor settings, Oh My Zsh, and Git to another Mac. Includes app installation, a read-only preview, backups, restore, and configuration capture. See the [setup instructions](./mac-setup/README.md) for manual migration steps.

```bash
cd mac-setup
bash setup.sh preview
```

## [Mac cleanup](./scripts/mac_cleanup.sh)

Interactive disk cleanup for caches, Docker, Android emulators, Xcode data, and `node_modules`. Each cleanup step asks for confirmation. Some steps delete whole app containers or emulators; review each prompt before proceeding.

```bash
bash scripts/mac_cleanup.sh
```
