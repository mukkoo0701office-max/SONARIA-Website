# SONARIA — 講師検索・簡易プロフィール UI仕様 v1.0

- Status: **Approved by site owner on 2026-11-23**
- Decision: **B案 — SONARIA内の簡易プロフィールを経由して、講師本人の外部サイト・SNS等へ移動**
- Reference design: [SONARIA UI Design System v1.0](SONARIA_UI_DESIGN_SYSTEM_v1.0.md)
- Reference working score-search prototype: [score-search-ui-v1.html](../prototypes/score-search-ui-v1.html)
- Scope: specification and design approval; **not yet implemented/deployed**.

## 1. Goal and boundaries
SONARIAの無料講師ディレクトリ。検索結果カード → SONARIA内の簡易プロフィールページ → 本人指定の公式サイト／SNS／レッスン案内等へ遷移。講師ごとのブログ記事・長文編集記事は作らない。検索・登録・マッチングは無料。レッスン料金、価格帯、料金フィルタ、有料順位、手数料徴収は導入しない。

## 2. Visual system
楽譜検索と**同じコンポーネント、操作感、配色**を使う。
- Navy `#182B45`, Gold `#B79656`, Off-white `#FAF9F6`, white `#FFFFFF`, muted `#667085`, border `#E5E0D6`.
- Header SONARIA / SONG × ARIA, JA/EN switch, search input, filter chips, 2-column selects on sufficiently wide screens, advanced disclosure, result count, reset, sort, white rounded cards, badges, bookmark, pagination, empty/loading/error states.
- Mobile-first, minimal JS, keyboard operability, visible focus, screen-reader labels; test contrast and responsive overflow.
- No ad masquerading as contact or external-site button. No paid rankings.

## 3. Teacher search — required filters
1. Free-text: teacher name in kanji/kana/romaji, instruments in JA/EN, prefecture/city/station in JA/EN, keywords.
2. Instrument (multi-instrument teacher matches any registered instrument): strings (violin, viola, cello, double bass), piano, woodwinds (flute, oboe, clarinet, bassoon), brass (trumpet, horn, trombone, tuba); extensible taxonomy.
3. Region: prefecture; city/ward; station text; online-only teachers remain discoverable when relevant.
4. Gender preference: **指定なし / 女性 / 男性** as prominent controls; optional teacher self-identification may be nonbinary/other, or undisclosed. Do not infer gender from name, photo or voice. Do not expose private identity attributes without consent. No gender ranking.
5. Lesson format: in-person, visiting/travel lessons, online; multiple selections may be supported.
6. Learner needs: beginner, conservatory entrance preparation, hobby/adult, children; teacher can select multiple.
7. Advanced: music university current student/graduate (self-declared until verified), station and service range (e.g. transit time), teaching languages, performance-video availability. Filters must not imply credentials verified when they are not.
8. Sorting: name, area; future proximity only with valid consent/accurate geographic information. Never paid prioritization.

## 4. Search normalization / multilingual
- Store `display_name_ja`, `name_kana`, `name_romaji`, optional `display_name_en` as distinct fields; ask registrants to verify romaji.
- Normalize case, width, Unicode, common whitespace/punctuation, kana variants, romanized spelling aliases where safely possible. Support instrument synonyms (ヴァイオリン/バイオリン/violin), place aliases (東京/Tokyo, 新宿/Shinjuku), and partial matches.
- Do not treat automatically transliterated names as authoritative identity; allow teacher correction.
- JA/EN shared structured records with localized UI labels, profile fields and SEO metadata. Avoid automatically publishing inaccurate AI-translated biographical claims.
- Locale URLs `/ja/teachers`, `/en/teachers`; profile `/ja/teachers/{stable-id-or-slug}`, `/en/teachers/{stable-id-or-slug}`. Locale switch preserves current profile/search context, explicit language preference overrides browser detection; use hreflang.
- Filters encoded in URL query parameters for sharing and browser back/forward navigation. Never include private information in URLs.

## 5. Search result card
- Photo (optional; fallback generic icon), display name, instrument badges, prefecture/area, nearest station where consented, teaching modes, learner targets, short introduction, bookmark.
- Primary CTA **「プロフィールを見る」 / “View profile”** routes to **SONARIA internal simple profile**, not directly to an external URL.
- Clear display of published/approved status; avoid fabricated star ratings, reviews, rankings or teacher entries.
- Cards display only public profile fields; do not show private address, DOB, email or phone without specific publication consent.

## 6. Internal simple profile — approved B route
- Breadcrumb → teacher display name + portrait if supplied → instruments → teaching area/station/service range → lesson formats → learner targets → education/experience (verified status differentiated) → concise teaching philosophy → optional performance video/SNS.
- **External links section**: teacher-specified representative official site, SNS, lesson booking/guide URLs, clearly labeled as external destinations; show only validated allowed protocols `https://` (optionally `http://` with policy), use `rel="noopener noreferrer"` when opening new tabs, no open redirects. Provide no dead button if no external URL exists.
- Optional SONARIA inquiry route can be considered separately; not presumed approved by this decision.
- No blog-style article, long editorial content, compulsory teacher website, price or paid badge.
- Minimal profile URL supports direct linking, indexing policy and reporting/removal. Teacher can withdraw profile and request corrections.

## 7. Registration, moderation, privacy
- Free application; email verification; instruments, service area, gender (optional and can be undisclosed), teaching modes, learner groups, public display name, kana/romaji, profile copy, external URL(s).
- Collect only needed personal data; consent for public fields, especially photo, gender, station and links. Private address/contact stays private.
- Initial moderation before publishing; edits to ordinary content may publish after automated validation, while sensitive identity/qualification changes are reviewed. Record audit logs, reporting, takedown, anti-spam and rollback.
- `draft` → `submitted` → `under_review` → `approved` → `published`, plus `changes_requested`, `rejected`, `suspended`, `withdrawn`.
- Search index only includes `published` records. No sample teacher cards on production until genuine consented registrations exist.
- External URL validation and periodic broken-link review; do not endorse linked third-party content.

## 8. Data entities (draft)
`Teacher`: stable ID, publication state, display names, kana/romaji, optional pronouns/gender disclosure, education claims + verification status, short bios JA/EN, portrait asset consent, languages, created/updated timestamps.
`TeacherInstrument`: teacher ID, controlled instrument code.
`TeacherServiceArea`: prefecture/city/station (public visibility flags), travel coverage and formats.
`TeacherAudience`: beginner, children, adult/hobby, exam prep.
`TeacherExternalLink`: label, type, URL, is_primary, validation status.
`TeacherModerationLog`, `TeacherReport`, `TeacherConsent`.
Do not use sensitive gender information for ranking or inference. Establish retention and deletion policy.

## 9. QA / acceptance tests
- Filters combine correctly, including gender; `指定なし` includes all public teachers regardless of disclosed gender.
- Non-disclosed gender is never auto-labeled female/male and is not included in gender-specific filters.
- Japanese/English/romaji searches resolve verified aliases; e.g. 山田 / やまだ / Yamada, ヴァイオリン / violin, 新宿 / Shinjuku.
- Internal CTA routes to correct teacher ID, locale switch preserves teacher; external links are labeled, safe and valid.
- Search reset, keyboard controls, no-results, pagination, favorites and URL state work on phone/desktop.
- No teacher blog required; no lesson fee/fee filter; no paid listing or fabricated data.
- Only moderated, published profiles are searchable; private details never leak.

## 10. Pending implementation decisions (not blockers for this approved spec)
- Exact URL/slug format, optional inquiry workflow, gender field wording for nonbinary/undisclosed choices, moderation staffing, exact travel-radius computation, bookmarking persistence, hosting stack, identity verification standard.
- The previously shared teacher UI was a **chat-only demo**; this document specifies its approved behavior but is not a claim that an HTML teacher prototype was saved.
