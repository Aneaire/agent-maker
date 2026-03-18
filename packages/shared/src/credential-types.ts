export interface CredentialFieldDef {
  key: string;
  label: string;
  type: "string" | "password" | "email" | "select";
  placeholder?: string;
  required: boolean;
  helpText?: string;
  options?: { label: string; value: string }[];
}

export interface CredentialTypeDef {
  type: string;
  label: string;
  description: string;
  icon?: string;
  authMethod: "api_key" | "oauth2" | "token";
  fields: CredentialFieldDef[];
  oauth2?: {
    authUrl: string;
    tokenUrl: string;
    scopes: string[];
    extraParams?: Record<string, string>;
  };
  compatibleToolSets: string[];
  test: {
    method: "GET" | "POST";
    url: string;
    headers?: Record<string, string>;
    expectedStatus?: number;
  };
}

// ── Registry ──────────────────────────────────────────────────────────

export const CREDENTIAL_TYPE_REGISTRY: Record<string, CredentialTypeDef> = {
  resend: {
    type: "resend",
    label: "Resend (Email)",
    description: "Send emails via the Resend API",
    icon: "Mail",
    authMethod: "api_key",
    fields: [
      {
        key: "resendApiKey",
        label: "Resend API Key",
        type: "password",
        placeholder: "re_...",
        required: true,
        helpText: "Get your API key from resend.com",
      },
      {
        key: "fromEmail",
        label: "From Email",
        type: "email",
        placeholder: "agent@yourdomain.com",
        required: true,
        helpText: "Must be a verified sending domain",
      },
      {
        key: "fromName",
        label: "From Name",
        type: "string",
        placeholder: "My Agent",
        required: false,
      },
    ],
    compatibleToolSets: ["email"],
    test: {
      method: "GET",
      url: "https://api.resend.com/domains",
      headers: { Authorization: "Bearer {{resendApiKey}}" },
      expectedStatus: 200,
    },
  },

  slack: {
    type: "slack",
    label: "Slack Bot",
    description: "Send messages, read channels, and interact with Slack",
    icon: "Hash",
    authMethod: "token",
    fields: [
      {
        key: "botToken",
        label: "Bot User OAuth Token",
        type: "password",
        placeholder: "xoxb-...",
        required: true,
        helpText: "From your Slack app's OAuth & Permissions page",
      },
    ],
    compatibleToolSets: ["slack"],
    test: {
      method: "POST",
      url: "https://slack.com/api/auth.test",
      headers: { Authorization: "Bearer {{botToken}}" },
      expectedStatus: 200,
    },
  },

  notion: {
    type: "notion",
    label: "Notion Integration",
    description: "Search, read, create, and update Notion pages and databases",
    icon: "BookOpen",
    authMethod: "api_key",
    fields: [
      {
        key: "apiKey",
        label: "Internal Integration Token",
        type: "password",
        placeholder: "ntn_...",
        required: true,
        helpText: "Create an integration at notion.so/my-integrations",
      },
    ],
    compatibleToolSets: ["notion"],
    test: {
      method: "GET",
      url: "https://api.notion.com/v1/users/me",
      headers: {
        Authorization: "Bearer {{apiKey}}",
        "Notion-Version": "2022-06-28",
      },
      expectedStatus: 200,
    },
  },

  google_oauth2: {
    type: "google_oauth2",
    label: "Google (OAuth2)",
    description: "Connect Google Calendar, Drive, and Sheets via OAuth",
    icon: "Calendar",
    authMethod: "oauth2",
    fields: [],
    oauth2: {
      authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      scopes: [
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/spreadsheets",
      ],
      extraParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
    compatibleToolSets: ["google_calendar", "google_drive", "google_sheets"],
    test: {
      method: "GET",
      url: "https://www.googleapis.com/oauth2/v1/userinfo",
      headers: { Authorization: "Bearer {{accessToken}}" },
      expectedStatus: 200,
    },
  },

  image_gen_gemini: {
    type: "image_gen_gemini",
    label: "Gemini Imagen",
    description: "Generate images using Google Gemini's Imagen model",
    icon: "Image",
    authMethod: "api_key",
    fields: [
      {
        key: "geminiApiKey",
        label: "Gemini API Key",
        type: "password",
        placeholder: "AI...",
        required: true,
        helpText: "From Google AI Studio (aistudio.google.com)",
      },
    ],
    compatibleToolSets: ["image_generation"],
    test: {
      method: "GET",
      url: "https://generativelanguage.googleapis.com/v1beta/models?key={{geminiApiKey}}",
      expectedStatus: 200,
    },
  },

  image_gen_nano_banana: {
    type: "image_gen_nano_banana",
    label: "Nano Banana (Flux)",
    description: "Generate images using Nano Banana's Flux model",
    icon: "Image",
    authMethod: "api_key",
    fields: [
      {
        key: "nanoBananaApiKey",
        label: "Nano Banana API Key",
        type: "password",
        placeholder: "nb_...",
        required: true,
      },
    ],
    compatibleToolSets: ["image_generation"],
    test: {
      method: "GET",
      url: "https://api.nanobanana.com/v1/models",
      headers: { Authorization: "Bearer {{nanoBananaApiKey}}" },
      expectedStatus: 200,
    },
  },
};

// ── Helpers ────────────────────────────────────────────────────────────

export function credentialTypesForToolSet(toolSet: string): CredentialTypeDef[] {
  return Object.values(CREDENTIAL_TYPE_REGISTRY).filter((def) =>
    def.compatibleToolSets.includes(toolSet)
  );
}

export function getCredentialTypeDef(type: string): CredentialTypeDef | undefined {
  return CREDENTIAL_TYPE_REGISTRY[type];
}

/** Tool sets that require credentials to function */
export const TOOL_SETS_REQUIRING_CREDENTIALS: Record<string, boolean> = {
  email: true,
  slack: true,
  notion: true,
  google_calendar: true,
  google_drive: true,
  google_sheets: true,
  image_generation: true,
};
