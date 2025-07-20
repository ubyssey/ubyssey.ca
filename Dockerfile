FROM python:3.10-bullseye

COPY . /app
WORKDIR /app

RUN apt-get update
RUN apt-get install -y git
RUN apt-get install -y curl
# Installs Node 14.x and npm 6.x
RUN curl -sL https://deb.nodesource.com/setup_14.x | bash -
RUN apt-get install -y nodejs

RUN pip install -r requirements.txt
