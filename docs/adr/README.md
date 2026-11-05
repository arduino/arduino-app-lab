# Architecture Decision Records

This directory collects the architectural decisions of the Cloud Editor
monorepo. An ADR is a short document (half a page is fine) that captures a
decision that shapes the structure of the codebase: why it was taken, what
the alternatives were, and what it implies for future work.

ADRs exist so that conventions survive team growth: a new contributor (or a
reviewer) can find out *why* the code is shaped the way it is without
archaeology through old PRs and Slack threads.

## When to write one

Open an ADR (or amend an existing one) when a PR:

- adds, moves, or removes a package/workspace boundary;
- changes how apps consume shared code (`ui-packages/*`,
  `consumable-app-components/*`);
- introduces a new cross-cutting pattern (state management, injection,
  styling, i18n, ...);
- deliberately deviates from a pattern documented here.

Reference the ADR from the PR description. Reviewers of structural changes
should ask for one when it is missing.

## Format

Copy an existing ADR. Sections: **Status** (Proposed / Accepted /
Superseded by ADR-XXXX), **Context**, **Decision**, **Consequences**.
Number files sequentially: `NNNN-short-title.md`. Never rewrite history:
when a decision changes, write a new ADR that supersedes the old one.

## Index

- [ADR-0001](0001-logic-injection.md) — Logic injection for shared UI
  components
- [ADR-0002](0002-editor-panel-content-injection.md) — EditorPanel pane
  content injection and app-agnostic boundary
