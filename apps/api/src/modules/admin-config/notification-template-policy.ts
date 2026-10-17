export function isSafeInternalActionPathTemplate(value: string): boolean {
  if (value.length === 0 || value !== value.trim()) return false;
  if (!isInternalPath(value)) return false;

  try {
    return isInternalPath(decodeURIComponent(value));
  }
  catch {
    return false;
  }
}

function isInternalPath(value: string): boolean {
  return value.startsWith('/')
    && !value.startsWith('//')
    && !value.includes('\\')
    && !containsControlCharacter(value);
}

function containsControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint === 127;
  });
}
