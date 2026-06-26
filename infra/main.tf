data "google_project" "this" {
  project_id = var.project_id
}

resource "google_project_service" "services" {
  for_each = toset([
    "run.googleapis.com",
    "iap.googleapis.com",
    "artifactregistry.googleapis.com",
    "secretmanager.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "sts.googleapis.com",
    "cloudresourcemanager.googleapis.com",
  ])

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_artifact_registry_repository" "app" {
  project       = var.project_id
  location      = var.region
  repository_id = var.artifact_repo_id
  format        = "DOCKER"
  description   = "Container images for ${var.service_name}"

  depends_on = [google_project_service.services]
}
