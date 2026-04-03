# Rajashree Fashion — GCP Hosting & Migration Guide

This document outlines the complete, end-to-end step-by-step process used to migrate the Next.js Admin Dashboard from Vercel to Google Cloud Platform (GCP).

## Architecture Definitions
*   **Google Cloud Run:** A fully managed compute platform that automatically scales your containerized Next.js application. It spins up instances when traffic spikes and scales to zero when idle, saving costs.
*   **Artifact Registry:** GCP's private Docker image repository where Cloud Build pushes your compiled Next.js standalone images.
*   **Cloud Build:** The CI/CD service that listens to GitHub pushes, securely retrieves secrets, builds your Dockerfile, and deploys it to Cloud Run.
*   **Secret Manager:** A highly secure vault for storing API keys (like Supabase and Resend).
*   **Global External Application Load Balancer:** The entry point for global internet traffic. It provides your static IP address and routes traffic to Cloud Run.
*   **Cloud CDN:** A globally distributed edge network that caches your static assets closer to your users for blazing-fast load times.
*   **Cloud Armor (WAF):** A Web Application Firewall that protects against DDoS attacks, SQL injection, and cross-site scripting (XSS).
*   **Serverless NEG (Network Endpoint Group):** The bridge layer that allows the Global Load Balancer to route traffic into the serverless Cloud Run environment.

---

## Step 1: Application Containerization

To run on GCP, the Next.js application was converted from a Vercel deployment to a standalone Docker container.

1.  **Standlone Mode:** Updated `next.config.ts` to include `output: 'standalone'`. This drastically reduces the Docker image size by only bundling files absolutely necessary for production.
2.  **Dockerfile Creation:** Created a multi-stage `Dockerfile`.
    *   *Stage 1:* Installs production dependencies.
    *   *Stage 2:* Builds the Next.js application. Crucially, we pass `NEXT_PUBLIC_` variables via `--build-arg` so they compile into the client JavaScript bundle. We also pass dummy values for backend secrets to prevent Next.js static evaluation from crashing.
    *   *Stage 3:* Creates a minimal Alpine Linux runner image, copying only the `.next/standalone` output, and exposes port `8080`.
3.  **Dockerignore:** Added `.dockerignore` to prevent uploading `node_modules/`, keeping the build context fast.

## Step 2: Secret Manager Setup

To avoid hardcoding sensitive keys in GitHub, secrets were migrated to GCP Secret Manager.

1.  Created secrets matching the `.env.example` exactly (e.g., `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
2.  Granted the Cloud Build service accounts the `roles/secretmanager.secretAccessor` role.

## Step 3: CI/CD Pipeline (Cloud Build)

We authored `cloudbuild.yaml` to handle automated deployments matching our Git branching strategy (`dev`, `sit`, `production`).

1.  **Secret Retrieval:** `cloudbuild.yaml` uses `availableSecrets` to securely pull keys from Secret Manager.
2.  **Bash Evaluation:** We wrapped the `docker build` command inside an `entrypoint: bash` script. This ensures that Cloud Build securely substitutes the `$$SECRET_NAME` variables into the Docker `--build-arg` inputs.
3.  **Docker Push:** The image is pushed to the target Artifact Registry repository (e.g., `dashboard` in `asia-south1`).
4.  **Cloud Run Deploy:** Executes `gcloud run deploy`, pulling the new image, setting `SUPABASE_SERVICE_ROLE_KEY` as a runtime environment variable, and exposing the service.

## Step 4: Infrastructure Provisioning

Once the Cloud Run service (`dashboard-production`) was live natively on GCP, we wrapped it in enterprise networking:

1.  **Serverless NEG:** Created `dashboard-serverless-neg` pointing to the Cloud Run service.
2.  **Backend Target:** Created `dashboard-backend-service` and attached the NEG. Enabled **Cloud CDN** on this backend.
3.  **URL Map:** Created `dashboard-url-map` to direct all root traffic to the backend.
4.  **SSL Configuration:** Requested a Google-Managed SSL Certificate (`dashboard-managed-cert`) for the domain `rajashreefashion.in`.
5.  **HTTPS Proxy & Forwarding Rule:** Bound the SSL cert and URL map to a Target HTTPS proxy, and opened a global forwarding rule on port `443` holding the static public IP.

## Step 5: Web Application Firewall (Cloud Armor)

To secure the internal dashboard against automated attacks:

1.  Created a security policy `dashboard-armor-policy`.
2.  Added a rule integrating OWASP Top 10 preconfigured expressions (`sqli-v33-stable` and `xss-v33-stable`).
3.  Attached the policy directly to the `dashboard-backend-service`, ensuring traffic is scrubbed before it ever touches Cloud Run.

## Step 6: Final DNS Cutover

The final static IP address provided by the Forwarding Rule (`35.244.241.15`) was configured in GoDaddy as an `A` record for the root domain (`@`). Once DNS propagates, Google provisions the SSL certificate, and traffic securely reaches the Cloud Run dashboard.
