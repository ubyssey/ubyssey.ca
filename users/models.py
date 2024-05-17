from django.db.models import EmailField, CharField, BooleanField
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin

from users.managers import UserManager

class User(AbstractBaseUser, PermissionsMixin):
    """
    The Ubyssey uses a custom user model to implement email-based logins.

    This is different than the default Django user model,
    which uses a separate username field.
    """

    email = EmailField(max_length=255, unique=True)
    first_name = CharField(max_length=150, blank=True)
    last_name = CharField(max_length=150, blank=True)

    is_active = BooleanField(default=True)
    is_staff = BooleanField(default=False)

    # Use the email as the username. Users log in with email + password
    # instead of username + password.
    USERNAME_FIELD = 'email'

    objects = UserManager()

    def get_full_name(self):
        """
        Return the first_name plus the last_name, with a space in between.
        """
        full_name = '%s %s' % (self.first_name, self.last_name)
        return full_name.strip()

    def get_short_name(self):
        """Return the short name for the user."""
        return self.first_name
