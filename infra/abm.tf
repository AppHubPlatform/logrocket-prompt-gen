# Storage for published ABM landing pages.
#
# Publishing renders the finished page to this bucket rather than letting the public
# service read the database. firestore.tf draws that line deliberately: only the
# IAP-gated app's runtime SA reaches Firestore, and the explore service must not. So the
# IAP app owns every draft, and the only thing crossing into public territory is a
# rendered page and the two images the rep uploaded.
#
# That split also gives the kill switch its teeth. Unpublishing deletes the object, and
# explore reads per request, so the page stops resolving immediately with no deploy and
# no cache to wait out.

resource "google_storage_bucket" "abm_pages" {
  project  = var.project_id
  name     = var.abm_bucket_name
  location = var.region

  # Objects are reached only through the explore service, which is the thing that
  # enforces whether a page is still published. A public bucket would hand out a second
  # URL for the same content that unpublishing could not reach.
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  # A published page is customer-facing, so an accidental delete or a bad overwrite is
  # worth being able to undo for a week.
  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      days_since_noncurrent_time = 7
    }
    action {
      type = "Delete"
    }
  }

  depends_on = [google_project_service.services]
}

# The IAP-gated app writes pages and deletes them when they are unpublished.
resource "google_storage_bucket_iam_member" "abm_pages_app_write" {
  bucket = google_storage_bucket.abm_pages.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.runtime.email}"
}

# The public service only ever reads. It cannot publish, cannot unpublish, and still has
# no route to Firestore or to the Anthropic and Rog secrets.
resource "google_storage_bucket_iam_member" "abm_pages_explore_read" {
  bucket = google_storage_bucket.abm_pages.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.explore_runtime.email}"
}
