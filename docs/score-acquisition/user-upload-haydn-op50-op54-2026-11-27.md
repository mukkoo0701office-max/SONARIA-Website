# Uploaded Haydn Op.50 / Op.54 parts — intake handoff (2026-11-27)

## Source
User-supplied ZIP: `選択項目から作成したフォルダ 2.zip`. Eight actual PDF files inspected for presence and PDF page count. **Binary PDF files have not yet been uploaded to this GitHub branch or website.** The ZIP is available in the originating ChatGPT conversation attachment, not in this repository.

| Collection | Instrument | IMSLP file ID | Filename | PDF pages |
|---|---|---:|---|---:|
| Haydn Op.50 | Violin I | 106764 | IMSLP106764-PMLP14070-Haydn_-_String_Quartets_Op.50_Vn1Pt.pdf | 32 |
| Haydn Op.50 | Violin II | 106765 | IMSLP106765-PMLP14070-Haydn_-_String_Quartets_Op.50_Vn2Pt.pdf | 24 |
| Haydn Op.50 | Viola | 106766 | IMSLP106766-PMLP14070-Haydn_-_String_Quartets_Op.50_VaPt.pdf | 24 |
| Haydn Op.50 | Cello | 106767 | IMSLP106767-PMLP14070-Haydn_-_String_Quartets_Op.50_VcPt.pdf | 22 |
| Haydn Op.54 | Violin I | 105769 | IMSLP105769-PMLP14071-Haydn_-_String_Quartets_Op.54_Vn1Pt.pdf | 18 |
| Haydn Op.54 | Violin II | 105770 | IMSLP105770-PMLP14071-Haydn_-_String_Quartets_Op.54_Vn2Pt.pdf | 12 |
| Haydn Op.54 | Viola | 105771 | IMSLP105771-PMLP14071-Haydn_-_String_Quartets_Op.54_VaPt.pdf | 12 |
| Haydn Op.54 | Cello | 105772 | IMSLP105772-PMLP14071-Haydn_-_String_Quartets_Op.54_VcPt.pdf | 12 |

## Owner decision (2026-11-27)
The owner explicitly authorizes publication of parts-only editions without a full score. Treat missing full score as descriptive metadata, **not** a rejection criterion. This does not waive copyright, integrity, or approval requirements.

## Claude implementation checklist
- [ ] Obtain original 8 PDF binaries from the user ZIP and verify they open and match their listed contents; do not use macOS `__MACOSX/._*` sidecars.
- [ ] Verify actual internal work divisions and completeness. Op.50 nominally contains six quartets and Op.54 three; **do not claim all nine individual works are complete until PDF page-level verification**.
- [ ] Cross-reference existing SONARIA Work/Edition/ScoreAsset records; do not duplicate works or assets.
- [ ] Identify publisher/editor/scan provenance and Japanese redistribution rights independently; no automatic `rights_status=approved`.
- [ ] Attach all four part assets to each verified collection/edition; full score is **not included** in this upload. **Owner-approved policy: score is NOT required for publication if verified individual parts are available.** Clearly label as part sets and show '総譜なし / Parts only' in Japanese and English. Do not block intake solely due to the absence of a full score.
- [ ] Follow existing JA/EN page structure and approved UI, add appropriate IMSLP provenance, and ensure unapproved PDFs cannot be downloaded.
- [ ] Test static export, PDF paths, mobile and EN/JA before requesting owner approval.
- [ ] Do not merge or deploy without explicit owner approval.

See `CLAUDE.md`, `docs/workflow.md`, and `docs/SONARIA_UI_DESIGN_SYSTEM_v1.0.md`.

## Canonical rename and storage mapping (approved naming template)

| IMSLP ID | New filename | Catalog work ID |
|---|---|---|
| 106764 | Haydn_String-Quartets-Op50_Violin1.pdf | haydn-string-quartets-op50 |
| 106765 | Haydn_String-Quartets-Op50_Violin2.pdf | haydn-string-quartets-op50 |
| 106766 | Haydn_String-Quartets-Op50_Viola.pdf | haydn-string-quartets-op50 |
| 106767 | Haydn_String-Quartets-Op50_Cello.pdf | haydn-string-quartets-op50 |
| 105769 | Haydn_String-Quartets-Op54_Violin1.pdf | haydn-string-quartets-op54 |
| 105770 | Haydn_String-Quartets-Op54_Violin2.pdf | haydn-string-quartets-op54 |
| 105771 | Haydn_String-Quartets-Op54_Viola.pdf | haydn-string-quartets-op54 |
| 105772 | Haydn_String-Quartets-Op54_Cello.pdf | haydn-string-quartets-op54 |

Preferred website paths: `frontend/public/scores/<catalog work ID>/<new filename>` or the existing GitHub Release asset workflow for large PDFs. Do not create download links before assets actually exist. Retain original IMSLP IDs and SHA256 checksums for provenance.
