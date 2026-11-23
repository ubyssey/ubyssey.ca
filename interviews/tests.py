from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse


class LibraryViewTests(TestCase):
    def test_signed_out_user_is_sent_to_login(self):
        response = self.client.get(reverse("interviews:library"))
        self.assertEqual(response.status_code, 302)
        self.assertIn("/admin/login/", response["Location"])

    def test_signed_in_user_sees_library(self):
        user = get_user_model().objects.create_user(email="reporter@example.com", password="pw")
        self.client.force_login(user)
        response = self.client.get(reverse("interviews:library"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "All recordings")
