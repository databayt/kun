# iOS App — Hogwarts Mobile Companion

> **Native iOS companion for Hogwarts. Phase 2 in progress.** Repo was renamed from `swift-app` on 2026-05-24; old URL redirects.

---

## Overview

| Field | Value |
|-------|-------|
| **Repo** | [databayt/ios-app](https://github.com/databayt/ios-app) |
| **Language** | Swift |
| **Created** | 2025-12-17 |
| **Sibling** | [databayt/android-app](https://github.com/databayt/android-app) (Kotlin/Compose, the lead mobile reference) |

---

## What It Does

Native iOS companion app for the Hogwarts education platform. Built with Swift 6 and SwiftUI, targeting iOS 18+. Mirrors the web app's module structure with offline-first data persistence.

### Architecture

| Aspect | Choice |
|--------|--------|
| Language | Swift 6.0+ |
| UI | SwiftUI |
| Min iOS | 18.0+ |
| Data | SwiftData (offline-first) |
| Architecture | MVVM + Clean Architecture |
| Method | BMAD |
| i18n | Arabic RTL default, English LTR |

### Component Hierarchy (mirrors web)

```
UI → Atom → Feature → Screen
```

### Features Built

| Feature | Status |
|---------|--------|
| Module structure | Done |
| Glass material design | Phase 2 (in progress) |
| Offline data flow | Done (Sprint 6) |
| Deep linking | Done |
| App icon | Done |
| UI tests | Done |
| CI pipeline | Done (Sprint 7) |
| Resilience layer | Done |

---

## Recent Activity

```
3880b2a docs: Update implementation summary with Phase 2 progress
a17d700 Phase 2 (Continued): Transform remaining modules to glass materials
bfb7673 Phase 2C: Transform detail views to glass materials
a14e01c feat(Sprint-7): resilience, full offline coverage, CI pipeline
fed3aef feat(Sprint-6): offline-first data flow, deep linking, app icon, UI tests
```

Active development through sprints. Currently on Phase 2 — glass material design system.

---

## What Kun Does for iOS App

- References ios-app patterns for iOS development
- Coordinates with Hogwarts web for feature parity, and mirrors android-app feature cadence
- Primary development on macOS + iOS
- Accessibility/VoiceOver testing on iOS
