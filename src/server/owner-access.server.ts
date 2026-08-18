import { requireSession } from "./auth.functions.js";
import { requireActiveRestaurant } from "./subscription.server.js";

export async function requireRestaurantId(): Promise<number> {
  const session = await requireSession();
  if (!session || (session.role !== "owner" && session.role !== "staff")) {
    throw new Error("Not authorized");
  }
  await requireActiveRestaurant(session.restaurantId);
  return session.restaurantId;
}
