#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Variables ---
TERRAFORM_VERSION="1.11.3"
TERRAFORM_DIR="/usr/local/bin"
TERRAFORM_ZIP="terraform_${TERRAFORM_VERSION}_linux_amd64.zip"
TERRAFORM_URL="https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/${TERRAFORM_ZIP}"
TERRAFORM_BIN="${TERRAFORM_DIR}/terraform"
GCLOUD_SDK_PARENT_DIR="/opt" 
GCLOUD_SDK_INSTALL_DIR="${GCLOUD_SDK_PARENT_DIR}/google-cloud-sdk"
TEMP_SDK_DOWNLOAD_DIR=$(mktemp -d)
TEMP_DIR=$(mktemp -d)
TARGET_PROJECT_ID="ubyssey-prd"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# --- Color definitions ---
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# --- Helper Functions ---
log() {
  echo -e "${GREEN}[INFO] $(date +'%Y-%m-%d %H:%M:%S') - $1${NC}"
}

error_exit() {
  echo -e "${RED}[ERROR] $(date +'%Y-%m-%d %H:%M:%S') - $1${NC}" >&2
  exit 1
}

warn() {
   echo -e "${YELLOW}[WARN] $(date +'%Y-%m-%d %H:%M:%S') - $1${NC}"
}

usage() {
  echo -e "${YELLOW}Usage: $0 <action>${NC}"
  echo -e ""
  echo -e "${YELLOW}Actions:${NC}"
  echo -e "  ${GREEN}deploy${NC}   - Initialize, plan, and apply Terraform configuration to deploy resources."
  echo -e "  ${GREEN}destroy${NC}  - Initialize and destroy Terraform-managed resources."
  echo -e ""
  echo -e "${YELLOW}Options:${NC}"
  echo -e "  ${GREEN}--help${NC}   - Display this help message."
  exit 1 # Exit with an error code as usage implies incorrect invocation or help request
}

set_gcp_project_id() {
  log "Checking current active gcloud project..."
  CURRENT_ACTIVE_PROJECT=$(gcloud config get-value project 2>/dev/null)

  if [ "$CURRENT_ACTIVE_PROJECT" == "$TARGET_PROJECT_ID" ]; then
    log "Active gcloud project is already set to '${TARGET_PROJECT_ID}'. No changes needed."
  else
    if gcloud projects describe "${TARGET_PROJECT_ID}" --format="value(projectId)" > /dev/null 2>&1; then
      log "Setting active gcloud project to '${TARGET_PROJECT_ID}'..."
      gcloud config set project "${TARGET_PROJECT_ID}" || error_exit "Failed to set gcloud project to '${TARGET_PROJECT_ID}'."
    else
      error_exit "Project '${TARGET_PROJECT_ID}' does not exist, or you do not have permission to access it. Please check the project ID and your IAM permissions."
    fi
  fi
}

authorize_gcp(){
  log "Checking current gcloud user authentication status..."
  ACTIVE_USER_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null)

  if [ -n "$ACTIVE_USER_ACCOUNT" ]; then
    log "Already logged in to gcloud as: $ACTIVE_USER_ACCOUNT"
  else
    warn "No active gcloud user login found. Attempting 'gcloud auth login'..."
    log "This will likely open a web browser for authentication."
    if gcloud auth login; then
      log "'gcloud auth login' successful."
      ACTIVE_USER_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null) # Re-check
      log "Now logged in as: $ACTIVE_USER_ACCOUNT"
    fi
  fi
}

install_gcloud_sdk() {
    log "gcloud CLI not found. Attempting to install Google Cloud SDK..."
    
    mkdir -p "${GCLOUD_SDK_PARENT_DIR}" || error_exit "Failed to create parent directory ${GCLOUD_SDK_PARENT_DIR}. Check permissions."

    # Ensure TEMP_SDK_DOWNLOAD_DIR is cleaned up on script exit
    trap 'rm -rf -- "$TEMP_SDK_DOWNLOAD_DIR"' EXIT

    cd "$TEMP_SDK_DOWNLOAD_DIR"

    log "Downloading Google Cloud SDK..."
    # Using the general tar.gz for broader compatibility
    curl -O https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-linux-x86_64.tar.gz

    log "Extracting Google Cloud SDK to ${GCLOUD_SDK_INSTALL_DIR}..."
    mkdir -p "${GCLOUD_SDK_INSTALL_DIR}"
    tar -xzf google-cloud-cli-linux-x86_64.tar.gz --strip-components=1 -C "${GCLOUD_SDK_INSTALL_DIR}" || error_exit "Failed to extract Google Cloud SDK."
    
    SDK_PATH_INC="${GCLOUD_SDK_INSTALL_DIR}/path.bash.inc"

    log "Running Google Cloud SDK installation script..."
    "${GCLOUD_SDK_INSTALL_DIR}/install.sh"

    if [ -f "$SDK_PATH_INC" ]; then
        log "Sourcing Google Cloud SDK path for current session from $SDK_PATH_INC"
        source "$SDK_PATH_INC"
    else
        log "Could not find $SDK_PATH_INC. Adding SDK bin to PATH manually for current session."
        export PATH="${GCLOUD_SDK_INSTALL_DIR}/bin:$PATH"
    fi
    
    cd - > /dev/null # Go back to original directory
    trap - EXIT # Clear the trap for TEMP_SDK_DOWNLOAD_DIR

    if ! command -v gcloud &> /dev/null; then
      error_exit "Google Cloud SDK installation attempted, but 'gcloud' command is still not found. Please check the installation output or install manually."
    else
      log "Google Cloud SDK installed successfully."
      gcloud --version
    fi
}

install_terraform() {
  # Check if Terraform is installed
  if command -v terraform &> /dev/null; then
    # Terraform is installed, let's check the version
    INSTALLED_VERSION_FULL_STRING=$(terraform version | head -n 1)
    INSTALLED_VERSION_NUMBER=$(echo "$INSTALLED_VERSION_FULL_STRING" | grep -oP 'v\K[0-9]+\.[0-9]+\.[0-9]+(?:-[a-zA-Z0-9]+)?')

    if [ -n "$INSTALLED_VERSION_NUMBER" ] && [ "$INSTALLED_VERSION_NUMBER" == "$TERRAFORM_VERSION" ]; then
      log "Terraform v${TERRAFORM_VERSION} is already installed and matches the required version."
      return 0 # Exit the function successfully
    else
      if [ -n "$INSTALLED_VERSION_NUMBER" ]; then
        warn "Installed Terraform version (v${INSTALLED_VERSION_NUMBER}) does NOT match the required version (v${TERRAFORM_VERSION})."
      else
        warn "Could not reliably parse installed Terraform version from: '${INSTALLED_VERSION_FULL_STRING}'. Assuming mismatch."
      fi
      log "Removing existing Terraform to install v${TERRAFORM_VERSION}..."
      # Attempt to find the full path of the existing terraform binary
      EXISTING_TERRAFORM_PATH=$(command -v terraform)
      if [ -n "$EXISTING_TERRAFORM_PATH" ] && [ -f "$EXISTING_TERRAFORM_PATH" ]; then
        rm -f "$EXISTING_TERRAFORM_PATH" || warn "Could not remove existing Terraform binary at '${EXISTING_TERRAFORM_PATH}'. Please check permissions. Installation will proceed to ${TERRAFORM_BIN}."
      else
        warn "Could not determine the path of the existing Terraform binary to remove it."
      fi
    fi
  fi

  # This part will run if Terraform is not installed OR if it was removed due to version mismatch
  log "Terraform not found or version mismatch. Installing Terraform v${TERRAFORM_VERSION}..."
  
  # Install dependencies if not present (curl, unzip)
  if ! command -v curl &> /dev/null || ! command -v unzip &> /dev/null; then
      log "Installing curl and unzip..."
      apt-get update && apt-get install -y curl unzip || error_exit "Failed to install curl/unzip."
  fi

  # Ensure TEMP_DIR is cleaned up on script exit, even if by error
  trap 'rm -rf -- "$TEMP_DIR"' EXIT

  cd "$TEMP_DIR"

  log "Downloading Terraform v${TERRAFORM_VERSION} from ${TERRAFORM_URL}..."
  curl -Os "${TERRAFORM_URL}" || error_exit "Failed to download Terraform from ${TERRAFORM_URL}."
  
  log "Unzipping ${TERRAFORM_ZIP}..."
  unzip "${TERRAFORM_ZIP}" || error_exit "Failed to unzip ${TERRAFORM_ZIP}."
  
  log "Moving Terraform to ${TERRAFORM_BIN}..."
  mkdir -p "${TERRAFORM_DIR}" || error_exit "Failed to create directory ${TERRAFORM_DIR}. Check permissions."
  mv terraform "${TERRAFORM_BIN}" || error_exit "Failed to move Terraform to ${TERRAFORM_BIN}."
  chmod +x "${TERRAFORM_BIN}"

  cd - > /dev/null # Go back to original directory
  # trap will clean up TEMP_DIR, but we can remove it here if we want to be explicit before trap fires
  rm -rf -- "$TEMP_DIR"
  trap - EXIT # Clear the trap as we've manually cleaned up

  log "Terraform v${TERRAFORM_VERSION} installed successfully to ${TERRAFORM_BIN}."
}

login_gcp() {
  log "Ensuring gcloud CLI is available..."
  if ! command -v gcloud &> /dev/null; then
    install_gcloud_sdk 
  else
    log "gcloud CLI is already installed."
  fi
  authorize_gcp
  set_gcp_project_id
}

run_terraform_workflow() {
  local action="$1"

  log "Starting Terraform workflow for action: ${action}..."

  cd "$SCRIPT_DIR"
  log "Running 'terraform init'..."
  terraform init || error_exit "Terraform init failed."

  if [ "$action" == "apply" ]; then
    log "Running 'terraform plan'..."
    terraform plan || error_exit "Terraform plan failed."

    log "Terraform will now ask for confirmation to apply the plan."
    terraform apply || error_exit "Terraform apply failed."
  
  elif [ "$action" == "destroy" ]; then
    log "Terraform will now ask for confirmation to destroy resources."
    terraform destroy || error_exit "Terraform destroy failed." 
    log "Terraform destroy completed successfully."
    
  else
    error_exit "Invalid action specified for Terraform workflow: ${action}. Use 'apply' or 'destroy'."
  fi
}

# --- Script Execution ---
main() {
  log "Starting GCP VM Deployment Script..."

  if [ "$1" == "--help" ]; then
    usage
  fi
  
  local action="$1"
  
  # Validate the input argument
  if [ -z "$1" ] || [[ "$action" != "deploy" && "$action" != "destroy" ]]; then
    echo -e "${RED}[ERROR] Invalid action: '${action}'.${NC}" >&2
    usage 
  fi

  install_terraform
  login_gcp 

  if [ "$action" == "deploy" ]; then
    run_terraform_workflow "apply"
  else
    run_terraform_workflow "destroy"
  fi

  log "Script finished successfully for action: ${action}!"
}

main "$@"