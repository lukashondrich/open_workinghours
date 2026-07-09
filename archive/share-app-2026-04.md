# Share App Feature — Planning Doc

> **✅ Shipped.** Share button + `/download` page shipped 2026-05 (`e3caac9`). The "When Store Links Are Available" step was completed at the iOS App Store launch (2026-07-08): official badges activated with the live App Store link. Durable knowledge (badge compliance, canonical link, page purpose) now lives in `website/README.md` → "Store Badges". Archived for history.

**Date:** 2026-04-30 (updated 2026-05-13)
**Branch:** `worktree-share-app-impl`

---

## Goal

Wire up the existing "Share App" / "App teilen" button on the Reports screen to open the native share sheet with a pre-written message + link to a new `/download` page on the website. The `/download` page detects the visitor's platform and shows the appropriate store badge.

---

## What Gets Shared

The native share sheet opens with a **text message + URL**. The user can edit the message and choose the channel (WhatsApp, SMS, email, etc.) before sending.

### Share Message (matter-of-fact, mentions healthcare, no rhetorical questions)

**English:**
> Open Working Hours is an app for healthcare workers to track working hours transparently and anonymously. The more people participate, the more meaningful the collective data. https://openworkinghours.org/download

**German:**
> Open Working Hours ist eine App für Beschäftigte im Gesundheitswesen, um Arbeitszeiten transparent und anonym zu erfassen. Je mehr mitmachen, desto aussagekräftiger die kollektiven Daten. https://openworkinghours.org/download

### Privacy principles
- Same message for every user — no referral codes, no identifiers
- No tracking of whether the share sheet was used or dismissed
- No contact list access
- Message is neutral — doesn't reveal the sharer's work situation

---

## Mobile App Changes

### 1. Add `Share` import to ReportsScreen

Add `Share` to the existing `react-native` import block in `ReportsScreen.tsx`.

### 2. Add `onPress` handler to share button

```tsx
<TouchableOpacity
  style={styles.shareButton}
  accessibilityRole="button"
  accessibilityLabel={t('reports.collective.share')}
  testID="share-button"
  onPress={handleShareApp}
>
```

The handler:

```tsx
const handleShareApp = async () => {
  const url = 'https://openworkinghours.org/download';
  const message = t('reports.collective.shareMessage');

  try {
    await Share.share(
      Platform.select({
        ios: { message, url },
        android: { message: `${message}\n${url}` },
      })!,
      { subject: 'Open Working Hours' },
    );
  } catch (_) {
    // Silently ignore — don't track or report
  }
};
```

Note: iOS `Share.share()` accepts `{ message, url }` separately. Android ignores the `url` field, so it must be appended to the message string.

### 3. Add translation keys

**en.ts** — `reports.collective.shareMessage`:
```
Open Working Hours is an app for healthcare workers to track working hours transparently and anonymously. The more people participate, the more meaningful the collective data.
```

**de.ts** — `reports.collective.shareMessage`:
```
Open Working Hours ist eine App für Beschäftigte im Gesundheitswesen, um Arbeitszeiten transparent und anonym zu erfassen. Je mehr mitmachen, desto aussagekräftiger die kollektiven Daten.
```

### Files changed (mobile)
| File | Change |
|------|--------|
| `mobile-app/src/modules/reports/screens/ReportsScreen.tsx` | Add `Share` import, add `handleShareApp`, wire `onPress` |
| `mobile-app/src/lib/i18n/translations/en.ts` | Add `shareMessage` key |
| `mobile-app/src/lib/i18n/translations/de.ts` | Add `shareMessage` key |

---

## Website: `/download` Page

A simple, clean page matching the existing site design. Two versions: EN (`/download`) and DE (`/de/download`).

### Content structure

1. **Headline + one-liner** — what the app is
2. **Store badges** — official Apple/Google badge artwork (see Badge Compliance below), both "Coming soon" with no link until store URLs are live
3. **Three bullet points** — what the app does (automatic tracking, privacy, collective insights)
4. **Link back** — "Learn more" → homepage

### Open Graph Meta Tags

The download page URL will be shared via messaging apps (WhatsApp, iMessage, SMS, Slack, etc.) that fetch OG metadata to render link previews. Both EN and DE pages must include:

```html
<meta property="og:title" content="Open Working Hours — Download" />
<meta property="og:description" content="Track working hours transparently and anonymously. For healthcare workers." />
<meta property="og:type" content="website" />
<meta property="og:url" content="https://openworkinghours.org/download" />
<meta property="og:image" content="https://openworkinghours.org/og-download.png" />
<meta property="og:locale" content="en_US" />  <!-- or de_DE for German page -->
```

**OG image:** Create a simple 1200×630 image (app name + tagline + app icon on teal/white background). Place at `website/public/og-download.png`.

The German page uses the same image but sets `og:locale` to `de_DE` and translates the `og:description`.

### Badge Compliance

Use **official badge artwork** from Apple and Google, not custom-styled badges:
- **Apple:** Official "Download on the App Store" SVG/PNG from Apple's marketing resources. Must follow Apple's [App Store Marketing Guidelines](https://developer.apple.com/app-store/marketing/guidelines/) — minimum clear space, no color modifications.
- **Google:** Official "Get it on Google Play" SVG/PNG from Google's [brand guidelines](https://play.google.com/intl/en_us/badges/). Must use the official badge, not a custom recreation.

Both badges displayed at equal size, both with reduced opacity and "Coming soon" text below. No `href` until store links are live.

### Platform detection (client-side JS)

On page load, detect the visitor's platform via `navigator.userAgent`:
- **iOS** → visually highlight the App Store badge, dim the other
- **Android** → highlight the Play Store badge
- **Desktop/other** → show both equally

This is purely cosmetic (CSS class toggle) — both badges are always visible and clickable.

### Deployment timing

The `/download` page and share button ship now. The page works as a landing page immediately — it explains the app and shows "Coming soon" badges for both stores.

When the apps are published on the stores (~2 weeks):
- Add real App Store / Play Store URLs to the badges
- Remove "Coming soon" text, restore full opacity
- No structural changes needed

### Page design

Follows existing site patterns:
- Layout: `Layout.astro` (EN) / `LayoutDE.astro` (DE)
- Container: `max-w-5xl mx-auto px-4 sm:px-6`
- Section spacing: `py-12 sm:py-16`
- Store badges: official artwork (see Badge Compliance above)
- Colors: teal-600 accent, stone-600 body text

### Files created (website)
| File | Description |
|------|-------------|
| `website/src/pages/download.astro` | EN download page (with OG tags) |
| `website/src/pages/de/download.astro` | DE download page (with OG tags) |
| `website/public/og-download.png` | OG image for link previews (1200×630) |

### Navigation

No nav bar changes needed — this page is primarily a landing page for shared links, not a primary navigation destination.

---

## Future: When Store Links Are Available

When the app is published on the stores, update two files:
- `website/src/pages/download.astro` — add real App Store / Play Store URLs, remove "Coming soon" text, restore full badge opacity
- `website/src/pages/de/download.astro` — same

---

## What This Does NOT Include

- No referral codes or tracking
- No analytics on share events
- No changes to navigation or other screens
- No contact list access
- No push notification prompts to share
