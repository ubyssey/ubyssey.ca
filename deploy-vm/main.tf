terraform {
  backend "gcs" {}
}

provider "google" {
  project = var.project_provider
  region  = var.region
  zone    = var.zone
}

data "google_compute_snapshot" "ubyssey_snapshot" {
  project     = var.project_snapshot
  filter      = var.snapshot_filter
  most_recent = true
}

resource "google_compute_disk" "boot_disk_from_snapshot" {
  name     = var.boot_disk_from_snapshot
  size     = var.disk_size_gb
  type     = var.disk_type
  snapshot = var.boot_disk_image != null ? null : data.google_compute_snapshot.ubyssey_snapshot.self_link
  image    = var.boot_disk_image
}

resource "google_compute_instance" "ubyssey_vm" {
  name                      = var.vm_name
  machine_type              = var.machine_type
  zone                      = var.zone
  description               = "the single VM for ubyssey.ca"
  allow_stopping_for_update = true

  boot_disk {
    auto_delete = true
    source      = google_compute_disk.boot_disk_from_snapshot.self_link
  }

  network_interface {
    network    = "default"
    subnetwork = "default"
    access_config {
    }
  }

  scheduling {
    automatic_restart   = true
    on_host_maintenance = "MIGRATE"
    preemptible         = false
    provisioning_model  = "STANDARD"
  }

  metadata = {
    enable-osconfig = "TRUE"
  }

  tags = ["http-server", "https-server"]

  labels = {
    goog-ops-agent-policy = "v2-x86-template-1-4-0"
  }

  reservation_affinity {
    type = "ANY_RESERVATION"
  }

  service_account {
    email  = var.service_account_email
    scopes = ["https://www.googleapis.com/auth/cloud-platform"]
  }
}

# Resource policy for automatic snapshot schedule and retention
resource "google_compute_resource_policy" "snapshot_retention" {
  name   = "${var.vm_name}-snapshot-policy"
  region = var.region
  snapshot_schedule_policy {
    schedule {
      daily_schedule {
        days_in_cycle = 1
        start_time    = "03:00"
      }
    }
    retention_policy {
      max_retention_days    = var.snapshot_retention_days
      on_source_disk_delete = "KEEP_AUTO_SNAPSHOTS"
    }
    snapshot_properties {
      labels = {
        created_by = "terraform"
        vm_name    = var.vm_name
      }
    }
  }
}

resource "google_compute_disk_resource_policy_attachment" "attach_policy" {
  name = google_compute_resource_policy.snapshot_retention.name
  disk = google_compute_disk.boot_disk_from_snapshot.name
  zone = var.zone
}