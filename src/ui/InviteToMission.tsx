"use client";
import { useState } from "react";
import { ApiForm } from "./ApiForm";
import { Field, Input, Select } from "./Field";

/** Invitation d'un expert à l'une des missions ouvertes de l'organisation active. */
export function InviteToMission({ expertId, missions }: { expertId: string; missions: { id: string; title: string }[] }) {
  const [missionId, setMissionId] = useState(missions[0]?.id ?? "");
  return (
    <ApiForm action={`/api/v1/missions/${missionId}/invite`} submitLabel="Inviter" successMessage="Invitation envoyée." className="mt-3 space-y-3" transform={(d) => ({ expertId, message: d.message || null })}>
      <Field label="Mission" htmlFor="invite-mission">
        <Select id="invite-mission" value={missionId} onChange={(e) => setMissionId(e.target.value)}>
          {missions.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
        </Select>
      </Field>
      <Field label="Message (facultatif)" htmlFor="invite-msg"><Input id="invite-msg" name="message" /></Field>
    </ApiForm>
  );
}
