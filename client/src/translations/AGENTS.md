# Translations DOX

## Purpose

- Own i18n resource files for user-facing FlowScribe text.

## Ownership

- `en.json` is the default and fallback language.
- `de.json` must contain matching German translations for every user-facing key.

## Local Contracts

- Keep translation key structure grouped by feature namespace.
- Do not remove keys unless all call sites are removed in the same change.
- Dynamic strings should use interpolation rather than concatenating translated fragments in UI code.

## Work Guidance

- Add English keys first, then German keys with the same JSON path.
- Keep JSON formatting compatible with Biome.

## Verification

- Run the root verification loop after translation edits.
- For UI changes, verify every new visible string has both translations.

## Child DOX Index

- No child DOX files.
