from django.contrib.auth.models import BaseUserManager

class UserManager(BaseUserManager):
    def create_user(self, email, password, is_superuser=False):
        email = self.normalize_email(email)
        user = self.model(email=email, is_superuser=is_superuser)
        user.set_password(password)
        user.save()
        return user

    def create_superuser(self, email, password):
        return self.create_user(email, password, is_superuser=True)
