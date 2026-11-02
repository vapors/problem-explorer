import unittest
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'apps' / 'api'))
from app.graph_preferences import DEFAULT_PALETTES, GraphPalette

class BadgeHoverPaletteTests(unittest.TestCase):
    def test_four_type_specific_hover_colors(self):
        for theme in ('light', 'dark'):
            fields = ('badgeHover','badgeReviewedHover','badgeUnreviewedHover','badgeProblemsHover')
            palette = GraphPalette.model_validate(DEFAULT_PALETTES[theme])
            for key in fields:
                self.assertRegex(getattr(palette,key), r'^#[0-9a-fA-F]{6}$')
            self.assertEqual(len({getattr(palette,key) for key in fields}), 4)

    def test_legacy_palette_falls_back_without_discarding_saved_colors(self):
        for theme in ('light','dark'):
            old = {key:value for key,value in DEFAULT_PALETTES[theme].items()
                   if key not in ('badgeReviewedHover','badgeUnreviewedHover','badgeProblemsHover')}
            old['badgeHover'] = '#123456'
            upgraded = GraphPalette.model_validate({**DEFAULT_PALETTES[theme],**old})
            self.assertEqual(upgraded.badgeHover, '#123456')
            self.assertTrue(upgraded.badgeReviewedHover.startswith('#'))

    def test_bad_hex_color_is_rejected(self):
        palette={**DEFAULT_PALETTES['dark'],'badgeProblemsHover':'garbage'}
        from pydantic import ValidationError
        with self.assertRaises(ValidationError): GraphPalette.model_validate(palette)
