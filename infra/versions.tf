terraform {
  required_version = ">= 1.13"

  # Bucket created out-of-band (see README): the bucket holding the state can't
  # be managed by the state it holds. Backend blocks can't use variables, so
  # these are literals rather than derived from var.project_id.
  backend "gcs" {
    bucket = "logrocket-enablement-tfstate"
    prefix = "logrocket-prompt-gen"
  }

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
