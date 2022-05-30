FROM python:3.8-buster
COPY . /workspaces/ubyssey.ca/
WORKDIR /workspaces/ubyssey.ca/
# Installs some basics
RUN apt-get update
  && apt-get install -y git 
  && curl 

# Installs Node 14.x and npm 6.x
RUN curl -sL https://deb.nodesource.com/setup_14.x | bash - \ 
  && apt-get install -y nodejs

# Install the Django app’s dependencies
RUN pip install -r requirements.txt

# Set up static files - clears old old version of node_modules that may be around, tides up new version
WORKDIR /workspaces/ubyssey.ca/ubyssey/static_src/
RUN rm -rf node_modules \ 
  && npm install && npm install -g gulp && npm rebuild node-sass \ 
  && gulp buildDev \ 
  && rm -rf node_modules

# See https://stackoverflow.com/questions/28372328/how-to-install-the-google-cloud-sdk-in-a-docker-image
# Downloading gcloud package
RUN curl https://dl.google.com/dl/cloudsdk/release/google-cloud-sdk.tar.gz > /tmp/google-cloud-sdk.tar.gz

# Installing the package
RUN mkdir -p /usr/local/gcloud \
  && tar -C /usr/local/gcloud -xvf /tmp/google-cloud-sdk.tar.gz \
  && /usr/local/gcloud/google-cloud-sdk/install.sh

# Adding the package path to local
ENV PATH $PATH:/usr/local/gcloud/google-cloud-sdk/bin

WORKDIR /workspaces/ubyssey.ca/
