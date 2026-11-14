# Personal Mac setup

Snapshot from 14 November 2026. Copy this entire folder to another Mac. It contains your selected preferences, Git name/email, editor configuration, extension lists, and installation commands.

## On the new Mac

Open Terminal in this folder, then run:

```sh
bash setup.sh preview
bash setup.sh install
```

`install` downloads Homebrew if needed, installs Git and Python, installs the selected apps, clones Oh My Zsh, and installs the captured Cursor extensions. It can request your Mac password for installers. Existing app bundles are skipped. Mini Calendar needs an App Store install using your Apple account: [Mini Calendar](https://apps.apple.com/app/id1088779979).

Launch Shottr and Mini Calendar once to create their app containers. Quit the selected apps, including their menu bar processes, and close System Settings. Then run:

```sh
bash setup.sh apply
```

Log out and back in. Launch the apps and complete the steps below. Apps and preference formats can change; confirm the keyboard inputs, shortcuts, gestures, and mouse controls on the new hardware.

To apply a subset, repeat `--only`:

```sh
bash setup.sh apply --only language --only karabiner
```

Groups: `language`, `karabiner`, `rectangle`, `raycast`, `alttab`, `keyboard`, `trackpad`, `desktop`, `shottr`, `zed`, `cursor`, `ghostty`, `shell`, `git`, `logi`, `minicalendar`. `--only` filters preview/apply; it does not filter installation or capture.

## What is included

| Area | Captured configuration |
| --- | --- |
| Language | U.S. and Slovak QWERTY inputs; English then Slovak; Czechia regional formatting |
| Karabiner | Only the active Mac-style profile, including the backtick/tilde remapping |
| Rectangle | Shortcut preset and preferences; macOS window tiling disabled |
| Raycast | Option+1 launcher and appearance preferences; full configuration uses the manual export below |
| AltTab | Stored appearance and hidden/minimized-window preferences |
| Keyboard | Key repeat, delay, function-key mode, keyboard navigation, stored system shortcuts |
| Trackpad | Tap to click, secondary click, tracking speed, scrolling direction, gestures and click pressure |
| Desktop | Dock hiding, size, magnification, placement and bottom-right hot corner; Finder list view and filename extensions |
| Shottr | Capture/OCR shortcuts, capture behavior, save format, scrolling capture and display preferences |
| Zed | Settings, keymap, and automatic installation of the 14 captured extensions |
| Cursor | Settings, keybindings, and the 56 captured extension IDs |
| Ghostty | Installed with your config file, which currently contains only comments |
| Shell | Oh My Zsh, `robbyrussell` theme, `git` plugin, and Homebrew PATH setup |
| Git | Name/email, automatic remote setup, merge preference, `main` default branch; editor changed from unavailable `code` to Cursor, using its full executable path when available |
| Logi Options | Legacy app and selected MX Master 3 settings, including button assignments and scrolling |
| Mini Calendar | Display preferences and keyboard shortcut; location and old screen coordinates excluded |

The shell files are a minimal recreation of your selected shell setup. Old Volta, NVM, Conda, other SDK initialization, and your unrelated alias are excluded. Applying `shell` replaces `.zshrc` and `.zprofile` after backing them up.

Cursor database connections and its old Node executable path are excluded. Zed's local browse MCP server is excluded. Existing Zed agent/model and tool-permission choices are retained; review `files/zed/.config/zed/settings.json` if your preferences have changed. API/provider accounts must be signed in again. Git signing keys and signing settings are excluded. On an existing Mac, existing Git signing settings remain in place.

## Manual steps

### Raycast

On the old Mac, run **Export Settings & Data** in Raycast. Save the encrypted `.rayconfig` in `manual/` inside this folder and keep its passphrase in your password manager. Review the export categories because it can include clipboard history, notes, chats, and other personal data.

On the new Mac, run **Import Settings & Data**, choose that file, and select the configuration categories you want. The exported app settings, aliases, hotkeys, and extensions are needed for the full setup; the three preferences captured by this script alone are incomplete. See the [official import/export guide](https://manual.raycast.com/import-export).

The `.rayconfig` is excluded by `.gitignore`. Transfer it separately if storing this folder in Git. No full Raycast export has been generated in this snapshot.

### Logi Options

The installed app is legacy **Logi Options**, not Options+. The installer list preserves this choice. Homebrew currently marks the legacy cask deprecated; if installation is unavailable on the new OS, choose a supported Logitech version for your hardware before continuing. Do not assume legacy preference files work in Options+.

Pair the MX Master 3 using macOS Bluetooth, launch Logi Options once, quit Logi Options and its background agent, then run `bash setup.sh apply --only logi`. Relaunch it and verify buttons, gestures, tracking speed and scrolling. Direct preference restoration is captured but has not been validated on a second laptop. Bluetooth pairing, unit IDs and Flow host configuration are deliberately excluded.

If you move to Options+, its supported migration path is its own device backup/restore, documented by [Logitech](https://support.logi.com/hc/en-us/articles/360023205374-Backup-device-settings-to-the-cloud-in-Logitech-Options). The script does not convert legacy settings to Options+.

### macOS permissions and login items

Approve Accessibility and Input Monitoring where requested by Karabiner, Rectangle, AltTab, Raycast and Logitech. Approve Screen Recording for Shottr. Enable the Karabiner system extension if prompted. These approvals are per computer.

Enable launch at login for the tools you want running continuously. Rectangle's saved preference is included, but macOS registration/approval may still be required. AltTab, Raycast, Shottr, Logi Options and Mini Calendar should be checked manually.

Mini Calendar's location for sunrise/sunset must be selected again. If `apply` prints `PENDING` for Shottr or Mini Calendar, launch that app once, quit it, then rerun the indicated group.

Check System Settings > Keyboard > Text Input for U.S. and Slovak QWERTY after logging back in. macOS can override directly written input-source preferences; if needed add/select them in this panel. Test the backtick key on the new keyboard before relying on the Karabiner mapping.

## Backups and undo

Every apply prints its backup directory, under `~/Library/Application Support/mac-setup/backups/`. It saves existing files and the original preference domains before changes. On failure, it prints the same restore command for partial changes.

```sh
bash setup.sh restore '/path/printed/by/apply'
```

Quit the affected apps before restoring. Restore the latest backup first. Restore replaces whole saved preference domains, so it also undoes changes made to those domains after that apply. It does not uninstall Homebrew, apps, Oh My Zsh, or extensions, and it does not reverse account sign-ins or permissions. Backups may contain existing personal settings; keep them private.

## Keep this setup current

On the configured Mac:

```sh
bash setup.sh capture
bash setup.sh preview
```

`capture` refreshes the selected preferences, active Karabiner profile, editor settings/keybindings/snippets/themes, installed editor extension lists, Ghostty config, and Git preferences. It overwrites those files in this folder. It leaves the curated shell files and app choices alone. Export Raycast separately again when its configuration changes.

The capture filters exclude the machine-specific fields found in this snapshot. Review future captures before committing, especially editor snippets, Ghostty config, and custom mouse actions, which may acquire personal content. Git name/email are intentionally included. Keep this setup in a private repository if desired.

## Verification

See `verification.txt` for this bundle's checks. Rerun them with `python3 verify.py` on a Mac with Python and Git installed. Apply and restore are exercised using a disposable home directory and isolated macOS preference domains. Fresh-machine downloads/installers, GUI permission grants, hardware behavior, app ingestion of preferences and the two manual migrations require verification on the destination Mac.
