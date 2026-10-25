/* ============================================================
   REGALE · game.js – drei gleiche Waren räumen sich weg
   Regeln + Löser: ../assets/sortieren/engine.js (regal*)
   Neu gegenüber Ordnungsliebe: Drag & Drop, Combo, Kisten, Zeitlevel
   ============================================================ */
import { sortierspiel } from "./assets/sortieren/rahmen.js";
import { regalStart, regalZuege, regalZugGrund, regalZu } from "./assets/sortieren/engine.js";
import { ware, kiste, WAREN_NAMEN } from "./assets/sortieren/symbole.js";
import { bewegungReduziert } from "./assets/ui.js";
import { LEVELS } from "./levels.js";

const COMBO_MS = 5000;
const name = (x) => WAREN_NAMEN[x % WAREN_NAMEN.length];
const kisteRest = (z, s) => (z.zu[s] || 0) - z.g;
const dreierWort = (n) => (n === 1 ? "Dreier" : "Dreier");

function grundText(z, a, x, b, grund) {
  switch (grund) {
    case "kiste-von":
    case "kiste": {
      const s = grund === "kiste" ? b : a;
      const n = kisteRest(z, s);
      return `Fach ${s + 1} steckt noch in einer Kiste – räume erst ${n} weitere ${dreierWort(n)} ab, dann geht sie auf.`;
    }
    case "voll":
      return `Fach ${b + 1} ist voll – vorne passen nur drei Waren. Räume dort erst einen Dreier ab.`;
    case "weg":
      return `${name(x)} steht nicht mehr in Fach ${a + 1}.`;
    default:
      return "";
  }
}

/* ---------- Combo: Dreier kurz hintereinander ---------- */
let combo = { n: 0, zeit: 0, best: 0 };
let aufgegangen = new Set(); // Fächer, die gerade aufgingen bzw. geräumt wurden (Blitz)

const api = sortierspiel({
  spiel: "regale",
  name: "Regale",
  levels: LEVELS,
  regeln: regalZuege,
  start: regalStart,
  kapitel: ["Tante-Emma-Laden", "Wochenmarkt", "Supermarkt", "Großmarkt", "Zentrallager"],
  migration: { welt: "regale" },
  markierung: (l) => (l.zeit ? { zeichen: "⏱", text: `Zeitlevel, ${l.zeit} Sekunden` } : null),
  titelZusatz: (l) => (l.zeit ? ` · Zeitlevel ${l.zeit} s` : ""),
  siegTitel: "REGALE LEER!",

  beimStart() {
    combo = { n: 0, zeit: 0, best: 0 };
    aufgegangen = new Set();
  },
  merken: () => ({ ...combo }),
  zurueck(extra) {
    if (extra) combo = { ...extra, zeit: 0 };
    aufgegangen = new Set();
  },
  nachZug(vorher, nachher, [a, , b]) {
    aufgegangen = new Set();
    const neu = nachher.g - vorher.g;
    if (neu > 0) {
      const jetzt = performance.now();
      combo.n = combo.zeit && jetzt - combo.zeit <= COMBO_MS ? combo.n + neu : neu;
      combo.zeit = jetzt;
      combo.best = Math.max(combo.best, combo.n);
      if (nachher.f[b].length === 0) aufgegangen.add(b);
      if (nachher.f[a].length === 0 || nachher.i[a] !== vorher.i[a]) aufgegangen.add(a);
    }
    for (let s = 0; s < nachher.f.length; s++)
      if (regalZu(vorher, s) && !regalZu(nachher, s)) aufgegangen.add(s);
  },
  siegInfo: () => (combo.best >= 2 ? [`Beste Combo: ×${combo.best}`] : []),

  einfuehrung(l, ausHilfe) {
    const zeit = l.zeit
      ? ` Zeitlevel: Du hast ${l.zeit} Sekunden – die Uhr startet mit dem Knopf unten.`
      : "";
    const kisten =
      l.zu && Object.keys(l.zu).length
        ? " Fächer in einer Kiste gehen erst auf, wenn so viele Dreier geräumt sind, wie auf der Kiste stehen."
        : "";
    if (ausHilfe)
      return {
        titel: "So geht's",
        text: `Zieh eine Ware in ein anderes Fach (oder tippe sie an und dann das Fach). Drei gleiche in einem Fach räumen sich weg. Ist ein Fach vorne leer, rückt die nächste Reihe nach. Mehrere Dreier innerhalb von 5 Sekunden geben eine Combo.${kisten}${zeit}`,
      };
    if (l.n === 1)
      return {
        titel: "Willkommen im Laden!",
        text: "Zieh eine Ware mit Maus oder Finger in ein anderes Fach – oder tippe sie an und dann das Ziel-Fach. Stehen drei gleiche Waren in einem Fach, räumen sie sich weg. Dahinter wartende Reihen schimmern durch und rücken nach. Räum alles leer!",
      };
    if (l.n === 10)
      return {
        titel: "Erstes Zeitlevel!",
        text: `Diesmal läuft die Uhr rückwärts: ${l.zeit} Sekunden. Sie startet erst, wenn du auf den Knopf drückst – schau dir das Regal also in Ruhe an. Ein Tab im Hintergrund hält die Uhr an.`,
      };
    if (l.n === 12)
      return {
        titel: "Neu: Kisten",
        text: "Ein Fach steckt in einer verschlossenen Kiste. Die Zahl darauf sagt, wie viele Dreier du noch abräumen musst – dann springt sie auf und das Fach ist frei.",
      };
    if (l.zeit)
      return {
        titel: `Zeitlevel · ${l.zeit} Sekunden`,
        text: "Die Uhr startet, sobald du bereit bist.",
      };
    if (l.n === 30)
      return {
        titel: "Zwei Kisten",
        text: "Ab jetzt stehen zwei Kisten im Lager – die zweite braucht mehr Dreier.",
      };
    return null;
  },

  zugText: ([a, x, b]) => `${name(x)} aus Fach ${a + 1} in Fach ${b + 1}`,
  zeichnen,
});

/* ============================================================
   Bedienung: Antippen ODER Ziehen (Pointer-Events)
   ============================================================ */
function ware_waehlen(s, x) {
  api.auswahl = { s, x };
  api.meldung("");
  api.ansagen(`${name(x)} aus Fach ${s + 1} gewählt. Jetzt das Ziel-Fach wählen.`);
  api.neuZeichnen();
}

function versuchen(a, x, b) {
  const grund = regalZugGrund(api.zustand, a, x, b);
  api.auswahl = null;
  if (grund === "gleich") return api.neuZeichnen();
  if (grund) {
    api.neuZeichnen();
    return api.fehler(
      grundText(api.zustand, a, x, b, grund),
      api.brett.querySelector(`.fach[data-s="${b}"]`),
    );
  }
  api.ziehen([a, x, b]);
}

function tippen(s, x) {
  if (api.fertig) return;
  const z = api.zustand;
  if (regalZu(z, s)) {
    api.auswahl = null;
    api.neuZeichnen();
    return api.fehler(
      grundText(z, s, x, s, "kiste-von"),
      api.brett.querySelector(`.fach[data-s="${s}"]`),
    );
  }
  const w = api.auswahl;
  if (!w) {
    if (x === null)
      return api.meldung("Tippe zuerst eine Ware an – oder zieh sie direkt in ein Fach.");
    return ware_waehlen(s, x);
  }
  if (w.s === s) {
    // im selben Fach: andere Ware wählen bzw. abwählen
    if (x === null || x === w.x) {
      api.auswahl = null;
      return api.neuZeichnen();
    }
    return ware_waehlen(s, x);
  }
  versuchen(w.s, w.x, s);
}

let zug = null; // laufendes Ziehen
let klickSperre = false;

api.brett.addEventListener("pointerdown", (e) => {
  const p = e.target.closest(".platz[data-x]");
  if (!p || api.fertig || e.button > 0) return;
  zug = {
    p,
    s: Number(p.closest(".fach").dataset.s),
    x: Number(p.dataset.x),
    x0: e.clientX,
    y0: e.clientY,
    aktiv: false,
    geist: null,
    id: e.pointerId,
  };
});

window.addEventListener("pointermove", (e) => {
  if (!zug || e.pointerId !== zug.id) return;
  if (!zug.aktiv) {
    if (Math.hypot(e.clientX - zug.x0, e.clientY - zug.y0) < 6) return;
    if (regalZu(api.zustand, zug.s)) return (zug = null);
    zug.aktiv = true;
    api.auswahl = null;
    api.neuZeichnen();
    zug.p = api.brett.querySelector(`.fach[data-s="${zug.s}"] .platz[data-x="${zug.x}"]`);
    zug.p?.classList.add("gezogen");
    zug.geist = document.createElement("div");
    zug.geist.className = "zieh-geist";
    zug.geist.innerHTML = ware(zug.x);
    document.body.append(zug.geist);
  }
  e.preventDefault();
  zug.geist.style.left = `${e.clientX}px`;
  zug.geist.style.top = `${e.clientY}px`;
  const ziel = fachUnter(e);
  for (const f of api.brett.querySelectorAll(".fach.ziel-ok"))
    if (f !== ziel) f.classList.remove("ziel-ok");
  if (ziel && !regalZugGrund(api.zustand, zug.s, zug.x, Number(ziel.dataset.s)))
    ziel.classList.add("ziel-ok");
});

function fachUnter(e) {
  zug.geist && (zug.geist.hidden = true);
  const f = document.elementFromPoint(e.clientX, e.clientY)?.closest(".fach");
  zug.geist && (zug.geist.hidden = false);
  return f && api.brett.contains(f) ? f : null;
}

function zugEnde(e, abbrechen = false) {
  if (!zug || e.pointerId !== zug.id) return;
  const z = zug;
  zug = null;
  if (!z.aktiv) return;
  klickSperre = true;
  setTimeout(() => (klickSperre = false), 0);
  const ziel = abbrechen
    ? null
    : (() => {
        zug = z;
        const f = fachUnter(e);
        zug = null;
        return f;
      })();
  z.geist.remove();
  if (!ziel) return api.neuZeichnen();
  versuchen(z.s, z.x, Number(ziel.dataset.s));
}
window.addEventListener("pointerup", (e) => zugEnde(e));
window.addEventListener("pointercancel", (e) => zugEnde(e, true));

api.brett.addEventListener("click", (e) => {
  if (klickSperre) return;
  const fach = e.target.closest(".fach");
  if (!fach) return;
  const p = e.target.closest(".platz");
  tippen(Number(fach.dataset.s), p?.dataset.x !== undefined ? Number(p.dataset.x) : null);
});

/* ---------- Zeichnen ---------- */
let comboAnzeige = 0;

function zeichnen(api, letzterZug) {
  const z = api.zustand;
  const t = api.tipp;
  const fokus = document.activeElement?.closest?.(".platz")?.dataset.fokus;
  const teile = [];
  for (let s = 0; s < z.f.length; s++) {
    const fach = document.createElement("div");
    fach.className = "fach";
    fach.dataset.s = s;
    const zu = regalZu(z, s);
    if (zu) fach.classList.add("zu");
    if (aufgegangen.has(s) && letzterZug && !bewegungReduziert()) fach.classList.add("auf");
    if (t && t[2] === s) fach.classList.add("tipp-nach");

    // Nächste Reihe schimmert durch
    const hinten = document.createElement("div");
    hinten.className = "fach-hinten";
    hinten.setAttribute("aria-hidden", "true");
    const naechste = z.r[s][z.i[s]];
    if (naechste && !zu)
      hinten.innerHTML = naechste.map((x) => `<span class="ware">${ware(x)}</span>`).join("");

    const vorne = document.createElement("div");
    vorne.className = "fach-vorne";
    for (let p = 0; p < 3; p++) {
      const x = z.f[s][p];
      const b = document.createElement("button");
      b.type = "button";
      b.className = "platz";
      b.dataset.fokus = `${s}-${p}`;
      if (x !== undefined) {
        b.dataset.x = x;
        b.innerHTML = `<span class="ware">${ware(x)}</span>`;
        if (api.auswahl && api.auswahl.s === s && api.auswahl.x === x && z.f[s].indexOf(x) === p)
          b.classList.add("gewaehlt");
        if (t && t[0] === s && t[1] === x && z.f[s].indexOf(x) === p) b.classList.add("tipp-von");
        if (letzterZug && letzterZug[2] === s && letzterZug[1] === x) b.classList.add("neu");
        b.setAttribute(
          "aria-label",
          `${name(x)}, Fach ${s + 1}${b.classList.contains("gewaehlt") ? ", gewählt" : ""}`,
        );
      } else {
        b.setAttribute("aria-label", `Freier Platz in Fach ${s + 1}`);
      }
      if (zu) b.tabIndex = -1;
      vorne.append(b);
    }

    const rest = document.createElement("div");
    rest.className = "fach-rest";
    const reihen = z.r[s].length - z.i[s];
    rest.textContent = reihen ? `+${reihen} Reihe${reihen === 1 ? "" : "n"}` : "";

    fach.append(hinten, vorne, rest);
    if (zu) {
      const k = document.createElement("button");
      k.type = "button";
      k.className = "kiste";
      const n = kisteRest(z, s);
      k.innerHTML = kiste(n);
      k.setAttribute(
        "aria-label",
        `Fach ${s + 1} in einer Kiste: noch ${n} ${dreierWort(n)} abräumen`,
      );
      fach.append(k);
    }
    teile.push(fach);
  }

  // Combo-Banner
  const banner = document.createElement("div");
  banner.className = "combo";
  banner.setAttribute("aria-hidden", "true");
  if (combo.n >= 2 && combo.zeit && performance.now() - combo.zeit <= COMBO_MS) {
    banner.textContent = `COMBO ×${combo.n}`;
    if (letzterZug && combo.n !== comboAnzeige) {
      banner.classList.add("neu");
      api.ansagen(`Combo mal ${combo.n}!`);
    }
    comboAnzeige = combo.n;
  } else comboAnzeige = 0;
  teile.push(banner);

  api.brett.replaceChildren(...teile);
  if (fokus) api.brett.querySelector(`[data-fokus="${fokus}"]`)?.focus({ preventScroll: true });
}

// Combo-Banner nach Ablauf ausblenden
setInterval(() => {
  const b = api.brett.querySelector(".combo");
  if (b && b.textContent && performance.now() - combo.zeit > COMBO_MS) b.textContent = "";
}, 500);
