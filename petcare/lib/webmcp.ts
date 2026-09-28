"use client";
import { useEffect } from "react";
export function useWebMCP(read: () => unknown, open: () => void) {
  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const tools = [
      {
        name: "read_pet_care_overview",
        title: "Read pet care overview",
        description:
          "Read the signed-in user’s pets and the currently visible occurrences. No data is changed.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: async (input: any) => {
          if (!input || Object.keys(input).length)
            throw Error("No arguments expected.");
          return read();
        },
      },
      {
        name: "start_care_schedule_form",
        title: "Open schedule form",
        description:
          "Open the care schedule form. This does not create a schedule; the user reviews and saves it.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: async (input: any) => {
          if (!input || Object.keys(input).length)
            throw Error("No arguments expected.");
          open();
          return { opened: true, saved: false };
        },
      },
    ];
    for (const tool of tools)
      Promise.resolve(
        context.registerTool(tool, { signal: lifecycle.signal }),
      ).catch(() => {});
    return () => lifecycle.abort();
  }, [read, open]);
}
