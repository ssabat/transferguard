import { describe, expect, test } from "bun:test";
import type {
  BedrockAgentRuntimeClient,
  InvokeAgentCommand,
  ResponseStream,
} from "@aws-sdk/client-bedrock-agent-runtime";
import { runBedrock } from "../src/api/services/bedrock";
import { demoProposal, evaluate } from "../src/api/services/policy";

const proposal = (amount: string, destination_country = "Canada", recipient = "Alice") => ({
  amount,
  destination_country,
  recipient,
});

describe("sample policy", () => {
  test("checks the exact cent boundary", () => {
    expect(evaluate(proposal("$10,000.00")).decision).toBe("APPROVED");
    expect(evaluate(proposal("$10,000.01")).decision).toBe("BLOCKED_AMOUNT_LIMIT");
  });
  test("checks exact country names and ISO codes without guessing", () => {
    for (const value of ["Somalia", "so", "SOM", "Afghanistan", "AFG"]) {
      expect(evaluate(proposal("1", value)).decision).toBe("BLOCKED_RESTRICTED_COUNTRY");
    }
    expect(evaluate(proposal("1", "Atlantis")).decision).toBe("BLOCKED_UNVERIFIED_COUNTRY");
    expect(evaluate(proposal("1", "deu")).isoCode).toBe("DE");
  });
  test("does not approve malformed, negative or zero amounts, or empty recipients", () => {
    for (const value of ["NaN", "Infinity", "-5", "0", "1.001", "10,00", "3e3", "€10"]) {
      expect(evaluate(proposal(value)).decision).toBe("BLOCKED_INVALID_AMOUNT");
    }
    expect(evaluate(proposal("5", "Canada", " ")).decision).toBe("BLOCKED_MISSING_RECIPIENT");
  });
  test("demo only proposes when a complete request is typed", () => {
    expect(demoProposal("Send $5,000 to Alice in Canada.")).toEqual(proposal("$5,000"));
    expect(demoProposal("Send $5,000 to Alice")).toBeNull();
  });
});

const config = { agentId: "fake", agentAliasId: "fake", region: "us-east-1", key: "fake" };
function mockRuntime(rounds: ResponseStream[][]) {
  const inputs: InvokeAgentCommand["input"][] = [];
  const runtime = {
    async send(command: InvokeAgentCommand) {
      inputs.push(command.input);
      const events = rounds[inputs.length - 1] || [];
      return {
        completion: (async function* () {
          yield* events;
        })(),
      };
    },
  } as unknown as BedrockAgentRuntimeClient;
  return { runtime, inputs };
}
function control(actionGroup = "TransferCompliance"): ResponseStream {
  return {
    returnControl: {
      invocationId: "test-invocation",
      invocationInputs: [
        {
          functionInvocationInput: {
            actionGroup,
            function: "evaluate_transfer",
            parameters: [
              { name: "amount", value: "750" },
              { name: "destination_country", value: "SOM" },
              { name: "recipient", value: "Alex" },
            ],
          },
        },
      ],
    },
  };
}

describe("Bedrock Return of Control (mocked)", () => {
  test("returns a policy rejection as a normal AWS function result", async () => {
    const { runtime, inputs } = mockRuntime([
      [control()],
      [{ chunk: { bytes: new TextEncoder().encode("Approved anyway") } }],
    ]);
    const result = await runBedrock(config, "test-session", "Evaluate the sample.", runtime);
    expect(result.interrupted).toBe(false);
    expect(result.evaluations[0]?.decision).toBe("BLOCKED_RESTRICTED_COUNTRY");
    const followup = inputs[1]?.sessionState;
    expect(followup?.invocationId).toBe("test-invocation");
    expect(
      followup?.returnControlInvocationResults?.[0]?.functionResult?.responseBody?.TEXT?.body,
    ).toContain("BLOCKED_RESTRICTED_COUNTRY");
    expect(
      followup?.returnControlInvocationResults?.[0]?.functionResult?.responseState,
    ).toBeUndefined();
    expect(inputs[1]?.inputText).toBeUndefined();
  });
  test("rejects unknown actions and bounds return-control rounds", async () => {
    const unexpected = mockRuntime([[control("Unexpected")]]);
    expect(await runBedrock(config, "test-session", "Check", unexpected.runtime)).toEqual({
      text: "",
      evaluations: [],
      interrupted: true,
    });
    const repeat = mockRuntime(Array.from({ length: 5 }, () => [control()]));
    const result = await runBedrock(config, "test-session", "Check", repeat.runtime);
    expect(repeat.inputs).toHaveLength(3);
    expect(result.interrupted).toBe(true);
    expect(result.evaluations).toHaveLength(3);
  });
});
