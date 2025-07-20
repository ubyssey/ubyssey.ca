FROM python:3.10-bullseye

COPY . /app/ubyssey.ca
WORKDIR /app/ubyssey.ca

RUN pip install -r requirements.txt
