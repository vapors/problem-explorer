"""Backward-compatible badge palette migration and admin-only update."""
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException
from app import auth, graph_preferences as preferences, main

class BadgeAppearanceTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.env=patch.dict(os.environ,{'AUTH_DB_PATH':str(Path(self.tmp.name)/'auth.sqlite3')})
        self.env.start()
        auth.init_db(); preferences.init_graph_preferences()
        with auth.conn() as db:
            for user,role in [('admin','admin'),('viewer','user')]:
                db.execute('INSERT INTO users(id,email,name,role,status) VALUES(?,?,?,?,?)',
                           (user,f'{user}@example.org',user,role,'active'))
    def tearDown(self):
        self.env.stop();self.tmp.cleanup()
    def acting(self,user,callback):
        token=main.current_user.set(user)
        try:return callback()
        finally:main.current_user.reset(token)
    def test_existing_palette_uses_theme_correct_defaults(self):
        with auth.conn() as db:
            for theme in ('dark','light'):
                legacy={k:v for k,v in preferences.DEFAULT_PALETTES[theme].items() if not k.startswith('badge')}
                import json
                db.execute('INSERT INTO graph_appearance(theme,payload) VALUES(?,?)', (theme,json.dumps(legacy)))
        result=self.acting('viewer',preferences.get_appearance)
        for theme in ('dark','light'):
            self.assertEqual(result[theme]['badgeClosed'],preferences.DEFAULT_PALETTES[theme]['badgeClosed'])
            self.assertEqual(result[theme]['badgeOpen'],preferences.DEFAULT_PALETTES[theme]['badgeOpen'])
            self.assertEqual(result[theme]['badgeHover'],preferences.DEFAULT_PALETTES[theme]['badgeHover'])
    def test_legacy_light_palette_save_keeps_light_badge_defaults(self):
        legacy={k:v for k,v in preferences.DEFAULT_PALETTES['light'].items()
                if not k.startswith('badge')}
        update=preferences.AppearanceUpdate(theme='light',palette=preferences.GraphPalette(**legacy))
        self.acting('admin',lambda:preferences.set_appearance(update))
        saved=self.acting('viewer',preferences.get_appearance)
        self.assertEqual(saved['light']['badgeClosed'],preferences.DEFAULT_PALETTES['light']['badgeClosed'])
    def test_admin_can_configure_badge_independent_from_graph_nodes(self):
        palette=preferences.GraphPalette(**preferences.DEFAULT_PALETTES['dark'])
        palette.badgeClosed='#123456'
        update=preferences.AppearanceUpdate(theme='dark',palette=palette)
        with self.assertRaises(HTTPException) as error:
            self.acting('viewer',lambda:preferences.set_appearance(update))
        self.assertEqual(error.exception.status_code,403)
        self.acting('admin',lambda:preferences.set_appearance(update))
        saved=self.acting('viewer',preferences.get_appearance)
        self.assertEqual(saved['dark']['badgeClosed'],'#123456')
        self.assertEqual(saved['dark']['problem'],preferences.DEFAULT_PALETTES['dark']['problem'])

if __name__=='__main__': unittest.main()
