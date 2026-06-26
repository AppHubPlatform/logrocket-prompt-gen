# Deployment infrastructure

Deploys the LogRocket Prompt Generator to **Cloud Run** in project
`logrocket-enablement` (region `us-east1`), gated by **IAP** so only
`@logrocket.com` Google accounts can log in, served at
**`prompts.logrocket.com`** behind Cloudflare (DNS-only), with auto-deploy on
push to `main` via **GitHub Actions + Workload Identity Federation**.

## Architecture

```
@logrocket.com user
   -> Cloudflare (DNS-only / grey cloud)  prompts.logrocket.com
   -> Cloud Run domain mapping (Google-managed TLS)
   -> IAP (domain:logrocket.com only)
   -> Cloud Run service (express: serves dist/ + /api/anthropic + /api/rog)
   -> Secret Manager (anthropic-api-key, rog-token) + upstream APIs
```

The app runs as a single container ([../Dockerfile](../Dockerfile)): an Express
server ([../server.js](../server.js)) serves the built Vite SPA and the two API
proxy routes so the API keys stay server-side.

## Prerequisites

- `terraform` >= 1.13 (not installed yet on this machine; `mise use -g terraform@1.15.7`).
- `gcloud` authenticated as a principal that can administer `logrocket-enablement`.
- A remote state backend is **not** configured; add a `backend "gcs"` block in
  `versions.tf` if you want shared/remote state.

## One-time setup

### 1. Confirm the project ID

The display name is `logrocket-enablement`, but the **ID** can differ:

```bash
gcloud projects list --filter="name:logrocket-enablement"
```

If the ID isn't literally `logrocket-enablement`, set it in `terraform.tfvars`
(copy from `terraform.tfvars.example`).

### 2. Apply Terraform

```bash
cd infra
terraform init
terraform apply
```

Note the outputs: `workload_identity_provider`, `deploy_service_account_email`,
`artifact_registry_repo`, and `domain_mapping_dns_records`.

### 3. Configure the OAuth consent screen + IAP brand (manual)

IAP on Cloud Run does not support programmatic OAuth client creation, so do this
once in the console:

1. APIs & Services -> OAuth consent screen -> set **User type = Internal**
   (only selectable because the project is in the logrocket.com Workspace org).
   This alone blocks any non-`logrocket.com` Google account.
2. Security -> Identity-Aware Proxy -> confirm IAP is enabled for the Cloud Run
   service (Terraform sets `iap_enabled = true`; accept the brand prompt if shown).

The `domain:logrocket.com` access binding is already created by Terraform
(`roles/iap.httpsResourceAccessor`).

### 4. Add the secret values (kept out of Terraform state)

```bash
echo -n "sk-ant-..."  | gcloud secrets versions add anthropic-api-key --data-file=- --project=<PROJECT_ID>
echo -n "<rog token>" | gcloud secrets versions add rog-token        --data-file=- --project=<PROJECT_ID>
```

### 5. Verify domain ownership + add DNS in Cloudflare

1. Verify ownership of `logrocket.com` for this project at
   <https://www.google.com/webmasters/verification/> (or Search Console) if not
   already done — required for the Cloud Run domain mapping.
2. In Cloudflare, on the `logrocket.com` zone, add the records from the
   `domain_mapping_dns_records` output as **DNS-only (grey cloud, not proxied)**.
   For a subdomain this is typically a `CNAME` for `prompts` ->
   `ghs.googlehosted.com`.

Google then issues the managed TLS cert automatically (can take ~15-60 min).

### 6. Set GitHub repository variables

In `AppHubPlatform/logrocket-prompt-gen` -> Settings -> Secrets and variables ->
Actions -> **Variables**, add (all non-secret; WIF means no JSON keys):

| Variable           | Value                                                       |
| ------------------ | ----------------------------------------------------------- |
| `GCP_PROJECT_ID`   | the project ID                                              |
| `GCP_REGION`       | `us-east1`                                                  |
| `GCP_SERVICE_NAME` | `logrocket-prompt-gen`                                      |
| `GCP_AR_REPO`      | `app`                                                       |
| `GCP_WIF_PROVIDER` | `workload_identity_provider` output                         |
| `GCP_DEPLOY_SA`    | `deploy_service_account_email` output                       |

## Auto-deploy

After setup, every push to `main` triggers
[../.github/workflows/deploy.yml](../.github/workflows/deploy.yml): it
authenticates via WIF, builds the container, pushes it to Artifact Registry, and
deploys a new Cloud Run revision. Terraform ignores image drift
(`lifecycle.ignore_changes`), so CI and Terraform don't fight over the image.

## Notes

- The Cloud Run service is created with a placeholder image
  (`us-docker.pkg.dev/cloudrun/container/hello`) on first apply; the first CI run
  replaces it with the real build.
- If `us-east1` ever can't host a domain mapping, the fallback is a global
  external Application Load Balancer + serverless NEG + Google-managed cert with
  IAP on the backend (more resources); not used here.
- Production env var names are `ANTHROPIC_API_KEY` / `ROG_TOKEN`. Local dev still
  uses the `VITE_`-prefixed names via the Vite dev proxy in `../vite.config.js`.
