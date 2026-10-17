/**
 * Carte géographique en tuiles (une tuile par pays, positions approximatives) :
 * intensité séquentielle sur une seule teinte (bordeaux), valeur affichée dans la tuile.
 */
const POS: Record<string, [number, number]> = {
  MA: [1, 3], DZ: [1, 4], TN: [1, 5], LY: [2, 6], EG: [2, 7],
  MR: [2, 2], ML: [3, 3], NE: [3, 5], TD: [3, 6], SD: [3, 7],
  SN: [3, 1], GM: [4, 1], BF: [4, 3], NG: [4, 5], CF: [4, 6], ET: [4, 8],
  GN: [4, 2], CI: [5, 2], GH: [5, 3], TG: [5, 4], BJ: [6, 4], CM: [5, 5], SS: [5, 7], SO: [5, 9],
  LR: [6, 2], GA: [6, 5], CG: [6, 6], UG: [6, 7], KE: [6, 8],
  CD: [7, 6], RW: [7, 7], TZ: [7, 8], AO: [8, 5], ZM: [8, 6], MW: [8, 7], MZ: [8, 8],
  NA: [9, 5], BW: [9, 6], ZW: [9, 7], MG: [9, 9], ZA: [10, 6],
};

export function AfricaTileMap({ values, format = (v: number) => String(v) }: { values: { code: string; value: number }[]; format?: (v: number) => string }) {
  const map = new Map(values.map((v) => [v.code, v.value]));
  const max = Math.max(1, ...values.map((v) => v.value));
  return (
    <div>
      <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(9, minmax(0, 1fr))" }} role="img" aria-label="Carte de l'Afrique : répartition par pays">
        {Object.entries(POS).map(([code, [r, c]]) => {
          const v = map.get(code) ?? 0;
          const t = v / max;
          return (
            <div key={code} title={`${code} : ${format(v)}`} style={{ gridRow: r, gridColumn: c, background: v ? `rgba(161,58,74,${0.15 + 0.85 * t})` : "#F7F8FA" }} className={`flex aspect-square flex-col items-center justify-center rounded-md border border-line text-[10px] font-semibold ${t > 0.5 ? "text-white" : "text-ink"}`}>
              {code}
              {v > 0 && <span className="text-[9px] font-normal">{format(v)}</span>}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-slate"><span>0</span><div className="h-2 flex-1 rounded" style={{ background: "linear-gradient(90deg, rgba(161,58,74,0.15), rgba(161,58,74,1))" }} /><span>{format(max)}</span></div>
    </div>
  );
}
