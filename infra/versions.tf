terraform {
  required_version = ">= 1.13"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 6.30, < 8.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region

  # Bill API quota to the target project instead of the ADC quota project.
  billing_project       = var.project_id
  user_project_override = true
}
