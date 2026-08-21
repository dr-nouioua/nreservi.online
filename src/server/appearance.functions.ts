import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { platformSettings } from "../../db/schema.js";

export const getPublicAppearance = createServerFn({ method: "GET" }).handler(async () => {
  const [settings] = await db.select().from(platformSettings).where(eq(platformSettings.id, 1));
  return { darkModeEnabled: settings?.darkModeEnabled ?? false };
});
