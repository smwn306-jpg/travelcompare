import { prisma } from "../../db/prisma.js";

/**
 * Public "hot deals" feed — no search parameters required. Shows whatever
 * active, non-expired deals exist from active providers, cheapest first.
 * This is what powers a homepage section like "דילים חמים עכשיו".
 */
export async function getFeaturedDeals(limit = 20) {
  const deals = await prisma.deal.findMany({
    where: {
      expiresAt: { gt: new Date() },
      provider: { isActive: true },
    },
    include: {
      provider: { select: { name: true, logoUrl: true } },
    },
    orderBy: { price: "asc" },
    take: limit,
  });

  return deals.map((deal: (typeof deals)[number]) => ({
    id: deal.id,
    provider: deal.provider.name,
    providerLogo: deal.provider.logoUrl,
    destination: deal.destination,
    hotelName: deal.hotelName,
    stars: deal.stars,
    price: Number(deal.price),
    originalPrice: deal.originalPrice ? Number(deal.originalPrice) : null,
    boardType: deal.boardType,
    includesFlight: deal.includesFlight,
    nights: deal.nights,
    travelDateStart: deal.travelDateStart,
    travelDateEnd: deal.travelDateEnd,
    flightDepartureTime: deal.flightDepartureTime,
    flightReturnTime: deal.flightReturnTime,
    fetchedAt: deal.fetchedAt,
  }));
}
