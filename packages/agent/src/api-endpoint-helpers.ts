/**
 * Helpers for the REST API endpoint surface (tabApiEndpoints).
 * - validateEndpointInput: lightweight schema check before an agent run
 * - substituteTemplateVars: {{body.x}} / {{query.x}} / {{headers.x}} replacement
 *
 * The schema format is a minimal subset of JSON Schema so we don't pull in
 * ajv just for a couple of field checks. Shape:
 *   { body?: FieldMap, query?: FieldMap }
 *   FieldMap = { properties: Record<string, FieldSpec>, required?: string[] }
 *   FieldSpec = { type: "string"|"number"|"boolean"|"object"|"array", enum?: any[] }
 */

type FieldType = "string" | "number" | "boolean" | "object" | "array";

interface FieldSpec {
  type: FieldType;
  enum?: unknown[];
  description?: string;
}

interface FieldMap {
  properties?: Record<string, FieldSpec>;
  required?: string[];
}

export interface EndpointInputSchema {
  body?: FieldMap;
  query?: FieldMap;
}

function typeOf(v: unknown): FieldType | "null" | "undefined" {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v as FieldType;
}

function checkFieldMap(
  source: "body" | "query",
  input: Record<string, unknown> | undefined | null,
  map: FieldMap | undefined
): string[] {
  if (!map) return [];
  const errors: string[] = [];
  const obj = (input ?? {}) as Record<string, unknown>;

  for (const req of map.required ?? []) {
    if (obj[req] === undefined || obj[req] === null || obj[req] === "") {
      errors.push(`${source}.${req}: required field is missing or empty`);
    }
  }

  for (const [key, spec] of Object.entries(map.properties ?? {})) {
    const val = obj[key];
    if (val === undefined || val === null) continue; // absence handled by required
    const t = typeOf(val);
    if (t !== spec.type) {
      errors.push(`${source}.${key}: expected ${spec.type}, got ${t}`);
      continue;
    }
    if (spec.enum && !spec.enum.some((e) => e === val)) {
      errors.push(
        `${source}.${key}: value must be one of [${spec.enum.map((e) => JSON.stringify(e)).join(", ")}]`
      );
    }
  }
  return errors;
}

export function validateEndpointInput(
  schema: EndpointInputSchema | undefined | null,
  body: unknown,
  query: Record<string, string>
): { ok: true } | { ok: false; errors: string[] } {
  if (!schema || typeof schema !== "object") return { ok: true };
  const errors: string[] = [];
  if (schema.body) {
    const bodyObj =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};
    errors.push(...checkFieldMap("body", bodyObj, schema.body));
  }
  if (schema.query) {
    errors.push(...checkFieldMap("query", query, schema.query));
  }
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

/**
 * Substitute {{body.field}}, {{body.a.b}}, {{query.x}}, {{headers.X-Source}}
 * in the template. Missing paths are replaced with an empty string and a
 * warning appended to the returned `missing` list. Whitespace inside `{{…}}`
 * is tolerated; case of the leading scope (body/query/headers) is
 * case-insensitive; header lookups are case-insensitive.
 */
export function substituteTemplateVars(
  template: string,
  vars: {
    body?: unknown;
    query?: Record<string, string>;
    headers?: Record<string, string>;
  }
): { output: string; missing: string[] } {
  const missing: string[] = [];
  const headersLower: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars.headers ?? {})) {
    headersLower[k.toLowerCase()] = v;
  }

  const output = template.replace(/\{\{\s*([a-zA-Z0-9_.\-]+)\s*\}\}/g, (match, path: string) => {
    const parts = path.split(".");
    const scope = parts[0].toLowerCase();
    const rest = parts.slice(1);

    let cursor: any;
    if (scope === "body") cursor = vars.body;
    else if (scope === "query") cursor = vars.query;
    else if (scope === "headers" || scope === "header") {
      const headerName = rest.join(".").toLowerCase();
      const v = headersLower[headerName];
      if (v === undefined) {
        missing.push(path);
        return "";
      }
      return v;
    } else {
      // Unknown scope — leave the placeholder intact so the agent can see it.
      return match;
    }

    for (const key of rest) {
      if (cursor == null || typeof cursor !== "object") {
        missing.push(path);
        return "";
      }
      cursor = (cursor as Record<string, unknown>)[key];
    }
    if (cursor === undefined || cursor === null) {
      missing.push(path);
      return "";
    }
    return typeof cursor === "string" ? cursor : JSON.stringify(cursor);
  });

  return { output, missing };
}

/**
 * Intersect an endpoint's allowedToolSets with the agent's enabledToolSets.
 * When allowedToolSets is null/undefined, returns the agent's full list
 * (inherit). When it's an empty array, returns an empty list (no tools).
 */
export function narrowToolSets(
  agentEnabled: string[] | undefined,
  endpointAllowed: string[] | undefined | null
): string[] {
  const base = agentEnabled ?? [];
  if (endpointAllowed === undefined || endpointAllowed === null) return base;
  const allowSet = new Set(endpointAllowed);
  return base.filter((t) => allowSet.has(t));
}
