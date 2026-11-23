# SONARIA UI Design System — Approved Search Prototype v1.0
Date: 2026-11-23
Status: **User-approved visual/interaction direction**. Implementation reference, not a claim of production readiness.

## Source of truth
- Interactive standalone demo: `prototypes/score-search-ui-v1.html`.
- This file is an implementation-oriented reference for Claude and future site components.
- Original ChatGPT in-conversation prototype used DIL components; the HTML file is a **faithful independent implementation of the approved appearance and core interactions**, not a byte-identical export.
- Sample work data, PDF counts and personnel counts are illustrative only; not real catalog records. In particular "5+" is a broad demo bucket, **not an authoritative count for orchestral/concerto works**.
- Brand logo in prototype is text-only. Replace with the actual approved logo asset once supplied; do not fabricate the original graphic.

## Design tokens (approved direction)
- Primary navy: `#182B45`; accent gold: `#B79656`; page background: `#FAF9F6`.
- White cards: `#FFFFFF`; muted text: `#667085`; subtle borders: `#E5E0D6`.
- Cards: ~16–17px rounded corners, 1px borders, white on warm off-white background.
- Controls: rounded chips for performer counts; white bordered selects; navy selected chips and primary buttons; gold used sparingly.
- Responsive: mobile-first, generous whitespace, 2-column selects when width allows.
- Typography: accessible system sans for content, elegant serif brand treatment pending actual logo asset.
- Accessibility: visible focus rings, labels, keyboard-operable native controls, state conveyed via aria-pressed/aria-expanded, contrast audit required.

## Search page reference interaction contract
1. Header SONARIA / SONG × ARIA; language switch JA/EN.
2. Search input across Japanese/English titles and composer aliases.
3. Performer chips: All, 1, 2, 3, 4, 5+.
4. Instrumentation select: All, Strings, Piano, Orchestra, Mixed (expand taxonomy later).
5. Musical form select: All, Chamber, Sonata, Concerto, Symphony, Suite (expand taxonomy later).
6. Advanced disclosure: period (All, Baroque, Classical, Romantic).
7. Immediate combined filtering, result count, reset.
8. Sorting by title/composer/PDF count.
9. Result cards: icon, work title, composer, performer/ensemble/form badges, PDF count, bookmark, expandable details.
10. 5 results per page, next/previous navigation, empty state.
11. Detail expansion includes an intentionally disabled PDF button until real assets and rights clearance are connected.
12. User language switch changes UI text and displayed titles without resetting current search.
13. Browser language auto-defaults to English for non-Japanese locales and Japanese for Japanese locales. **Production**: explicit preference must override automatic choice; route-based /ja and /en URLs, hreflang, server/client consistency and persistence remain to implement.

## Site-wide component reuse
- Header, locale switch, search field, chips, select, disclosure, card, badges, bookmark, primary/secondary buttons, pagination, empty/loading/error states, labels and alerts.
- Apply these components to homepage, score catalog, work detail, PDF preview, teacher directory, teacher signup, teacher dashboard, articles, services, community and admin.
- Keep page-specific workflows distinct: teacher forms must prioritize privacy, validation and accessibility; admin tools should prioritize information density without sacrificing clarity.
- Maintain design tokens in a shared CSS variable/theme system, not scattered literal colors.

## Catalog model / production corrections
- Separate `Work` from `Edition` / `ScoreAsset`; one canonical work page with multiple movements, editions, parts and legally cleared PDFs.
- Filter `performer_count` on the **specific edition/arrangement**, not just on an abstract work; orchestral scoring is not reliably modeled as a fixed 5.
- Instrumentation and musical form are independent facets; allow multi-valued tags and richer controlled vocabulary (woodwind, brass, voice, mixed, piano + strings, etc.).
- Localized title aliases, catalog number, composer and instrument synonyms are searchable.
- Persist filter state in URL query params for shareability, back/forward, SEO-safe navigation.
- Bookmark persistence requires a privacy-conscious user preference design; demo bookmarks are memory-only and reset on reload.
- Never show a PDF as available until `rights_status=approved`; handle takedowns and withdrawal.
- Do not load large PDF preview until requested; offer download fallback.
- Avoid large client-side catalog bundles; use indexed server search or a suitable search backend once corpus grows.

## Ads / bilingual / performance
- Default target: two clearly marked affiliate placements on substantive public content pages, with exceptions for auth, registration, contact, legal, checkout, admin and short pages.
- No affiliate ad masquerading as a download action. Reserve layout space to prevent CLS.
- Shared components and data across Japanese/English pages; separate editorial copy, localized SEO titles and descriptions, hreflang.
- Performance: minimal JavaScript, lazy-loaded PDFs/images, sensible caching, keyboard access, no blocking scripts.
- Sakura hosting capabilities must be confirmed before framework/CMS/DB decisions.

## Claude implementation checklist
- Treat this prototype as the **approved UI baseline**; do not redesign its palette, chip behavior, card density or information hierarchy without proposing and documenting a reason.
- Translate prototype into reusable production components with types, tests, semantic markup and responsive/a11y checks.
- Provide states: default/hover/focus/selected/disabled/loading/empty/error.
- Audit color contrast, keyboard navigation, screen-reader announcements, Japanese/English text overflow.
- Validate real catalog taxonomy, edition-level performer counts, rights gating, query URL persistence and search scaling.
- Link each new UI page back to this design-system reference in the PR.
- Do not publish production, move domains, alter rights status or make purchases without human approval.

## Acceptance
- Visually coherent with prototype at phone and desktop widths.
- Combined filters and sorting correct, pagination correct, reset works.
- Language switch retains current work context and explicit preference.
- No false download affordance; real PDF only when cleared.
- No fabricated teacher entries, fees, paid rankings or personal information leaks.
