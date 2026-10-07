const PLACEHOLDER_PATTERN = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;

export function renderNotificationTemplate(template: string, variables: Readonly<Record<string, string>>): string {
  return template.replace(PLACEHOLDER_PATTERN, (_match, key: string) => variables[key] ?? '');
}
