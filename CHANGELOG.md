# Changelog

All notable changes to AI Academic Agent (Trợ lý học thuật) are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] - 2026-10-03

AI Academic Agent gains Ami, a friendly 3D robot character who guides you from the home page through every step.

### Added

- Ami: a procedurally drawn 3D assistant robot (three.js, lazy-loaded) with 9 emotions (idle, wave, read, think, happy, celebrate, care, alert, sleep), eyes that follow the pointer and bilingual Vietnamese/English speech bubbles.
- Ami accompanies the whole journey: greets you on the sign-in page, prompts each step, reads your document with you, "thinks" during analysis, reacts to the fit score (80+: celebrate, 60+: happy, below 60: care) and reports errors gently. After sign-in a compact Ami sits in the corner with a hide/show button.
- An "ISA ecosystem" block in the footer (EduFind, AI Academic Agent, Document Assistant) with UTM-tagged links to measure referrals.
- A new marketing kit starring Ami: share-preview image, 3:4 poster, nine 1:1 social images and a 30-second vertical video (English and Vietnamese).
- Bilingual release notes on the web (/ghi-chu-phat-hanh, /en/release-notes), an in-app "What's new" notice, the version number in the footer, CHANGELOG.md and automated releases (push a version tag or run the Release workflow).

### Changed

- The share-preview image (og.png) was redesigned around Ami.
- Ecosystem display names: "Trợ lý văn thư Mây" (vi), "Mary, Document Assistant" (en); the current step reads "You are here with Ami".
- The 3D part loads separately (about 142 KB gzipped) when the browser is idle; devices without WebGL, with data-saver or low memory get a light SVG robot; rendering pauses when the tab is hidden or the robot is off-screen; quality drops automatically on slow devices; reduced-motion is respected. Home-page Lighthouse: performance 96, accessibility 100, SEO 100, CLS 0.

### Fixed

- The robot render loop no longer accepts a negative frame time (when the browser clock jumps backwards), which could make the robot's head spin wildly.

> Ami added the three.js library (MIT); see THIRD_PARTY_NOTICES.md.

## [1.0.0] - 2026-10-02

A bilingual web app that reads sources, scores their fit 0–100, picks citable passages and copies internationally standard citations.

### Added

- Sign-up and email verification (Supabase Auth); 1 free analysis per day; files up to 2 MB (15 MB for accounts verified by an administrator).
- Analysis with Claude: a 0–100 score on 5 criteria, a summary, ranked passages with page numbers verified verbatim against the source; below 60 it suggests alternative sources (OpenAlex) and suitable journals from EduFind.
- PDF, DOC and DOCX are read on the user's device; OCR (Vietnamese and English) for scans; documents are never stored.
- Citations in APA, Harvard, Chicago, MLA, IEEE, Vancouver, AMA, BibTeX and RIS plus a store of 10,865 CSL styles; citation language (Vietnamese/English) independent of the interface; history grouped by topic.
- Researcher profile (ORCID with check-digit validation), an admin area with API-cost statistics, Google Sheets sync through GitHub Actions and a visit counter.
- SEO and accessibility: structured data, sitemap, bilingual guides (/huong-dan, /en/guide), llms.txt; colour contrast meeting WCAG 2.2 AA; a phone layout that puts the main content first; the aaa.isavietnam.app domain.
- Author photo in the footer with an introduction dialog; the first marketing kit (poster, step-by-step images, bilingual post).

### Fixed

- PDFs now read on Safari/iPhone (added a ReadableStream async iterator for pdf.js) and the real cause is reported when a file cannot be read.
- The /api/analyze function no longer crashes on start-up on Vercel; fixed the clipped profile-percentage label on iPhone.

[Unreleased]: https://github.com/lvhoang90/tro-ly-hoc-thuat/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/lvhoang90/tro-ly-hoc-thuat/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/lvhoang90/tro-ly-hoc-thuat/releases/tag/v1.0.0
