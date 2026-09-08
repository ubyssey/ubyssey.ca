from django.test import SimpleTestCase

from images.models import UbysseyImage


class RedesignImageDescriptionTests(SimpleTestCase):
    def test_redesign_description_is_a_separate_blank_field(self):
        field = UbysseyImage._meta.get_field('redesign_description')

        self.assertTrue(field.blank)
        self.assertEqual(field.default, '')
