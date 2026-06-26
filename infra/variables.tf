variable "project_id" {
  description = "GCP project ID (under the logrocket.com org). Confirm the ID, which may differ from the display name."
  type        = string
  default     = "logrocket-enablement"
}

variable "region" {
  description = "Region for Cloud Run, Artifact Registry, and the domain mapping. Must support Cloud Run domain mappings (us-east1 does, us-east4 does not)."
  type        = string
  default     = "us-east1"
}

variable "service_name" {
  description = "Cloud Run service name."
  type        = string
  default     = "logrocket-prompt-gen"
}

variable "domain" {
  description = "Custom domain the app is served at."
  type        = string
  default     = "prompts.logrocket.com"
}

variable "allowed_domain" {
  description = "Google Workspace domain allowed to log in via IAP."
  type        = string
  default     = "logrocket.com"
}

variable "github_repo" {
  description = "GitHub repository (owner/name) allowed to deploy via Workload Identity Federation."
  type        = string
  default     = "AppHubPlatform/logrocket-prompt-gen"
}

variable "artifact_repo_id" {
  description = "Artifact Registry repository ID for container images."
  type        = string
  default     = "app"
}

variable "image" {
  description = "Container image for the Cloud Run service. Defaults to a placeholder; real images are deployed by CI. Terraform ignores image drift after creation."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}
