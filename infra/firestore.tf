# Shared storage for Mission Control (public/mission-control.html). Only the
# IAP-gated app's runtime SA can reach it; the public explore service must not.
resource "google_firestore_database" "mission_control" {
  project     = var.project_id
  name        = var.firestore_database_id
  location_id = var.region
  type        = "FIRESTORE_NATIVE"

  point_in_time_recovery_enablement = "POINT_IN_TIME_RECOVERY_ENABLED"
  delete_protection_state           = "DELETE_PROTECTION_ENABLED"
  deletion_policy                   = "ABANDON"

  depends_on = [google_project_service.services]
}

resource "google_project_iam_member" "runtime_firestore" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.runtime.email}"

  condition {
    title      = "mission-control-db-only"
    expression = "resource.name.startsWith(\"projects/${var.project_id}/databases/${google_firestore_database.mission_control.name}\")"
  }
}
