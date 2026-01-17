import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

if (import.meta.env.DEV) {
  const IGNORED_MESSAGE = "Attempting to use a disconnected port object";

  window.addEventListener(
    "error",
    (ev: ErrorEvent) => {
      try {
        const msg = ev && ev.message;
        const file = (ev as any).filename || "";
        if (
          (typeof msg === "string" && msg.includes(IGNORED_MESSAGE)) ||
          (typeof file === "string" &&
            (file.includes("react_devtools_backend_compact.js") || file.includes("proxy.js")))
        ) {
          ev.preventDefault();
        }
      } catch (e) {
        // swallow any errors in the filter itself
      }
    },
    true,
  );

  window.addEventListener("unhandledrejection", (ev: PromiseRejectionEvent) => {
    try {
      const reason = ev && (ev as any).reason;
      if (typeof reason === "string" && reason.includes(IGNORED_MESSAGE)) {
        ev.preventDefault();
      }
    } catch (e) {
      // ignore
    }
  });
}

createRoot(root).render(<App />);
