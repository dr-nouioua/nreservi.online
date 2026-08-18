import { createServerFn } from "@tanstack/react-start";
import { desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { platformSettings, restaurants, restaurantOwners, restaurantSubscriptions, reservations, areas } from "../../db/schema.js";
import { requireSession } from "./auth.functions.js";
import { hashPassword } from "./crypto.server.js";
import { signSession } from "./session.server.js";
import { setCookie } from "@tanstack/react-start/server";
import { deriveSubscriptionStatus, todayIso } from "./subscription.server.js";

async function requireAdmin() {
  const session = await requireSession();
  if (!session || session.role !== "admin") throw new Error("Not authorized");
  return session;
}

export const listAllRestaurants = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const rows = await db.select().from(restaurants).orderBy(restaurants.id);
  return rows.map((restaurant) => ({
    ...restaurant,
    openingHours: restaurant.openingHours as Record<string, Array<{ open: string; close: string }>>,
  }));
});

export const getPlatformAnalytics = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const allRestaurants = await db.select().from(restaurants);
  const allSubscriptions = await db.select().from(restaurantSubscriptions);
  const allReservations = await db.select().from(reservations);
  const today = todayIso();
  const active = allRestaurants.filter((restaurant) => {
    const periods = allSubscriptions
      .filter((period) => period.restaurantId === restaurant.id)
      .sort((left, right) => right.endDate.localeCompare(left.endDate));
    const current = periods.find((period) => period.startDate <= today && period.endDate >= today) ?? periods[0];
    return deriveSubscriptionStatus({
      restaurantStatus: restaurant.status,
      startDate: current?.startDate,
      endDate: current?.endDate,
      today,
    }).active;
  }).length;
  const pending = allRestaurants.filter((r) => r.status === "pending").length;
  const byRestaurant: Record<string, number> = {};
  for (const r of allReservations) {
    const name = allRestaurants.find((x) => x.id === r.restaurantId)?.name ?? "Unknown";
    byRestaurant[name] = (byRestaurant[name] ?? 0) + 1;
  }
  return {
    totalRestaurants: allRestaurants.length,
    activeRestaurants: active,
    pendingRestaurants: pending,
    totalBookings: allReservations.length,
    byRestaurant,
  };
});

export const approveRestaurant = createServerFn({ method: "POST" })
  .inputValidator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    await db.update(restaurants).set({ status: "active" }).where(eq(restaurants.id, data.id));
    return { success: true };
  });

export const suspendRestaurant = createServerFn({ method: "POST" })
  .inputValidator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    await db.update(restaurants).set({ status: "suspended" }).where(eq(restaurants.id, data.id));
    return { success: true };
  });

export const deleteRestaurant = createServerFn({ method: "POST" })
  .inputValidator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    await db.delete(restaurantOwners).where(eq(restaurantOwners.restaurantId, data.id));
    await db.delete(reservations).where(eq(reservations.restaurantId, data.id));
    await db.delete(areas).where(eq(areas.restaurantId, data.id));
    await db.delete(restaurants).where(eq(restaurants.id, data.id));
    return { success: true };
  });

export const setSubscriptionTier = createServerFn({ method: "POST" })
  .inputValidator((data: { id: number; tier: string }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    await db.update(restaurants).set({ subscriptionTier: data.tier }).where(eq(restaurants.id, data.id));
    return { success: true };
  });

export const getSubscriptions = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const restaurantRows = await db.select().from(restaurants).orderBy(restaurants.name);
  const periods = await db.select().from(restaurantSubscriptions).orderBy(desc(restaurantSubscriptions.endDate));
  const today = todayIso();
  return restaurantRows.map((restaurant) => {
    const history = periods.filter((period) => period.restaurantId === restaurant.id);
    const current = history.find((period) => period.startDate <= today && period.endDate >= today) ?? history[0] ?? null;
    return {
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        status: restaurant.status,
      },
      current,
      history,
      ...deriveSubscriptionStatus({
        restaurantStatus: restaurant.status,
        startDate: current?.startDate,
        endDate: current?.endDate,
        today,
      }),
    };
  });
});

export const createSubscription = createServerFn({ method: "POST" })
  .inputValidator((data: { restaurantId: number; startDate: string; endDate: string }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    if (!data.startDate || !data.endDate || data.endDate < data.startDate) throw new Error("Invalid subscription period");
    const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.id, data.restaurantId));
    if (!restaurant) throw new Error("Restaurant not found");
    const [subscription] = await db.insert(restaurantSubscriptions).values(data).returning();
    if (restaurant.status === "suspended") {
      await db.update(restaurants).set({ status: "active" }).where(eq(restaurants.id, data.restaurantId));
    }
    return subscription;
  });

export const updateSubscription = createServerFn({ method: "POST" })
  .inputValidator((data: { id: number; startDate: string; endDate: string }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    if (!data.startDate || !data.endDate || data.endDate < data.startDate) throw new Error("Invalid subscription period");
    await db.update(restaurantSubscriptions).set({ startDate: data.startDate, endDate: data.endDate }).where(eq(restaurantSubscriptions.id, data.id));
    return { success: true };
  });

export const getAppearanceSettings = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const [settings] = await db.select().from(platformSettings).where(eq(platformSettings.id, 1));
  return { darkModeEnabled: settings?.darkModeEnabled ?? false };
});

export const saveAppearanceSettings = createServerFn({ method: "POST" })
  .inputValidator((data: { darkModeEnabled: boolean }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    await db.insert(platformSettings).values({ id: 1, darkModeEnabled: data.darkModeEnabled }).onConflictDoUpdate({
      target: platformSettings.id,
      set: { darkModeEnabled: data.darkModeEnabled, updatedAt: new Date() },
    });
    return { success: true };
  });

export const onboardRestaurant = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      name: string;
      slug: string;
      city: string;
      cuisine: string;
      address: string;
      contactEmail: string;
      contactPhone: string;
      whatsappNumber: string;
      ownerEmail: string;
      ownerPassword: string;
      ownerName: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const defaultHours = {
      mon: [{ open: "12:00", close: "22:00" }],
      tue: [{ open: "12:00", close: "22:00" }],
      wed: [{ open: "12:00", close: "22:00" }],
      thu: [{ open: "12:00", close: "22:00" }],
      fri: [{ open: "12:00", close: "23:00" }],
      sat: [{ open: "12:00", close: "23:00" }],
      sun: [{ open: "12:00", close: "21:00" }],
    };
    const [restaurant] = await db
      .insert(restaurants)
      .values({
        name: data.name,
        slug: data.slug,
        city: data.city,
        cuisine: data.cuisine,
        address: data.address,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        whatsappNumber: data.whatsappNumber || null,
        status: "active",
        subscriptionTier: "starter",
        openingHours: defaultHours,
      })
      .returning();

    await db.insert(areas).values({ restaurantId: restaurant.id, name: "Main Dining" });

    await db.insert(restaurantOwners).values({
      restaurantId: restaurant.id,
      email: data.ownerEmail,
      passwordHash: hashPassword(data.ownerPassword),
      name: data.ownerName,
    });

    const startDate = todayIso();
    const end = new Date(`${startDate}T00:00:00Z`);
    end.setUTCFullYear(end.getUTCFullYear() + 1);
    end.setUTCDate(end.getUTCDate() - 1);
    await db.insert(restaurantSubscriptions).values({
      restaurantId: restaurant.id,
      startDate,
      endDate: end.toISOString().slice(0, 10),
    });

    return {
      ...restaurant,
      openingHours: restaurant.openingHours as Record<string, Array<{ open: string; close: string }>>,
    };
  });

// Support-login: lets the super-admin impersonate a restaurant's owner dashboard for troubleshooting.
export const impersonateRestaurant = createServerFn({ method: "POST" })
  .inputValidator((data: { restaurantId: number }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    const [owner] = await db.select().from(restaurantOwners).where(eq(restaurantOwners.restaurantId, data.restaurantId));
    if (!owner) throw new Error("No owner account found for this restaurant");
    const token = signSession({
      role: "owner",
      id: owner.id,
      email: owner.email,
      name: `${owner.name} (support session)`,
      restaurantId: owner.restaurantId,
    });
    setCookie("rsv_session", token, { httpOnly: true, path: "/", sameSite: "lax", maxAge: 60 * 60 });
    return { success: true };
  });
