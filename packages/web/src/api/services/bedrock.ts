import {
  BedrockAgentRuntimeClient,
  InvokeAgentCommand,
  type InvocationResultMember,
  type SessionState,
} from "@aws-sdk/client-bedrock-agent-runtime";
import { evaluate, type Evaluation } from "./policy";

export function bedrockConfig() {
  const {
    BEDROCK_AGENT_ID: agentId,
    BEDROCK_AGENT_ALIAS_ID: agentAliasId,
    BEDROCK_SANDBOX_KEY: key,
    AWS_REGION,
  } = process.env;
  return agentId && agentAliasId && key && key.length >= 24
    ? { agentId, agentAliasId, key, region: AWS_REGION || "us-east-1" }
    : null;
}

export async function runBedrock(
  config: NonNullable<ReturnType<typeof bedrockConfig>>,
  sessionId: string,
  message: string,
  runtime = new BedrockAgentRuntimeClient({ region: config.region, maxAttempts: 1 }),
) {
  const evaluations: Evaluation[] = [];
  const decoder = new TextDecoder();
  let text = "";
  let sessionState: SessionState | undefined;
  const signal = AbortSignal.timeout(25_000);
  try {
    for (let round = 0; round < 3; round++) {
      const result = await runtime.send(
        new InvokeAgentCommand({
          agentId: config.agentId,
          agentAliasId: config.agentAliasId,
          sessionId,
          ...(sessionState ? { sessionState } : { inputText: message }),
        }),
        { abortSignal: signal },
      );
      if (!result.completion) throw new Error("Missing completion");
      let next: SessionState | undefined;
      for await (const event of result.completion) {
        if (event.chunk?.bytes)
          text = (text + decoder.decode(event.chunk.bytes, { stream: true })).slice(0, 4000);
        if (event.returnControl) {
          const { invocationId, invocationInputs } = event.returnControl;
          if (next || !invocationId || !invocationInputs?.length || invocationInputs.length > 3)
            throw new Error("Unexpected return of control");
          const results: InvocationResultMember[] = [];
          for (const item of invocationInputs) {
            const call = item.functionInvocationInput;
            if (
              !call ||
              call.actionGroup !== "TransferCompliance" ||
              call.function !== "evaluate_transfer"
            )
              throw new Error("Unexpected agent action");
            const p = new Map(call.parameters?.map(({ name, value }) => [name, value]));
            const output = evaluate({
              amount: p.get("amount") ?? "",
              destination_country: p.get("destination_country") ?? "",
              recipient: p.get("recipient") ?? "",
            });
            evaluations.push(output);
            results.push({
              functionResult: {
                actionGroup: call.actionGroup,
                function: call.function,
                responseBody: { TEXT: { body: JSON.stringify(output) } },
              },
            });
          }
          next = { invocationId, returnControlInvocationResults: results };
        }
        if (Object.keys(event).some((key) => key.endsWith("Exception")))
          throw new Error("Agent stream error");
      }
      text = (text + decoder.decode()).slice(0, 4000);
      if (!next) return { text, evaluations, interrupted: false };
      sessionState = next;
    }
  } catch {
    // Keep the actual policy evaluations even if agent follow-up fails.
  }
  return { text: "", evaluations, interrupted: true };
}
