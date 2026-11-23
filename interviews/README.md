# Interviews

Internal tool for uploading interview recordings and reading their transcripts, replacing the shared Otter.ai account. It lives inside the main site at `/interviews/`, like Stove.

**Status:** early prototype. The Library screen renders with mock data. There are no models yet.

## Running locally

Set up the main site first by following the [installation docs](https://code.ubyssey.ca/installation/docker.html). The interviews app needs no extra setup.

1. Start the database container and wait until it is ready (about 10 seconds).
2. Start the Django container (`python manage.py runserver 0.0.0.0:8000`).

   If Django starts before MySQL is ready, it fails with `Can't connect to server on 'db'` and stops responding. Restart the Django container to fix it.
3. Open http://localhost:8000/interviews/

## Login

The page needs a login. It uses the same Wagtail account as Stove: signed-out users are sent to `/admin/login/` and come back to `/interviews/` after signing in.

## Tests

```
python manage.py test interviews
```
