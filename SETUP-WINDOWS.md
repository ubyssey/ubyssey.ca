## Setup Instructions for Windows

### Notes

- The following instructions were tested using Git Shell (based on Windows Powershell).

- The Windows Bash shell is still quite unstable and isn't recommended (it _does_ work though, and you can follow the Mac instructions).

- The steps for installing through Command Prompt should be the same. Please report any issues you have so that we can revise the instructions.

- Note that the Windows setup instructions are still in development, so expect to see flux and inaccuracies in content.

### Install Python

Install Python if don't have it on your system:

https://www.python.org/downloads/

### Install Visual Studio

Install Visual Studio 2015 if you don't have it.

Visual Studio 2015 only comes with Windows 10 SDK while some of our installation steps might require Windows 8.1 SDK, therefore, it is recommended that you install both of them for a smoother set-up process.

Visual Studio: https://www.visualstudio.com/downloads/

Windows 8.1 SDK: https://developer.microsoft.com/en-us/windows/downloads/windows-8-1-sdk

### Install pip

You should install pip if you haven't already, but note that pip often comes with the Python installation. If you don't have pip installed, follow the instructions here: https://pip.pypa.io/en/stable/installing/

### Create a virtual environment

We recommend working inside a virtualenv, but it's not required.

```bash
# Install virtualenv if you don't have it
pip install virtualenv

# Create a new virtual environment
virtualenv ubyssey-dev
cd ubyssey-dev

# Activate the virtualenv
.\Scripts\activate
```

### Get the code

Clone the `ubyssey-dispatch-theme` repository:

```bash
git clone https://github.com/ubyssey/ubyssey-dispatch-theme
cd ubyssey-dispatch-theme
```

Install the required Python packages with pip:

```bash
pip install -r requirements.txt
```

_Note: you might get an error saying that `_mysql.c(42) : fatal error C1083: Cannot open include file: 'config-win.h': No such file or directory`. To resolve this issue:_

Download mysql-python from http://www.lfd.uci.edu/~gohlke/pythonlibs/#mysql-python

Choose the one that is corresponding to the edition of your Python (32-bit or 64-bit) and install it using pip. Occasionally, things get complicated if you install 32-bit Python on 64-bit system; if that's the case, you could try both of them.

```bash
pip install wheel
pip install theFileYouJustDownloaded
```

### Project settings

Download the sample [project settings file](https://ubyssey.s3.amazonaws.com/dropbox/settings.py) and save it to `ubyssey-dispatch-theme/ubyssey/settings.py`.

### Database

Dispatch requires a MySQL database to store information. Install MySQL with MySQL installer.

```bash
https://dev.mysql.com/downloads/windows/installer/5.6.html
```

You can set a password for root user, if you do, you will need to change the attribute of password in the setting.py file that you previously downloaded.

Now run the MySQL command line client that comes with mysql installation and create a fresh database:

```bash
CREATE DATABASE ubyssey;
```

Next, save the sample data from https://ubyssey.s3.amazonaws.com/dropbox/ubyssey.sql to your local drive, which is usually located at  \MySQL Server 5.7\bin
and load the SQL file to the database.

```bash
USE ubyssey;
source ubyssey.sql
```

### Static files

First, install Node.js if you don't have it already:

https://nodejs.org/en/

To check if npm and node are successfully installed, type these commands:

```bash
npm -v
node -v
```

Install a global verison of gulp (if you don't have it already) and build the static files:

```bash
cd ubyssey\static

# Install node packages
npm install

# Install and run gulp
npm install -g gulp
gulp
```

### Media files

Download and unzip the [sample media folder](https://ubyssey.s3.amazonaws.com/dropbox/media.zip) to `ubyssey-dispatch-theme/media/`. This will make it so the images attached to the sample articles are viewable.

### Running the server

Now start the server!

```bash
python manage.py runserver
```

### Admin panel

You can log in to the admin panel at [http://localhost:8000/admin/](http://localhost:8000/admin/):

__Email:__ volunteer@ubyssey.ca

__Password:__ volunteer

--

## Troubleshooting

When you encounter problems during your installation, please read the following FAQ to see if it resolves your issues. Feel free to ask other developers who are on Windows platform if you have any questions.

Note that this is the first edition of troubleshooting FAQ on Windows installation, expect to see inaccuracies in the content.


**Q: I encountered following warnings when trying to install gulp, what should I do?**

	return process.dlopen(module, path._makeLong(filename));
                 ^
	Error: %1 is not a valid Win32 application.

**A:** Try run ```bash npm rebuild node-sass```, note that certain steps may take longer than expected so be patient. Read the error information. Based on previous experiences, you might be missing a Windows 8.1 sdk, or related Visual Studio C++ environment.

--

**Q: I'm trying to download the .sql file into the MySQL Server 5.7\bin\ folder but it syas i need administrator permission, what should I do?**

**A:** Download the .sql file to another folder and copy/cut and paste into the \bin\ folder, this way you'll be asked to given Administrator permission.

--

**Q: I encountered following warnings when trying to install gulp, what should I do?**

SKIPPING OPTIONAL DEPENDENCY: fsevents@^1.0.0 (node_modules\chokidar\node_modules\fsevents)
wanted {"os":"darwin","arch":"any"} (current: {"os":"win32","arch":"ia32"})

**A:** Ignore these warning messages. Fsevents was built for MacOS, this shouldn't have any actual impact on your installation.

--

**Q: I encountered following errors:**

C:\Program Files (x86)\MSBuild\Microsoft.Cpp\v4.0\V140\Platforms\Win32\PlatformToolsets\v140\Toolset.targets(34,5): error MSB8036: The Windows SDK version
8.1 was not found. Install the required version of Windows SDK or change the SDK version in the project property pages or by right-clicking the solution and
selecting "Retarget solution". [C:\Users\Haoyuan\Documents\GitHub\ubyssey-dev\ubyssey-dispatch-theme\ubyssey\static\node_modules\node-sass\build\src\libsass.
vcxproj]


**A:** Install windows SDK 8.1.

--

**Q: I encountered following errors:**

Unhandled exception in thread started by <function wrapper at 0x00000000040BA6D8>
Traceback (most recent call last):

django.db.utils.OperationalError: (2003, "Can't connect to MySQL server on '127.0.0.1' (10061)")

**A:**

Check if your mySQL is running, if not, open the MySQL commandline and start the sql server. If that fails, it means that it might be corrupted and you might want to re-install it. If you do decide to re-install the MySQL server, after removing mySQL Server, remove mySQL57 Service before your reinstall it.

You can also try the following command under ubyssey\static\

```bash npm config set msvs_version 2015```

--

**Q: I encountered these warning messages:**

```bash 
npm WARN deprecated minimatch@2.0.10: Please update to minimatch 3.0.2 or higher to avoid a RegExp DoS issue
npm WARN deprecated minimatch@0.2.14: Please update to minimatch 3.0.2 or higher to avoid a RegExp DoS issue
npm WARN deprecated graceful-fs@1.2.3: graceful-fs v3.0.0 and before will fail on node releases >= v7.0. Please update to graceful-fs@^4.0.0 as soon as possible. Use 'npm ls graceful-fs' to find it in the tree.
```

--

**A:**

You could ignore these warning messages for now as they should not stop you from running the server. Minimatch developers decided to deprecate versions prior to 3.0.2 but not all other package are kept up-to-date, which resulted in these issues. Solutions to these problems will hopefully be released soon.
