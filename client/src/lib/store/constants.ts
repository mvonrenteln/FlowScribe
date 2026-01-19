export const SPEAKER_COLORS = [
  // First 10: clearly distinguishable hues (high contrast)
  "hsl(0, 90%, 50%)", // strong red
  "hsl(30, 90%, 50%)", // orange
  "hsl(60, 90%, 45%)", // yellow
  "hsl(120, 70%, 40%)", // green
  "hsl(180, 80%, 42%)", // cyan
  "hsl(210, 90%, 48%)", // blue
  "hsl(270, 85%, 50%)", // purple
  "hsl(300, 80%, 48%)", // magenta
  "hsl(330, 80%, 50%)", // pink
  "hsl(15, 90%, 48%)", // reddish-orange

  // Next 10: additional colors, may be less distinct / repeated shades
  "hsl(345, 65%, 48%)",
  "hsl(45, 85%, 50%)",
  "hsl(75, 70%, 45%)",
  "hsl(135, 60%, 45%)",
  "hsl(165, 65%, 42%)",
  "hsl(195, 70%, 44%)",
  "hsl(225, 65%, 46%)",
  "hsl(255, 60%, 48%)",
  "hsl(285, 55%, 50%)",
  "hsl(315, 60%, 48%)",
];

export const MAX_HISTORY = 100;
export const PERSIST_THROTTLE_MS = 500;
export const PLAYING_TIME_PERSIST_STEP = 1;
export const PAUSED_TIME_PERSIST_STEP = 0.25;
