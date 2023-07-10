# Generated by Django 3.2.11 on 2023-07-07 23:17

from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        migrations.CreateModel(
            name='User',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, verbose_name='ID')),
                ('email', models.CharField(max_length=255, unique=True)),
                ('first_name', models.CharField(blank=True, max_length=150, unique=True)),
                ('last_name', models.CharField(blank=True, max_length=150, unique=True)),
                ('password', models.CharField(max_length=128, verbose_name='password')),
                ('last_login', models.DateTimeField(blank=True, null=True, verbose_name='last login')),
                ('is_active', models.BooleanField(default=True))
            ],
            options={
                'abstract': False,
            },
        ),
    ]