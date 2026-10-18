import { z } from "zod";
import { json, readJson, route } from "@/lib/http/route";
import { getSettings, updateSettings } from "@/modules/settings/settings.service";
import { settingsInputSchema } from "@/modules/settings/settings.types";

export const dynamic = "force-dynamic";

const updateSchema = z
  .object({ settings: settingsInputSchema, nextInvoiceNumber: z.number().int().min(1).max(999_999_999).optional() })
  .strict();

export const GET = route(async () => json({ settings: await getSettings() }));

export const PUT = route(async (request: Request) => {
  const body = await readJson(request, updateSchema);
  return json({ settings: await updateSettings(body.settings, body.nextInvoiceNumber) });
});
