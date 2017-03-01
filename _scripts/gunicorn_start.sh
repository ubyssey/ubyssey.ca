#!/bin/bash

NAME="ubyssey"
SOCKFILE=/var/webapps/ubyssey/run/gunicorn.sock
LOGFILE=/var/webapps/ubyssey/logs/gunicorn_error.log
USER=ubyssey
GROUP=webapps
NUM_WORKERS=3
DJANGO_PROJECT_DIR=/var/webapps/ubyssey/ubyssey
DJANGO_WSGI_MODULE=ubyssey.wsgi

# Activate the virtual environment
cd $DJANGO_PROJECT_DIR
cd ../
source bin/activate
export PYTHONPATH=$DJANGO_PROJECT_DIR:$PYTHONPATH

# Create the run directory if it doesn't exist
RUNDIR=$(dirname $SOCKFILE)
test -d $RUNDIR || mkdir -p $RUNDIR

# Start gunicorn daemon
echo "Starting $NAME as `whoami`"

exec bin/gunicorn ${DJANGO_WSGI_MODULE}:application \
  --name $NAME \
  --workers $NUM_WORKERS \
  --bind=unix:$SOCKFILE \
  --log-level=error \
  --log-file $LOGFILE \
  --timeout 90

echo "Successfully started $NAME"
