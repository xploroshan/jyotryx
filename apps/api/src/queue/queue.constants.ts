// Queue name constants live in a standalone file so processors and
// consumers can import them without creating a cycle with `queue.module.ts`
// (which itself imports the processor classes). When the constants lived
// alongside the module, the classic circular-import pattern meant the
// `@Processor(REPORT_QUEUE)` decorator could evaluate before
// `queue.module.ts` finished initialising its `export const` bindings,
// so the decorator received `undefined` and BullExplorer later threw
// `Queue name must be provided` at app startup.

export const REPORT_QUEUE = 'report-generation';
export const PALMISTRY_QUEUE = 'palmistry-analysis';
