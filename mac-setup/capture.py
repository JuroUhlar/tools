import json
import plistlib
import re
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
HOME = Path.home()

SELECTION = {
    'language': {
        'NSGlobalDomain': ['AppleLanguages', 'AppleLocale'],
        'com.apple.HIToolbox': ['AppleEnabledInputSources', 'AppleSelectedInputSources', 'AppleCurrentKeyboardLayoutInputSourceID', 'AppleFnUsageType'],
    },
    'keyboard': {
        'NSGlobalDomain': ['AppleKeyboardUIMode', 'InitialKeyRepeat', 'KeyRepeat', 'ApplePressAndHoldEnabled', 'com.apple.keyboard.fnState'],
        'com.apple.symbolichotkeys': ['AppleSymbolicHotKeys'],
    },
    'rectangle': {'com.knollsoft.Rectangle': ['allowAnyShortcut', 'alternateDefaultShortcuts', 'launchOnLogin', 'reflowTodo', 'toggleTodo', 'subsequentExecutionMode'],
                  'com.apple.WindowManager': ['EnableTilingByEdgeDrag', 'EnableTilingOptionAccelerator', 'EnableTopTilingByEdgeDrag', 'GloballyEnabled']},
    'raycast': {'com.raycast.macos': ['raycastGlobalHotkey', 'raycastPreferredWindowMode', 'raycastShouldFollowSystemAppearance']},
    'alttab': {'com.lwouis.alt-tab-macos': ['appearanceSize', 'showHiddenWindows', 'showMinimizedWindows']},
    'trackpad': {'NSGlobalDomain': ['com.apple.swipescrolldirection', 'com.apple.trackpad.scaling'],
                 'com.apple.AppleMultitouchTrackpad': ['Clicking', 'TrackpadRightClick', 'TrackpadCornerSecondaryClick', 'TrackpadThreeFingerDrag', 'FirstClickThreshold', 'SecondClickThreshold', 'ForceSuppressed', 'TrackpadPinch', 'TrackpadRotate', 'TrackpadTwoFingerDoubleTapGesture', 'TrackpadTwoFingerFromRightEdgeSwipeGesture', 'TrackpadThreeFingerHorizSwipeGesture', 'TrackpadThreeFingerVertSwipeGesture', 'TrackpadFourFingerHorizSwipeGesture', 'TrackpadFourFingerVertSwipeGesture']},
    'desktop': {'NSGlobalDomain': ['AppleShowAllExtensions'],
                'com.apple.dock': ['autohide', 'largesize', 'magnification', 'minimize-to-application', 'orientation', 'tilesize', 'wvous-br-corner', 'wvous-br-modifier'],
                'com.apple.finder': ['FXPreferredViewStyle']},
    'shottr': {'cc.ffitch.shottr': ['KeyboardShortcuts_area', 'KeyboardShortcuts_fullscreen', 'KeyboardShortcuts_ocr', 'KeyboardShortcuts_window', 'afterGrabCopy', 'afterGrabSave', 'afterGrabShow', 'captureCursor', 'colorFormat', 'copyOnEsc', 'downscaleOnSave', 'ocrRemoveBreaks', 'primaryOCRLang', 'realPixels', 'saveFormat', 'saveOnEsc', 'scrollingManualEnabled', 'scrollingMax', 'scrollingReverseAutoscroll', 'scrollingSpeed', 'windowShadow', 'alwaysOnTop', 'areaCaptureMode', 'notificationType', 'thumbnailClosing']},
    'minicalendar': {'com.antlogic.minicalendar': ['coloredMenuBarIcon', 'showSunriseSundownTime', 'digitalClockMode', 'statusItemMode', 'showCalendarKeyboardShortcut']},
    'logi': {'com.logitech.manager.setting.0006b023': ['deviceName', 'thumbwheelSensitivity', 'profilesEnabled', 'smartShiftWheelMode', 'scrollingSpeed', 'scrollDirectionNatural', 'horizontalDirectionNatural', 'secondaryClick', 'secondaryClickValue', 'controlIDPreferences', 'ControlIDToGestureSettingsControlID', 'DPISwitchAlternateValue', 'DPISwitchToggle', 'profiles', 'settingsGroups', 'smartShift', 'smartShiftAutoDisengage', 'smoothScrolling', 'specialKeyGestures', 'trackingSpeed', 'enableMuteMicrophoneOsd']},
}
SELECTION['trackpad']['com.apple.driver.AppleBluetoothMultitouch.trackpad'] = [k for k in SELECTION['trackpad']['com.apple.AppleMultitouchTrackpad'] if k not in ['FirstClickThreshold', 'SecondClickThreshold', 'ForceSuppressed']]


def jsonc(path):
    text = path.read_text()
    pattern = r'"(?:\\.|[^"\\])*"|//[^\n]*|/\*[\s\S]*?\*/'
    text = re.sub(pattern, lambda m: m[0] if m[0].startswith('"') else '', text)
    text = re.sub(r'("(?:\\.|[^"\\])*")|,\s*(?=[}\]])', lambda m: m[1] or '', text)
    return json.loads(text)


def preferences(domain):
    container = HOME / f'Library/Containers/{domain}/Data/Library/Preferences/{domain}.plist'
    if container.exists():
        return plistlib.loads(container.read_bytes())
    result = subprocess.run(['defaults', 'export', domain, '-'], capture_output=True, timeout=15)
    if result.returncode == 0:
        return plistlib.loads(result.stdout)
    if b'does not exist' in result.stderr:
        return {}
    raise RuntimeError(f'Cannot read preferences for {domain}: {result.stderr.decode()}')


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + '\n')


def capture():
    for group, domains in SELECTION.items():
        for domain, keys in domains.items():
            data = preferences(domain)
            selected = {k: data[k] for k in keys if k in data}
            p = ROOT / 'preferences' / group / f'{domain}.plist'
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(plistlib.dumps(selected))
    files = ROOT / 'files'
    profile = json.loads((HOME / '.config/karabiner/karabiner.json').read_text())
    profile['profiles'] = [p for p in profile['profiles'] if p.get('selected')]
    write_json(files / 'karabiner/.config/karabiner/karabiner.json', profile)
    for group, base in [('zed', '.config/zed'), ('cursor', 'Library/Application Support/Cursor/User')]:
        settings = jsonc(HOME / base / 'settings.json')
        if group == 'zed':
            settings.pop('context_servers', None)
            installed = HOME / 'Library/Application Support/Zed/extensions/installed'
            settings['auto_install_extensions'] = {p.name: True for p in sorted(installed.iterdir()) if p.is_dir()}
        else:
            for key in ['pgsql.serverGroups', 'pgsql.connections', 'cursorpyright.nodeExecutable']:
                settings.pop(key, None)
            if type(settings.get('window.commandCenter')) is int:
                settings['window.commandCenter'] = bool(settings['window.commandCenter'])
        write_json(files / group / base / 'settings.json', settings)
        keymap = 'keymap.json' if group == 'zed' else 'keybindings.json'
        write_json(files / group / base / keymap, jsonc(HOME / base / keymap))
        for sub in ['snippets', 'themes']:
            source = HOME / base / sub
            dest = files / group / base / sub
            if dest.exists():
                shutil.rmtree(dest)
            if source.exists():
                shutil.copytree(source, dest)
    extension_file = HOME / '.cursor/extensions/extensions.json'
    extensions = [x['identifier']['id'] for x in json.loads(extension_file.read_text())]
    write_json(ROOT / 'cursor-extensions.json', sorted(set(extensions)))
    ghostty = files / 'ghostty/Library/Application Support/com.mitchellh.ghostty/config'
    ghostty.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(HOME / 'Library/Application Support/com.mitchellh.ghostty/config', ghostty)
    git = {}
    for key in ['user.name', 'user.email', 'push.autoSetupRemote', 'core.mergeoptions', 'init.defaultbranch']:
        result = subprocess.run(['git', 'config', '--global', '--get', key], capture_output=True, text=True)
        if result.returncode == 0:
            git[key] = result.stdout.strip()
    git['core.editor'] = 'cursor --wait'
    write_json(ROOT / 'git.json', git)
    print('Captured selected preferences. Shell configuration is curated separately. See README.md for manual steps.')


if __name__ == '__main__':
    capture()
