# AI Concurrency (Batch Requests)

This document explains how FlowScribe runs optional parallel AI requests for batch operations and how to configure it.

## Overview

Batch AI features can execute requests in parallel with a bounded concurrency limit. When enabled, tasks run concurrently, but batch logs and suggestion callbacks are emitted **in input order** so the UI stays deterministic.

Parallel mode is global and controlled from **Settings → AI Providers → Global AI Settings**.

## How to Enable

1. Open **Settings**.
2. Go to **AI Providers**.
3. Under **Global AI Settings**:
   - Check **Enable parallel AI requests**.
   - Set **Max Concurrent Requests** to a value between 1 and 6.

When disabled, all batch requests run sequentially (concurrency = 1).

## Where It Applies

Parallel batch execution is used by batch services that issue independent requests per item or per batch:

- Text revision batch processing
- Speaker classification batch processing
- Core `executeBatch` helper

Features with cross-batch dependencies remain sequential. For example, chapter detection must preserve batch order because each batch can depend on the previous chapter summary.

## Implementation Notes

- Ordered concurrency is implemented in `client/src/lib/ai/core/batch.ts` via `runConcurrentOrdered(...)`.
- The global concurrency setting is read from `client/src/lib/settings/settingsStorage.ts`.

See `docs/features/architecture/ai-features-unified.md` for the broader AI infrastructure.
