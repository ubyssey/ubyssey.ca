variable "project_provider" {
  description = "GCP project ID"
  type        = string
  default     = "ubyssey-staging"
}

variable "project_snapshot" {
  description = "GCP project ID"
  type        = string
  default     = "ubyssey-staging"
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-west1"
}

variable "zone" {
  description = "GCP zone"
  type        = string
  default     = "us-west1-a"
}

variable "vm_name" {
  description = "Name of the VM instance"
  type        = string
  default     = "ubyssey-staging-vm-2"
}

variable "machine_type" {
  description = "Machine type for the VM"
  type        = string
  default     = "e2-highcpu-8"
}

variable "disk_size_gb" {
  description = "Boot disk size in GB"
  type        = number
  default     = 40
}

variable "disk_type" {
  description = "Boot disk type"
  type        = string
  default     = "pd-balanced"
}

variable "snapshot_filter" {
  description = "Filter for finding the latest snapshot"
  type        = string
  default     = "name eq ^ubyssey-staging-vm.*"
}

variable "service_account_email" {
  description = "Service account email for the VM"
  type        = string
  default     = "863738545301-compute@developer.gserviceaccount.com"
}

variable "boot_disk_from_snapshot" {
  type        = string
  default     = "ubyssey-staging-vm"
  description = "Optional: Boot disk from snapshot, if not provided a new disk will be created with the default name"
}

variable "boot_disk_image" {
  description = "Optional: GCP image self_link or family to use for boot disk. If set, this takes precedence over snapshot. Default is null."
  type        = string
  default     = null
}

variable "snapshot_retention_days" {
  description = "Number of days to retain snapshots. Default is 7."
  type        = number
  default     = 7
}