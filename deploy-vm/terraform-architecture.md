# GCP Terraform Infrastructure Overview

This document explains how the components defined in your Terraform script are interconnected and how they map to Google Cloud Platform (GCP) resources.

---

## 1. **Google Cloud Storage (GCS) Bucket**
- **Purpose:** Stores the Terraform state file, which tracks all managed resources.
- **How:**
  - Defined in the `terraform` backend block (via `backend.conf`).
  - Example: `ubyssey-terraform-state-bucket`.

---

## 2. **Provider**
- **Purpose:** Configures Terraform to use your GCP project, region, and zone.
- **How:**
  - Uses variables: `project_provider`, `region`, `zone`.

---

## 3. **Snapshot Data Source**
- **Resource:** `data "google_compute_snapshot" "ubyssey_snapshot"`
- **Purpose:** Finds the latest disk snapshot matching a filter in a given project.
- **How:**
  - Used to restore VM disks from backups.

---

## 4. **Persistent Disk**
- **Resource:** `google_compute_disk.boot_disk_from_snapshot`
- **Purpose:** Creates a new persistent disk for the VM, either from a snapshot or an image.
- **How:**
  - If `boot_disk_image` is set, uses that image.
  - Otherwise, uses the latest snapshot found above.

---

## 5. **Compute Engine VM Instance**
- **Resource:** `google_compute_instance.ubyssey_vm`
- **Purpose:** The main virtual machine running your application.
- **How:**
  - Uses the persistent disk as its boot disk.
  - Connects to the default VPC network and subnetwork.
  - Optionally attaches a static or ephemeral external IP.
  - Uses a service account for permissions.
  - Has metadata, tags, and labels for configuration and management.

---

## 6. **Resource Policy for Snapshots**
- **Resource:** `google_compute_resource_policy.snapshot_retention`
- **Purpose:** Automates daily snapshots of the VM's boot disk and manages retention.
- **How:**
  - Schedules daily snapshots at 03:00.
  - Retains snapshots for a configurable number of days.

---

## 7. **Resource Policy Attachment**
- **Resource:** `google_compute_disk_resource_policy_attachment.attach_policy`
- **Purpose:** Attaches the snapshot policy to the boot disk so GCP will automatically create and manage snapshots.

---

## 8. **Network and Access**
- **Network:**
  - The VM is attached to the default VPC network and subnetwork.
  - `access_config {}` enables an external IP for SSH and HTTP/S access.
- **Firewall (not shown in this script):**
  - You may need to define firewall rules to allow SSH (port 22), HTTP (80), and HTTPS (443) access.

---

## **How Everything Connects**

1. **Terraform** uses the GCS bucket to store state.
2. **Provider** tells Terraform which GCP project/region/zone to use.
3. **Snapshot data source** finds the latest backup to restore from.
4. **Persistent disk** is created from the snapshot or image.
5. **VM instance** is created using the persistent disk as its boot disk.
6. **Resource policy** ensures the disk is regularly backed up.
7. **Policy attachment** links the backup policy to the disk.
8. **Network interface** connects the VM to the internet and internal network.

---

## **Diagram**

```
[GCS Bucket: Terraform State]
        |
        v
[Terraform Provider (Project/Region/Zone)]
        |
        v
[Snapshot Data Source] ---> [Persistent Disk (from snapshot/image)]
                                         |
                                         v
                        [Compute Engine VM Instance]
                                         |
                                         v
                [Resource Policy] <--- [Policy Attachment]
                                         |
                                         v
                                [Automatic Snapshots]
                                         |
                                         v
                                [Network Interface]
```

---

## **Summary Table**

| Terraform Resource                                 | GCP Component                | Purpose                                    |
|----------------------------------------------------|------------------------------|--------------------------------------------|
| `terraform { backend "gcs" ... }`                  | GCS Bucket                   | Store Terraform state                      |
| `provider "google" ...`                            | Project/Region/Zone          | Set GCP context                            |
| `data "google_compute_snapshot" ...`               | Compute Snapshot             | Find latest snapshot                       |
| `google_compute_disk.boot_disk_from_snapshot`       | Persistent Disk              | Boot disk for VM                           |
| `google_compute_instance.ubyssey_vm`               | Compute Engine VM            | Main VM                                    |
| `google_compute_resource_policy.snapshot_retention` | Resource Policy              | Snapshot schedule/retention                |
| `google_compute_disk_resource_policy_attachment`    | Policy Attachment            | Attach policy to disk                      |

---

**This setup ensures your VM is created from a backup, is regularly backed up, and is managed in a reproducible, automated way using Terraform.**
