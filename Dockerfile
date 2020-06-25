# ARG must come before all FROM calls to be globally scoped
ARG ENVIRON
FROM python:3.8-buster
ARG ENVIRON
COPY . /workspaces/ubyssey.ca/
WORKDIR /workspaces/ubyssey.ca/
# Installs some basics
RUN apt-get update && apt-get install -y git && apt-get install -y curl
# Installs Node 14.x and npm 6.x
RUN curl -sL https://deb.nodesource.com/setup_14.x | bash -
RUN apt-get install -y nodejs
# Install the Django app’s dependencies
RUN if [ "$ENVIRON" = "production" ]; then pip install --requirement requirements-prd.txt; else pip install --requirement requirements.txt; fi
# Set up static files - clears old old version of node_modules that may be around, tidies up new version
WORKDIR /workspaces/ubyssey.ca/ubyssey/static/
RUN npm install && npm install -g gulp
RUN if [ "$ENVIRON" = "production" ]; then gulp build; else gulp buildDev; fi
RUN rm -rf node_modules

# Clone the Dispatch app into typical app location. These steps are for ease of development
WORKDIR /workspaces/
RUN git clone https://github.com/ubyssey/dispatch.git
# Put dispatch into "development mode"
WORKDIR /workspaces/dispatch/
RUN pip install -e .[dev] && python setup.py develop
WORKDIR /workspaces/dispatch/dispatch/static/manager
RUN npm install && npm run-script dev
RUN rm -rf node_modules
# Spin the project up
WORKDIR /workspaces/ubyssey.ca/
ENV PYTHONUNBUFFERED=1
ENV PORT=8000
EXPOSE 8000
ENTRYPOINT gunicorn --bind :$PORT --chdir ubyssey/ wsgi:application