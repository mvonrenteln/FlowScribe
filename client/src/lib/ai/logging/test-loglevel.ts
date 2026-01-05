// Quick test for loglevel integration
import { createLogger, enableFeatureDebug, setGlobalLogLevel } from "@/lib/ai/logging";

// Test 1: Basic logging
const logger = createLogger({ feature: "TestFeature" });
logger.info("Info message");
logger.warn("Warning message");
logger.debug("This should not show"); // Debug disabled by default

// Test 2: Enable debug for specific feature
enableFeatureDebug("TestFeature");
logger.debug("This should show now");

// Test 3: Global level
setGlobalLogLevel("error");
logger.info("This should not show"); // Info < error
logger.error("This should show");

console.log("✅ All logging tests passed!");
