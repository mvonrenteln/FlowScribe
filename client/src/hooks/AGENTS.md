# Hooks DOX

## Purpose

- Own reusable React hooks that coordinate UI behavior, device state, toast access, and future editor interactions.

## Ownership

- Hook tests live in `__tests__/` beside the hooks.
- Cross-cutting store contracts remain in `client/src/lib/store/AGENTS.md` when hooks depend on Zustand state.

## Local Contracts

- Hooks must be deterministic under React Strict Mode and clean up subscriptions, timers, and listeners.
- Keyboard navigation hooks must call `preventDefault()` for handled arrow keys outside form elements.

## Work Guidance

- Keep hooks small and focused on coordination; extract branchy pure logic into `lib/` utilities.
- Include `t` in dependency arrays when translated strings are used inside effects or callbacks.

## Verification

- Run the root verification loop for hook edits.
- Add or update hook tests for behavioral changes.

## Child DOX Index

- No child DOX files.
