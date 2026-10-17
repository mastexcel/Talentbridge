import { NextResponse } from "next/server";
import { route } from "@/infrastructure/http/handler";
import { exportMyData } from "@/application/privacy.service";
import { audit } from "@/application/audit.service";

/** Export des données personnelles (droit d'accès / portabilité) au format JSON. */
export const GET = route({ auth: true, rateLimit: { limit: 5, windowMs: 3600_000, key: "user" } }, async ({ user }) => {
  const data = await exportMyData(user!.id);
  await audit({ actorId: user!.id, action: "privacy.export", entityType: "User", entityId: user!.id });
  return new NextResponse(JSON.stringify(data, null, 2), { headers: { "content-type": "application/json", "content-disposition": 'attachment; filename="mes-donnees-talent-bridge.json"' } });
});
