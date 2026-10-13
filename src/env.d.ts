/** Injected by vite.config.ts at build time (YYYY-MM-DD). */
declare const __BUILD_DATE__: string;

/** Non-standard but widely available hints used for device tiering. */
interface NetworkInformationLike {
  readonly saveData?: boolean;
  readonly effectiveType?: string;
}

interface NavigatorUADataLike {
  readonly brands: readonly { brand: string; version: string }[];
}

interface Navigator {
  readonly deviceMemory?: number;
  readonly connection?: NetworkInformationLike;
  readonly userAgentData?: NavigatorUADataLike;
}
