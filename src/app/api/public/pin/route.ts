import { NextRequest, NextResponse } from "next/server";
import { getCompanyBySlug, getPublishedEvent } from "@/lib/tenant";
import {
  makeAccessCookieValue,
  pinCookieName,
  verifyPin,
} from "@/lib/pin";

export async function POST(req: NextRequest) {
  const { slug, eventSlug, pin } = (await req.json()) as {
    slug: string;
    eventSlug: string;
    pin: string;
  };

  if (typeof pin !== "string" || !/^\d{4,6}$/.test(pin)) {
    return new NextResponse("Invalid PIN", { status: 401 });
  }

  const company = await getCompanyBySlug(String(slug ?? ""));
  if (!company) return new NextResponse("Not found", { status: 404 });
  const event = await getPublishedEvent(company.id, String(eventSlug ?? ""));
  if (!event) return new NextResponse("Not found", { status: 404 });

  if (!event.pinHash || !(await verifyPin(pin, event.pinHash))) {
    return new NextResponse("Invalid PIN", { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: pinCookieName(event.id),
    value: await makeAccessCookieValue(event.id),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return res;
}
