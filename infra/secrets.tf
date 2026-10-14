resource "google_service_account" "runtime" {
  project      = var.project_id
  account_id   = "prompt-gen-run"
  display_name = "Cloud Run runtime SA for ${var.service_name}"

  depends_on = [google_project_service.services]
}

# Secret containers only. Add versions out-of-band so values never land in
# Terraform state:
#   echo -n "sk-ant-..." | gcloud secrets versions add anthropic-api-key --data-file=- --project=<PROJECT_ID>
#   echo -n "<rog token>" | gcloud secrets versions add rog-token       --data-file=- --project=<PROJECT_ID>
resource "google_secret_manager_secret" "anthropic" {
  project   = var.project_id
  secret_id = "anthropic-api-key"

  replication {
    auto {}
  }

  depends_on = [google_project_service.services]
}

resource "google_secret_manager_secret" "rog" {
  project   = var.project_id
  secret_id = "rog-token"

  replication {
    auto {}
  }

  depends_on = [google_project_service.services]
}

resource "google_secret_manager_secret_iam_member" "runtime_anthropic" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.anthropic.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.runtime.email}"
}

resource "google_secret_manager_secret_iam_member" "runtime_rog" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.rog.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.runtime.email}"
}

# Slack incoming-webhook URL for ABM "needs approval" alerts (#enablement-updates).
# Anyone holding it can post to the channel, so it is a secret like the API keys. The
# value is added out of band, the same way as the others:
#   printf %s "$URL" | gcloud secrets versions add abm-slack-webhook --data-file=-
resource "google_secret_manager_secret" "abm_slack_webhook" {
  project   = var.project_id
  secret_id = "abm-slack-webhook"

  replication {
    auto {}
  }

  depends_on = [google_project_service.services]
}

resource "google_secret_manager_secret_iam_member" "runtime_abm_slack_webhook" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.abm_slack_webhook.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.runtime.email}"
}
