"""Non-destructive v0.9.8.1 graph appearance compatibility contracts."""
import unittest
from pydantic import ValidationError
from apps.api.app.graph_preferences import DEFAULT_PALETTES, GraphPalette


class BadgeAppearanceContract(unittest.TestCase):
    def test_new_open_closed_defaults_are_valid_for_both_themes(self):
        for theme in ('dark', 'light'):
            palette = GraphPalette.model_validate(DEFAULT_PALETTES[theme])
            self.assertTrue(palette.showConceptClosed)
            self.assertTrue(palette.showConceptOpen)
            self.assertFalse(palette.showReviewedOpen)
            self.assertTrue(palette.showReviewedClosed)
            self.assertFalse(palette.showUnreviewedOpen)
            self.assertTrue(palette.showUnreviewedClosed)
            self.assertFalse(palette.showProblemsOpen)
            self.assertTrue(palette.showProblemsClosed)
            self.assertTrue(palette.showBadgeTooltips)

    def test_old_color_profiles_receive_additive_defaults(self):
        original = {k: DEFAULT_PALETTES['dark'][k] for k in ('target', 'stream', 'category', 'problem', 'concept')}
        profile = GraphPalette.model_validate(original)
        self.assertTrue(profile.showReviewedClosed)
        self.assertFalse(profile.showReviewedOpen)
        self.assertEqual(profile.badgeReviewedOpen, '#3a6957')

    def test_bad_appearance_color_is_rejected(self):
        with self.assertRaises(ValidationError):
            GraphPalette.model_validate({**DEFAULT_PALETTES['dark'], 'badgeReviewedOpen': 'invalid'})

    def test_mixed_state_flags_are_boolean(self):
        profile = GraphPalette.model_validate({**DEFAULT_PALETTES['light'],
                                               'showBadgeTooltips': False,
                                               'showProblemsOpen': True})
        self.assertFalse(profile.showBadgeTooltips)
        self.assertTrue(profile.showProblemsOpen)


if __name__ == '__main__':
    unittest.main()
