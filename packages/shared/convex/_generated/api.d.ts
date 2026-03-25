/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agentApi from "../agentApi.js";
import type * as agentDatabases from "../agentDatabases.js";
import type * as agentEvents from "../agentEvents.js";
import type * as agentJobs from "../agentJobs.js";
import type * as agentMessages from "../agentMessages.js";
import type * as agentTimers from "../agentTimers.js";
import type * as agents from "../agents.js";
import type * as assetFolders from "../assetFolders.js";
import type * as assets from "../assets.js";
import type * as auth from "../auth.js";
import type * as automations from "../automations.js";
import type * as conversations from "../conversations.js";
import type * as creatorApi from "../creatorApi.js";
import type * as creatorSessions from "../creatorSessions.js";
import type * as credentialActions from "../credentialActions.js";
import type * as credentials from "../credentials.js";
import type * as customTools from "../customTools.js";
import type * as dispatch from "../dispatch.js";
import type * as documentChunksInternal from "../documentChunksInternal.js";
import type * as documents from "../documents.js";
import type * as executions from "../executions.js";
import type * as memories from "../memories.js";
import type * as messages from "../messages.js";
import type * as processAutomation from "../processAutomation.js";
import type * as scheduledActions from "../scheduledActions.js";
import type * as seed from "../seed.js";
import type * as seed_pageSeeders from "../seed/pageSeeders.js";
import type * as seed_registry from "../seed/registry.js";
import type * as seed_toolsetSeeders from "../seed/toolsetSeeders.js";
import type * as serverAuth from "../serverAuth.js";
import type * as sidebarTabs from "../sidebarTabs.js";
import type * as storage from "../storage.js";
import type * as tabApiEndpoints from "../tabApiEndpoints.js";
import type * as tabNotes from "../tabNotes.js";
import type * as tabSpreadsheet from "../tabSpreadsheet.js";
import type * as tabTasks from "../tabTasks.js";
import type * as users from "../users.js";
import type * as webhookFire from "../webhookFire.js";
import type * as webhooks from "../webhooks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agentApi: typeof agentApi;
  agentDatabases: typeof agentDatabases;
  agentEvents: typeof agentEvents;
  agentJobs: typeof agentJobs;
  agentMessages: typeof agentMessages;
  agentTimers: typeof agentTimers;
  agents: typeof agents;
  assetFolders: typeof assetFolders;
  assets: typeof assets;
  auth: typeof auth;
  automations: typeof automations;
  conversations: typeof conversations;
  creatorApi: typeof creatorApi;
  creatorSessions: typeof creatorSessions;
  credentialActions: typeof credentialActions;
  credentials: typeof credentials;
  customTools: typeof customTools;
  dispatch: typeof dispatch;
  documentChunksInternal: typeof documentChunksInternal;
  documents: typeof documents;
  executions: typeof executions;
  memories: typeof memories;
  messages: typeof messages;
  processAutomation: typeof processAutomation;
  scheduledActions: typeof scheduledActions;
  seed: typeof seed;
  "seed/pageSeeders": typeof seed_pageSeeders;
  "seed/registry": typeof seed_registry;
  "seed/toolsetSeeders": typeof seed_toolsetSeeders;
  serverAuth: typeof serverAuth;
  sidebarTabs: typeof sidebarTabs;
  storage: typeof storage;
  tabApiEndpoints: typeof tabApiEndpoints;
  tabNotes: typeof tabNotes;
  tabSpreadsheet: typeof tabSpreadsheet;
  tabTasks: typeof tabTasks;
  users: typeof users;
  webhookFire: typeof webhookFire;
  webhooks: typeof webhooks;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
