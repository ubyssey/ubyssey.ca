#!/bin/bash

# Set the Google Cloud Project ID
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)

if [[ -z "$PROJECT_ID" ]]; then
    echo "Error: No Google Cloud project set. Run 'gcloud config set project PROJECT_ID'."
    exit 1
fi

echo "Fetching all secrets from Google Secret Manager for project: $PROJECT_ID"

# Get a list of all secret names
GCLOUD_SECRETS=$(gcloud secrets list --format="value(name)")

# Check if Google secrets exist
if [[ -z "$GCLOUD_SECRETS" ]]; then
    echo "No secrets found in Google Secret Manager."
    exit 0
fi

# Get a list of all Docker secrets
DOCKER_SECRETS=$(docker secret ls --format '{{.Name}}')

# Loop through and remove each Docker secret
echo "Deleting Docker secrets..."
for SECRET in $DOCKER_SECRETS; do
    echo "Removing secret: $SECRET"
    docker secret rm "$SECRET"
done

echo "All Docker secrets have been deleted."

# Loop through each Google secret and create a Docker secret
for SECRET_NAME in $GCLOUD_SECRETS; do
    echo "Processing secret: $SECRET_NAME"

    # Retrieve the latest secret value
    SECRET_VALUE=$(gcloud secrets versions access latest --secret="$SECRET_NAME" --project="$PROJECT_ID" 2>/dev/null)

    if [[ -z "$SECRET_VALUE" ]]; then
        echo "Error: Unable to retrieve value for secret $SECRET_NAME." >&2
        exit 1
    fi

    # Check if Docker secret already exists
    if docker secret inspect "$SECRET_NAME" &>/dev/null; then
        echo "Docker secret '$SECRET_NAME' already exists. Skipping."
        continue
    fi

    # Create Docker secret
    echo -n "$SECRET_VALUE" | docker secret create "$SECRET_NAME" -
    
    if [[ $? -eq 0 ]]; then
        echo "Docker secret '$SECRET_NAME' created successfully."
    else
        echo "Error: Failed to create Docker secret '$SECRET_NAME'."
    fi

done

echo "All secrets processed."
