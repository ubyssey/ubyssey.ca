FROM python:3.9-bullseye

COPY . /app
WORKDIR /app

RUN pip install -r requirements.txt
