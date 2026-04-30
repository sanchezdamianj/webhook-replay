declare module "zod" {
  // Shim for editor/tsserver resolution issues under pnpm workspace.
  // Runtime + `tsc` build still resolve real `zod`; this only unblocks diagnostics.
  export const z: any;

  // Support `z.infer<typeof schema>` type usage.
  export namespace z {
    export type infer<_T> = any;
  }
}

