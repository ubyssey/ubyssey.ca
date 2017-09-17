## Setup Instructions for Mac OS X

First, make sure you have Homebrew installed:

```bash
/usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"
```

You should also install pip if you haven't already:
```bash
sudo easy_install pip
```

We recommend working inside a virtualenv, but it's not required.

```bash
# Install virtualenv if you don't have it
pip install virtualenv

# Create a new virtual environment
virtualenv ubyssey-dev
cd ubyssey-dev

# Activate the virtualenv
source bin/activate
```

Clone the `ubyssey-dispatch-theme` repository:

```bash
git clone https://github.com/ubyssey/ubyssey-dispatch-theme
cd ubyssey-dispatch-theme
```

Install the required Python packages with pip:

```bash
pip install -r requirements.txt
```

_Note: you might get an error saying that `libjpeg` is required. You can install it with Homebrew:_

```bash
brew install libjpeg zlib
```
_Note: if `mySQL-python` fails to install, you might be missing some of Apple's Command Line Tools. Install [Xcode](https://itunes.apple.com/ca/app/xcode/id497799835?mt=12) from the Mac App Store, then:_

```bash
xcode-select --install
```

### Project settings

Download the sample [project settings file](https://ubyssey.s3.amazonaws.com/dropbox/settings.py) and save it to `ubyssey-dispatch-theme/ubyssey/settings.py`.

### Database

Dispatch requires a MySQL database to store information. Install mysql with Homebrew.

```bash
brew install mysql56
```

Now run the server and create a fresh database:

```bash
mysql.server start
echo "CREATE DATABASE ubyssey" | mysql -u root

# If you're seeing "ERROR 1045 (28000): Access denied for user 'root'@'localhost'"
# try
# echo "CREATE DATABASE ubyssey" | mysql -u root -p
```

Next, populate the database with sample data:

```bash
curl https://ubyssey.s3.amazonaws.com/dropbox/ubyssey.sql | mysql -u root ubyssey

# If you're seeing "curl: (23) Failed writing body"
# try
# curl https://ubyssey.s3.amazonaws.com/dropbox/ubyssey.sql | tac | tac | mysql -u root ubyssey

# If you're seeing "ERROR 1045 (28000): Access denied for user 'root'@'localhost'"
# try
# curl https://ubyssey.s3.amazonaws.com/dropbox/ubyssey.sql | mysql -u root ubyssey -p
```

### Static files

Install the required Node packages with npm:

```bash
cd ubyssey/static
npm install
```

Install a global verison of gulp (if you don't have it already) and build the static files:

```bash
npm install -g gulp
gulp
```

### Media Files

Download and unzip the [sample media folder](https://ubyssey.s3.amazonaws.com/dropbox/media.zip) to `ubyssey-dispatch-theme/media/`. This will make it so the images attached to the sample articles are viewable.

### Running the server

Now start the server!

```bash
python manage.py runserver

# If you're seeing "django.core.exceptions.ImproperlyConfigured: Error loading MySQLdb module: No module named MySQLdb"
# run
# pip install MySQL-python
# and try again
```

### Admin Panel

You can log in to the admin panel at [http://localhost:8000/admin/](http://localhost:8000/admin/):

__Email:__ volunteer@ubyssey.ca

__Password:__ volunteer
