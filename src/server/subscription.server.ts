import { desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { restaurants, restaurantSubscriptions } from "../../db/schema.js";

export type SubscriptionStatus = "active" | "expiring_soon" | "expired" | "suspended";

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function deriveSubscriptionStatus(input: {
  restaurantStatus: string;
  startDate?: string | null;
  endDate?: string | null;
  today?: string;
}) {
  const today = input.today ?? todayIso();
  if (input.restaurantStatus !== "active") {
    return { status: "suspended" as const, daysRemaining: null, active: false };
  }
  if (!input.startDate || !input.endDate || today < input.startDate) {
    return { status: "suspended" as const, daysRemaining: null, active: false };
  }

  const daysRemaining = Math.ceil(
    (new Date(`${input.endDate}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) /
      86_400_000,
  );
  if (daysRemaining < 0) return { status: "expired" as const, daysRemaining, active: false };
  if (daysRemaining <= 7) return { status: "expiring_soon" as const, daysRemaining, active: true };
  return { status: "active" as const, daysRemaining, active: true };
}

export async function getRestaurantAccess(restaurantId: number) {
  const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.id, restaurantId));
  if (!restaurant) return null;
  const history = await db
    .select()
    .from(restaurantSubscriptions)
    .where(eq(restaurantSubscriptions.restaurantId, restaurantId))
    .orderBy(desc(restaurantSubscriptions.endDate), desc(restaurantSubscriptions.id));
  const today = todayIso();
  const current = history.find((period) => period.startDate <= today && period.endDate >= today) ?? history[0] ?? null;
  return { restaurant, subscription: current, history, ...deriveSubscriptionStatus({
    restaurantStatus: restaurant.status,
    startDate: current?.startDate,
    endDate: current?.endDate,
    today,
  }) };
}

export async function requireActiveRestaurant(restaurantId: number) {
  const access = await getRestaurantAccess(restaurantId);
  if (!access?.active) throw new Error("SUBSCRIPTION_SUSPENDED");
  return access;
}
