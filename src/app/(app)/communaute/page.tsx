import type { Metadata } from "next";
import Link from "next/link";
import { Calendar, Heart, MessageCircle } from "lucide-react";
import { requireUser } from "@/lib/session";
import { feed, groups, upcomingEvents } from "@/application/community.service";
import { PageHeader } from "@/ui/Page";
import { Card, CardBody, CardHeader } from "@/ui/Card";
import { ApiForm } from "@/ui/ApiForm";
import { ActionButton } from "@/ui/ActionButton";
import { Select, Textarea, Input } from "@/ui/Field";
import { Badge, DemoBadge } from "@/ui/Badge";
import { EmptyState } from "@/ui/Feedback";
import { ButtonLink } from "@/ui/Button";

export const metadata: Metadata = { title: "Communauté" };

export default async function CommunityPage({ searchParams }: { searchParams: Promise<{ groupe?: string; abonnements?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser("/communaute");
  const [posts, gs, events] = await Promise.all([feed(user.id, { groupSlug: sp.groupe, following: sp.abonnements === "1" }), groups(user.id), upcomingEvents()]);
  const myGroups = gs.filter((g) => g.isMember);
  return (
    <>
      <PageHeader title="Communauté" description="Partagez vos retours d'expérience. Contenus modérés : signalez tout contenu inapproprié." actions={<ButtonLink href="/communaute/mentorat" variant="outline">Mentorat</ButtonLink>} />
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <Card><CardBody>
            <ApiForm action="/api/v1/community/post" submitLabel="Publier" successMessage="Publication en ligne." className="space-y-2">
              <Textarea name="body" placeholder="Partagez une ressource, une question, un retour d'expérience…" aria-label="Publication" />
              <Select name="groupId" aria-label="Groupe"><option value="">Fil général</option>{myGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</Select>
            </ApiForm>
          </CardBody></Card>
          <nav className="flex flex-wrap gap-2 text-sm"><Link href="/communaute" className={`rounded-full px-3 py-1 ${!sp.groupe && !sp.abonnements ? "bg-bordeaux-700 text-white" : "border border-line bg-white"}`}>Tout</Link><Link href="?abonnements=1" className={`rounded-full px-3 py-1 ${sp.abonnements ? "bg-bordeaux-700 text-white" : "border border-line bg-white"}`}>Mes abonnements</Link>{gs.map((g) => <Link key={g.id} href={`?groupe=${g.slug}`} className={`rounded-full px-3 py-1 ${sp.groupe === g.slug ? "bg-bordeaux-700 text-white" : "border border-line bg-white"}`}>{g.name}</Link>)}</nav>
          {posts.length === 0 ? <EmptyState title="Aucune publication" /> : posts.map((p) => {
            const liked = p.reactions.some((r) => r.userId === user.id);
            return (
              <Card key={p.id}><CardBody className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div><p className="font-semibold">{p.author.expertProfile ? <Link href={`/experts/${p.author.expertProfile.slug}`} className="hover:underline">{p.author.firstName} {p.author.lastName}</Link> : `${p.author.firstName} ${p.author.lastName}`}</p><p className="text-xs text-slate">{p.author.expertProfile?.headline} · {p.createdAt.toLocaleDateString("fr-FR")}{p.group && <> · <Badge>{p.group.name}</Badge></>}</p></div>
                  {p.author.id !== user.id && <ActionButton action="/api/v1/community/follow" body={{ userId: p.author.id }} variant="ghost" successMessage={null}>Suivre / ne plus suivre</ActionButton>}
                </div>
                <p className="whitespace-pre-line text-sm">{p.body}</p>
                <div className="flex items-center gap-3 text-sm">
                  <ActionButton action="/api/v1/community/react" body={{ postId: p.id }} variant="ghost" successMessage={null}><Heart className={`h-4 w-4 ${liked ? "fill-orange-600 text-orange-600" : ""}`} /> {p.reactions.length}</ActionButton>
                  <span className="flex items-center gap-1 text-slate"><MessageCircle className="h-4 w-4" />{p.comments.length}</span>
                  <ActionButton action="/api/v1/community/report" body={{ targetType: "POST", targetId: p.id }} prompt={{ key: "reason", label: "Motif du signalement", required: true }} variant="ghost" successMessage="Signalement transmis aux modérateurs.">Signaler</ActionButton>
                </div>
                {p.comments.length > 0 && <ul className="space-y-1 rounded-xl bg-mist p-3 text-sm">{p.comments.map((c) => <li key={c.id}><strong>{c.author.firstName} {c.author.lastName}</strong> : {c.body}</li>)}</ul>}
                <ApiForm action="/api/v1/community/comment" submitLabel="Commenter" successMessage={null} transform={(d) => ({ ...d, postId: p.id })}><Input name="body" placeholder="Votre commentaire" aria-label="Commentaire" /></ApiForm>
              </CardBody></Card>
            );
          })}
        </div>
        <aside className="space-y-6">
          <Card><CardHeader title="Groupes thématiques" /><CardBody className="space-y-2 text-sm">{gs.map((g) => <div key={g.id} className="flex items-center justify-between gap-2"><span><strong>{g.name}</strong><br /><span className="text-xs text-slate">{g._count.members} membre(s)</span></span><ActionButton action="/api/v1/community/group" body={{ groupId: g.id }} variant={g.isMember ? "ghost" : "outline"} successMessage={g.isMember ? "Groupe quitté." : "Bienvenue dans le groupe."}>{g.isMember ? "Quitter" : "Rejoindre"}</ActionButton></div>)}</CardBody></Card>
          <Card><CardHeader title="Événements" /><CardBody className="space-y-2 text-sm">{events.length === 0 ? <p className="text-slate">Aucun événement à venir.</p> : events.map((e) => <div key={e.id}><p className="flex items-center gap-2 font-semibold"><Calendar className="h-4 w-4 text-orange-600" />{e.title} <DemoBadge show={e.isDemo} /></p><p className="text-xs text-slate">{e.startsAt.toLocaleString("fr-FR")} · {e.location}</p></div>)}</CardBody></Card>
        </aside>
      </div>
    </>
  );
}
