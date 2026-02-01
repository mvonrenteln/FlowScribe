/**
 * Checks if an element is visible within its container viewport.
 *
 * Takes into account dynamic elements (suggestions, chapter headers) that may shift positions.
 *
 * @param target The element to check
 * @param container The container element (parent of target)
 * @param threshold Padding in pixels to consider "mostly visible"
 * @returns boolean true if the element is visible within the threshold
 */
export function isElementVisible(
  target: HTMLElement | null,
  container: HTMLElement | null,
  threshold = 20,
): boolean {
  if (!target || !container) return false;

  const viewport = container.parentElement;
  if (!viewport) return false;

  const rect = target.getBoundingClientRect();
  const viewRect = viewport.getBoundingClientRect();

  // If both have 0 dimensions, something is likely not rendered or hidden
  if (rect.height === 0 || viewRect.height === 0) return false;

  // Account for dynamic elements (suggestions, chapter headers) by using a more generous threshold
  // when there are such elements in the DOM. This prevents false negatives when DOM height changes.
  const hasDynamicElements =
    container.querySelector("[data-merge-suggestion]") !== null ||
    container.querySelector("[data-chapter-suggestion]") !== null;
  const effectiveThreshold = hasDynamicElements ? threshold + 40 : threshold;

  // Consider it visible if it's largely within the viewport.
  // This prevents "jumpy" scrolling for segments that are just slightly off.
  const isMostlyVisible =
    rect.top >= viewRect.top + effectiveThreshold &&
    rect.bottom <= viewRect.bottom - effectiveThreshold;

  // For very tall segments, if it currently fills the viewport, we don't need to re-center it.
  const fillsViewport = rect.top <= viewRect.top && rect.bottom >= viewRect.bottom;

  return isMostlyVisible || fillsViewport;
}
