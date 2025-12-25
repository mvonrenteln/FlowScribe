const createRegex = (
  pattern: string,
  flags: string,
  fallbackPattern: string,
  fallbackFlags: string,
) => {
  try {
    return new RegExp(pattern, flags);
  } catch {
    return new RegExp(fallbackPattern, fallbackFlags);
  }
};

export const wordEdgeRegex = createRegex(
  "^[^\\p{L}\\p{N}]+|[^\\p{L}\\p{N}]+$",
  "gu",
  "^[^A-Za-z0-9]+|[^A-Za-z0-9]+$",
  "g",
);

export const wordLeadingRegex = createRegex(
  "^[^\\p{L}\\p{N}]+",
  "gu",
  "^[^A-Za-z0-9]+",
  "g",
);

export const wordTrailingRegex = createRegex(
  "[^\\p{L}\\p{N}]+$",
  "gu",
  "[^A-Za-z0-9]+$",
  "g",
);
