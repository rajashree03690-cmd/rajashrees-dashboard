# Storefront Advanced SEO & Implementation Plan
**Domain:** `www.rajashreefashions.com`

Unlike the internal Admin Dashboard, the consumer-facing Storefront requires massive optimization for Search Engine Optimization (SEO), Core Web Vitals, dynamic web indexing, and lightning-fast customer UX. This document outlines the end-to-end plan covering codebase preparations, infrastructure deployments, and advanced SEO strategies.

---

## Phase 1: Next.js Advanced SEO Codebase Preparation

### 1.1 Dynamic Metadata & Temporary Domain Strategy
> [!WARNING]
> **CRITICAL SEO CONTEXT:** `rajashreefashions.com` (with the 's') is a temporary staging domain. The final production domain will be `rajashreefashion.com` (without the 's'). 
> *   **Implementation:** All metadata and absolute URL generators in Next.js will use a central `NEXT_PUBLIC_SITE_URL` env variable.
> *   **Canonical Tags:** We will heavily enforce `<link rel="canonical" href="https://rajashreefashion.com/..." />` on the temporary domain. By pointing the canonical reference to the *final* domain early, Google realizes the temporary domain is just a testing clone, preventing any duplicate-content penalties when you make the final switch.

### 1.2 Programmatic SEO & Structured Data (JSON-LD)
*   **Implementation:** Inject Google-recommended `<script type="application/ld+json">` payloads in pages.
*   **Entities:**
    *   `Product`: SKU, Name, Description, Image, Price Configuration (`Offer`), and Availability (in-stock vs out-of-stock).
    *   `BreadcrumbList`: Enhances search results with precise logical paths.
    *   `Organization`: On the homepage, mapping your massive social presence to the brand entity so Google displays the official knowledge graph. We will hardcode the exact URIs:
        *   `https://www.instagram.com/rajashree_fashion/`
        *   `https://www.youtube.com/@RajashreeFashion`

### 1.3 Optimized Dynamic Sitemaps & Robots.txt
*   **Implementation:** Create `app/sitemap.ts`. It will dynamically query the Supabase `products` and `categories` tables to generate an XML sitemap of every active URL.
*   **Robots.txt:** Allow crawling on all product/category routes, while strictly disallowing `/api/*`, `/cart`, and `/checkout` to preserve crawl budget.

### 1.4 Post-Testing Permanent Redirection (301)
*   **Implementation:** When testing is complete, the Load Balancer (or Next.js middleware) for `rajashreefashions.com` will be updated to return a `301 Moved Permanently` to `rajashreefashion.com`. Google instantly transfers all accumulated PageRank and SEO juice from the testing domain to the final domain seamlessly.

---

## Phase 2: Performance & Core Web Vitals

To rank high on Google, the site must pass Core Web Vitals (LCP, FID, CLS).

### 2.1 Edge Asset Optimization
*   **Next/Image:** Ensure all product images from the Supabase storage buckets run through Next.js Image Optimization to serve WebP/AVIF formats natively.
*   **Preconnecting:** Ensure a `<link rel="preconnect" href="https://[PROJECT].supabase.co" />` exists in the root layout to eliminate latency when fetching initial Supabase product lists.

### 2.2 Next.js ISR (Incremental Static Regeneration)
*   **Implementation:** The storefront will not purely Server-Side Render (SSR) every request. It will use ISR (e.g., `revalidate: 3600`) so category pages load instantly from the Next.js cache.
*   **Invalidation:** A dedicated API route `/api/revalidate` will be triggered securely via Supabase triggers whenever an admin updates a product, instantly purging the cache for that specific URL.

---

## Phase 3: Infrastructure Configuration (GCP)

The Storefront will reside in the exact same GCP project but completely segregated to protect performance.

### 3.1 Custom Cloud Run & Load Balancer
1.  **Service:** `storefront-prod` (separate from `dashboard-prod`).
2.  **Artifact Registry:** Uploaded to a new repository or distinct branch trigger.
3.  **Global Load Balancer:** A new Network Endpoint Group (NEG) routed through `www.rajashreefashions.com`.

### 3.2 Aggressive Cloud CDN Caching
*   **Implementation:** Unlike the Dashboard (which has minimal caching to ensure fresh admin UI), the Storefront's Cloud CDN will be configured to aggressively edge-cache CSS, JS, and product images globally.
*   **Cache Invalidation:** The Load Balancer header settings will strictly abide by Next.js cache-control outputs.

---

## Phase 4: Integration with Web Search Engines

### 4.1 Google Search Console Verification
*   **Implementation:** Finalize domain verification via DNS TXT record in GoDaddy.
*   **Sitemap Submission:** Submit `https://www.rajashreefashions.com/sitemap.xml` directly into the console to establish crawl rhythms.

### 4.2 Real-Time Google Indexing API Integration
*   **Implementation:** Build an integration with the **Google Indexing API**.
*   **How it works:** When a new product is added via the Admin Dashboard, a Supabase Edge Function will securely ping the Google Indexing API with a `URL_UPDATED` notification.
*   **Benefit:** Instead of waiting weeks for Google to organically crawl the site, new products will appear in Google Search Results in as little as 2-24 hours.

### 4.3 Google Merchant Center (Shopping Integration)
*   **Implementation:** Automatically generate a `/api/shopping-feed.xml` route that outputs product data conforming to the Google Merchant Center RSS spec.
*   **Advanced:** Allows Rajashree Fashions products to show up in "Google Shopping" panels and free listings automatically based on raw DB updates.

---

## Pipeline Execution Summary

When ready to execution, we will follow a similar 5-phase structure:
1.  **Codebase preparation:** Implement JSON-LD, Sitemap, and Middleware.
2.  **Containerization:** `Dockerfile` explicitly mapped to the storefront root.
3.  **Deployment CI/CD:** Distinct `cloudbuild-storefront.yaml` pipeline.
4.  **Infrastructure:** Global Load Balancer, specific Cloud Armor rules (DDoS protection tailored for public read-heavy traffic).
5.  **Go-Live & Indexing APIs:** Flip the DNS and actively push URLs to Google.
