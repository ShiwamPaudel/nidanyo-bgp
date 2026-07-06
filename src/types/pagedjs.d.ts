declare module "pagedjs" {
  /** Minimal typings for the bits of paged.js we use. */
  export class Previewer {
    constructor(options?: unknown);
    preview(
      content: string | Node,
      stylesheets?: Array<string | Record<string, string>>,
      renderTo?: Element,
    ): Promise<{ total: number }>;
  }
  export class Handler {
    constructor(chunker: unknown, polisher: unknown, caller: unknown);
  }
  export function registerHandlers(...handlers: unknown[]): void;
}
