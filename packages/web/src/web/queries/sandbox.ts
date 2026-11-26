import { orpc } from "../lib/api";

export const sandboxConfig = orpc.sandbox.config.queryOptions({ staleTime: 60_000 });
export const createSession = orpc.sandbox.start.mutationOptions();
export const submitMessage = (token: string) =>
  orpc.sandbox.chat.mutationOptions({ context: { sandboxToken: token } });
export const sessionHistory = (token: string) =>
  orpc.sandbox.history.queryOptions({
    context: { sandboxToken: token },
    queryKey: ["sandbox-history", token],
    enabled: Boolean(token),
    staleTime: 60_000,
    retry: false,
  });
