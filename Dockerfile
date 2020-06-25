# ARG must come before all FROM calls to be globally scoped
ARG ENVIRON
FROM python:3.8-buster
ARG ENVIRON
COPY . /ubyssey.ca/
WORKDIR /ubyssey.ca/
# Installs some basics
RUN apt-get update
RUN apt-get install -y git
RUN apt-get install curl
# Installs Node 14.x and npm 6.x
RUN curl -sL https://deb.nodesource.com/setup_14.x | bash -
RUN apt-get install -y nodejs
# Install the Django app’s dependencies
RUN if [ "$ENVIRON" = "production" ]; then pip install --requirement requirements-prd.txt; else pip install --requirement requirements.txt; fi
# Set up static files - clears old old version of node_modules that may be around, tidies up new version
WORKDIR /ubyssey.ca/ubyssey/static/
RUN rm -rf node_modules
RUN npm install
RUN npm install -g gulp
RUN npm rebuild node-sass
RUN if [ "$ENVIRON" = "production" ]; then gulp build; else gulp buildDev; fi
RUN rm -rf node_modules
WORKDIR /ubyssey.ca/
ENV PYTHONUNBUFFERED=1
ENV PORT=8000
EXPOSE 8000
ENTRYPOINT gunicorn --bind :$PORT --chdir ubyssey/ wsgi:application