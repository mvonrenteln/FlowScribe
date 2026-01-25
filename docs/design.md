# Audio Transcription Editor - Design Guidelines

## Design Approach: Productivity-Focused System Design

**Selected Framework:** Material Design 3 with productivity tool optimizations
**Justification:** This is a professional audio editing tool requiring clarity, efficiency, and information density. Drawing inspiration from Descript, Notion, and Linear for their clean, functional interfaces that prioritize workflow over decoration.

**Core Principles:**
- Information hierarchy over visual flair
- Keyboard-first interaction patterns
- Clear visual feedback for all editing states
- Minimal cognitive load through consistent patterns
- Orientation tools must coexist with the content they describe

## Layout System

**Spacing Scale:** Use Tailwind units of 1, 2, 3, 4, 6, and 8 exclusively
- Micro spacing (gaps, padding): 1, 2
- Component spacing: 3, 4
- Section spacing: 6, 8

**Layout Structure:**
```
Three-panel layout (fixed proportions):
- Header: Fixed height (h-14) with file info and primary actions
- Main workspace: Split into three zones
  - Left sidebar: Speaker management (w-64, fixed)
  - Center: Waveform + Transcript (flex-1, scrollable)
  - Right sidebar: Optional tools panel (w-56, collapsible)
```

**Grid System:**
- Waveform: Full-width of center panel (100%)
- Transcript: Single column, max-w-4xl centered
- Speaker cards: Vertical stack with 2px gap between segments

## Typography

**Font Stack:** Inter (via Google Fonts)
- Primary: 400 (regular), 500 (medium), 600 (semibold)
- Monospace fallback: 'Monaco', 'Courier New' for timestamps

**Hierarchy:**
- Header title: text-sm font-semibold tracking-tight
- Segment speaker labels: text-xs font-medium uppercase tracking-wide
- Transcript text: text-base leading-relaxed (optimized for reading)
- Timestamps: text-xs font-mono tabular-nums
- Sidebar headings: text-sm font-semibold
- Button labels: text-sm font-medium

## Component Library

### Waveform Panel
- Height: h-32 to h-48 (resizable)
- Container: Rounded corners (rounded-lg), subtle border
- Playhead: Vertical line (w-0.5) with subtle shadow
- Segment markers: Vertical dividers at word boundaries
- Region highlights: Semi-transparent overlays per speaker
- Interaction: Click-to-seek, drag segment boundaries

### Transcript Editor
- Segment cards: Stacked vertically with 1px dividers
- Card padding: p-3 to p-4
- Speaker tag: Inline badge (px-2 py-0.5, rounded-md, text-xs)
- Active segment: Elevated appearance (shadow-sm, ring-1)
- Word highlighting: Underline during playback
- Editable text: Contenteditable div with focus ring
- Timestamps: Right-aligned, subtle text

### Speaker Management Sidebar
- Speaker list: Vertical cards with avatar placeholders
- Each card shows: Color indicator (w-1 vertical bar), name, segment count
- Rename input: Inline edit on click
- Add speaker button: Full-width, subtle (text-sm, p-2)
- Merge speakers: Drag-and-drop interaction zones

### Controls Bar (Header)
- Play/pause: Icon button (h-9 w-9)
- Timeline scrubber: Horizontal slider (h-1)
- Time display: Monospace (text-sm, tabular-nums)
- Export button: Primary action (px-4 py-2, rounded-md)
- Keyboard shortcuts hint: Icon with tooltip

### Context Menus
- Split segment: Text option with keyboard shortcut label
- Merge with next/previous: Conditional display
- Change speaker: Dropdown with avatar + name
- Delete segment: Destructive action at bottom

### Keyboard Shortcut Panel (Overlay)
- Modal: max-w-2xl, centered
- Two-column grid: Shortcut (left, monospace) + Description (right)
- Categories: Playback, Navigation, Editing, Export
- Close on ESC or backdrop click

## Interaction Patterns

**Selection States:**
- Default: Border subtle (border-gray-200)
- Hover: Border emphasis (border-gray-300)
- Selected: Ring-2 with accent treatment
- Focus: Ring-2 with keyboard focus indicator

**Drag & Drop:**
- Dragging segment: Opacity-50 on source
- Drop zone: Dashed border (border-dashed, border-2)
- Invalid drop: Red border treatment

**Loading States:**
- File upload: Progress bar (h-1) with percentage
- Waveform rendering: Skeleton loader (animate-pulse)
- Processing: Spinner with status text

## Accessibility Implementation

**Keyboard Navigation:**
- Tab order: File upload → Waveform → Transcript segments → Sidebar
- Arrow keys: Navigate between segments
- Space/Enter: Play/pause, activate controls
- Focus indicators: Ring-2 on all interactive elements

**Screen Reader Support:**
- ARIA labels on all icon buttons
- Live region announcements for playback status
- Semantic HTML: nav, main, aside, article for segments

## Critical Constraints

- No animations except: Progress indicators, active playback highlight, drag feedback
- No hero images (utility application)
- Maintain consistent 8px base grid throughout
- All interactive elements minimum 44x44px touch targets
- No decorative elements that don't serve function
