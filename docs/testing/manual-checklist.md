# SEOmation Manual Test Checklist

Pre-production / demo verification. Work through sections A → I in order.
Mark each item ✅ when confirmed, ❌ if a problem is found (note the error below it).

---

## Prerequisites

- Backend running: `cd SEOmation/backend && npm run dev` → port 3000
- AI service running: `cd SEOmation/ai && uvicorn main:app --host 127.0.0.1 --port 8001 --reload`
- PostgreSQL running, production DB migrated: `npx prisma migrate deploy`
- A REST client ready (curl commands below, or Postman)

**Save these variables as you go:**
```
BASE=http://localhost:3000
AI=http://localhost:8001
ACCESS_TOKEN=<filled in Section B>
REFRESH_TOKEN=<filled in Section B>
CONTENT_ID=<filled in Section D>
IMAGE_LINK_ID=<filled in Section E>
```

---

## Section A — Environment & Health

- [ ] AI service health check passes
  ```bash
  curl $AI/health
  # Expected: {"ok":true}
  ```

- [ ] Backend health check passes
  ```bash
  curl $BASE/health
  # Expected: {"ok":true}
  ```

- [ ] No error logs in backend terminal on startup (pino logs only INFO/DEBUG)

- [ ] No error logs in AI service terminal on startup

- [ ] Database connection confirmed (Prisma shows no pending migrations)
  ```bash
  cd SEOmation/backend && npx prisma migrate status
  # Expected: "All migrations have been applied"
  ```

---

## Section B — Auth Flow

- [ ] **Register** a new user
  ```bash
  curl -X POST $BASE/api/auth/register \
    -H "Content-Type: application/json" \
    -d '{"email":"demo@seomation.dev","password":"Demo1234!","name":"Demo User","company":"Acme Corp","niche":"SaaS technology","timezone":"UTC","language":"EN"}'
  # Expected: 201 { user: {...}, accessToken: "...", refreshToken: "..." }
  ```
  - Save `accessToken` → `ACCESS_TOKEN`
  - Save `refreshToken` → `REFRESH_TOKEN`

- [ ] **Login** with same credentials
  ```bash
  curl -X POST $BASE/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"demo@seomation.dev","password":"Demo1234!"}'
  # Expected: 200 { user: {...}, accessToken: "...", refreshToken: "..." }
  ```

- [ ] **Get profile** using access token
  ```bash
  curl $BASE/api/users/me -H "Authorization: Bearer $ACCESS_TOKEN"
  # Expected: 200 { id: "...", email: "demo@seomation.dev", ... }
  ```

- [ ] **Refresh** access token
  ```bash
  curl -X POST $BASE/api/auth/refresh \
    -H "Content-Type: application/json" \
    -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}"
  # Expected: 200 { accessToken: "...", refreshToken: "..." }
  ```
  - Update `ACCESS_TOKEN` and `REFRESH_TOKEN` with the new values

- [ ] **Logout** and confirm old refresh token is revoked
  ```bash
  curl -X POST $BASE/api/auth/logout \
    -H "Content-Type: application/json" \
    -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}"
  # Expected: 200

  # Now try to refresh with the old token — must fail:
  curl -X POST $BASE/api/auth/refresh \
    -H "Content-Type: application/json" \
    -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}"
  # Expected: 401
  ```

- [ ] **Auth guard works**: unauthenticated request returns 401
  ```bash
  curl $BASE/api/content
  # Expected: 401
  ```

> **Re-login** to get a fresh `ACCESS_TOKEN` before continuing.

---

## Section C — Topic Generation

- [ ] **Generate topics** (English, Blog)
  ```bash
  curl -X POST $BASE/api/topics/generate \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"platform":"BLOG","language":"EN"}'
  # Expected: 200 { items: [ { title: "...", platform: "BLOG", language: "EN", ... }, ... ] }
  # Verify: items array is non-empty, each item has a title
  ```

- [ ] **List topics** — same topics appear in list
  ```bash
  curl $BASE/api/topics -H "Authorization: Bearer $ACCESS_TOKEN"
  # Expected: 200 { items: [...] } — same count as generated above
  ```

- [ ] **Generate topics with context** (niche + seed keywords)
  ```bash
  curl -X POST $BASE/api/topics/generate \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"platform":"LINKEDIN","language":"EN","context":{"niche":"fintech","seedKeywords":["payments","banking"],"count":5}}'
  # Expected: 200, items relevant to fintech
  ```

- [ ] **Diagnostics field** present in topic response
  - Check `diagnostics` key exists in the API response JSON

---

## Section D — Content Generation

- [ ] **Generate blog content** from prompt
  ```bash
  curl -X POST $BASE/api/content/generate \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"platform":"BLOG","language":"EN","prompt":"How to build a SaaS product from scratch","focusKeyword":"SaaS product"}'
  # Expected: 201 { item: { id: "...", title: "...", html: "...", ... }, seo: { score: N, hints: [...] } }
  ```
  - Save `item.id` → `CONTENT_ID`
  - Verify: `seo.score` is a number 0-100
  - Verify: `item.html` contains `<h1>` or `<h2>` tags

- [ ] **List content** — newly generated content appears
  ```bash
  curl $BASE/api/content -H "Authorization: Bearer $ACCESS_TOKEN"
  # Expected: 200 { items: [...] } — includes the content just created
  ```

- [ ] **Get content by ID**
  ```bash
  curl $BASE/api/content/$CONTENT_ID -H "Authorization: Bearer $ACCESS_TOKEN"
  # Expected: 200 { id: "...", title: "...", html: "...", platform: "BLOG", ... }
  ```

- [ ] **Update content** title
  ```bash
  curl -X PUT $BASE/api/content/$CONTENT_ID \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"title":"Updated: How to Build a SaaS Product"}'
  # Expected: 200 { title: "Updated: How to Build a SaaS Product", ... }
  ```

- [ ] **Update content status** to READY
  ```bash
  curl -X PUT $BASE/api/content/$CONTENT_ID \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"status":"READY"}'
  # Expected: 200 { status: "READY", ... }
  ```

- [ ] **Get SEO hints** for the content
  ```bash
  curl -X POST $BASE/api/content/$CONTENT_ID/seo-hints \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"focusKeyword":"SaaS product"}'
  # Expected: 200 { score: N, hints: [...], contentId: "...", focusKeyword: "SaaS product" }
  # Verify: hints array has specific improvement suggestions
  ```

- [ ] **Generate with LinkedIn variant**
  ```bash
  curl -X POST $BASE/api/content/generate \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"platform":"BLOG","language":"EN","prompt":"Top 5 productivity tips for remote teams","focusKeyword":"productivity tips","includeLinkedIn":true}'
  # Expected: 201 { item: {...}, variants: { linkedin: { html: "...", text: "..." } }, ... }
  # Verify: variants.linkedin exists and has content
  ```

---

## Section E — Image Generation

- [ ] **Generate images** for content
  ```bash
  curl -X POST $BASE/api/content/$CONTENT_ID/images/generate \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"prompt":"A modern SaaS dashboard with clean UI"}'
  # Expected: 201 { images: [{ url: "...", provider: "...", altText: "..." }] }
  # Verify: images[0].provider shows which API was used (together/kie/huggingface/placeholder)
  ```

- [ ] **List images** for content
  ```bash
  curl $BASE/api/content/$CONTENT_ID/images -H "Authorization: Bearer $ACCESS_TOKEN"
  # Expected: 200 { images: [{ url: "...", linkId: "...", ... }] }
  ```
  - Save `images[0].linkId` → `IMAGE_LINK_ID`

- [ ] **Image served correctly** — open the image URL in a browser
  - Take the `url` from the images response and open it
  - Expected: actual image renders (or base64 data if using placeholder)

- [ ] **Delete image link**
  ```bash
  curl -X DELETE $BASE/api/content/$CONTENT_ID/images/$IMAGE_LINK_ID \
    -H "Authorization: Bearer $ACCESS_TOKEN"
  # Expected: 200

  # Verify it's gone:
  curl $BASE/api/content/$CONTENT_ID/images -H "Authorization: Bearer $ACCESS_TOKEN"
  # Expected: 200 { images: [] }
  ```

---

## Section F — SEO Scoring (Direct Endpoint)

- [ ] **Score arbitrary content** with good properties
  ```bash
  curl -X POST $BASE/api/seo/score \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "title": "How to Build a SaaS Product: A Complete Guide for Founders",
      "metaDescription": "Learn step-by-step how to build a SaaS product that solves real problems and attracts paying customers in 2025.",
      "bodyHtml": "<h1>SaaS Product Guide</h1><h2>Market Research</h2><p>Building a SaaS product starts with understanding your market. A good SaaS product solves a specific pain point.</p><h2>Development</h2><p>Choose the right tech stack for your SaaS product and iterate quickly.</p>",
      "primaryKeyword": "SaaS product",
      "secondaryKeywords": ["software", "startup", "founder"]
    }'
  # Expected: 200 { total: N (>50), components: [...], meta: { wordCount: N, keywordDensity: N } }
  ```

- [ ] **Score content without focus keyword** — gets a lower keyword score
  ```bash
  curl -X POST $BASE/api/seo/score \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"title":"A Title","bodyHtml":"<p>Some content here.</p>","primaryKeyword":""}'
  # Verify: keywords component has low score and message about providing keyword
  ```

- [ ] Verify all 6 components are present: `title`, `meta`, `headings`, `keywords`, `length`, `images`

---

## Section G — Platform Integrations (OAuth — browser required)

- [ ] **List integrations** — empty for new user
  ```bash
  curl $BASE/api/integrations -H "Authorization: Bearer $ACCESS_TOKEN"
  # Expected: 200 { integrations: [] }
  ```

- [ ] **Get WordPress auth URL**
  ```bash
  curl "$BASE/api/integrations/wordpress/auth-url" -H "Authorization: Bearer $ACCESS_TOKEN"
  # Expected: 200 { url: "https://public-api.wordpress.com/oauth2/authorize?..." }
  ```

- [ ] **Complete WordPress OAuth flow**
  - Open the auth URL in a browser
  - Authorize the app on WordPress
  - After redirect, check backend logs for callback processing
  - Expected: `POST /api/integrations/wordpress/callback` logged with success

- [ ] **Verify WordPress integration saved**
  ```bash
  curl $BASE/api/integrations -H "Authorization: Bearer $ACCESS_TOKEN"
  # Expected: { integrations: [{ platform: "WORDPRESS", metadata: { ... } }] }
  ```
  - Save `integrations[0].id` → `INTEGRATION_ID`

- [ ] **Set WordPress site URL** (if using self-hosted WordPress)
  ```bash
  curl -X POST $BASE/api/integrations/wordpress/site \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"siteUrl":"https://yourblog.wordpress.com"}'
  # Expected: 200
  ```

- [ ] **Get LinkedIn auth URL**
  ```bash
  curl "$BASE/api/integrations/linkedin/auth-url" -H "Authorization: Bearer $ACCESS_TOKEN"
  # Expected: 200 { url: "https://www.linkedin.com/oauth/v2/authorization?..." }
  ```

- [ ] **Complete LinkedIn OAuth flow** (same steps as WordPress)

- [ ] **Delete an integration**
  ```bash
  curl -X DELETE $BASE/api/integrations/linkedin -H "Authorization: Bearer $ACCESS_TOKEN"
  # Expected: 200 { message: "..." }

  # Verify removed:
  curl $BASE/api/integrations -H "Authorization: Bearer $ACCESS_TOKEN"
  # LinkedIn should no longer appear
  ```

---

## Section H — Scheduling & Publishing

> Requires: `INTEGRATION_ID` from Section G (WordPress integration)
> Requires: `CONTENT_ID` with status READY from Section D

- [ ] **Schedule content** for future publish
  ```bash
  curl -X POST $BASE/api/schedule/content/$CONTENT_ID/schedule \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"integrationId\":\"$INTEGRATION_ID\",\"platform\":\"WORDPRESS\",\"scheduledTime\":\"2027-06-01T10:00\",\"timezone\":\"UTC\"}"
  # Expected: 201 { job: { id: "...", status: "SCHEDULED", scheduledTime: "..." } }
  ```
  - Save `job.id` → `JOB_ID`

- [ ] **List scheduled jobs** — job appears
  ```bash
  curl $BASE/api/schedule -H "Authorization: Bearer $ACCESS_TOKEN"
  # Expected: 200 { items: [{ id: "...", status: "SCHEDULED", ... }] }
  ```

- [ ] **Get scheduler stats**
  ```bash
  curl $BASE/api/schedule/stats -H "Authorization: Bearer $ACCESS_TOKEN"
  # Expected: 200 { activeJobs: N, ... }
  ```

- [ ] **Cancel scheduled job**
  ```bash
  curl -X POST $BASE/api/schedule/$JOB_ID/cancel -H "Authorization: Bearer $ACCESS_TOKEN"
  # Expected: 200 { job: { status: "CANCELLED", ... } }
  ```

- [ ] **Publish now** (requires live WordPress integration and READY content)
  ```bash
  curl -X POST $BASE/api/schedule/content/$CONTENT_ID/publish-now \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"integrationId\":\"$INTEGRATION_ID\",\"platform\":\"WORDPRESS\"}"
  # Expected: 201 { job: { status: "SCHEDULED" or "COMPLETED", ... } }
  # Check backend logs: should see "Published content to WORDPRESS" or similar
  # Check WordPress admin: new post should appear
  ```

---

## Section I — Error Handling & Edge Cases

- [ ] **Unauthenticated access** returns 401
  ```bash
  curl $BASE/api/content
  curl $BASE/api/topics
  curl $BASE/api/schedule
  # All Expected: 401 { message: "..." }
  ```

- [ ] **Other user's content** returns 404
  - Register a second user
  - Try to GET/PUT the first user's `CONTENT_ID` with the second user's token
  - Expected: 404

- [ ] **Invalid JSON body** returns 400
  ```bash
  curl -X POST $BASE/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{invalid json}'
  # Expected: 400
  ```

- [ ] **Missing required field** returns 400 with clear message
  ```bash
  curl -X POST $BASE/api/auth/register \
    -H "Content-Type: application/json" \
    -d '{"email":"bad@test.com","password":"pass123"}'
  # Expected: 400 { message: "..." mentioning missing fields }
  ```

- [ ] **AI service down** — backend returns graceful error
  - Stop the uvicorn process
  - With `AI_MOCK=false` in .env, attempt content generation
  ```bash
  curl -X POST $BASE/api/content/generate \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"platform":"BLOG","language":"EN","prompt":"Test topic","focusKeyword":"test"}'
  # Expected: 502 or 504 with message — NOT an unhandled 500 crash
  ```
  - Restart uvicorn after verifying

- [ ] **Rate limiting** on auth endpoint
  ```bash
  # Run 101 login attempts in quick succession
  for i in $(seq 1 101); do
    curl -s -o /dev/null -w "%{http_code}\n" -X POST $BASE/api/auth/login \
      -H "Content-Type: application/json" \
      -d '{"email":"x@x.com","password":"wrongpass"}'
  done
  # Expected: first 100 return 401, 101st returns 429
  ```

- [ ] **404 for unknown route**
  ```bash
  curl $BASE/api/does-not-exist
  # Expected: 404 { message: "Route not found" }
  ```

---

## Section J — AI Service Direct Tests (via AI port 8001)

- [ ] **Generate topics** directly on AI service
  ```bash
  curl -X POST $AI/topic/suggest \
    -H "Content-Type: application/json" \
    -d '{
      "userId": "manual-test",
      "language": "en",
      "niche": "SaaS technology",
      "persona": {"role": "content creator", "pains": ["low traffic"]},
      "seedKeywords": ["startup", "software"],
      "count": 3,
      "includeTrends": false
    }'
  # Expected: 200 { clusters: [...], ideas: [...], diagnostics: {...} }
  ```

- [ ] **Generate blog content** directly on AI service
  ```bash
  curl -X POST $AI/content/generate \
    -H "Content-Type: application/json" \
    -d '{
      "userId": "manual-test",
      "platform": "blog",
      "language": "en",
      "topicOrIdea": "How to build a SaaS startup",
      "focusKeyword": "SaaS startup",
      "tone": "friendly",
      "targetLength": 800,
      "includeTrend": false,
      "niche": "SaaS"
    }'
  # Expected: 200 { contentForEditor: { html: "...", plainText: "..." }, metrics: {...}, diagnostics: {...} }
  # Verify: html contains multiple paragraphs and headers
  ```

- [ ] **Generate image** directly on AI service
  ```bash
  curl -X POST $AI/image/generate \
    -H "Content-Type: application/json" \
    -d '{
      "prompt": "A professional tech workspace with monitors and code",
      "platform": "blog",
      "sizes": ["512x512"],
      "count": 1,
      "language": "en"
    }'
  # Expected: 200 { altText: "...", images: [{ url: "...", provider: "...", size: "..." }] }
  # Verify: provider field shows which image API responded
  ```

---

## Sign-off Checklist

| Area | Status | Notes |
|---|---|---|
| Auth (register/login/refresh/logout/JWT guards) | | |
| User profile (get/update) | | |
| Topic generation (multiple platforms/languages) | | |
| Content generation (blog, LinkedIn, Instagram variants) | | |
| SEO scoring (score + hints, individual components) | | |
| Image generation (generate, list, delete) | | |
| Integration OAuth (WordPress and/or LinkedIn) | | |
| Scheduling (schedule, list, cancel, stats) | | |
| Publish-now (end-to-end post creation) | | |
| Error handling (401, 400, 404, 429, 502) | | |
| AI service endpoints (direct health/topics/content/image) | | |

**Tested by:** _______________
**Date:** _______________
**Environment:** local / staging
**Result:** PASS / FAIL
