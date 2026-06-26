locals {
  iap_service_agent = "serviceAccount:service-${data.google_project.this.number}@gcp-sa-iap.iam.gserviceaccount.com"
}

# IAP intercepts requests and re-invokes the service as its own service agent,
# so that agent needs run.invoker on the service.
resource "google_cloud_run_v2_service_iam_member" "iap_invoker" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.app.name
  role     = "roles/run.invoker"
  member   = local.iap_service_agent
}

# The @logrocket.com-only gate: only members of the Workspace domain may pass IAP.
resource "google_iap_web_cloud_run_service_iam_member" "domain_access" {
  project                = var.project_id
  location               = var.region
  cloud_run_service_name = google_cloud_run_v2_service.app.name
  role                   = "roles/iap.httpsResourceAccessor"
  member                 = "domain:${var.allowed_domain}"
}
