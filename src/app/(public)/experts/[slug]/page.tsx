import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Award, BookOpen, Briefcase, Calendar, CheckCircle2, Globe, Languages, MapPin, Star } from "lucide-react";
import { prisma } from "@/infrastructure/db";
import { getPublicProfile, logProfileView } from "@/application/expert.service";
import { currentUser } from "@/lib/session";
import { formatMoney } from "@/domain/money";
import { orgRoleCan, type OrgRole } from "@/domain/permissions";
import { Card, CardBody, CardHeader } from "@/ui/Card";
import { Badge, DemoBadge } from "@/ui/Badge";
import { ButtonLink } from "@/ui/Button";
import { ActionButton } from "@/ui/ActionButton";
import { ApiForm } from "@/ui/ApiForm";
import { Field, Select, Textarea } from "@/ui/Field";
import { InviteToMission } from "@/ui/InviteToMission";
import { Avatar, AVAILABILITY_LABELS, MOBILITY_LABELS, VerificationBadges } from "@/ui/cards";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await prisma.expertProfile.findUnique({ where: { slug }, select: { headline: true, visibility: true, user: { select: { firstName: true, lastName: true } } } });
  return p && p.visibility === "PUBLIC" ? { title: `${p.user.firstName} ${p.user.lastName}`, description: p.headline ?? undefined } : { title: "Profil expert" };
}

const LANG: Record<string, string> = { fr: "Français", en: "Anglais", pt: "Portugais", ar: "Arabe", es: "Espagnol", sw: "Swahili" };

export default async function ExpertProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await currentUser();
  const p = await getPublicProfile(user, slug);
  if (!p) notFound();
  await logProfileView(user, p.id);
  const membership = user?.memberships.find((m) => m.organizationId === user.activeOrgId);
  const canRecruit = !!membership && orgRoleCan(membership.role as OrgRole, "experts.search");
  const [missions, favorite] = await Promise.all([
    canRecruit ? prisma.mission.findMany({ where: { organizationId: membership!.organizationId, status: { in: ["DRAFT", "PUBLISHED", "SHORTLISTING", "INTERVIEWS"] } }, select: { id: true, title: true } }) : [],
    user ? prisma.favorite.findUnique({ where: { userId_expertId: { userId: user.id, expertId: p.id } } }) : null,
  ]);
  const year = (d: Date | null) => (d ? d.getFullYear() : "aujourd'hui");

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card>
            <CardBody className="flex flex-col gap-5 sm:flex-row">
              <Avatar first={p.user.firstName} last={p.user.lastName} photoFileId={p.photoFileId} size={96} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-extrabold">{p.user.firstName} {p.user.lastName}</h1>
                  <DemoBadge show={p.isDemo} />
                </div>
                <p className="mt-1 text-lg text-slate">{p.headline}</p>
                <div className="mt-3 flex flex-wrap gap-1.5"><VerificationBadges badges={p.badges} /></div>
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate">
                  <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{p.city ? `${p.city}, ` : ""}{p.countryCode}</span>
                  <span className="flex items-center gap-1"><Briefcase className="h-4 w-4" />{p.yearsExperience} ans d'expérience</span>
                  <span className="flex items-center gap-1"><Star className="h-4 w-4" />{p.averageRating ? `${p.averageRating.toFixed(1)}/5 (${p.ratingsCount} avis)` : "Pas encore d'évaluation"}</span>
                  <span className="flex items-center gap-1"><CheckCircle2 className="h-4 w-4" />{p.completedMissions} mission(s) terminée(s) sur Talent Bridge</span>
                </div>
              </div>
            </CardBody>
          </Card>

          {p.bio && <Card><CardHeader title="Présentation" /><CardBody><p className="whitespace-pre-line leading-relaxed text-ink">{p.bio}</p></CardBody></Card>}

          <Card>
            <CardHeader title="Domaines et compétences" />
            <CardBody>
              <div className="mb-3 flex flex-wrap gap-2">{p.domains.map((d) => <Badge key={d.domain.slug} tone="orange">{d.domain.nameFr}</Badge>)}</div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {p.skills.map((s) => (
                  <li key={s.skill.slug} className="flex items-center justify-between rounded-xl border border-line px-3 py-2 text-sm">
                    <span>{s.skill.nameFr}</span>
                    <span className="flex gap-0.5" aria-label={`Niveau ${s.level} sur 5`}>{[1, 2, 3, 4, 5].map((i) => <span key={i} className={`h-2 w-4 rounded-full ${i <= s.level ? "bg-olive-600" : "bg-line"}`} />)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-slate">Niveaux déclarés par l'expert{p.badges.some((b) => b.badge.code === "SKILLS_ASSESSED") ? " et évalués par Talent Bridge" : ""}.</p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Expériences" />
            <CardBody>
              <ol className="space-y-4 border-l-2 border-orange-200 pl-5">
                {p.experiences.map((e) => (
                  <li key={e.id}>
                    <p className="font-semibold">{e.title} — {e.employer}</p>
                    <p className="text-xs text-slate">{e.startDate.getFullYear()} – {year(e.endDate)} {e.countryCode ? `· ${e.countryCode}` : ""}</p>
                    {e.description && <p className="mt-1 text-sm text-slate">{e.description}</p>}
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader title="Diplômes et certifications" />
              <CardBody className="space-y-3 text-sm">
                {p.qualifications.map((q) => (
                  <div key={q.id} className="flex items-start gap-2"><BookOpen className="mt-0.5 h-4 w-4 text-bordeaux-700" /><div><p className="font-semibold">{q.title}</p><p className="text-slate">{q.institution}{q.year ? ` · ${q.year}` : ""}</p>{q.status === "VERIFIED" ? <Badge tone="olive">Vérifié</Badge> : <Badge>Déclaré</Badge>}</div></div>
                ))}
                {p.qualifications.length === 0 && <p className="text-slate">Non renseigné.</p>}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Références" description="Coordonnées des référents confidentielles." />
              <CardBody className="space-y-3 text-sm">
                {p.references.map((r) => (
                  <div key={r.id} className="flex items-start gap-2"><Award className="mt-0.5 h-4 w-4 text-orange-600" /><div><p className="font-semibold">{r.missionTitle ?? "Mission"}</p><p className="text-slate">{r.contactOrg}{r.year ? ` · ${r.year}` : ""}</p>{r.status === "VERIFIED" ? <Badge tone="olive">Référence vérifiée</Badge> : <Badge>Déclarée</Badge>}</div></div>
                ))}
                {p.references.length === 0 && <p className="text-slate">Non renseigné.</p>}
              </CardBody>
            </Card>
          </div>

          {p.portfolio.length > 0 && (
            <Card><CardHeader title="Portfolio" /><CardBody className="grid gap-3 sm:grid-cols-2">{p.portfolio.map((x) => <div key={x.id} className="rounded-xl border border-line p-3 text-sm"><p className="font-semibold">{x.title}</p>{x.description && <p className="text-slate">{x.description}</p>}{x.url && <a href={x.url} rel="noopener noreferrer nofollow" target="_blank" className="text-orange-700 hover:underline">Consulter</a>}</div>)}</CardBody></Card>
          )}

          <Card>
            <CardHeader title="Évaluations" description="Uniquement des avis liés à des contrats terminés sur la plateforme." />
            <CardBody className="space-y-4">
              {p.reviews.length === 0 && <p className="text-sm text-slate">Aucune évaluation pour le moment.</p>}
              {p.reviews.map((r) => (
                <div key={r.id} className="rounded-xl bg-mist p-4 text-sm">
                  <p className="font-semibold">{"★".repeat(r.rating)}<span className="text-line">{"★".repeat(5 - r.rating)}</span> · {r.organization.name}</p>
                  {r.comment && <p className="mt-1 text-slate">{r.comment}</p>}
                </div>
              ))}
            </CardBody>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardBody className="space-y-3 text-sm">
              <p className="font-display text-xl font-extrabold">{p.dailyRateMinor && p.rateCurrency ? `${formatMoney(p.dailyRateMinor, p.rateCurrency)} / jour` : "Tarif sur demande"}</p>
              <p className="text-xs text-slate">Tarif indicatif déclaré par l'expert.</p>
              <p className="flex items-center gap-2"><Calendar className="h-4 w-4 text-olive-700" />{AVAILABILITY_LABELS[p.availability]}{p.availableFrom ? ` à partir du ${p.availableFrom.toLocaleDateString("fr-FR")}` : ""}</p>
              <p className="flex items-center gap-2"><Globe className="h-4 w-4 text-olive-700" />Mobilité {MOBILITY_LABELS[p.mobility].toLowerCase()}{p.remoteOk ? " · accepte le travail à distance" : ""}</p>
              {p.mobilityCountries.length > 0 && <p className="text-slate">Zone d'intervention : {p.mobilityCountries.join(", ")}</p>}
              <p className="flex items-center gap-2"><Languages className="h-4 w-4 text-olive-700" />{p.languages.map((l) => LANG[l] ?? l).join(", ")}</p>
              {p.availabilitySlots.length > 0 && <div className="rounded-xl bg-mist p-3 text-xs"><p className="font-semibold">Périodes déjà engagées</p>{p.availabilitySlots.map((s, i) => <p key={i}>{s.startDate.toLocaleDateString("fr-FR")} → {s.endDate.toLocaleDateString("fr-FR")}</p>)}</div>}
            </CardBody>
          </Card>

          {p.isSelf ? (
            <ButtonLink href="/espace/profil" className="w-full">Modifier mon profil</ButtonLink>
          ) : user ? (
            <Card>
              <CardHeader title="Actions" />
              <CardBody className="space-y-3">
                <ActionButton action="/api/v1/me/favorite" body={{ expertId: p.id }} successMessage={favorite ? "Retiré des favoris." : "Ajouté aux favoris."} className="w-full">
                  {favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                </ActionButton>
                <ButtonLink href={`/comparer?ids=${p.id}`} variant="outline" size="sm" className="w-full">Comparer avec d'autres experts</ButtonLink>
                <details className="rounded-xl border border-line p-3">
                  <summary className="cursor-pointer text-sm font-semibold">Envoyer un message / demander un devis</summary>
                  <ApiForm action="/api/v1/messages" submitLabel="Envoyer" successMessage="Message envoyé." className="mt-3 space-y-3">
                    <input type="hidden" name="expertId" value={p.id} />
                    <Field label="Objet" htmlFor="subject" required>
                      <Select id="subject" name="subject" defaultValue="Demande de devis">
                        <option>Demande de devis</option>
                        <option>Proposition de collaboration</option>
                        <option>Question sur votre profil</option>
                      </Select>
                    </Field>
                    <Field label="Message" htmlFor="body" required><Textarea id="body" name="body" placeholder="Décrivez votre besoin, la période et le lieu de la mission…" /></Field>
                  </ApiForm>
                </details>
                {canRecruit && (
                  <details className="rounded-xl border border-line p-3">
                    <summary className="cursor-pointer text-sm font-semibold">Inviter à une mission</summary>
                    {missions.length === 0 ? (
                      <p className="mt-2 text-sm text-slate">Aucune mission ouverte. <Link className="text-orange-700 underline" href="/organisation/missions/nouvelle">Créer une mission</Link></p>
                    ) : (
                      <InviteToMission expertId={p.id} missions={missions} />
                    )}
                  </details>
                )}
                <ActionButton action="/api/v1/community/report" body={{ targetType: "EXPERT", targetId: p.id }} prompt={{ key: "reason", label: "Motif du signalement", required: true }} successMessage="Signalement transmis à la modération." variant="ghost" className="w-full text-xs text-slate">
                  Signaler ce profil
                </ActionButton>
              </CardBody>
            </Card>
          ) : (
            <Card><CardBody className="space-y-3 text-sm"><p>Connectez-vous pour contacter cet expert, l'inviter à une mission ou l'ajouter à vos favoris.</p><ButtonLink href={`/connexion?suite=/experts/${p.slug}`} className="w-full">Se connecter</ButtonLink></CardBody></Card>
          )}
        </aside>
      </div>
    </div>
  );
}
