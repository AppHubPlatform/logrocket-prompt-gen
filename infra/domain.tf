# Maps the custom domain to the Cloud Run service. Google provisions and renews
# the TLS certificate automatically once the DNS records below are in place.
#
# Prerequisite: the logrocket.com domain must be verified for this project in
# Google Search Console / Webmaster Central (see infra/README.md).
resource "google_cloud_run_domain_mapping" "app" {
  project  = var.project_id
  location = var.region
  name     = var.domain

  metadata {
    namespace = var.project_id
  }

  spec {
    route_name = google_cloud_run_v2_service.app.name
  }
}
