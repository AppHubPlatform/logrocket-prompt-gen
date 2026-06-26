resource "google_cloud_run_v2_service" "app" {
  project             = var.project_id
  name                = var.service_name
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  iap_enabled         = true
  deletion_protection = false

  template {
    service_account = google_service_account.runtime.email

    containers {
      image = var.image

      ports {
        container_port = 8080
      }

      env {
        name = "ANTHROPIC_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.anthropic.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "ROG_TOKEN"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.rog.secret_id
            version = "latest"
          }
        }
      }
    }
  }

  # CI deploys new images out-of-band; don't let Terraform revert them.
  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
      client,
      client_version,
    ]
  }

  depends_on = [
    google_project_service.services,
    google_secret_manager_secret_iam_member.runtime_anthropic,
    google_secret_manager_secret_iam_member.runtime_rog,
  ]
}
