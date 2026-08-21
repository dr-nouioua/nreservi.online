import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  reservations,
  tables,
  areas,
  restaurants,
  menuCategories,
  menuItems,
  customers,
  marketingTemplates,
  marketingRules,
  whatsappMessages,
  marketingCampaigns,
  marketingCampaignRecipients,
} from "../../db/schema.js";
import { requireSession } from "./auth.functions.js";
import { randomToken } from "./session.server.js";
import { getRestaurantAccess } from "./subscription.server.js";
import { requireRestaurantId } from "./owner-access.server.js";

export const getOwnerAccess = createServerFn({ method: "GET" }).handler(async () => {
  const session = await requireSession();
  if (!session || (session.role !== "owner" && session.role !== "staff")) throw new Error("Not authorized");
  const access = await getRestaurantAccess(session.restaurantId);
  return {
    session,
    access: access ? {
      active: access.active,
      status: access.status,
      daysRemaining: access.daysRemaining,
      restaurantName: access.restaurant.name,
      startDate: access.subscription?.startDate ?? null,
      endDate: access.subscription?.endDate ?? null,
    } : null,
  };
});

export const getOwnerOverview = createServerFn({ method: "GET" }).handler(async () => {
  const restaurantId = await requireRestaurantId();
  const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.id, restaurantId));
  const areaRows = await db.select().from(areas).where(eq(areas.restaurantId, restaurantId));
  const tableRows = await db.select().from(tables).where(eq(tables.restaurantId, restaurantId));
  return {
    restaurant: restaurant ? {
      ...restaurant,
      openingHours: restaurant.openingHours as Record<string, Array<{ open: string; close: string }>>,
    } : null,
    areas: areaRows,
    tables: tableRows,
  };
});

export const listReservationsForDate = createServerFn({ method: "GET" })
  .inputValidator((data: { date: string }) => data)
  .handler(async ({ data }) => {
    const restaurantId = await requireRestaurantId();
    const rows = await db
      .select()
      .from(reservations)
      .where(and(eq(reservations.restaurantId, restaurantId), eq(reservations.date, data.date)))
      .orderBy(reservations.time);
    return rows;
  });

export const updateReservationStatus = createServerFn({ method: "POST" })
  .inputValidator((data: { id: number; status: string }) => data)
  .handler(async ({ data }) => {
    const restaurantId = await requireRestaurantId();
    const allowedStatuses = new Set(["pending", "confirmed", "seated", "completed", "no_show", "cancelled"]);
    if (!allowedStatuses.has(data.status)) throw new Error("Invalid reservation status");
    await db
      .update(reservations)
      .set({ status: data.status, updatedAt: new Date() })
      .where(and(eq(reservations.id, data.id), eq(reservations.restaurantId, restaurantId)));
    return { success: true };
  });

export const updateReservationNotes = createServerFn({ method: "POST" })
  .inputValidator((data: { id: number; notes: string }) => data)
  .handler(async ({ data }) => {
    const restaurantId = await requireRestaurantId();
    await db
      .update(reservations)
      .set({ notes: data.notes, updatedAt: new Date() })
      .where(and(eq(reservations.id, data.id), eq(reservations.restaurantId, restaurantId)));
    return { success: true };
  });

export const createWalkIn = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      guestName: string;
      guestPhone: string;
      partySize: number;
      date: string;
      time: string;
      tableId: number;
    }) => data,
  )
  .handler(async ({ data }) => {
    const restaurantId = await requireRestaurantId();
    const [table] = await db.select().from(tables).where(and(eq(tables.id, data.tableId), eq(tables.restaurantId, restaurantId)));
    if (!table) throw new Error("Table not found");
    const [reservation] = await db
      .insert(reservations)
      .values({
        restaurantId,
        tableId: data.tableId,
        areaId: table?.areaId,
        guestName: data.guestName,
        guestPhone: data.guestPhone,
        partySize: data.partySize,
        date: data.date,
        time: `${data.time}:00`,
        status: "seated",
        source: "walk_in",
        confirmationCode: randomToken(),
      })
      .returning();
    return reservation;
  });

export const getAnalytics = createServerFn({ method: "GET" }).handler(async () => {
  const restaurantId = await requireRestaurantId();
  const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.id, restaurantId));
  const allRes = await db.select().from(reservations).where(eq(reservations.restaurantId, restaurantId));
  const tableRows = await db.select().from(tables).where(eq(tables.restaurantId, restaurantId));

  const total = allRes.length;
  const noShows = allRes.filter((r) => r.status === "no_show").length;
  const cancelled = allRes.filter((r) => r.status === "cancelled").length;
  const completed = allRes.filter((r) => r.status === "completed" || r.status === "seated").length;

  const byHour: Record<string, number> = {};
  const byDay: Record<string, number> = {};
  const byArea: Record<number, number> = {};
  const customerVisits: Record<string, number> = {};

  for (const r of allRes) {
    const hour = r.time.slice(0, 2);
    byHour[hour] = (byHour[hour] ?? 0) + 1;
    const weekday = new Date(r.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });
    byDay[weekday] = (byDay[weekday] ?? 0) + 1;
    if (r.areaId) byArea[r.areaId] = (byArea[r.areaId] ?? 0) + 1;
    customerVisits[r.guestPhone] = (customerVisits[r.guestPhone] ?? 0) + 1;
  }

  const repeatCustomers = Object.values(customerVisits).filter((v) => v > 1).length;
  const newCustomers = Object.values(customerVisits).filter((v) => v === 1).length;

  const occupancyRate = tableRows.length > 0 ? Math.min(100, Math.round((total / (tableRows.length * 7)) * 100)) : 0;
  const revenueEstimate = completed * Number(restaurant?.avgTicketPrice ?? 0);

  const areaRows = await db.select().from(areas).where(eq(areas.restaurantId, restaurantId));

  return {
    total,
    noShowRate: total ? Math.round((noShows / total) * 100) : 0,
    cancellationRate: total ? Math.round((cancelled / total) * 100) : 0,
    occupancyRate,
    revenueEstimate,
    repeatCustomers,
    newCustomers,
    byHour,
    byDay,
    byArea: Object.fromEntries(
      Object.entries(byArea).map(([areaId, count]) => [
        areaRows.find((a) => a.id === Number(areaId))?.name ?? areaId,
        count,
      ]),
    ),
  };
});

export const updateRestaurantSettings = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      name: string;
      description: string;
      logoUrl: string;
      coverImageUrl: string;
      avgTicketPrice: string;
      openingHours: Record<string, { open: string; close: string }[]>;
    }) => data,
  )
  .handler(async ({ data }) => {
    const restaurantId = await requireRestaurantId();
    await db
      .update(restaurants)
      .set({
        name: data.name,
        description: data.description,
        logoUrl: data.logoUrl || null,
        coverImageUrl: data.coverImageUrl || null,
        avgTicketPrice: data.avgTicketPrice,
        openingHours: data.openingHours,
      })
      .where(eq(restaurants.id, restaurantId));
    return { success: true };
  });

export const addArea = createServerFn({ method: "POST" })
  .inputValidator((data: { name: string }) => data)
  .handler(async ({ data }) => {
    const restaurantId = await requireRestaurantId();
    const [area] = await db.insert(areas).values({ restaurantId, name: data.name }).returning();
    return area;
  });

export const addTable = createServerFn({ method: "POST" })
  .inputValidator((data: { areaId: number; label: string; capacity: number; shape: string }) => data)
  .handler(async ({ data }) => {
    const restaurantId = await requireRestaurantId();
    const [area] = await db.select().from(areas).where(and(eq(areas.id, data.areaId), eq(areas.restaurantId, restaurantId)));
    if (!area) throw new Error("Area not found");
    const [table] = await db
      .insert(tables)
      .values({
        restaurantId,
        areaId: data.areaId,
        label: data.label,
        capacity: data.capacity,
        shape: data.shape,
        posX: Math.floor(Math.random() * 300),
        posY: Math.floor(Math.random() * 200),
      })
      .returning();
    return table;
  });

export const deleteTable = createServerFn({ method: "POST" })
  .inputValidator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    const restaurantId = await requireRestaurantId();
    await db.delete(tables).where(and(eq(tables.id, data.id), eq(tables.restaurantId, restaurantId)));
    return { success: true };
  });

export const getMenu = createServerFn({ method: "GET" }).handler(async () => {
  const restaurantId = await requireRestaurantId();
  const cats = await db.select().from(menuCategories).where(eq(menuCategories.restaurantId, restaurantId));
  const items = await db.select().from(menuItems).where(eq(menuItems.restaurantId, restaurantId));
  return cats.map((c) => ({ ...c, items: items.filter((i) => i.categoryId === c.id) }));
});

export const addMenuCategory = createServerFn({ method: "POST" })
  .inputValidator((data: { name: string }) => data)
  .handler(async ({ data }) => {
    const restaurantId = await requireRestaurantId();
    const [cat] = await db.insert(menuCategories).values({ restaurantId, name: data.name }).returning();
    return cat;
  });

export const addMenuItem = createServerFn({ method: "POST" })
  .inputValidator((data: { categoryId: number; name: string; description: string; price: string; photoUrl?: string }) => data)
  .handler(async ({ data }) => {
    const restaurantId = await requireRestaurantId();
    const [category] = await db.select().from(menuCategories).where(and(
      eq(menuCategories.id, data.categoryId),
      eq(menuCategories.restaurantId, restaurantId),
    ));
    if (!category) throw new Error("Menu category not found");
    const [item] = await db
      .insert(menuItems)
      .values({
        restaurantId,
        categoryId: data.categoryId,
        name: data.name,
        description: data.description,
        price: data.price,
        photoUrl: data.photoUrl || null,
        available: true,
      })
      .returning();
    return item;
  });

export const toggleMenuItemAvailability = createServerFn({ method: "POST" })
  .inputValidator((data: { id: number; available: boolean }) => data)
  .handler(async ({ data }) => {
    const restaurantId = await requireRestaurantId();
    await db
      .update(menuItems)
      .set({ available: data.available })
      .where(and(eq(menuItems.id, data.id), eq(menuItems.restaurantId, restaurantId)));
    return { success: true };
  });

export const getMarketing = createServerFn({ method: "GET" }).handler(async () => {
  const restaurantId = await requireRestaurantId();
  const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.id, restaurantId));
  const reservationRows = await db
    .select({ reservation: reservations, customer: customers })
    .from(reservations)
    .innerJoin(customers, eq(reservations.customerId, customers.id))
    .where(and(eq(reservations.restaurantId, restaurantId), eq(customers.whatsappOptIn, true)))
    .orderBy(desc(reservations.date));
  const audience = new Map<number, { id: number; name: string; phone: string; lastReservationDate: string; reservationCount: number; reservationDates: string[] }>();
  for (const row of reservationRows) {
    const current = audience.get(row.customer.id);
    if (current) {
      current.reservationCount += 1;
      current.reservationDates.push(row.reservation.date);
    }
    else audience.set(row.customer.id, {
      id: row.customer.id,
      name: row.customer.name || row.reservation.guestName,
      phone: row.customer.phone,
      lastReservationDate: row.reservation.date,
      reservationCount: 1,
      reservationDates: [row.reservation.date],
    });
  }
  const campaigns = await db
    .select()
    .from(marketingCampaigns)
    .where(eq(marketingCampaigns.restaurantId, restaurantId))
    .orderBy(desc(marketingCampaigns.createdAt), desc(marketingCampaigns.id));
  return {
    restaurant: restaurant ? {
      id: restaurant.id,
      name: restaurant.name,
      whatsappNumber: restaurant.whatsappNumber,
    } : null,
    customers: Array.from(audience.values()),
    campaigns,
  };
});

export const addMarketingTemplate = createServerFn({ method: "POST" })
  .inputValidator((data: { name: string; body: string }) => data)
  .handler(async ({ data }) => {
    const restaurantId = await requireRestaurantId();
    const [tpl] = await db
      .insert(marketingTemplates)
      .values({ restaurantId, name: data.name, body: data.body })
      .returning();
    return tpl;
  });

export const toggleMarketingRule = createServerFn({ method: "POST" })
  .inputValidator((data: { id: number; active: boolean }) => data)
  .handler(async ({ data }) => {
    const restaurantId = await requireRestaurantId();
    await db
      .update(marketingRules)
      .set({ active: data.active })
      .where(and(eq(marketingRules.id, data.id), eq(marketingRules.restaurantId, restaurantId)));
    return { success: true };
  });

export const addMarketingRule = createServerFn({ method: "POST" })
  .inputValidator((data: { segmentId: number; templateId: number }) => data)
  .handler(async ({ data }) => {
    const restaurantId = await requireRestaurantId();
    const [rule] = await db
      .insert(marketingRules)
      .values({ restaurantId, segmentId: data.segmentId, templateId: data.templateId, active: true })
      .returning();
    return rule;
  });

export const createMarketingCampaign = createServerFn({ method: "POST" })
  .inputValidator((data: {
    name: string;
    audienceKind: string;
    audienceLabel: string;
    message: string;
    customerIds: number[];
  }) => data)
  .handler(async ({ data }) => {
    const restaurantId = await requireRestaurantId();
    const name = data.name.trim();
    const message = data.message.trim();
    if (!name || !message) throw new Error("Campaign name and message are required");
    const uniqueIds = Array.from(new Set(data.customerIds));
    if (!uniqueIds.length) throw new Error("Select at least one customer");
    const allowed = await db
      .select({ customerId: reservations.customerId })
      .from(reservations)
      .where(and(eq(reservations.restaurantId, restaurantId), inArray(reservations.customerId, uniqueIds)));
    const allowedIds = new Set(allowed.map((row) => row.customerId).filter((id): id is number => id !== null));
    if (uniqueIds.some((id) => !allowedIds.has(id))) throw new Error("Customer not available for this restaurant");
    const [campaign] = await db.insert(marketingCampaigns).values({
      restaurantId,
      name,
      audienceKind: data.audienceKind,
      audienceLabel: data.audienceLabel,
      message,
      selectedCount: uniqueIds.length,
      status: "draft",
    }).returning();
    await db.insert(marketingCampaignRecipients).values(uniqueIds.map((customerId) => ({
      campaignId: campaign.id,
      restaurantId,
      customerId,
    })));
    return campaign;
  });

export const logMarketingHandoff = createServerFn({ method: "POST" })
  .inputValidator((data: { campaignId: number; customerId: number; body: string }) => data)
  .handler(async ({ data }) => {
    const restaurantId = await requireRestaurantId();
    const [recipient] = await db.select().from(marketingCampaignRecipients).where(and(
      eq(marketingCampaignRecipients.campaignId, data.campaignId),
      eq(marketingCampaignRecipients.customerId, data.customerId),
      eq(marketingCampaignRecipients.restaurantId, restaurantId),
    ));
    if (!recipient) throw new Error("Campaign recipient not found");
    if (!recipient.preparedAt) {
      await db.update(marketingCampaignRecipients).set({ preparedAt: new Date() }).where(eq(marketingCampaignRecipients.id, recipient.id));
      await db.update(marketingCampaigns).set({
        preparedCount: sql`${marketingCampaigns.preparedCount} + 1`,
        status: "initiated",
      }).where(and(eq(marketingCampaigns.id, data.campaignId), eq(marketingCampaigns.restaurantId, restaurantId)));
      await db.insert(whatsappMessages).values({
        restaurantId,
        customerId: data.customerId,
        direction: "outbound",
        kind: "marketing",
        body: data.body.slice(0, 4000),
        status: "prepared",
      });
    }
    return { success: true };
  });

export const getWhatsappLog = createServerFn({ method: "GET" }).handler(async () => {
  const restaurantId = await requireRestaurantId();
  return db.select().from(whatsappMessages).where(eq(whatsappMessages.restaurantId, restaurantId)).orderBy(sql`created_at desc`).limit(50);
});
