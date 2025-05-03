provider "google" {
  project = "ubyssey-prd"
  region  = "us-west1"
  zone    = "us-west1-a"
}

resource "google_compute_instance" "ubyssey_prd_vm_2" {
  name         = "ubyssey-prd-vm-2"
  machine_type = "e2-highcpu-8"
  zone         = "us-west1-a"
  description  = ""
  allow_stopping_for_update = true
  
  boot_disk {
    auto_delete = true
    device_name = "ubyssey-prd-vm-2"

    initialize_params {
      size = 40
      image = "projects/debian-cloud/global/images/family/debian-12"
      type = "pd-standard"
    }
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