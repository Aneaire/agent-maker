import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { AgentConvexClient } from "../convex-client.js";

export function createAgentMessageTools(
  convexClient: AgentConvexClient,
  agentId: string
) {
  const listAgents = tool(
    "list_sibling_agents",
    "List other agents owned by the same user that you can communicate with. Shows their names and descriptions.",
    {},
    async () => {
      try {
        const agents = await convexClient.listSiblingAgents(agentId);
        if (agents.length === 0) {
          return {
            content: [{
              type: "text" as const,
              text: "No other agents available. The user only has this agent.",
            }],
          };
        }

        const list = agents.map((a: any) =>
          `- "${a.name}" (ID: ${a.id})${a.description ? ` — ${a.description}` : ""}`
        );

        return {
          content: [{
            type: "text" as const,
            text: `Available agents:\n${list.join("\n")}`,
          }],
        };
      } catch (err: any) {
        return {
          content: [{
            type: "text" as const,
            text: `Failed to list agents: ${err.message}`,
          }],
        };
      }
    }
  );

  const sendToAgent = tool(
    "send_to_agent",
    `Send a message to another agent. The message will be queued for the target agent to process.
Use this for delegation, coordination, or passing work to specialized agents.
Example: Send a support ticket summary to a "Support Triage" agent, or ask a "Data Analyst" agent to run a report.`,
    {
      target_agent_id: z.string().describe("ID of the agent to send the message to"),
      message: z.string().describe("Message content for the target agent"),
      context: z.record(z.any()).optional().describe("Optional structured data to pass along (e.g. task details, relevant data)"),
    },
    async (input) => {
      try {
        const msgId = await convexClient.sendAgentMessage(
          agentId,
          input.target_agent_id,
          input.message,
          input.context
        );

        // Emit event
        await convexClient.emitEvent(agentId, "agent_message.sent", "agent_message_tools", {
          toAgentId: input.target_agent_id,
          messageId: msgId,
        });

        return {
          content: [{
            type: "text" as const,
            text: `Message sent to agent ${input.target_agent_id}. Message ID: ${msgId}. The target agent will process it when it runs next.`,
          }],
        };
      } catch (err: any) {
        return {
          content: [{
            type: "text" as const,
            text: `Failed to send message: ${err.message}`,
          }],
        };
      }
    }
  );

  const checkMessages = tool(
    "check_agent_messages",
    "Check for messages from other agents sent to you. Returns pending messages that haven't been processed yet.",
    {},
    async () => {
      try {
        const messages = await convexClient.listPendingAgentMessages(agentId);
        if (messages.length === 0) {
          return {
            content: [{
              type: "text" as const,
              text: "No pending messages from other agents.",
            }],
          };
        }

        const list = messages.map((m: any) => {
          const time = new Date(m.createdAt).toISOString();
          const context = m.context ? `\n  Context: ${JSON.stringify(m.context).substring(0, 200)}` : "";
          return `- From: ${m.fromAgentId} [${time}]\n  Message: ${m.content.substring(0, 300)}${context}\n  ID: ${m._id}`;
        });

        return {
          content: [{
            type: "text" as const,
            text: `Pending messages:\n${list.join("\n\n")}`,
          }],
        };
      } catch (err: any) {
        return {
          content: [{
            type: "text" as const,
            text: `Failed to check messages: ${err.message}`,
          }],
        };
      }
    }
  );

  const respondToAgent = tool(
    "respond_to_agent",
    "Respond to a message from another agent, marking it as processed.",
    {
      message_id: z.string().describe("ID of the agent message to respond to"),
      response: z.string().describe("Your response to the sending agent"),
    },
    async (input) => {
      try {
        await convexClient.respondToAgentMessage(input.message_id, input.response);
        return {
          content: [{
            type: "text" as const,
            text: `Response sent and message marked as processed.`,
          }],
        };
      } catch (err: any) {
        return {
          content: [{
            type: "text" as const,
            text: `Failed to respond: ${err.message}`,
          }],
        };
      }
    }
  );

  return [listAgents, sendToAgent, checkMessages, respondToAgent];
}
