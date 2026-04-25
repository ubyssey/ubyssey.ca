# Ubyssey Linux Deployment

## Overview

The Ubyssey website (ubyssey.ca) is hosted on a single Debian 12 Linux virtual machine. We use a single-server deployment, meaning that all core services are hosted on the same machine, including the Django application, the database and a memory cache.

We chose a single-server deployment instead of a distributed system in order to reduce costs and decrease latency between the application and database.

## Configuration

The website consists of the following services:

1. Reverse Proxy (Nginx)
2. App Server (Django)
3. Database (MySQL)
4. Cache (Memcached)
5. Static File Storage (Google Cloud Storage)

```
                                       Docker Swarm
                  ┌────────────────────────────────────────────────────┐
                  │  ┌───────────┐      ┌───────────┐                  │
────Page Request──┼─▶│ 1. Nginx  ├─────▶│ 2. Django │                  │
                  │  └───────────┘      └───────────┘                  │
                  │                           │                        │
                  │                           ├───────────────┐        │
                  │                           ▼               ▼        │
                  │                     ┌───────────┐ ┌──────────────┐ │
                  │                     │ 3. MySQL  │ │ 4. Memcached │ │
                  │                     └───────────┘ └──────────────┘ │
                  └────────────────────────────────────────────────────┘
```

_Diagram made with [Monodraw](https://monodraw.helftone.com/) :)_

Services 1-4 are defined as Docker containers in [docker-compose.yml](./docker-compose.yml) and run in a single-node Docker Swarm. These services communicate with each other on Docker's internal network, meaning that, for example, the MySQL server is only accessible by the other Docker containers and not the general public.

### 1. Reverse Proxy (Nginx)

Nginx is an HTTP web server that acts as the entrypoint for all client requests to the website. Nginx is a versatile tool, but we use it as a reverse proxy that does the following:

- Forwards traffic to the Django server
- Redirects requests from www.ubyssey.ca to ubyssey.ca
- Handles HTTPS traffic, including redirecting insecure HTTP requests to HTTPS (see [TLS Certificates](#tls-certificates) below)
- _In the future: serve archived versions of the website as static HTML files_

The Nginx configuration is defined in [nginx.conf](./nginx.conf).

### 2. App Server (Django)

The Django app server is the main part of the deployment. It is where all the user-facing pages are defined and also serves the backend CMS used to manage the website content.

Django runs inside of a custom Docker image that we build from our source code, using the [Python Docker image](https://hub.docker.com/_/python) as a base. This image is defined in the [Dockerfile](./Dockerfile) in this repository.

### 3. Database (MySQL)

The MySQL database is a dependency of Django and hosts all of the data for the website. It runs in a standard MySQL Docker image.

### 4. Cache (Memcached)

Memcached is another Django dependency. It serves as the primary cache for the Django app and is used to speed up page requests, database calls and other parts of the code.

### 5. Static File Storage (Google Cloud Storage)

All static assets (i.e. images, stylesheets, scripts) are uploaded to a Google Cloud Storage bucket instead of being stored on the Linux server. This allows us to quickly and reliably deliver static assets to clients.

## Deployment Process

The website is deployed by two GitHub Actions workflows defined in this repository.

Each deployment is a two-step process: build first, then deploy.

### Build Workflow

Workflow file: [.github/workflows/build.yml](.github/workflows/build.yml)

This workflow builds a Docker image from the Python source code in this repository. Each image is versioned and can be deployed at a later date. The image is defined in the [Dockerfile](./Dockerfile) in the root of this repository.

The build workflow is triggered each time a pull request is merged. This means that every major code change results in a new image that can be deployed. However, not every image needs to be deployed. Builds happen on an ongoing basis in order to detect and fix build errors early instead of at deployment time.

The build workflow is also triggered when a new tag is created on the repository. This allows us to tag our Docker images with easy-to-read [semantic version tags](https://semver.org/) (e.g. `v1.2.3`).

Our Docker images are pushed to the [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry). Here's an example image ID:

```
ghcr.io/ubyssey/ubyssey.ca:v1.2.3
```

### Deploy Workflow

Workflow file: [.github/workflows/deploy-production.yml](.github/workflows/deploy-production.yml)

The deploy workflow deploys our pre-built Docker image (from the workflow above) to our Linux server. This workflow only triggers when a new GitHub release is published on this repository.

The `ubyssey/ubyssey.ca` image is deployed as the `django` service defined in [docker-compose.yml](./docker-compose.yml).

### How to make a deployment

1. Create a new git tag (e.g. `v1.2.3`).
2. Wait for the build workflow to complete.
3. Create and publish a new release for the tag you made above.
4. Wait for the deploy workflow to complete.

## Connecting to the Server

### SSH into the VM

Please read the Google Cloud documentation for information on how to connect directly to the Linux VM: [Google Cloud: Connect to Linux VMs](https://cloud.google.com/compute/docs/connect/standard-ssh)

### Switch to the app directory

All commands should be executed from the app directory (`/opt/ubyssey.ca`) on the Linux VM. Switch to this directory with this command:

```bash
cd /opt/ubyssey.ca
```

### Useful commands

**:warning: Important Notes:** 
- All commands must be executed from the app directory (`/opt/ubyssey.ca`)
- You may need to execute some commands as a superuser. Switch to superuser mode by running `sudo su -`.

```bash
# Deploy (or update) the Docker swarm
docker stack deploy ubyssey
```

```bash
# Restart all Docker services
docker service ls --format '{{.Name}}' | xargs -n1 docker service update --force
```

```bash
# Restart a single service

# e.g. restart the "django" service:
docker service update --force ubyssey_django
```

## TLS Certificates

To secure our website and serve HTTPS traffic, we use a free TLS certificate from [Let's Encrypt](https://letsencrypt.org/) and manage it using [Certbot](https://certbot.eff.org/).

### Create a TLS certificate

After connecting to the server and switching to the app directory (see above), run the following command to request a new TLS certificate from Let's Encrypt using the `certonly` command:

```bash
docker compose run --rm certbot certonly --webroot --webroot-path /var/www/certbot/ --dry-run -d ubyssey.ca -d www.ubyssey.ca
```

**:warning: Important:** this command requires that at least the `nginx` service is running. This is so that Let's Encrypt can complete an ACME verification of our domain name.

_Note: we run certbot with Docker to avoid having to install it on the Linux system._

### Renew a TLS certificate

Our TLS certificate needs to be renewed at least once every 90 days to avoid expiry. The `certbot` service in our Docker Swarm is configured to automatically check and renew our certificate every 12 hours.

However, use this command if you need to trigger a renewal manually:

```bash
docker compose run --rm certbot renew
```

### How we handle HTTPS traffic

Nginx uses our TLS certificate to encrypt HTTPS traffic. The TLS certificate files are mounted to the Nginx Docker container and then loaded by Nginx. Please reference the Nginx configuration ([nginx.conf](./nginx.conf) for more information.

## Logs

You can view realtime logs from the Ubyssey Docker services in the Google Cloud Logging console. Logs are delivered to Cloud Logging using the [Docker Google Cloud Logging driver](https://docs.docker.com/engine/logging/drivers/gcplogs/).
