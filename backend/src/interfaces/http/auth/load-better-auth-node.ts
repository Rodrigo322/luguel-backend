interface BetterAuthNodeExports {
  toNodeHandler: (auth: unknown) => (request: unknown, response: unknown) => Promise<void> | void;
  fromNodeHeaders: (headers: Record<string, unknown>) => Headers;
}

let betterAuthNodePromise: Promise<BetterAuthNodeExports> | null = null;

export async function loadBetterAuthNode(): Promise<BetterAuthNodeExports> {
  if (!betterAuthNodePromise) {
    betterAuthNodePromise = import("better-auth/node") as Promise<BetterAuthNodeExports>;
  }

  return betterAuthNodePromise;
}
