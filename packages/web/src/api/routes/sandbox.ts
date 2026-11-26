import { timingSafeEqual, createHash, randomBytes } from "node:crypto";
import { ORPCError } from "@orpc/server";
import { asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { base } from "../__core/app";
import { db } from "../database";
import { audits, messages, sessions } from "../database/schema";
import { bedrockConfig, runBedrock } from "../services/bedrock";
import { demoProposal, evaluate, type Evaluation } from "../services/policy";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const scoped = base.use(async ({ context, next }) => {
  const header = context.headers.get("authorization");
  if (!header || !/^Bearer [a-f0-9]{64}$/.test(header)) throw new ORPCError("UNAUTHORIZED");
  const [session] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.tokenHash, digest(header.slice(7))))
    .limit(1);
  if (!session) throw new ORPCError("UNAUTHORIZED");
  return next({ context: { sessionId: session.id } });
});

async function snapshot(sessionId: string) {
  const [conversation, events] = await Promise.all([
    db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(asc(messages.createdAt))
      .limit(200),
    db
      .select()
      .from(audits)
      .where(eq(audits.sessionId, sessionId))
      .orderBy(desc(audits.createdAt))
      .limit(300),
  ]);
  return { sessionId, conversation, events };
}

const running = new Set<string>();
let lastAgentStart = 0;
export const sandbox = {
  config: base.handler(() => ({ bedrockAvailable: Boolean(bedrockConfig()) })),
  start: base.handler(async () => {
    const token = randomBytes(32).toString("hex");
    const sessionId = crypto.randomUUID();
    await db
      .insert(sessions)
      .values({ id: sessionId, tokenHash: digest(token), createdAt: Date.now() });
    return { token };
  }),
  history: scoped.handler(({ context }) => snapshot(context.sessionId)),
  chat: scoped
    .input(
      z.object({
        message: z.string().trim().min(1).max(600),
        mode: z.enum(["demo", "bedrock"]),
        accessKey: z.string().max(256).optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const { sessionId } = context;
      if (running.has(sessionId))
        throw new ORPCError("CONFLICT", {
          message: "A request is already running in this session.",
        });
      running.add(sessionId);
      try {
        const history = await snapshot(sessionId);
        if (history.conversation.length >= 200)
          throw new ORPCError("BAD_REQUEST", {
            message: "This session is full. Start a new session to continue.",
          });
        let evaluations: Evaluation[] = [];
        let reply: string;
        if (input.mode === "bedrock") {
          const config = bedrockConfig();
          if (!config)
            throw new ORPCError("BAD_REQUEST", {
              message: "Bedrock is not configured on this server.",
            });
          if (
            !timingSafeEqual(
              Buffer.from(digest(config.key)),
              Buffer.from(digest(input.accessKey ?? "")),
            )
          )
            throw new ORPCError("FORBIDDEN", { message: "The Bedrock access key is incorrect." });
          if (Date.now() - lastAgentStart < 1500)
            throw new ORPCError("TOO_MANY_REQUESTS", {
              message: "Bedrock is busy. Try again in a moment.",
            });
          lastAgentStart = Date.now();
          const agent = await runBedrock(config, sessionId, input.message);
          evaluations = agent.evaluations;
          if (agent.interrupted)
            reply = evaluations.length
              ? "The Bedrock follow-up was interrupted. The completed server-side checks are recorded below."
              : "Bedrock could not complete this request. Check the agent configuration or switch to demo mode. No transfer was evaluated.";
          else
            reply = evaluations.length
              ? evaluations
                  .map(
                    (e) =>
                      `${e.decision === "APPROVED" ? "Approved (simulation)" : "Blocked"}: ${e.reason}${e.reference ? ` Reference: ${e.reference}.` : ""}`,
                  )
                  .join("\n\n")
              : `No server-side policy decision was recorded.${agent.text.trim() ? `\n\nBedrock reply (unverified): ${agent.text.trim()}` : " Include a USD amount, recipient, and destination."}`;
        } else {
          const proposal = demoProposal(input.message);
          if (proposal) {
            const result = evaluate(proposal);
            evaluations = [result];
            reply = `${result.decision === "APPROVED" ? "Approved (simulation)" : "Blocked"}: ${result.reason}${result.reference ? ` Reference: ${result.reference}.` : ""}`;
          } else {
            reply = /\b(policy|rules|limit|restricted|help)\b/i.test(input.message)
              ? "This sandbox allows positive USD amounts up to $10,000.00, verifies destinations, and blocks Afghanistan (AF) and Somalia (SO) under the sample policy. A recipient is required. Nothing is sent."
              : "I need a USD amount, recipient, and destination to run a policy check. Try: “Send $5,000 to Alice in Canada”.";
          }
        }
        const stamp = Math.max(
          Date.now(),
          (history.conversation.at(-1)?.createdAt ?? 0) + 1,
          (history.events[0]?.createdAt ?? 0) + 1,
        );
        const turns = db.insert(messages).values([
          {
            id: crypto.randomUUID(),
            sessionId,
            role: "user",
            content: input.message,
            createdAt: stamp,
          },
          {
            id: crypto.randomUUID(),
            sessionId,
            role: "assistant",
            content: reply,
            createdAt: stamp + 1,
          },
        ]);
        if (evaluations.length)
          await db.batch([
            turns,
            db
              .insert(audits)
              .values(
                evaluations.map((e, i) => ({
                  ...e,
                  id: crypto.randomUUID(),
                  sessionId,
                  source: input.mode,
                  createdAt: stamp + 1 + i,
                })),
              ),
          ]);
        else await turns;
        return snapshot(sessionId);
      } finally {
        running.delete(sessionId);
      }
    }),
};
