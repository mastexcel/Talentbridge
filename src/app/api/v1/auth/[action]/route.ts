import { NextResponse } from "next/server";
import { z } from "zod";
import { DomainError } from "@/domain/errors";
import { parseBody, route } from "@/infrastructure/http/handler";
import { clearSessionCookie, setSessionCookie } from "@/infrastructure/http/cookies";
import { rateLimiter } from "@/infrastructure/rate-limit";
import { SESSION_COOKIE, acceptInvitation, changePassword, createSession, login, logout, requestPasswordReset, resendVerification, resetPassword, signup, switchOrganization, verifyEmail } from "@/application/auth.service";
import { changePasswordSchema, forgotSchema, loginSchema, resetSchema, signupSchema } from "@/application/schemas";
import { homePathFor } from "@/lib/home";

/** Actions d'authentification (limitées en débit par adresse IP). */
export const POST = route<{ action: string }>({}, async ({ req, user, params, ip }) => {
  // Seuils anti-force-brute par IP (15 min). AUTH_RATE_LIMIT_FACTOR > 1 uniquement pour les tests automatisés.
  const factor = Math.max(1, Number(process.env.AUTH_RATE_LIMIT_FACTOR) || 1);
  const limited = (limit: number) => {
    if (!rateLimiter.hit(`auth:${params.action}:${ip}`, limit * factor, 15 * 60_000).allowed) throw new DomainError("RATE_LIMITED", "Trop de tentatives. Réessayez dans quelques minutes.");
  };
  const meta = { ip, userAgent: req.headers.get("user-agent") };
  switch (params.action) {
    case "signup": {
      limited(10);
      const input = await parseBody(req, signupSchema);
      const r = await signup(input, meta);
      const token = await createSession(r.userId, meta);
      const res = NextResponse.json({ ok: true, redirectUrl: input.accountType === "EXPERT" ? "/espace/profil?bienvenue=1" : input.accountType === "LEARNER" ? "/academy?bienvenue=1" : "/organisation/parametres?bienvenue=1" });
      setSessionCookie(res, token);
      return res;
    }
    case "login": {
      limited(20);
      const input = await parseBody(req, loginSchema);
      const { token } = await login(input.email, input.password, meta);
      const { getUserBySessionToken } = await import("@/application/auth.service");
      const u = await getUserBySessionToken(token);
      const next = req.nextUrl.searchParams.get("suite");
      const res = NextResponse.json({ ok: true, redirectUrl: next && next.startsWith("/") && !next.startsWith("//") ? next : homePathFor(u!) });
      setSessionCookie(res, token);
      return res;
    }
    case "logout": {
      await logout(req.cookies.get(SESSION_COOKIE)?.value);
      const res = NextResponse.json({ ok: true, redirectUrl: "/" });
      clearSessionCookie(res);
      return res;
    }
    case "forgot": {
      limited(5);
      const { email } = await parseBody(req, forgotSchema);
      await requestPasswordReset(email);
      // Réponse identique que le compte existe ou non.
      return { ok: true, message: "Si un compte existe pour cette adresse, un lien vous a été envoyé." };
    }
    case "reset": {
      limited(10);
      const { token, password } = await parseBody(req, resetSchema);
      await resetPassword(token, password);
      return { ok: true, redirectUrl: "/connexion?reinitialise=1" };
    }
    case "verify-email": {
      limited(20);
      const { token } = await parseBody(req, z.object({ token: z.string().min(10) }));
      await verifyEmail(token);
      return { ok: true };
    }
    case "resend-verification":
      if (!user) throw new DomainError("UNAUTHENTICATED", "Connectez-vous.");
      limited(3);
      await resendVerification(user.id);
      return { ok: true };
    case "switch-org": {
      if (!user) throw new DomainError("UNAUTHENTICATED", "Connectez-vous.");
      const { organizationId } = await parseBody(req, z.object({ organizationId: z.string().min(1) }));
      await switchOrganization(user, organizationId);
      return { ok: true, redirectUrl: "/organisation" };
    }
    case "accept-invitation": {
      if (!user) throw new DomainError("UNAUTHENTICATED", "Connectez-vous.");
      const { token } = await parseBody(req, z.object({ token: z.string().min(10) }));
      const orgId = await acceptInvitation(token, user);
      await switchOrganization({ ...user, memberships: [...user.memberships, { organizationId: orgId } as never] }, orgId);
      return { ok: true, redirectUrl: "/organisation" };
    }
    case "change-password": {
      if (!user) throw new DomainError("UNAUTHENTICATED", "Connectez-vous.");
      limited(10);
      const input = await parseBody(req, changePasswordSchema);
      await changePassword(user.id, input.currentPassword, input.newPassword, user.sessionId);
      return { ok: true };
    }
    default:
      throw new DomainError("NOT_FOUND", "Action inconnue.");
  }
});
