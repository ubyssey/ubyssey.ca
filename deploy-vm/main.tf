provider "google" {
  project = "ubyssey-prd"
  region  = "us-west1"
  zone    = "us-west1-a"
}

data "google_compute_snapshot" "ubyssey_snapshot" {
  name    = "ubyssey-prd-vm-1-us-west1-a-20250504090431-kiy1orqn"
  project = "ubyssey-prd"
}

# Optional: Generate a random suffix for the disk name to ensure uniqueness
resource "random_id" "suffix" {
  byte_length = 4
}

# 1. Create a new disk from the snapshot to be used as the boot disk
resource "google_compute_disk" "boot_disk_from_snapshot" {
  name  = "boot-disk-from-snapshot-${random_id.suffix.hex}" # Use a unique name, e.g., with a random suffix
  zone  = "us-west1-a"
  type  = "pd-standard"
  # The size of the new disk must be at least the size of the snapshot's source disk.
  # You can explicitly set a size if needed, otherwise it will default to the snapshot size.
  # size = 40 # Example: explicitly setting size

  # CORRECTED: Use the 'snapshot' argument to specify the source snapshot
  snapshot = data.google_compute_snapshot.ubyssey_snapshot.self_link
}


resource "google_compute_instance" "ubyssey_prd_vm_2" {
  name         = "ubyssey-prd-vm-2"
  machine_type = "e2-highcpu-8"
  zone         = "us-west1-a" # Must be in the same zone as the boot disk
  description  = ""
  allow_stopping_for_update = true

  # 2. Reference the newly created disk in the boot_disk block
  boot_disk {
    auto_delete = true
    # Use the 'source' argument to attach the disk created from the snapshot
    source = google_compute_disk.boot_disk_from_snapshot.self_link
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
}