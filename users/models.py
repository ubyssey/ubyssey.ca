from django.db.models import CharField, BooleanField
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin

from users.managers import UserManager

class User(AbstractBaseUser, PermissionsMixin):
    email = CharField(max_length=255, unique=True)
    first_name = CharField(max_length=150, blank=True)
    last_name = CharField(max_length=150, blank=True)

    is_active = BooleanField(default=True)

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
