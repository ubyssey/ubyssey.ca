FROM node:14.4.0-stretch-slim as staticfiles
COPY . /ubyssey.ca/
WORKDIR /ubyssey.ca/

# Set up static files - clears old old version of node_modules that may be around, tides up new version
WORKDIR /ubyssey.ca/ubyssey/static/
RUN rm -rf node_modules
RUN npm install
RUN npm install -g gulp
RUN gulp buildDev
RUN rm -rf node_modules

FROM python:3.8-buster as django
WORKDIR /ubyssey.ca/
ENV PYTHONUNBUFFERED=1
ENV PORT=8000
COPY --from=staticfiles /ubyssey.ca/ .
RUN pip install --requirement requirements.txt
EXPOSE 8000
ENTRYPOINT gunicorn --bind :$PORT --chdir ubyssey/ wsgi:application
