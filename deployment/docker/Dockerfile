FROM python:3.10-bullseye

COPY . /app
WORKDIR /app

RUN apt-get update && \
    apt-get install -y git curl cron ca-certificates && \
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

RUN pip install -r requirements.txt
