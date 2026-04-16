# SEOmation Frontend — Pre-Release Fix List

Comprehensive list of issues found across two audit rounds: code quality + user-facing usability. Organized by priority. Each fix should be testable independently.

---

## P0 — CRITICAL (Users will hit these during any demo)

### 1. Content generation has no progress feedback (30-60 second wait)
**File:** `src/pages/BlogWriter/BlogWriterPage.tsx`
**Problem:** User clicks "Send Prompt", button says "Generating..." with a spinner, then nothing for 30-60 seconds. No indication of what's happening, which step is running, or whether it stalled.
**What user sees:** A disabled button with a spinner. That's it.
**Fix:** Add a status text state that updates through the generation flow:
- "Researching your topic..." (when API call starts)
- "Writing your draft..." (after a few seconds via timeout)
- "Almost done..." (after ~20 seconds)
Display this text below the send button or in the chat area. Even fake staged messages are better than silence during a 60-second wait.

### 2. Session expired — silent redirect to login, no explanation
**File:** `src/contexts/AuthContext.tsx` (lines 92-94), `src/pages/Auth/LoginPage.tsx`
**Problem:** When the refresh token fails, `clearSession()` is called silently. User is redirected to login with zero explanation of why they were logged out.
**Fix:**
- In AuthContext: `sessionStorage.setItem('session_expired', '1')` before `clearSession()`
- In LoginPage: read and clear this flag on mount, show `"Your session expired. Please log in again."` using the existing `auth-form__error` class

### 3. Dashboard error state is a dead end
**File:** `src/pages/Dashboard/DashboardPage.tsx` (lines 243-251)
**Problem:** Shows "We hit a snag" + error text. No button, no link, no way to recover without manually refreshing the browser.
**Fix:** Add a "Try again" button below the error message.

### 4. No error boundary — component crash = white screen
**File:** `src/App.tsx`
**Problem:** If any page component throws during render, the entire app crashes with a blank white screen. No fallback, no recovery.
**Fix:** Create an `ErrorBoundary` component (React class component with `componentDidCatch`). Wrap the routes in App.tsx. Show a friendly "Something went wrong" page with a "Go to Dashboard" button.

### 5. Schedule empty state says nothing useful
**File:** `src/pages/Schedule/SchedulePage.tsx` (lines 75-79)
**Problem:** Shows `"No jobs yet."` — doesn't explain what jobs are or how to create one.
**Fix:** Replace with: `"No scheduled or published posts yet. Use the Blog Writer to create and schedule content."` with a button linking to `/writer`.

### 6. Publish/schedule success messages are vague
**Files:** `BlogWriterPage.tsx` (lines 423, 464), `ContentEditorPage.tsx` (lines 465, 505)
**Problem:** After publishing: `"Publish job created."` After scheduling: `"Schedule created."` Doesn't say which platform, when it's scheduled, or where to check status.
**Fix:** Include platform name + time + pointer to schedule page:
- Publish: `"Published to ${platform}. View progress in the Publishing Schedule."`
- Schedule: `"Scheduled for ${formattedTime}. View in the Publishing Schedule."`

---

## P1 — HIGH (Error handling gaps — users will be confused)

### 7. SchedulePage cancelJob silently fails + fake status update
**File:** `src/pages/Schedule/SchedulePage.tsx` (lines 38-45)
**Problem:** Catch block is `/* ignore */`. If cancellation API fails, the UI still shows "CANCELLED" even though the server didn't process it.
**Fix:** In the catch, call `setError(extractErrorMessage(err, 'Unable to cancel this job.'))`. Both `setError` and `extractErrorMessage` already exist on this page.

### 8. ContentEditorPage — 3 silent catches hide critical failures
**File:** `src/pages/Content/ContentEditorPage.tsx` (lines 262, 275, 284)
**Problem:** `loadImages`, `loadIntegrations`, `loadJobs` all have `catch { /* ignore */ }`. If integrations fail to load, the publish dropdown is empty with no explanation. User thinks there's a bug.
**Fix:**
- `loadImages` catch: `console.warn('Failed to load images:', err);`
- `loadIntegrations` catch: `console.warn(...)` + `setErrorMessage('Could not load publishing integrations.')`
- `loadJobs` catch: `console.warn('Failed to load schedule jobs:', err);`

### 9. BlogWriterPage — silent catches (integrations + clipboard)
**File:** `src/pages/BlogWriter/BlogWriterPage.tsx` (lines 229, ~370, ~699, ~756)
**Problem:**
- `loadIntegrations` catch is `/* ignore list failures for now */` — if this fails, publish modal shows no platforms
- Clipboard copy catches are `/* ignore */` — if clipboard write fails (HTTP, browser permissions), user thinks it worked
**Fix:**
- loadIntegrations: `console.warn('Failed to load integrations:', err);`
- Clipboard (all 3 locations): Add a `clipboardFail` boolean state, set it to true in catch, auto-dismiss after 2s. Show `"Copy failed — try selecting the text manually."` using existing `blog-writer-alert` CSS class.

### 10. ContentEditorPage "Publish now" has no double-click protection
**File:** `src/pages/Content/ContentEditorPage.tsx` (line 927)
**Problem:** BlogWriter's publish button has `isLoading={publishing} disabled={...}`. ContentEditor's doesn't:
```tsx
<Button variant="secondary" onClick={handlePublishNow}>Publish now</Button>
```
User can double-click and trigger two publish API calls.
**Fix:** Add `disabled={saving}` — `saving` state already exists at line 109.

### 11. BlogWriter disabled publish/schedule buttons don't explain WHY
**File:** `src/pages/BlogWriter/BlogWriterPage.tsx` (lines 1013-1023)
**Problem:** "Schedule" button is disabled when no time is picked. "Publish now" is disabled when no integrations. Buttons are grayed out with zero explanation.
**Fix:** The empty-integrations case already has a message (line 1027-1030). Add a hint for the scheduling case:
```tsx
{integrations.length > 0 && !scheduledTime && (
  <p className="muted">Pick a date and time above to enable scheduling.</p>
)}
```

### 12. Image generation has no progress indicator
**Files:** `BlogWriterPage.tsx` (lines 200-218, 810-843), `ContentEditorPage.tsx` (lines 380-406)
**Problem:** Image generation can take 10-30 seconds. User sees "Loading images..." with no detail — not how many are being generated, not which provider, not progress per image.
**Fix:** Show `"Generating ${count} image(s)..."` instead of "Loading images...". The `imageCount` or image request count is available in scope.

---

## P2 — MEDIUM (UX polish, accessibility, maintainability)

### 13. Modal missing Escape key + backdrop click to close
**File:** `src/components/ui/Modal.tsx`
**Problem:** Modal has `role="dialog" aria-modal="true"` but can only be closed via the tiny x button. No Escape key handler, no click-outside-to-close. This is a standard UX expectation.
**Fix:**
- Add `useEffect` that listens for Escape key when `open` is true (with cleanup)
- Add `onClick` on backdrop: `(e) => { if (e.target === e.currentTarget) onClose(); }`

### 14. Onboarding has no progress indicator
**File:** `src/pages/Onboarding/OnboardingPage.tsx`
**Problem:** Onboarding is a single long form with two sections ("Business foundations" + "Content preferences"). No step counter, no progress bar. User can't see how much is left.
**Fix:** Add section numbers: "Step 1 of 2 — Business foundations", "Step 2 of 2 — Content preferences". A simple progress bar at the top showing 50%/100% would also work.

### 15. Onboarding has no auto-save — tab close loses everything
**File:** `src/pages/Onboarding/OnboardingPage.tsx`, `src/contexts/OnboardingContext.tsx`
**Problem:** If user closes the tab mid-onboarding, all answers are lost. `saveProgress()` exists in the context but is only called on final submit, not during form filling.
**Fix:** Auto-save form values to `sessionStorage` on change (debounced). On mount, restore from sessionStorage if available. Clear on successful submit.

### 16. Dashboard metrics show "0" for new users with no explanation
**File:** `src/pages/Dashboard/DashboardPage.tsx` (lines 273-292)
**Problem:** New user sees "Words Generated: 0", "Content Created: 0". Analytics chart shows 6 months of zeros. No message explaining this is because they haven't created anything yet.
**Fix:** When `content.length === 0`, show a welcome card instead of (or above) the zero metrics: `"Start generating content to see your analytics here."`

### 17. Integration connect doesn't warn about redirect
**File:** `src/pages/Settings/IntegrationsPage.tsx` (lines 256-262)
**Problem:** Clicking "Connect" immediately redirects to an OAuth provider. User isn't warned they'll leave the page.
**Fix:** Add helper text below the connect button or in a tooltip: `"You'll be redirected to authenticate."` Or show a brief confirmation before redirecting.

### 18. ContentListPage card keyboard handling incomplete
**File:** `src/pages/Content/ContentListPage.tsx` (lines 78-80)
**Problem:** Cards have `role="button"` but only handle Enter key. Per WCAG, Space must also activate elements with `role="button"`.
**Fix:**
```tsx
onKeyDown={(event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    navigate(`/content/${item.id}`);
  }
}}
```

### 19. CalendarWidget has duplicate React keys
**File:** `src/components/dashboard/CalendarWidget.tsx` (line 61)
**Problem:** `['S','M','T','W','T','F','S'].map((day) => <span key={day}>` — "S" and "T" appear twice. React will warn and may incorrectly reconcile.
**Fix:** Use `key={`day-${idx}`}` instead.

### 20. Save confirmation may not be visible (scroll position)
**File:** `src/pages/Content/ContentEditorPage.tsx` (line 611)
**Problem:** After saving a draft, success message appears at the top of the page. If user is editing content near the bottom, they won't see it without scrolling up.
**Fix (low effort):** Scroll to top on save: `window.scrollTo({ top: 0, behavior: 'smooth' })` after setting status message. Or use a fixed-position toast instead.

### 21. Logout button has no loading state
**File:** `src/components/layout/Sidebar.tsx` (line 100), `src/contexts/AuthContext.tsx`
**Problem:** Clicking logout calls an async function but the button shows no spinner. User might click multiple times.
**Fix:** Pass `authLoading` to the sidebar logout button's `isLoading` prop. Or set a local loading state in the sidebar.

---

## P3 — LOW (Code hygiene, won't affect demo)

### 22. `@keyframes spin` defined 5 times
**Files:** `button.css`, `fullScreenLoader.css`, `contentEditor.css`, `contentList.css`, `schedule.css`
**Fix:** Define once in `index.css`, remove from all 5 files.

### 23. Hardcoded colors where CSS variables exist
- `fullScreenLoader.css:9` — `color: #1f1f25` → `color: inherit`
- `sidebar.css:44` — `color: #2f54eb` → `color: var(--color-primary)`

### 24. `as any` type assertions missing explanation
- `api/client.ts:83` — `config.headers as any` — add eslint-disable comment explaining Axios v1 type ambiguity
- `pages/Onboarding/OnboardingPage.tsx:68` — `zodResolver(...) as any` — add comment explaining zod/react-hook-form type mismatch

### 25. No timeout handling for long API calls
**All pages with generation calls**
**Problem:** If content/image generation hangs for 2+ minutes, user has no feedback that something went wrong. The axios client has a 360s timeout (`VITE_API_TIMEOUT_MS`), but no UI handles the timeout error distinctly from other errors.
**Fix (future):** Add a "This is taking longer than expected..." message after 45 seconds, with a cancel button.

---

## Summary

| Priority | Count | Theme |
|----------|-------|-------|
| P0 Critical | 6 | Dead ends, no feedback, white screens |
| P1 High | 6 | Silent errors, double-clicks, missing hints |
| P2 Medium | 9 | Accessibility, onboarding, polish |
| P3 Low | 4 | CSS hygiene, types, future improvements |
| **Total** | **25** | |
