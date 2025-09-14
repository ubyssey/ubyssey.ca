output "vm_static_ip" {
  description = "The static external IP address of the VM"
  value       = google_compute_address.vm_static_ip.address
}

output "vm_internal_ip" {
  description = "The internal IP address of the VM"
  value       = google_compute_instance.ubyssey_vm.network_interface[0].network_ip
}

output "vm_name" {
  description = "The name of the created VM"
  value       = google_compute_instance.ubyssey_vm.name
}

output "vm_zone" {
  description = "The zone where the VM is located"
  value       = google_compute_instance.ubyssey_vm.zone
}