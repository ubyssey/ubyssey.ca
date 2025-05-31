provider "google" {
  project = "ubyssey-prd"
  region  = "us-west1"
  zone    = "us-west1-a"
}

data "google_compute_snapshot" "ubyssey_snapshot" {
  project     = "ubyssey-prd"
  filter      = "name eq ^ubyssey-prd-vm.*"
  most_recent = true
}

resource "random_id" "suffix" {
  byte_length = 4
}
//TODO: add snapshot of the disk

resource "google_compute_disk" "boot_disk_from_snapshot" {
  name     = "boot-disk-from-snapshot-${random_id.suffix.hex}"
  size     = 40
  type     = "pd-balanced"
  snapshot = data.google_compute_snapshot.ubyssey_snapshot.self_link
}

//TODO: update name
resource "google_compute_instance" "ubyssey_prd_vm_2" {
  name                      = "ubyssey-prd-vm-2"
  //TODO: create a variable for the name
  machine_type              = "e2-highcpu-8"
  zone                      = "us-west1-a"
  description               = ""
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
    startup-script = "sudo ufw allow 22"
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
    email  = "863738545301-compute@developer.gserviceaccount.com"
    scopes = ["https://www.googleapis.com/auth/cloud-platform"]
  }
}