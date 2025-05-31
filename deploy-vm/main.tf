provider "google" {
  project = var.project
  region  = var.region
  zone    = var.zone
}

data "google_compute_snapshot" "ubyssey_snapshot" {
  project     = var.project
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

resource "google_compute_instance" "ubyssey_prd_vm_2" {
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