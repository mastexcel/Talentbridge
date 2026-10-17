import { parseBody, parseQuery, route } from "@/infrastructure/http/handler";
import { requireActiveOrg } from "@/application/access";
import { createMission, searchMissions } from "@/application/mission.service";
import { missionSchema, missionSearchSchema } from "@/application/schemas";

export const GET = route({}, async ({ req, user }) => searchMissions(user, parseQuery(req, missionSearchSchema)));

/** Création (brouillon) dans l'organisation active. La limite de l'offre s'applique à la publication. */
export const POST = route({ auth: true }, async ({ req, user }) => {
  const { organizationId } = requireActiveOrg(user, "missions.manage");
  const input = await parseBody(req, missionSchema);
  const mission = await createMission(user!, organizationId, input);
  return { mission, redirectUrl: `/organisation/missions/${mission.id}` };
});
