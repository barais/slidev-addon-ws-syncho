import type { SharedState } from "@slidev/client/state/shared.ts";
import type { SlidevConfig } from "@slidev/types";



declare module "@slidev/types" {
  export interface SlidevConfig {
    wsSettings?: {
      server?: string;
      updateCursor?: boolean;
    };
  }
}