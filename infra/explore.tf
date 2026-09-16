# Public counterpart to cloudrun.tf: serves explore.logrocket.com to the open
# internet with no IAP in front of it.
#
# IAP on Cloud Run is scoped to the whole service, so external content cannot
# live on logrocket-prompt-gen behind a path. It gets its own service, its own
# image (../Dockerfile.explore, static files only), and its own runtime SA that
# is deliberately granted NO access to the Anthropic/Rog secrets.

resource "google_service_account" "explore_runtime" {
  project      = var.project_id
  account_id   = "explore-run"
  display_name = "Cloud Run runtime SA for ${var.explore_service_name}"

  depends_on = [google_project_service.services]
}

resource "google_cloud_run_v2_service" "explore" {
  project             = var.project_id
  name                = var.explore_service_name
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  iap_enabled         = false
  deletion_protection = false

  template {
    service_account = google_service_account.explore_runtime.email

    containers {
      image = var.explore_image

      ports {
        container_port = 8080
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

  depends_on = [google_project_service.services]
}

# The actual "public" part: unauthenticated invocation for anyone.
resource "google_cloud_run_v2_service_iam_member" "explore_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.explore.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Lets the existing GitHub Actions deployer run revisions as the explore
# runtime SA. Project-level roles/run.admin it already has is not sufficient.
resource "google_service_account_iam_member" "deploy_act_as_explore_runtime" {
  service_account_id = google_service_account.explore_runtime.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.deploy.email}"
}

resource "google_cloud_run_domain_mapping" "explore" {
  project  = var.project_id
  location = var.region
  name     = var.explore_domain

  metadata {
    namespace = var.project_id
  }

  spec {
    route_name = google_cloud_run_v2_service.explore.name
  }
}
