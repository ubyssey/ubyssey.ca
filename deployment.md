# Ubyssey Linux Deployment

## Overview

The Ubyssey website (ubyssey.ca) is hosted on a single Debian 12 Linux virtual machine. Given that it is a single-server deployment, all services are hosted on the same machine, including the Django application, the database and a memory cache.

We chose a single-server deployment instead of a distributed system in order to save costs and decrease latency between the application and database.

## Configuration

The website consists of the following services:

1. Reverse Proxy (Nginx)
2. App Server (Django)
3. Database (MySQL)
4. Cache (Memcached)

// TODO: insert diagram

These services are defined as Docker containers in [docker-compose.yml](./docker-compose.yml) and run in a single-node Docker Swarm. The services communicate with each other on Docker's internal network, meaning that, for example, the MySQL server is only accessible by the other Docker containers and not the general public.

### Reverse proxy (Nginx)

Nginx is an HTTP web server that acts as the entrypoint for all client requests to the website. Nginx is a versatile tool; for us, it does the following:

- Routes traffic to the Django server or static files
- Redirects requests from www.ubyssey.ca to ubyssey.ca
- Handles HTTPS traffic, including redirecting insecure HTTP requests to HTTPS (see [SSL Certificates](#ssl-certificates) below)

The Nginx configuration is defined in [nginx.conf](./nginx.conf).

### App server (Django)

The Django app server is the main part of the deployment. It is where all the user-facing pages are defined and also serves the backend CMS used to manage the website content.

Django runs inside of a custom Docker image that we build from our source code, using the Python Docker image as a base. This imagine is defined in the [Dockerfile](./Dockerfile).

### Database (MySQL)

The MySQL database is a dependency of Django and hosts all of the data for the website. It runs in a standard MySQL Docker image.

### Cache (Memcached)

Memcached is another Django dependency. It serves as the primary cache for the Django app and is used to speed up page requests, database calls and other parts of the code.

## Deployment process

The website is deployed by GitHub Actions workflows defined in this repository.

The deployment is a two-step process: build first, then deploy.

### Build workflow

This workflow builds a Docker image from the Python source code in this repository. Each image is versioned and can be deployed at a later date.

Builds happen on an ongoing basis in order to detect and fix build errors early instead of at deployment time.

The build workflow is triggered each time a pull request is merged. This means that every major code change results in a new image that can be deployed. However, not every image needs to be deployed.

The build workflow is also triggered when a new tag is created on the repository. This allows us to tag our Docker images with easy-to-read [semantic version tags](https://semver.org/).

Our Docker images are pushed to the [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry). Here's an example image ID:

`ghcr.io/ubyssey/ubyssey.ca:v1.2.3`

### Deploy workflow

The deploy workflow deploys our pre-built Docker image (from the workflow above) to our Linux server. This workflow only triggers when a new GitHub release is created.

The `ubyssey/ubyssey.ca` image is deployed as the `django` service defined in [docker-compose.yml](./docker-compose.yml).


### How to make a deployment

1. Create a new git tag (e.g. `v1.2.3`).
2. Wait for the build workflow to complete.
3. Create and publish a new release for the tag you made above.
4. Wait for the deploy workflow to complete.

## Logs

// TODO

## SSL certificates

// TODO
