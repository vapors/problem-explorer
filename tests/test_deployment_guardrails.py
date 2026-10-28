"""Non-destructive verification of packaging/deployment safety filters.
Does not touch systemd, authentication files, Neo4j or production paths.
"""
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

@unittest.skipUnless(shutil.which('bash') and shutil.which('rsync'), 'Bash and rsync required (Linux server test)')
class DeploymentGuardrailTests(unittest.TestCase):
    def test_bash_scripts_parse(self):
        for script in sorted((ROOT / 'deploy/directadmin').glob('*.sh')):
            with self.subTest(script=script.name):
                result = subprocess.run(['bash', '-n', str(script)], capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, result.stderr)

    def test_source_sync_preserves_secrets_and_app_data(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            source, live = base / 'source', base / 'live'
            (source / 'apps/api/app').mkdir(parents=True)
            (source / 'apps/api/data').mkdir(parents=True)
            (source / 'apps/api/app/main.py').write_text('updated source')
            (source / 'apps/api/data/auth.sqlite3').write_text('bad source DB')
            (source / '.env').write_text('bad secret')
            (source / '.env.production').write_text('other secret')
            (source / '.env.example').write_text('example only')
            (live / 'apps/api/data').mkdir(parents=True)
            (live / 'apps/api/data/auth.sqlite3').write_text('KEEP_DB')
            (live / '.env').write_text('KEEP_ENV')
            program = 'source "$1"; DEPLOY_USER=$(id -un); DEPLOY_GROUP=$(id -gn); pe_rsync_source "$2" "$3"'
            result = subprocess.run(['bash', '-c', program, '_', str(ROOT/'deploy/directadmin/common.sh'),
                str(source), str(live)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual((live / '.env').read_text(), 'KEEP_ENV')
            self.assertEqual((live / 'apps/api/data/auth.sqlite3').read_text(), 'KEEP_DB')
            self.assertEqual((live / '.env.example').read_text(), 'example only')
            self.assertEqual((live / 'apps/api/app/main.py').read_text(), 'updated source')
            self.assertFalse((live / '.env.production').exists())

if __name__ == '__main__':
    unittest.main()
