import { parseBody, route } from "@/infrastructure/http/handler";
import { requireActiveOrg } from "@/application/access";
import { createProject } from "@/application/project.service";
import { projectSchema } from "@/application/schemas";

export const POST = route({ auth: true }, async ({ req, user }) => {
  const { organizationId } = requireActiveOrg(user, "projects.manage");
  const p = await createProject(user!, organizationId, await parseBody(req, projectSchema));
  return { project: p, redirectUrl: `/projets/${p.id}` };
});
