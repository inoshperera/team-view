<!--
Sync Impact Report
Version change: template -> 1.0.0
Modified principles:
- [PRINCIPLE_1_NAME] -> I. Client-Side Simplicity
- [PRINCIPLE_2_NAME] -> II. Proxy-Only Redmine Access
- [PRINCIPLE_3_NAME] -> III. MVP Visibility Before Analytics
- [PRINCIPLE_4_NAME] -> IV. Human-Readable Activity State
- [PRINCIPLE_5_NAME] -> V. Reference-Guided, Not Reference-Copied
Added sections:
- Product Scope
- Development Workflow
Removed sections:
- Placeholder Section 2
- Placeholder Section 3
Templates requiring updates:
- .specify/templates/plan-template.md: no update required; Constitution Check can reference these gates
- .specify/templates/spec-template.md: no update required; current user-story format fits this project
- .specify/templates/tasks-template.md: no update required; current story-based phases fit this project
Follow-up TODOs:
- None
-->
# Team High-Level View Constitution

## Core Principles

### I. Client-Side Simplicity
The product MUST start as a small client-side web application built with vanilla
HTML, CSS, and JavaScript. A build pipeline, frontend framework, package manager,
or bundled dependency MAY be introduced only when a feature cannot be delivered
cleanly with the simpler stack and the plan documents the reason.

Rationale: This project is intended to be easy to inspect, run locally, and adapt
without framework overhead.

### II. Proxy-Only Redmine Access
Browser code MUST NOT contain Redmine API keys, passwords, or other private
credentials. All Redmine API requests that require credentials MUST go through a
local proxy or similarly isolated runtime component. Credentials MUST live in a
local ignored configuration source or environment variable.

Rationale: The UI is client-side and visible to anyone who opens the files, so
credential handling must remain outside the browser surface.

### III. MVP Visibility Before Analytics
The first deliverable MUST prioritize clear current-or-recent activity visibility:
who is working, what they are working on, when activity was last observed, and
how long they appear occupied. Productivity scoring, trend analytics, forecasting,
and comparative ranking MUST remain out of scope until the MVP is working and
validated.

Rationale: The project's first value is operational awareness, not measurement
complexity.

### IV. Human-Readable Activity State
The dashboard MUST translate Redmine data into understandable states such as
active, recently active, inactive today, or needs attention. Raw Redmine records
MAY be shown as supporting detail, but the primary view MUST be understandable
without reading API-shaped data.

Rationale: The tool exists to reduce scanning effort for a team lead.

### V. Reference-Guided, Not Reference-Copied
Files in `referance/` MAY guide Redmine endpoint usage, proxy behavior, and
existing reporting logic. New implementation MUST avoid wholesale copying of the
old dashboard structure unless the plan identifies a specific reusable pattern.
The new product experience MUST be designed around the high-level activity
overview use case.

Rationale: The reference app solves a reporting problem; this project solves a
live team awareness problem.

## Product Scope

The MVP MUST focus on a selected team and the current working day. It MUST show
each selected member's latest meaningful Redmine activity, related project or
issue where available, time logged today, last activity time, and an estimated
occupied duration or fallback status when duration cannot be inferred.

The MVP SHOULD support manual refresh and MAY support simple automatic refresh.
The MVP MUST handle empty, delayed, or unavailable Redmine data with clear UI
states rather than silent failure.

## Development Workflow

Feature work MUST follow the Spec Kit flow: constitution, specification,
clarification when needed, implementation plan, tasks, implementation, and
cross-artifact analysis for non-trivial changes.

Plans MUST document:
- Redmine data assumptions and endpoints used
- Proxy and credential handling
- Source file structure
- UI states for loading, empty, error, active, and inactive data
- Verification steps that can be run locally

Tasks MUST be organized by independently testable user stories and keep the MVP
slice deliverable before enhancements.

## Governance

This constitution supersedes informal project preferences when creating specs,
plans, and tasks. Amendments require updating this file, including a Sync Impact
Report, and checking whether templates or generated artifacts need changes.

Versioning follows semantic versioning:
- MAJOR for incompatible principle removals or redefinitions
- MINOR for new principles or materially expanded governance
- PATCH for wording clarifications that do not change behavior

Every feature plan MUST include a Constitution Check that explicitly confirms
compliance with the five core principles or justifies any temporary exception.

**Version**: 1.0.0 | **Ratified**: 2026-05-12 | **Last Amended**: 2026-05-12
