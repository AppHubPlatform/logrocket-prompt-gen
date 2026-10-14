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

      # ABM landing pages: drafts' images and published pages (abm.tf).
      env {
        name  = "ABM_BUCKET"
        value = google_storage_bucket.abm_pages.name
      }

      # Posts "needs approval" alerts to Slack. Add a version to the secret before
      # applying, or the revision will fail to start (see secrets.tf).
      env {
        name = "ABM_SLACK_WEBHOOK_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.abm_slack_webhook.secret_id
            version = "latest"
          }
        }
      }

      env {
        name  = "FIRESTORE_DATABASE_ID"
        value = google_firestore_database.mission_control.name
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
    google_secret_manager_secret_iam_member.runtime_abm_slack_webhook,
    google_project_iam_member.runtime_firestore,
  ]
}
