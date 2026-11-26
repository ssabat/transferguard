import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { AppRouterClient } from "../../api";

const link = new RPCLink<{ sandboxToken?: string }>({
  url: `${window.location.origin}/api/rpc`,
  headers: ({ context }) =>
    context.sandboxToken ? { authorization: `Bearer ${context.sandboxToken}` } : {},
});

/** Direct typed client: await client.ping() */
type WithSandboxContext<T> = T extends import("@orpc/client").Client<
  Record<never, never>,
  infer I,
  infer O,
  infer E
>
  ? import("@orpc/client").Client<{ sandboxToken?: string }, I, O, E>
  : { [K in keyof T]: WithSandboxContext<T[K]> };
export const client: WithSandboxContext<AppRouterClient> = createORPCClient(link);

/** TanStack Query helpers: useQuery(orpc.ping.queryOptions()) */
export const orpc = createTanstackQueryUtils(client);
