# ARG must come before all FROM calls to be globally scoped
ARG ENVIRON

FROM node:14.4.0-stretch-slim as staticfiles
ARG ENVIRON
COPY . /ubyssey.ca/
WORKDIR /ubyssey.ca/ubyssey/static/
RUN npm install && npm install -g gulp
RUN if [ "$ENVIRON" = "production" ]; then gulp build; else gulp buildDev; fi
RUN rm -rf node_modules

FROM python:3.8-buster as django
ARG ENVIRON
WORKDIR /ubyssey.ca/
ENV PYTHONUNBUFFERED=1
ENV PORT=8000
COPY --from=staticfiles /ubyssey.ca/ .
RUN if [ "$ENVIRON" = "production" ]; then pip install --requirement requirements-prd.txt; else pip install --requirement requirements.txt; fi
EXPOSE 8000
ENTRYPOINT gunicorn --bind :$PORT --chdir ubyssey/ wsgi:application