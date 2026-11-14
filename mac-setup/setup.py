import argparse
import datetime
import json
import os
import plistlib
import shlex
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
HOME = Path.home()
SANDBOXED = {'cc.ffitch.shottr', 'com.antlogic.minicalendar'}


def run(args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)


def domain_target(domain):
    if domain in SANDBOXED:
        path = HOME / f'Library/Containers/{domain}/Data/Library/Preferences/{domain}.plist'
        if not path.parent.exists():
            return None
        return str(path.with_suffix(''))
    return domain


def read_domain(domain):
    result = subprocess.run(['defaults', 'export', domain, '-'], capture_output=True, timeout=20)
    if result.returncode == 0:
        return plistlib.loads(result.stdout) or None
    if b'does not exist' in result.stderr:
        return None
    raise RuntimeError(f'Cannot back up {domain}: {result.stderr.decode()}')


def selected(groups, only):
    return sorted(g for g in groups if not only or g in only)


def cursor_cli():
    for apps in [Path('/Applications'), HOME / 'Applications']:
        for name in ['cursor', 'code']:
            path = apps / 'Cursor.app/Contents/Resources/app/bin' / name
            if path.exists():
                return path
    return None


def apply(only):
    backup = HOME / 'Library/Application Support/mac-setup/backups' / datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f')
    backup.mkdir(parents=True, mode=0o700)
    journal = {'files': [], 'domains': []}

    def save_journal():
        (backup / 'journal.json').write_text(json.dumps(journal, indent=2))

    save_journal()
    print('Backup:', backup)
    try:
        for group in selected([p.name for p in (ROOT / 'files').iterdir()], only):
            for source in sorted((ROOT / 'files' / group).rglob('*')):
                if not source.is_file():
                    continue
                rel = source.relative_to(ROOT / 'files' / group)
                target = HOME / rel
                if target.is_symlink():
                    raise RuntimeError(f'Refusing to overwrite a symlink: {target}')
                exists = target.exists()
                if exists:
                    dest = backup / 'files' / rel
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(target, dest)
                journal['files'].append({'path': str(rel), 'existed': exists})
                save_journal()
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, target)
                print('Copied', rel)
        saved_domains = set()
        for group in selected([p.name for p in (ROOT / 'preferences').iterdir()], only):
            for source in sorted((ROOT / 'preferences' / group).glob('*.plist')):
                domain = source.stem
                target = domain_target(domain)
                if target is None:
                    print(f'PENDING: launch {domain} once, quit it, then run apply --only {group}')
                    continue
                current = read_domain(target)
                if target not in saved_domains:
                    index = len(journal['domains'])
                    name = f'domain-{index}.plist'
                    if current is not None:
                        (backup / name).write_bytes(plistlib.dumps(current))
                    journal['domains'].append({'target': target, 'backup': name if current is not None else None})
                    save_journal()
                    saved_domains.add(target)
                data = plistlib.loads(source.read_bytes())
                for key, value in data.items():
                    if key == 'AppleSymbolicHotKeys':
                        value = {**(current or {}).get(key, {}), **value}
                    run(['defaults', 'write', target, key, plistlib.dumps(value).decode()], capture_output=True)
                print(f'Applied {group}: {domain} ({len(data)} keys)')
        if not only or 'git' in only:
            gitpath = HOME / '.gitconfig'
            if gitpath.is_symlink():
                raise RuntimeError(f'Refusing to overwrite a symlink: {gitpath}')
            if gitpath.exists():
                dest = backup / 'files/.gitconfig'
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(gitpath, dest)
            journal['files'].append({'path': '.gitconfig', 'existed': gitpath.exists()})
            save_journal()
            for key, value in json.loads((ROOT / 'git.json').read_text()).items():
                if key == 'core.editor' and value == 'cursor --wait' and cursor_cli():
                    value = shlex.quote(str(cursor_cli())) + ' --wait'
                run(['git', 'config', '--global', key, value])
            print('Applied Git preferences and identity')
    except Exception:
        print('Apply stopped. Restore the partial changes with:')
        print('bash setup.sh restore', shlex.quote(str(backup)))
        raise
    print('Log out and back in. Then follow the manual steps in README.md.')
    print('To undo these preferences and files: bash setup.sh restore', shlex.quote(str(backup)))


def restore(backup):
    backup = Path(backup).expanduser().resolve()
    journal = json.loads((backup / 'journal.json').read_text())
    for entry in reversed(journal['files']):
        target = HOME / entry['path']
        if target.is_symlink():
            raise RuntimeError(f'Refusing to overwrite a symlink: {target}')
        if entry['existed']:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(backup / 'files' / entry['path'], target)
        else:
            target.unlink(missing_ok=True)
    for entry in reversed(journal['domains']):
        if entry['backup']:
            run(['defaults', 'delete', entry['target']], capture_output=True) if read_domain(entry['target']) is not None else None
            run(['defaults', 'import', entry['target'], str(backup / entry['backup'])])
        elif read_domain(entry['target']) is not None:
            run(['defaults', 'delete', entry['target']], capture_output=True)
    print('Restored files and preference domains. Installed apps and extensions remain. Log out and back in.')


def install():
    for app in json.loads((ROOT / 'apps.json').read_text()):
        if (Path('/Applications') / app['app']).exists() or (HOME / 'Applications' / app['app']).exists():
            print('Already installed:', app['app'])
        else:
            run(['brew', 'install', '--cask', app['cask']])
    omz = HOME / '.oh-my-zsh'
    if not omz.exists():
        run(['git', 'clone', '--depth=1', 'https://github.com/ohmyzsh/ohmyzsh.git', str(omz)])
    cli = cursor_cli()
    if cli:
        for extension in json.loads((ROOT / 'cursor-extensions.json').read_text()):
            run([str(cli), '--install-extension', extension])
    else:
        print('PENDING: install Cursor extensions from cursor-extensions.json using the Cursor command line.')
    print('Install Mini Calendar from https://apps.apple.com/app/id1088779979')
    print('Apps installed. Launch Shottr and Mini Calendar once, then quit the selected apps before apply.')


def main():
    parser = argparse.ArgumentParser(description='Portable macOS preferences. Default: read-only preview.')
    parser.add_argument('command', nargs='?', default='preview', choices=['preview', 'install', 'apply', 'capture', 'restore'])
    parser.add_argument('backup', nargs='?')
    groups = sorted({p.name for base in ['files', 'preferences'] for p in (ROOT / base).iterdir()} | {'git'})
    parser.add_argument('--only', action='append', choices=groups, help='Apply/preview only this group; repeat to select several')
    args = parser.parse_args()
    if args.command == 'preview':
        print('READ-ONLY PREVIEW. No downloads, installs, or preference writes.')
        print('Install: Homebrew, Python (setup dependency), Git, Oh My Zsh, selected apps and Cursor extensions.')
        for group in selected(groups, args.only):
            files = [str(p.relative_to(ROOT / 'files' / group)) for p in (ROOT / 'files' / group).rglob('*') if p.is_file()]
            prefs = [f'{p.stem}: {len(plistlib.loads(p.read_bytes()))} keys' for p in (ROOT / 'preferences' / group).glob('*.plist')]
            print(group + ':', '; '.join(files + prefs) or 'Git identity and preferences')
        print('Manual: Raycast export/import; app permissions and login items; Mini Calendar App Store; verify Logi device mapping.')
    elif args.command == 'apply':
        apply(args.only)
    elif args.command == 'install':
        install()
    elif args.command == 'capture':
        from capture import capture
        capture()
    elif args.command == 'restore':
        if not args.backup:
            parser.error('restore requires the backup directory printed by apply')
        restore(args.backup)


if __name__ == '__main__':
    os.umask(0o077)
    main()
