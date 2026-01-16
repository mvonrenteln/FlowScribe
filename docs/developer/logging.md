- **Logging**

- **Location:** `client/src/lib/logging/loggingService.ts`

- **Summary:**
  - A general-purpose, reusable `Logger` for components and services.
  - The default namespace is `AI`; callers can override it via the `namespace` option.

- **Import:**

  - Recommended: `import { createLogger } from "@/lib/logging";`

- **Create a logger:**

  - Example:

    ```ts
    const logger = createLogger({ feature: "MyFeature" });
    logger.info("Started");
    logger.debug("Details", { count: 3 });
    ```

- **Enable debug logging:**

  - Global (namespace, default: `AI`):

    ```ts
    import { enableGlobalDebug } from "@/lib/logging";
    enableGlobalDebug(); // enables debug for namespace 'AI'
    // or for a custom namespace:
    enableGlobalDebug("MyNamespace");
    ```

  - Feature-specific:

    ```ts
    import { enableFeatureDebug } from "@/lib/logging";
    enableFeatureDebug("MyFeature");
    // or with a namespace:
    enableFeatureDebug("MyFeature", "MyNamespace");
    ```

- **Other utilities:**

  - `disableGlobalDebug(namespace?)` — disable global debug flag
  - `disableFeatureDebug(feature, namespace?)` — disable feature debug flag
  - `setGlobalLogLevel(level)` — set global log level ("debug"|"info"|"warn"|"error")
  - `getLogLevel()` — access the underlying `loglevel` export for advanced usage

- **Where to use:**
  - Import from `@/lib/logging` in `client/src/lib/**` (services/utilities).
  - Import from `@/lib/logging` in `client/src/components/**` (UI components) as well.

---

If you want, I can also add a short example into `docs/features/architecture` or update the main README.

---

Wenn du willst, kann ich zusätzlich ein kurzes Beispiel in `docs/features/architecture` einfügen oder die README aktualisieren.
