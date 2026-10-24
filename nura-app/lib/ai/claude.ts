import Anthropic from "@anthropic-ai/sdk";
import { getVercelOidcToken } from "@vercel/oidc";

/**
 * Every Claude call goes through here so an outage on Nura's own Anthropic account (out of
 * credit, revoked key, overloaded, down) doesn't take the product with it: the same request is
 * retried once through Vercel AI Gateway, which bills the Vercel team instead. Only when both
 * fail does the caller get an AiUnavailableError - and then it must say so plainly rather than
 * paper over it with a canned reply (that is how the 2026-10-24 credit outage went unnoticed).
 */

const GATEWAY_BASE_URL = "https://ai-gateway.vercel.sh";

/** Every Nura log line about a Claude outage starts with this, so one search finds them all. */
export const AI_DOWN_LOG_TAG = "[AI DOWN]";

export type AiFailureKind =
  | "billing"
  | "auth"
  | "rate_limit"
  | "overloaded"
  | "server"
  | "network"
  | "timeout"
  | "not_configured"
  | "bad_request";

export class AiUnavailableError extends Error {
  constructor(
    readonly kind: AiFailureKind,
    readonly source: string,
    message: string,
  ) {
    super(message);
    this.name = "AiUnavailableError";
  }
}

/** What went wrong with a Claude call, or null when it isn't an API failure at all. */
export function classifyAiError(err: unknown): AiFailureKind | null {
  if (err instanceof AiUnavailableError) return err.kind;
  if (err instanceof Anthropic.APIConnectionTimeoutError) return "timeout";
  if (err instanceof Anthropic.APIConnectionError) return "network";
  if (!(err instanceof Anthropic.APIError)) return null;
  const status = err.status ?? 0;
  if (status === 402 || /credit balance|billing|payment/i.test(err.message)) return "billing";
  if (status === 401 || status === 403) return "auth";
  if (status === 429) return "rate_limit";
  if (status === 529) return "overloaded";
  if (status >= 500) return "server";
  return "bad_request";
}

/**
 * Failures a second provider can get around. A bad request (malformed tool schema, too many
 * tokens) would fail the same way through the gateway, so it isn't retried.
 */
export function isProviderOutage(kind: AiFailureKind | null) {
  return kind !== null && kind !== "bad_request";
}

/** Gateway model ids carry the provider: "claude-sonnet-5" → "anthropic/claude-sonnet-5". */
export function gatewayModelId(model: string) {
  return model.includes("/") ? model : `anthropic/${model}`;
}

function describe(err: unknown) {
  if (err instanceof Anthropic.APIError) return `${err.status ?? "?"} ${err.message}`;
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}

async function gatewayCredential(): Promise<string | null> {
  if (process.env.AI_GATEWAY_API_KEY) return process.env.AI_GATEWAY_API_KEY;
  // On Vercel each function invocation gets a short-lived OIDC token the gateway accepts, so
  // no extra secret is needed in production. Locally it only exists after `vercel env pull`.
  return getVercelOidcToken().catch(() => null);
}

type CreateParams = Anthropic.MessageCreateParamsNonStreaming;

async function viaGateway(params: CreateParams): Promise<Anthropic.Message> {
  const credential = await gatewayCredential();
  if (!credential) throw new AiUnavailableError("not_configured", "gateway", "No AI Gateway credential");
  const gateway = new Anthropic({ apiKey: credential, baseURL: GATEWAY_BASE_URL });
  return gateway.messages.create({ ...params, model: gatewayModelId(params.model) });
}

/** Direct Anthropic first, then AI Gateway on an outage. Throws AiUnavailableError if both fail. */
export async function createClaudeMessage(source: string, params: CreateParams): Promise<Anthropic.Message> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  let directFailure = "ANTHROPIC_API_KEY not set";
  let directKind: AiFailureKind = "not_configured";

  if (apiKey) {
    try {
      return await new Anthropic({ apiKey }).messages.create(params);
    } catch (err) {
      const kind = classifyAiError(err);
      if (!isProviderOutage(kind)) throw err;
      directKind = kind ?? "server";
      directFailure = describe(err);
    }
  }

  try {
    const message = await viaGateway(params);
    console.error(
      `${AI_DOWN_LOG_TAG} Anthropic direct failed (${directKind}) for ${source}; served via AI Gateway instead. ${directFailure}`,
    );
    return message;
  } catch (err) {
    const gatewayKind = classifyAiError(err) ?? "server";
    console.error(
      `${AI_DOWN_LOG_TAG} Claude unavailable for ${source}: Anthropic direct failed (${directKind}: ${directFailure}) and AI Gateway failed (${gatewayKind}: ${describe(err)}). Users are seeing the outage reply.`,
    );
    throw new AiUnavailableError(directKind === "not_configured" ? gatewayKind : directKind, source, directFailure);
  }
}

/** Drop-in for `new Anthropic({ apiKey })` at call sites that only use messages.create. */
export function claudeClient(source: string) {
  return {
    messages: {
      create: (params: CreateParams) => createClaudeMessage(source, params),
    },
  };
}

