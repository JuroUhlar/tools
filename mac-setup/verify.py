import hashlib,json,os,plistlib,shutil,subprocess,sys,tempfile,uuid
from pathlib import Path
source=Path(__file__).resolve().parent
root=Path(tempfile.mkdtemp(prefix='mac-setup-proof-')).resolve()
bundle=root/'bundle';shutil.copytree(source,bundle)
home=root/'home';home.mkdir()
env={**os.environ,'HOME':str(home),'GIT_CONFIG_NOSYSTEM':'1'}
env.pop('GIT_CONFIG_GLOBAL',None)
prefix='local.mac-setup-proof.'+uuid.uuid4().hex+'.'
domains=set();expected={}
for file in list((bundle/'preferences').rglob('*.plist')):
 name=prefix+file.stem;domains.add(name)
 expected.setdefault(name,{}).update(plistlib.loads(file.read_bytes()))
 file.rename(file.with_name(name+'.plist'))
(home/'.zshrc').write_text('export OLD_SHELL=1\n')
(home/'.gitconfig').write_text('[user]\n name = Before Migration\n[other]\n value = keep\n')
original={str(p.relative_to(home)):p.read_bytes() for p in home.rglob('*') if p.is_file()}

def defaults(*args):
 return subprocess.run(['defaults',*args],env=env,capture_output=True)
def read(domain):
 r=defaults('export',domain,'-')
 return (plistlib.loads(r.stdout) or None) if r.returncode==0 else None
def cli(*args):
 r=subprocess.run([sys.executable,str(bundle/'setup.py'),*args],env=env,text=True,capture_output=True)
 if r.returncode:raise AssertionError(r.stdout+'\n'+r.stderr)
 return r.stdout
try:
 domain=prefix+'NSGlobalDomain'
 r=defaults('write',domain,'existingSentinel','keep-me');assert r.returncode==0
 r=defaults('write',domain,'AppleLocale','en_US');assert r.returncode==0
 baseline=read(domain)
 before={str(p.relative_to(home)):p.read_bytes() for p in home.rglob('*') if p.is_file()}
 out=cli('preview');assert 'READ-ONLY PREVIEW' in out
 after={str(p.relative_to(home)):p.read_bytes() for p in home.rglob('*') if p.is_file()}
 assert before==after and read(domain)==baseline
 print('PASS preview: no files or isolated preferences changed')
 out=cli('apply');backup1=Path(next(l.removeprefix('Backup: ') for l in out.splitlines() if l.startswith('Backup: ')))
 for name,data in expected.items():
  actual=read(name);assert actual is not None,name
  for key,value in data.items():assert actual[key]==value,(name,key)
 assert read(domain)['existingSentinel']=='keep-me'
 assert read(domain)['AppleLocale']=='en_CZ'
 for f in (bundle/'files').rglob('*'):
  if f.is_file():
   rel=Path(*f.relative_to(bundle/'files').parts[1:]);assert (home/rel).read_bytes()==f.read_bytes(),rel
 git=subprocess.run(['git','config','--global','--get','other.value'],env=env,text=True,capture_output=True);assert git.stdout.strip()=='keep'
 assert json.loads((home/'.config/karabiner/karabiner.json').read_text())['profiles'][0]['selected'] is True
 print(f'PASS apply: {len(expected)} isolated preference domains match captured values; files match; unrelated settings preserved')
 out=cli('apply');backup2=Path(next(l.removeprefix('Backup: ') for l in out.splitlines() if l.startswith('Backup: ')))
 for name,data in expected.items():
  actual=read(name)
  for key,value in data.items():assert actual[key]==value
 print('PASS repeat apply: same captured preference values')
 cli('restore',str(backup2));cli('restore',str(backup1))
 for rel,content in original.items():assert (home/rel).read_bytes()==content,rel
 for f in (bundle/'files').rglob('*'):
  if f.is_file():
   rel=Path(*f.relative_to(bundle/'files').parts[1:])
   if str(rel) not in original:assert not (home/rel).exists(),rel
 for name in domains:assert read(name)==(baseline if name==domain else None),name
 print('PASS restore: original files/domains restored; newly created configuration files/domains removed')
 inputs=plistlib.loads((source/'preferences/language/com.apple.HIToolbox.plist').read_bytes())
 layouts=[x.get('KeyboardLayout Name') for x in inputs['AppleEnabledInputSources'] if x.get('InputSourceKind')=='Keyboard Layout']
 assert set(layouts)=={'U.S.','Slovak-QWERTY'}
 profile=json.loads((source/'files/karabiner/.config/karabiner/karabiner.json').read_text())
 assert len(profile['profiles'])==1 and profile['profiles'][0]['name']=='My mac style profile'
 cursor=json.loads((source/'files/cursor/Library/Application Support/Cursor/User/settings.json').read_text())
 assert cursor['window.commandCenter'] is True
 assert not any(k in cursor for k in ['pgsql.connections','pgsql.serverGroups','cursorpyright.nodeExecutable'])
 zed=json.loads((source/'files/zed/.config/zed/settings.json').read_text())
 assert 'context_servers' not in zed
 print('PASS captured inputs: U.S.+Slovak QWERTY; en_CZ; active Mac Karabiner profile; excluded editor connections/paths absent')
 print('UNVERIFIED: fresh-Mac installs, app GUI ingestion, hardware, permissions, Raycast export/import, Logi behavior on another Mac')
finally:
 for name in domains:defaults('delete',name)
 shutil.rmtree(root)
