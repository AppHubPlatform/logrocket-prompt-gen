output "cloud_run_url" {
  description = "Default run.app URL of the service (also IAP-protected)."
  value       = google_cloud_run_v2_service.app.uri
}

output "artifact_registry_repo" {
  description = "Artifact Registry repo path used for image pushes."
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.app.repository_id}"
}

output "deploy_service_account_email" {
  description = "Service account GitHub Actions impersonates to deploy. Set as GH variable GCP_DEPLOY_SA."
  value       = google_service_account.deploy.email
}

output "workload_identity_provider" {
  description = "Full WIF provider resource name. Set as GH variable GCP_WIF_PROVIDER."
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "domain_mapping_dns_records" {
  description = "DNS records to create in Cloudflare (DNS-only / grey cloud) for the custom domain."
  value       = google_cloud_run_domain_mapping.app.status[0].resource_records
}
