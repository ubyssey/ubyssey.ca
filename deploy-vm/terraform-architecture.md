# GCP Terraform Infrastructure Overview

This document explains how the components defined in your Terraform script are interconnected and how they map to Google Cloud Platform (GCP) resources.

---

## 1. **Google Cloud Storage (GCS) Bucket**
- **Purpose:** Stores the Terraform state file, which tracks all managed resources.
- **How:**
  - Defined in the `terraform` backend block using `ubyssey-terraform-state-bucket`.
  - State is stored with prefix `terraform/state`.

---

## 2. **Provider Configuration**
- **Purpose:** Configures Terraform to use your GCP project, region, and zone.
- **How:**
  - Uses variables: `project_provider`, `region`, `zone`.
  - Enables multi-project deployments (staging vs production).

---

## 3. **Snapshot Data Source**
- **Resource:** `data "google_compute_snapshot" "ubyssey_snapshot"`
- **Purpose:** Finds the latest disk snapshot matching a filter in a specified project.
- **How:**
  - Uses `project_snapshot` variable to allow cross-project snapshot access.
  - Filters snapshots using `snapshot_filter` variable.
  - Automatically selects the most recent matching snapshot.

---

## 4. **Static IP Address**
- **Resource:** `google_compute_address.vm_static_ip`
- **Purpose:** Reserves a static external IP address for the VM.
- **How:**
  - Named as `{vm_name}-static-ip`.
  - External address type for internet access.
  - Regional scope matching the VM's region.

---

## 5. **Persistent Disk**
- **Resource:** `google_compute_disk.boot_disk_from_snapshot`
- **Purpose:** Creates a new persistent disk for the VM boot volume.
- **How:**
  - Conditional creation: uses snapshot OR image based on `boot_disk_image` variable.
  - If `boot_disk_image` is null → uses latest snapshot.
  - If `boot_disk_image` is set → uses specified image.
  - Configurable size (`disk_size_gb`) and type (`disk_type`).

---

## 6. **Compute Engine VM Instance**
- **Resource:** `google_compute_instance.ubyssey_vm`
- **Purpose:** The main virtual machine running your application.
- **Key Features:**
  - Uses the persistent disk as boot disk with auto-delete enabled.
  - Attached to default VPC network and subnetwork.
  - Assigned the reserved static IP address.
  - Configured with specific service account and cloud-platform scope.
  - Includes metadata for OS Config management.
  - Tagged for HTTP/HTTPS firewall rules.
  - Labeled for Google Ops Agent policy.
  - Allows stopping for updates and automatic restart.
  - Standard (non-preemptible) provisioning model.

---

## 7. **Resource Policy for Snapshots**
- **Resource:** `google_compute_resource_policy.snapshot_retention`
- **Purpose:** Automates daily snapshots of the VM's boot disk and manages retention.
- **How:**
  - Schedules daily snapshots at 03:00.
  - Retains snapshots for a configurable number of days (`snapshot_retention_days` variable).
  - Labels snapshots with metadata (created_by, vm_name).
  - Keeps snapshots even if source disk is deleted.

---

## 8. **Resource Policy Attachment**
- **Resource:** `google_compute_disk_resource_policy_attachment.attach_policy`
- **Purpose:** Attaches the snapshot policy to the boot disk so GCP will automatically create and manage snapshots.
- **How:**
  - Links the resource policy to the persistent disk.
  - Ensures automated backup execution.

---

## 9. **Outputs**
- **Purpose:** Provides important information about the created infrastructure.
- **Outputs:**
  - `vm_static_ip`: The static external IP address of the VM.
  - `vm_internal_ip`: The internal IP address within the VPC.
  - `vm_name`: The name of the created VM instance.
  - `vm_zone`: The GCP zone where the VM is located.

---

## 10. **Network and Access**
- **Network:**
  - The VM is attached to the default VPC network and subnetwork.
  - `access_config` block assigns the static external IP for internet access.
  - NAT IP is explicitly set to the reserved static IP address.
- **Security:**
  - Service account with cloud-platform scope for GCP API access.
  - Tagged with `http-server` and `https-server` for firewall rules.
  - OS Config enabled for patch management.

---

## **How Everything Connects**

1. **Terraform Backend** uses the GCS bucket to store and manage state.
2. **Provider Configuration** tells Terraform which GCP project/region/zone to use.
3. **Snapshot Data Source** finds the latest backup to restore from (supports cross-project access).
4. **Persistent Disk** is created from the snapshot or image with specified size and type.
5. **Static IP Address** is reserved for consistent external access.
6. **VM Instance** is created using the persistent disk as boot disk and assigned the static IP.
7. **Resource Policy** defines the automated snapshot schedule and retention rules.
8. **Policy Attachment** links the backup policy to the disk for automatic execution.
9. **Network Interface** connects the VM to the internet and internal network with the static IP.
10. **Outputs** provide key information for external use (DNS, SSH, monitoring).

---

## **Updated Architecture Diagram**

```
[GCS Bucket: Terraform State]
        |
        v
[Terraform Provider (Project/Region/Zone)]
        |
        v
[Snapshot Data Source] -----> [Static IP Address]
        |                           |
        v                           v
[Persistent Disk (from snapshot/image)] --> [Compute Engine VM Instance]
        |                                           |
        v                                           |
[Resource Policy] <---> [Policy Attachment]        |
        |                                           |
        v                                           |
[Automatic Daily Snapshots]                        |
                                                    v
                                        [Network Interface + Outputs]
```

---

## **Complete Resource Summary**

| Terraform Resource                                  | GCP Component           | Purpose                                      |
|---------------------------------------------------|-------------------------|----------------------------------------------|
| `terraform { backend "gcs" ... }`                | GCS Bucket              | Store Terraform state                       |
| `provider "google" ...`                           | Project/Region/Zone     | Set GCP context                             |
| `data "google_compute_snapshot" ...`              | Compute Snapshot        | Find latest snapshot for restore             |
| `google_compute_address.vm_static_ip`             | Static External IP      | Reserve consistent external IP address      |
| `google_compute_disk.boot_disk_from_snapshot`     | Persistent Disk         | Boot disk for VM (from snapshot/image)      |
| `google_compute_instance.ubyssey_vm`              | Compute Engine VM       | Main virtual machine                         |
| `google_compute_resource_policy.snapshot_retention` | Resource Policy      | Automated snapshot schedule/retention       |
| `google_compute_disk_resource_policy_attachment`  | Policy Attachment       | Link policy to disk for execution           |
| `output "vm_static_ip" ...`                       | Terraform Output        | Expose static IP for external use           |
| `output "vm_internal_ip" ...`                     | Terraform Output        | Expose internal IP for monitoring           |
| `output "vm_name" ...`                            | Terraform Output        | Expose VM name for reference                |
| `output "vm_zone" ...`                            | Terraform Output        | Expose zone for deployment scripts          |

---

## **Key Features**

- **Cross-Project Support**: Can restore from snapshots in different projects (staging from production).
- **Flexible Boot Source**: Can boot from either snapshots or fresh images.
- **Static IP Management**: Ensures consistent external access for DNS configuration.
- **Automated Backups**: Daily snapshots with configurable retention.
- **Production Ready**: Includes proper labeling, tagging, and service account configuration.
- **Infrastructure as Code**: Fully reproducible and version-controlled infrastructure.

**This setup ensures your VM infrastructure is reliable, backed up, scalable, and managed through code.**
