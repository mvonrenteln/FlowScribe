# Accessibility Notes

## Transcript word focus

- Transcript word tokens are rendered as buttons for click handling, but they are removed from the tab order (`tabIndex=-1`).
- Keyboard navigation is handled at the segment level (arrow keys, shortcuts). If you need to focus a word, use pointer interaction or programmatic focus.

## Segment tag controls

- Tag remove/add buttons are revealed on hover and on keyboard focus within the tag row, so keyboard users can reach them without a mouse.
