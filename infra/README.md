# Deployment infrastructure

Two **Cloud Run** services in project `logrocket-enablement` (region
`us-east1`), both behind Cloudflare (DNS-only) with Google-managed TLS and
deployed via **GitHub Actions + Workload Identity Federation**:

| Service                | Domain                    | Access                          |
| ---------------------- | ------------------------- | ------------------------------- |
| `logrocket-prompt-gen` | `prompts.logrocket.com`   | IAP, `@logrocket.com` only      |
| `logrocket-explore`    | `explore.logrocket.com`   | Public, unauthenticated         |

## Architecture

```
@logrocket.com user
   -> Cloudflare (DNS-only / grey cloud)  prompts.logrocket.com
   -> Cloud Run domain mapping (Google-managed TLS)
   -> IAP (domain:logrocket.com only)
   -> logrocket-prompt-gen (express: serves dist/ + /api/anthropic + /api/rog)
   -> Secret Manager (anthropic-api-key, rog-token) + upstream APIs

anyone on the internet
   -> Cloudflare (DNS-only / grey cloud)  explore.logrocket.com
   -> Cloud Run domain mapping (Google-managed TLS)
   -> logrocket-explore (express: static files only, no secrets)
```

The internal app runs as a single container ([../Dockerfile](../Dockerfile)): an
Express server ([../server.js](../server.js)) serves the built Vite SPA and the
two API proxy routes so the API keys stay server-side.

### Why the public site is a separate service

IAP on Cloud Run is scoped to the **whole service** — there is no per-path or
per-hostname gating — so external content cannot be a path on
`logrocket-prompt-gen`. It also must not reuse that container image:
[../api/anthropic.js](../api/anthropic.js) and [../api/rog.js](../api/rog.js)
are unauthenticated passthroughs that attach server-side API keys, and they are
safe only because IAP fronts them. Serving that image publicly would hand
anyone on the internet a free Anthropic and Rog proxy.

`logrocket-explore` therefore has its own minimal image
([../Dockerfile.explore](../Dockerfile.explore) +
[../explore/server.js](../explore/server.js), static files only) and its own
runtime service account (`explore-run`) that is deliberately granted **no**
access to the Secret Manager secrets. Adding a backend route there later is
fine; granting it secret access needs a deliberate decision.

See [../explore/README.md](../explore/README.md) for how to add a page.

## Prerequisites

- `terraform` >= 1.13 (`mise use -g terraform@1.15.7`).
- `gcloud` authenticated as a principal that can administer `logrocket-enablement`:

  ```bash
  gcloud auth login                      # for gcloud commands
  gcloud auth application-default login  # for the terraform provider (ADC)
  ```

  Both expire independently, so it's normal for one to work while the other
  doesn't.

## State

State lives in GCS, configured in [versions.tf](versions.tf):

```hcl
backend "gcs" {
  bucket = "logrocket-enablement-tfstate"
  prefix = "logrocket-prompt-gen"
}
```

- **Locking is automatic.** The GCS backend takes a lock object for the
  duration of a write, so concurrent applies are safe.
- **Versioning is the recovery path.** The bucket has object versioning on, so
  if an interrupted apply ever writes a corrupt state you can restore the
  previous generation rather than rebuilding state by hand:

  ```bash
  gcloud storage ls -a gs://logrocket-enablement-tfstate/logrocket-prompt-gen/
  gcloud storage cp gs://logrocket-enablement-tfstate/logrocket-prompt-gen/default.tfstate#<GENERATION> \
    gs://logrocket-enablement-tfstate/logrocket-prompt-gen/default.tfstate
  ```

- Backend blocks can't reference variables, so the bucket name is a literal
  rather than derived from `var.project_id`.
- The bucket is **deliberately not managed by Terraform**: the bucket holding
  the state can't be managed by the state it holds. It was created once with
  the settings below, and `storage.googleapis.com` likewise has to be enabled
  out-of-band, since the backend must work before Terraform can enable
  anything.

  ```bash
  gcloud storage buckets create gs://logrocket-enablement-tfstate \
    --project=logrocket-enablement \
    --location=us-east1 \
    --uniform-bucket-level-access \
    --public-access-prevention
  gcloud storage buckets update gs://logrocket-enablement-tfstate --versioning
  ```

  The bucket also has a lifecycle rule deleting noncurrent versions once they
  are both older than 90 days and superseded by 10 newer ones. Every write
  also leaves an archived `.tflock` object behind, so without this the bucket
  accumulates them indefinitely. The two conditions are ANDed, so the 10 most
  recent generations are always retained no matter how old they are.

Note that no secret *values* are in state: [secrets.tf](secrets.tf) creates
only the secret containers, and versions are added out-of-band with
`gcloud secrets versions add`.

### Working on this from another machine

There is no state handoff. Authenticate as above, then:

```bash
cd infra
terraform init
terraform plan   # should report no changes
```

If the principal isn't a project owner, it also needs
`roles/storage.objectAdmin` on the state bucket — object **admin**, not
viewer, because Terraform has to create and delete lock objects:

```bash
gcloud storage buckets add-iam-policy-binding gs://logrocket-enablement-tfstate \
  --member="user:someone@logrocket.com" --role="roles/storage.objectAdmin"
```

`.terraform.lock.hcl` is committed, pinning the `hashicorp/google` provider so
every machine resolves the same version. It records hashes for `darwin_arm64`
and `linux_amd64`; if you add another platform, run
`terraform providers lock -platform=<platform>` and commit the result.
Upgrading the provider is then a deliberate `terraform init -upgrade`.

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
`artifact_registry_repo`, `domain_mapping_dns_records`, and
`explore_domain_mapping_dns_records`.

On a brand-new project the state bucket won't exist yet, so create it first
(see [State](#state) above) or comment out the `backend` block for the initial
apply and migrate afterwards with `terraform init -migrate-state`.

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

This step applies only to `logrocket-prompt-gen`. `logrocket-explore` is public
by design (`iap_enabled = false` plus an `allUsers` `roles/run.invoker`
binding) and needs no OAuth or IAP configuration.

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
   `domain_mapping_dns_records` and `explore_domain_mapping_dns_records`
   outputs as **DNS-only (grey cloud, not proxied)**. For a subdomain this is
   a `CNAME` -> `ghs.googlehosted.com`:

   | Type    | Name      | Content                | Proxy    |
   | ------- | --------- | ---------------------- | -------- |
   | `CNAME` | `prompts` | `ghs.googlehosted.com` | DNS only |
   | `CNAME` | `explore` | `ghs.googlehosted.com` | DNS only |

Google then issues the managed TLS cert automatically (can take ~15-60 min).

DNS-only is required: Cloud Run domain mappings cannot provision a managed cert
through a Cloudflare-proxied (orange cloud) record. The tradeoff is that
`explore.logrocket.com` gets no Cloudflare CDN or WAF despite being public. If
that becomes a problem, the fix is the load balancer fallback in the notes
below, which is a DNS cutover (CNAME -> A record at the LB IP), not a toggle.

### 6. Set GitHub repository variables

In `AppHubPlatform/logrocket-prompt-gen` -> Settings -> Secrets and variables ->
Actions -> **Variables**, add (all non-secret; WIF means no JSON keys):

| Variable                   | Value                                       |
| -------------------------- | ------------------------------------------- |
| `GCP_PROJECT_ID`           | the project ID                              |
| `GCP_REGION`               | `us-east1`                                  |
| `GCP_SERVICE_NAME`         | `logrocket-prompt-gen`                      |
| `GCP_EXPLORE_SERVICE_NAME` | `logrocket-explore`                         |
| `GCP_AR_REPO`              | `app`                                       |
| `GCP_WIF_PROVIDER`         | `workload_identity_provider` output         |
| `GCP_DEPLOY_SA`            | `deploy_service_account_email` output       |

## Deploys

Both workflows are **manual** (`workflow_dispatch`): Actions tab -> "Run
workflow", or `gh workflow run <file>`. Each authenticates via WIF, builds the
container, pushes it to Artifact Registry, and deploys a new Cloud Run
revision. Terraform ignores image drift (`lifecycle.ignore_changes`), so CI and
Terraform don't fight over the image.

| Workflow                                                                       | Service                |
| ------------------------------------------------------------------------------ | ---------------------- |
| [../.github/workflows/deploy.yml](../.github/workflows/deploy.yml)               | `logrocket-prompt-gen` |
| [../.github/workflows/deploy-explore.yml](../.github/workflows/deploy-explore.yml) | `logrocket-explore`    |

Note that `workflow_dispatch` only exposes workflows that exist on the **default
branch**, so a new deploy workflow is not runnable until it merges to `main`.
Bootstrap a new service by building and deploying locally in the meantime:

```bash
docker build --platform linux/amd64 -f Dockerfile.explore \
  -t us-east1-docker.pkg.dev/<PROJECT_ID>/app/logrocket-explore:bootstrap .
docker push us-east1-docker.pkg.dev/<PROJECT_ID>/app/logrocket-explore:bootstrap
gcloud run deploy logrocket-explore \
  --image us-east1-docker.pkg.dev/<PROJECT_ID>/app/logrocket-explore:bootstrap \
  --region us-east1 --project <PROJECT_ID>
```

`--platform linux/amd64` matters on an Apple Silicon machine; Cloud Run will not
run an arm64 image.

## Notes

- Cloud Run services are created with a placeholder image
  (`us-docker.pkg.dev/cloudrun/container/hello`) on first apply; the first
  deploy replaces it with the real build.
- Don't use `/healthz` as a health check path. Google's frontend intercepts it
  before it reaches the container, so it returns a Google 404 and never appears
  in the request logs. `../explore/server.js` uses `/_health` instead.
  `../server.js` still defines `/healthz`, which is unreachable for the same
  reason — harmless, since Cloud Run's default startup probe is a TCP probe on
  the container port, but don't wire monitoring to it.
- If `us-east1` ever can't host a domain mapping, the fallback is a global
  external Application Load Balancer + serverless NEG + Google-managed cert with
  IAP on the backend (more resources); not used here.
- Production env var names are `ANTHROPIC_API_KEY` / `ROG_TOKEN`. Local dev still
  uses the `VITE_`-prefixed names via the Vite dev proxy in `../vite.config.js`.
