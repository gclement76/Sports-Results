/* =========================================================
   Tableau de bord sport — navigation et affichage
   ========================================================= */

"use strict";


/* ---------- 1. Configuration ---------- */

// Les championnats : clé utilisée dans l'adresse (#ligue1/...) -> réglages
const CHAMPIONNATS = {
  ligue1: {
    code: "FL1",            // code de la compétition dans l'API football-data.org
    nom: "Ligue 1",
    clubSuivi: 533,         // Le Havre AC
    zones: [
      { de: 1, a: 3, libelle: "Ligue des champions", couleur: "#3FD5F5" },
      { de: 4, a: 4, libelle: "Ligue des champions (tour préliminaire)", couleur: "#A78BFA" },
      { de: 5, a: 5, libelle: "Ligue Europa", couleur: "#F59E0B" },
      { de: 6, a: 6, libelle: "Ligue Conférence (barrages)", couleur: "#34D399" }
    ]
  },
  laliga: {
    code: "PD",
    nom: "LaLiga",
    clubSuivi: 86,          // Real Madrid
    zones: [
      { de: 1, a: 4, libelle: "Ligue des champions", couleur: "#3FD5F5" },
      { de: 5, a: 5, libelle: "Ligue Europa", couleur: "#F59E0B" },
      { de: 6, a: 6, libelle: "Ligue Conférence (barrages)", couleur: "#34D399" }
    ]
  },
  ldc: {
    code: "CL",
    nom: "Ligue des champions",
    libelleClassement: "Phase de ligue",
    clubSuivi: 86,          // Real Madrid
    zones: [
      { de: 1, a: 8, libelle: "Huitièmes de finale", couleur: "#34D399" },
      { de: 9, a: 24, libelle: "Barrages", couleur: "#F59E0B" }
    ]
  }
};

// Les clubs affichés sur l'écran "Mes clubs"
const MES_CLUBS = [
  { idEquipe: 533, championnat: "ligue1" },
  { idEquipe: 86, championnat: "laliga" }
];

// Sous-onglets des championnats : clé dans l'adresse -> libellé
const SOUS_ONGLETS = {
  classement: "Classement",
  resultats: "Résultats",
  calendrier: "Calendrier",
  buteurs: "Buteurs"
};

// Sous-onglets de la Formule 1
const SOUS_ONGLETS_F1 = {
  resultats: "Résultats",
  pilotes: "Pilotes",
  "prochain-gp": "Prochain GP"
};

// En passant du foot à la F1 (ou l'inverse), la rubrique équivalente est gardée
const RUBRIQUES_EQUIVALENTES = {
  classement: "pilotes",
  pilotes: "classement",
  calendrier: "prochain-gp",
  "prochain-gp": "calendrier"
};

// Les sous-onglets d'un onglet principal (null pour "Mes clubs")
function sousOngletsDe(onglet) {
  if (CHAMPIONNATS[onglet]) return SOUS_ONGLETS;
  if (onglet === "f1") return SOUS_ONGLETS_F1;
  return null;
}

// Libellé d'un sous-onglet ("Classement" devient "Phase de ligue" pour la Ligue des champions)
function libelleSousOnglet(onglet, cle) {
  const championnat = CHAMPIONNATS[onglet];
  if (cle === "classement" && championnat && championnat.libelleClassement) {
    return championnat.libelleClassement;
  }
  return sousOngletsDe(onglet)[cle];
}


/* ---------- 2. Chargement des données ---------- */

// On garde les données déjà chargées pour ne pas les redemander
const cacheDonnees = {};

// Renvoie une promesse (Promise) contenant { season, standings, matches, scorers }.
// Priorité aux vraies données (data/donnees.js, mises à jour par GitHub Actions),
// sinon les données fictives (data/exemple.js).
function chargerDonnees(code) {
  if (!cacheDonnees[code]) {
    cacheDonnees[code] = new Promise((resoudre, rejeter) => {
      const donnees = (window.DONNEES_API && window.DONNEES_API[code])
        || (window.DONNEES_EXEMPLE && window.DONNEES_EXEMPLE[code]);
      if (donnees) {
        resoudre(donnees);
      } else {
        rejeter(new Error("Données introuvables pour la compétition " + code + "."));
      }
    });
  }
  return cacheDonnees[code];
}

// Charge les trois championnats d'un coup -> { ligue1: ..., laliga: ..., ldc: ... }
async function chargerTousLesChampionnats() {
  const cles = Object.keys(CHAMPIONNATS);
  const resultats = await Promise.all(cles.map((cle) => chargerDonnees(CHAMPIONNATS[cle].code)));
  const toutes = {};
  cles.forEach((cle, i) => { toutes[cle] = resultats[i]; });
  return toutes;
}

// Données F1 (data/f1.js, mises à jour par GitHub Actions)
function chargerF1() {
  if (window.DONNEES_F1) {
    return Promise.resolve(window.DONNEES_F1);
  }
  return Promise.reject(new Error("Données F1 introuvables."));
}


/* ---------- 3. Petits outils ---------- */

// Protège le texte avant de l'insérer dans le HTML (évite qu'un nom casse la page)
function echapper(texte) {
  const remplacements = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(texte).replace(/[&<>"']/g, (c) => remplacements[c]);
}

const formatJourCourt = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" });
const formatJourLong = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const formatHeure = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

// "sam. 17 oct. · 17:00"
function formaterDate(iso) {
  const date = new Date(iso);
  return formatJourCourt.format(date) + " · " + formatHeure.format(date);
}

// "samedi 17 octobre" (avec une majuscule)
function formaterJourLong(iso) {
  const texte = formatJourLong.format(new Date(iso));
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

// Nombre de jours entre aujourd'hui et la date du match (en jours de calendrier)
function joursRestants(iso) {
  const aujourdhui = new Date();
  aujourdhui.setHours(0, 0, 0, 0);
  const jourDuMatch = new Date(iso);
  jourDuMatch.setHours(0, 0, 0, 0);
  return Math.round((jourDuMatch - aujourdhui) / 86400000);
}

// "J-3", ou "Aujourd'hui" le jour du match
function texteCompteARebours(jours) {
  return jours <= 0 ? "Aujourd'hui" : "J-" + jours;
}

// 1 -> "1er", 10 -> "10e"
function formaterPosition(position) {
  return position + (position === 1 ? "<sup>er</sup>" : "<sup>e</sup>");
}

// +5, 0, −3 (avec un vrai signe moins)
function formaterDiff(nombre) {
  if (nombre > 0) return "+" + nombre;
  if (nombre < 0) return "−" + Math.abs(nombre);
  return "0";
}

function estTermine(match) {
  return match.status === "FINISHED";
}

function estAVenir(match) {
  return match.status === "SCHEDULED" || match.status === "TIMED";
}

function trierParDate(matchs) {
  return [...matchs].sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
}

// Range une liste en groupes selon une clé -> [[clé, [éléments]], ...] (ordre conservé)
function grouper(liste, fonctionCle) {
  const groupes = new Map();
  liste.forEach((element) => {
    const cle = fonctionCle(element);
    if (!groupes.has(cle)) groupes.set(cle, []);
    groupes.get(cle).push(element);
  });
  return [...groupes];
}

// Les lignes du classement général
function lignesClassement(donnees) {
  const total = donnees.standings.find((s) => s.type === "TOTAL") || donnees.standings[0];
  return total ? total.table : [];
}

// "V", "N" ou "D" pour l'équipe donnée
function resultatPour(match, idEquipe) {
  const { home, away } = match.score.fullTime;
  const aDomicile = match.homeTeam.id === idEquipe;
  const pour = aDomicile ? home : away;
  const contre = aDomicile ? away : home;
  if (pour > contre) return "V";
  if (pour < contre) return "D";
  return "N";
}

const LIBELLES_RESULTAT = { V: "Victoire", N: "Match nul", D: "Défaite" };

// "Saison 2026-2027"
function texteSaison(donnees) {
  if (!donnees.season || !donnees.season.startDate) return "";
  const annee = new Date(donnees.season.startDate).getFullYear();
  return "Saison " + annee + "-" + (annee + 1);
}


/* ---------- 4. Navigation (adresse #onglet/sous-onglet) ---------- */

// Lit l'adresse et renvoie { onglet, sousOnglet } (valeurs corrigées si besoin)
function lireRoute() {
  const [onglet, sousOnglet] = location.hash.slice(1).split("/");
  const liste = sousOngletsDe(onglet);
  if (!liste) {
    return { onglet: "mes-clubs", sousOnglet: null };
  }
  // Rubrique inconnue : la première de la liste (Classement, ou Résultats pour la F1)
  return { onglet, sousOnglet: liste[sousOnglet] ? sousOnglet : Object.keys(liste)[0] };
}

function cheminDeRoute(route) {
  return route.sousOnglet ? route.onglet + "/" + route.sousOnglet : route.onglet;
}

// Change l'adresse : le navigateur ajoute une entrée à l'historique (bouton retour)
// et déclenche l'évènement "hashchange", qui relance l'affichage
function aller(chemin) {
  if (location.hash !== "#" + chemin) {
    location.hash = chemin;
  }
}

// Numéro de l'affichage en cours : ignore un ancien chargement qui finirait en retard
let numeroAffichage = 0;
let ongletPrecedent = null;

async function afficher() {
  const route = lireRoute();
  const numero = ++numeroAffichage;

  // Adresse invalide ou vide : on la corrige sans créer d'entrée dans l'historique
  const cheminCorrect = cheminDeRoute(route);
  if (location.hash !== "#" + cheminCorrect) {
    history.replaceState(null, "", "#" + cheminCorrect);
  }

  // Thème de couleurs de toute la page
  document.body.dataset.theme = route.onglet;

  // Onglet principal actif
  document.querySelectorAll(".onglet").forEach((bouton) => {
    if (bouton.dataset.onglet === route.onglet) {
      bouton.setAttribute("aria-current", "page");
    } else {
      bouton.removeAttribute("aria-current");
    }
  });

  // Sous-onglets : cachés sur "Mes clubs", recréés à chaque changement d'onglet principal
  const championnat = CHAMPIONNATS[route.onglet];
  const listeSousOnglets = sousOngletsDe(route.onglet);
  const navSousOnglets = document.querySelector(".sous-onglets");
  navSousOnglets.hidden = !listeSousOnglets;
  if (listeSousOnglets && navSousOnglets.dataset.onglet !== route.onglet) {
    navSousOnglets.dataset.onglet = route.onglet;
    navSousOnglets.innerHTML = Object.keys(listeSousOnglets).map((cle) =>
      `<button type="button" class="sous-onglet" data-sous-onglet="${cle}">${echapper(libelleSousOnglet(route.onglet, cle))}</button>`
    ).join("");
  }
  document.querySelectorAll(".sous-onglet").forEach((bouton) => {
    const cle = bouton.dataset.sousOnglet;
    if (cle === route.sousOnglet) {
      bouton.setAttribute("aria-current", "page");
    } else {
      bouton.removeAttribute("aria-current");
    }
  });

  // Nouvel onglet principal : on remonte en haut de la page
  if (ongletPrecedent !== null && ongletPrecedent !== route.onglet) {
    window.scrollTo(0, 0);
  }
  ongletPrecedent = route.onglet;

  // Construction du contenu
  const titre = document.getElementById("titre");
  const sousTitre = document.getElementById("sous-titre");
  let html;
  try {
    if (route.onglet === "f1") {
      const donnees = await chargerF1();
      titre.textContent = "Formule 1";
      sousTitre.textContent = donnees.saison ? "Saison " + donnees.saison : "";
      html = CONSTRUCTEURS_F1[route.sousOnglet](donnees);
    } else if (!championnat) {
      titre.textContent = "Mes clubs";
      sousTitre.textContent = "Le prochain match, la forme et le classement de mes équipes";
      html = construireMesClubs(await chargerTousLesChampionnats());
    } else {
      const donnees = await chargerDonnees(championnat.code);
      titre.textContent = championnat.nom;
      sousTitre.textContent = texteSaison(donnees);
      html = CONSTRUCTEURS[route.sousOnglet](donnees, championnat);
    }
  } catch (erreur) {
    html = '<p class="message">Impossible de charger les données. ' + echapper(erreur.message) + "</p>";
  }

  // Un autre affichage a été demandé entre-temps : on abandonne celui-ci
  if (numero !== numeroAffichage) return;

  document.getElementById("contenu").innerHTML = html;

  // Titre de l'onglet du navigateur
  const morceaux = [titre.textContent];
  if (listeSousOnglets) {
    morceaux.push(libelleSousOnglet(route.onglet, route.sousOnglet));
  }
  document.title = morceaux.join(" · ") + " — Tableau de bord sport";
}


/* ---------- 5. Écran "Mes clubs" ---------- */

function construireMesClubs(toutes) {
  const cartes = MES_CLUBS.map((club) => construireCarteClub(club, toutes)).join("");
  return '<div class="grille-clubs">' + cartes + "</div>";
}

// Tous les matchs d'un club, toutes compétitions confondues, du plus ancien au plus récent
function matchsDuClub(idEquipe, toutes) {
  const matchs = [];
  Object.keys(CHAMPIONNATS).forEach((cle) => {
    toutes[cle].matches.forEach((m) => {
      if (m.homeTeam.id === idEquipe || m.awayTeam.id === idEquipe) {
        matchs.push({ match: m, competition: CHAMPIONNATS[cle].nom });
      }
    });
  });
  return matchs.sort((a, b) => new Date(a.match.utcDate) - new Date(b.match.utcDate));
}

function construireCarteClub(club, toutes) {
  const championnat = CHAMPIONNATS[club.championnat];
  const ligne = lignesClassement(toutes[club.championnat]).find((l) => l.team.id === club.idEquipe);
  const matchs = matchsDuClub(club.idEquipe, toutes);
  const prochain = matchs.find((m) => estAVenir(m.match));
  const cinqDerniers = matchs.filter((m) => estTermine(m.match)).slice(-5);
  const nomClub = ligne ? ligne.team.name : "Club " + club.idEquipe;

  // Prochain match
  let blocProchain = '<p class="date-match">Aucun match programmé.</p>';
  if (prochain) {
    const m = prochain.match;
    const aDomicile = m.homeTeam.id === club.idEquipe;
    const adversaire = aDomicile ? m.awayTeam : m.homeTeam;
    blocProchain = `
      <div class="prochain-match">
        <div>
          <span class="lieu">${aDomicile ? "Domicile" : "Extérieur"}</span>
          <p class="adversaire">${aDomicile ? "contre" : "à"} ${echapper(adversaire.shortName)}</p>
          <p class="date-match">${echapper(formaterDate(m.utcDate))} · ${echapper(prochain.competition)}</p>
        </div>
        <span class="compte-a-rebours">${texteCompteARebours(joursRestants(m.utcDate))}</span>
      </div>`;
  }

  // Forme : 5 pastilles, de la plus ancienne à la plus récente
  const pastilles = cinqDerniers.map(({ match: m, competition }) => {
    const resultat = resultatPour(m, club.idEquipe);
    const adversaire = m.homeTeam.id === club.idEquipe ? m.awayTeam : m.homeTeam;
    const detail = `${LIBELLES_RESULTAT[resultat]} ${m.score.fullTime.home}-${m.score.fullTime.away} `
      + `contre ${adversaire.shortName} (${competition}, ${formatJourCourt.format(new Date(m.utcDate))})`;
    return `<li class="forme-${resultat}" title="${echapper(detail)}">
        <span aria-hidden="true">${resultat}</span>
        <span class="visuellement-cache">${echapper(detail)}</span>
      </li>`;
  }).join("");

  return `
    <article class="carte carte-club" data-championnat="${club.championnat}">
      <header class="carte-entete">
        <h2 class="carte-nom">${echapper(nomClub)}</h2>
        <span class="pastille-championnat">${echapper(championnat.nom)}</span>
      </header>

      <section>
        <h3 class="bloc-titre">Prochain match</h3>
        ${blocProchain}
      </section>

      <section>
        <h3 class="bloc-titre">Forme · 5 derniers matchs</h3>
        ${pastilles ? `<ol class="forme">${pastilles}</ol>
        <p class="legende-forme">Du plus ancien au plus récent</p>` : '<p class="date-match">Aucun match joué.</p>'}
      </section>

      <section class="stats" aria-label="Classement en ${echapper(championnat.nom)}">
        <div class="stat">
          <span class="stat-valeur">${ligne ? formaterPosition(ligne.position) : "–"}</span>
          <span class="stat-libelle">Classement</span>
        </div>
        <div class="stat">
          <span class="stat-valeur">${ligne ? ligne.points : "–"}</span>
          <span class="stat-libelle">Points</span>
        </div>
      </section>

      <button type="button" class="bouton" data-aller="${club.championnat}/classement">Voir le classement</button>
    </article>`;
}


/* ---------- 6. Écrans des championnats ---------- */

function construireClassement(donnees, championnat) {
  const lignes = lignesClassement(donnees);
  if (lignes.length === 0) {
    return '<p class="message">Classement indisponible.</p>';
  }

  const corps = lignes.map((l) => {
    const zone = championnat.zones.find((z) => l.position >= z.de && l.position <= z.a);
    const suivie = l.team.id === championnat.clubSuivi;
    const point = zone
      ? `<span class="point-zone" style="--couleur-zone:${zone.couleur}" title="${echapper(zone.libelle)}"></span>`
      : '<span class="point-zone"></span>';
    return `
      <tr${suivie ? ' class="ligne-suivie"' : ""}>
        <td class="col-pos">${point}${l.position}</td>
        <td class="col-club">${echapper(l.team.shortName)}</td>
        <td>${l.playedGames}</td>
        <td>${l.won}</td>
        <td>${l.draw}</td>
        <td>${l.lost}</td>
        <td>${formaterDiff(l.goalDifference)}</td>
        <td class="col-pts">${l.points}</td>
      </tr>`;
  }).join("");

  // Légende : une entrée par zone + le club suivi
  const clubSuivi = lignes.find((l) => l.team.id === championnat.clubSuivi);
  const legende = championnat.zones.map((z) =>
    `<li><span class="point-zone" style="--couleur-zone:${z.couleur}"></span>${echapper(z.libelle)}</li>`
  ).join("") + (clubSuivi
    ? `<li><span class="repere-suivi"></span>${echapper(clubSuivi.team.name)}</li>`
    : "");

  return `
    <div class="tableau-defilant">
      <table class="classement">
        <caption class="visuellement-cache">${echapper(championnat.libelleClassement || "Classement")} ${echapper(championnat.nom)}</caption>
        <thead>
          <tr>
            <th scope="col" class="col-pos">#</th>
            <th scope="col" class="col-club">Club</th>
            <th scope="col"><abbr title="Joués">J</abbr></th>
            <th scope="col"><abbr title="Gagnés">G</abbr></th>
            <th scope="col"><abbr title="Nuls">N</abbr></th>
            <th scope="col"><abbr title="Perdus">P</abbr></th>
            <th scope="col"><abbr title="Différence de buts">Diff</abbr></th>
            <th scope="col" class="col-pts"><abbr title="Points">Pts</abbr></th>
          </tr>
        </thead>
        <tbody>${corps}</tbody>
      </table>
    </div>
    <ul class="legende">${legende}</ul>`;
}

// Une ligne de match : "Domicile  score (ou heure)  Extérieur"
function construireLigneMatch(m, championnat, avecScore) {
  const suivi = m.homeTeam.id === championnat.clubSuivi || m.awayTeam.id === championnat.clubSuivi;
  let classeDomicile = "";
  let classeExterieur = "";
  let centre;

  if (avecScore) {
    const { home, away } = m.score.fullTime;
    if (home > away) {
      classeDomicile = " gagnant";
      classeExterieur = " perdant";
    } else if (away > home) {
      classeDomicile = " perdant";
      classeExterieur = " gagnant";
    }
    centre = `<span class="score">${home}<span class="tiret" aria-label="à">–</span>${away}</span>`;
  } else {
    centre = `<span class="score heure">${formatHeure.format(new Date(m.utcDate))}</span>`;
  }

  return `
    <li class="match${suivi ? " match-suivi" : ""}">
      <span class="equipe domicile${classeDomicile}">${echapper(m.homeTeam.shortName)}</span>
      ${centre}
      <span class="equipe exterieur${classeExterieur}">${echapper(m.awayTeam.shortName)}</span>
    </li>`;
}

// Noms des tours à élimination directe (ces matchs n'ont pas de numéro de journée)
const LIBELLES_TOURS = {
  PLAYOFFS: "Barrages",
  LAST_16: "Huitièmes de finale",
  QUARTER_FINALS: "Quarts de finale",
  SEMI_FINALS: "Demi-finales",
  FINAL: "Finale"
};

// "Journée 9", ou le nom du tour ("Quarts de finale")
function libelleJournee(match) {
  if (match.matchday != null) return "Journée " + match.matchday;
  return LIBELLES_TOURS[match.stage] || match.stage || "Match";
}

// Liste de matchs groupée par journée (ou tour), puis par jour
function construireListeMatchs(matchs, championnat, avecScore) {
  const parJournee = grouper(matchs, libelleJournee);
  return parJournee.map(([journee, matchsJournee]) => {
    const parJour = grouper(matchsJournee, (m) => new Date(m.utcDate).toDateString());
    const jours = parJour.map(([, matchsDuJour]) => `
      <h3 class="jour-titre">${echapper(formaterJourLong(matchsDuJour[0].utcDate))}</h3>
      <ul class="liste-matchs">
        ${matchsDuJour.map((m) => construireLigneMatch(m, championnat, avecScore)).join("")}
      </ul>`).join("");
    return `
      <section class="groupe-matchs">
        <h2 class="groupe-titre">${echapper(journee)}</h2>
        ${jours}
      </section>`;
  }).join("");
}

// Résultats : uniquement la dernière journée jouée
function construireResultats(donnees, championnat) {
  const termines = trierParDate(donnees.matches.filter(estTermine));
  if (termines.length === 0) {
    return '<p class="message">Aucun résultat pour le moment.</p>';
  }
  // Phase du match terminé le plus récent (championnat, phase de ligue, quarts...)
  const phase = termines[termines.length - 1].stage;
  const memePhase = termines.filter((m) => m.stage === phase);
  // La journée la plus avancée de cette phase (un match reporté joué en retard ne compte pas)
  const numeros = memePhase.map((m) => m.matchday).filter((n) => n != null);
  const matchs = numeros.length > 0
    ? memePhase.filter((m) => m.matchday === Math.max(...numeros))
    : memePhase;
  return construireListeMatchs(matchs, championnat, true);
}

// Nombre de journées affichées dans le calendrier
const JOURNEES_CALENDRIER = 2;

// Calendrier : les matchs des prochaines journées
function construireCalendrier(donnees, championnat) {
  const aVenir = trierParDate(donnees.matches.filter(estAVenir));
  if (aVenir.length === 0) {
    return '<p class="message">Aucun match programmé.</p>';
  }
  const journees = [...new Set(aVenir.map(libelleJournee))].slice(0, JOURNEES_CALENDRIER);
  const matchs = aVenir.filter((m) => journees.includes(libelleJournee(m)));
  return construireListeMatchs(matchs, championnat, false);
}

// Buteurs : le top 5
function construireButeurs(donnees) {
  const top = [...donnees.scorers].sort((a, b) => b.goals - a.goals).slice(0, 5);
  if (top.length === 0) {
    return '<p class="message">Aucun buteur pour le moment.</p>';
  }
  let rang = 0;
  const lignes = top.map((b, i) => {
    // Même nombre de buts que le précédent = même rang
    if (i === 0 || b.goals !== top[i - 1].goals) rang = i + 1;
    return `
      <li class="buteur">
        <span class="rang">${rang}</span>
        <span>
          <span class="joueur-nom">${echapper(b.player.name)}</span>
          <span class="joueur-club">${echapper(b.team.shortName)}</span>
        </span>
        <span class="buts">${b.goals}<small>${b.goals > 1 ? "buts" : "but"}</small></span>
      </li>`;
  }).join("");
  return `<ol class="liste-buteurs">${lignes}</ol>`;
}

// Quel écran construire pour chaque sous-onglet
const CONSTRUCTEURS = {
  classement: construireClassement,
  resultats: construireResultats,
  calendrier: construireCalendrier,
  buteurs: construireButeurs
};


/* ---------- 7. Écrans de la Formule 1 ---------- */

// Noms des Grands Prix en français (sinon le nom anglais de l'API est gardé)
const NOMS_GP = {
  "Australian Grand Prix": "Grand Prix d'Australie",
  "Chinese Grand Prix": "Grand Prix de Chine",
  "Japanese Grand Prix": "Grand Prix du Japon",
  "Bahrain Grand Prix": "Grand Prix de Bahreïn",
  "Bahrain Grand Prix in Malaysia": "Grand Prix de Bahreïn (en Malaisie)",
  "Saudi Arabian Grand Prix": "Grand Prix d'Arabie saoudite",
  "Miami Grand Prix": "Grand Prix de Miami",
  "Emilia Romagna Grand Prix": "Grand Prix d'Émilie-Romagne",
  "Canadian Grand Prix": "Grand Prix du Canada",
  "Monaco Grand Prix": "Grand Prix de Monaco",
  "Barcelona Grand Prix": "Grand Prix de Barcelone",
  "Spanish Grand Prix": "Grand Prix d'Espagne",
  "Austrian Grand Prix": "Grand Prix d'Autriche",
  "British Grand Prix": "Grand Prix de Grande-Bretagne",
  "Belgian Grand Prix": "Grand Prix de Belgique",
  "Hungarian Grand Prix": "Grand Prix de Hongrie",
  "Dutch Grand Prix": "Grand Prix des Pays-Bas",
  "Italian Grand Prix": "Grand Prix d'Italie",
  "Azerbaijan Grand Prix": "Grand Prix d'Azerbaïdjan",
  "Singapore Grand Prix": "Grand Prix de Singapour",
  "United States Grand Prix": "Grand Prix des États-Unis",
  "Mexico City Grand Prix": "Grand Prix de Mexico",
  "Brazilian Grand Prix": "Grand Prix du Brésil",
  "São Paulo Grand Prix": "Grand Prix de São Paulo",
  "Las Vegas Grand Prix": "Grand Prix de Las Vegas",
  "Qatar Grand Prix": "Grand Prix du Qatar",
  "Abu Dhabi Grand Prix": "Grand Prix d'Abou Dhabi"
};

// Noms des pays en français
const PAYS = {
  Australia: "Australie", China: "Chine", Japan: "Japon", Bahrain: "Bahreïn",
  "Saudi Arabia": "Arabie saoudite", USA: "États-Unis", Italy: "Italie", Canada: "Canada",
  Monaco: "Monaco", Spain: "Espagne", Austria: "Autriche", UK: "Royaume-Uni",
  Belgium: "Belgique", Hungary: "Hongrie", Netherlands: "Pays-Bas", Azerbaijan: "Azerbaïdjan",
  Malaysia: "Malaisie", Singapore: "Singapour", Mexico: "Mexique", Brazil: "Brésil",
  Qatar: "Qatar", UAE: "Émirats arabes unis"
};

// Nom court et couleur de chaque écurie (petite barre devant le nom du pilote)
const ECURIES = {
  mercedes: { nom: "Mercedes", couleur: "#00D7B6" },
  red_bull: { nom: "Red Bull", couleur: "#4781D7" },
  ferrari: { nom: "Ferrari", couleur: "#ED1131" },
  mclaren: { nom: "McLaren", couleur: "#F47600" },
  aston_martin: { nom: "Aston Martin", couleur: "#229971" },
  alpine: { nom: "Alpine", couleur: "#00A1E8" },
  williams: { nom: "Williams", couleur: "#1868DB" },
  rb: { nom: "Racing Bulls", couleur: "#6C98FF" },
  haas: { nom: "Haas", couleur: "#9C9FA2" },
  audi: { nom: "Audi", couleur: "#E8E8E8" },
  cadillac: { nom: "Cadillac", couleur: "#C9A227" }
};

// Les séances d'un week-end de course
const NOMS_SEANCES = {
  FirstPractice: "Essais libres 1",
  SecondPractice: "Essais libres 2",
  ThirdPractice: "Essais libres 3",
  SprintQualifying: "Qualifications sprint",
  Sprint: "Course sprint",
  Qualifying: "Qualifications",
  Race: "Course"
};

// Durée approximative d'une séance (pour savoir si elle est en cours ou terminée)
const UNE_HEURE = 3600000;
function dureeSeance(type) {
  return type === "Race" ? 2 * UNE_HEURE : UNE_HEURE;
}

function nomGP(course) {
  return NOMS_GP[course.nom] || course.nom;
}

// "Marina Bay Street Circuit · Marina Bay, Singapour"
function lieuGP(course) {
  const pays = PAYS[course.pays] || course.pays;
  return course.circuit + " · " + [course.ville, pays].filter(Boolean).join(", ");
}

// Nom de l'écurie, précédé d'une barre à sa couleur
function htmlEcurie(ecurie) {
  if (!ecurie) return "";
  const infos = ECURIES[ecurie.id] || {};
  const nom = infos.nom || ecurie.nom.replace(/ F1 Team$/, "");
  return `<span class="barre-ecurie" style="--couleur-ecurie:${infos.couleur || "#8A94A6"}"></span>${echapper(nom)}`;
}

// 25 -> "25 pts", 1 -> "1 pt"
function textePoints(points) {
  return points + (points > 1 ? " pts" : " pt");
}

// Une date sans heure ("2026-10-25") : l'horaire n'est pas encore connu
function sansHeure(iso) {
  return iso.length === 10;
}

// Temps ou écart du pilote, ou raison de son abandon
function ecartPilote(resultat, toursVainqueur) {
  switch (resultat.statut) {
    case "Finished":
      return resultat.temps || "";
    case "Lapped": {
      const tours = toursVainqueur - resultat.tours;
      return "+" + tours + (tours > 1 ? " tours" : " tour");
    }
    case "Retired":
      return "Abandon";
    case "Disqualified":
      return "Disqualifié";
    case "Did not start":
      return "Non partant";
    default:
      return resultat.statut || "";
  }
}

// Résultats : le classement de la dernière course
function construireResultatsF1(donnees) {
  const course = donnees.derniereCourse;
  if (!course || course.resultats.length === 0) {
    return '<p class="message">Aucune course disputée pour le moment.</p>';
  }
  const toursVainqueur = course.resultats[0].tours;

  const lignes = course.resultats.map((r) => {
    // "R" (abandon), "D" (disqualifié)... : pilote non classé
    const classe = /^\d+$/.test(r.position);
    const podium = classe && Number(r.position) <= 3;
    return `
      <li class="ligne-f1${podium ? " podium" : ""}${classe ? "" : " non-classe"}">
        <span class="rang">${classe ? r.position : "–"}</span>
        <span>
          <span class="joueur-nom">${echapper(r.pilote.nom)}</span>
          <span class="joueur-club">${htmlEcurie(r.ecurie)}</span>
        </span>
        <span class="droite-f1">
          <span class="ecart">${echapper(ecartPilote(r, toursVainqueur))}</span>
          ${r.points > 0 ? `<span class="points-course">+${textePoints(r.points)}</span>` : ""}
        </span>
      </li>`;
  }).join("");

  return `
    <section class="bloc-f1">
      <header class="entete-gp">
        <span class="lieu">Manche ${course.manche}</span>
        <h2 class="groupe-titre">${echapper(nomGP(course))}</h2>
        <p class="date-match">${echapper(formaterJourLong(course.date))} · ${echapper(lieuGP(course))}</p>
      </header>
      <ol class="liste-f1">${lignes}</ol>
    </section>`;
}

// Pilotes : le classement du championnat
function construirePilotes(donnees) {
  const lignes = donnees.classementPilotes || [];
  if (lignes.length === 0) {
    return '<p class="message">Classement disponible après la première course.</p>';
  }
  const html = lignes.map((l) => {
    const victoires = l.victoires > 0
      ? ` · ${l.victoires} ${l.victoires > 1 ? "victoires" : "victoire"}`
      : "";
    return `
      <li class="ligne-f1">
        <span class="rang">${echapper(l.position)}</span>
        <span>
          <span class="joueur-nom">${echapper(l.pilote.nom)}</span>
          <span class="joueur-club">${htmlEcurie(l.ecurie)}${victoires}</span>
        </span>
        <span class="buts">${l.points}<small>${l.points > 1 ? "pts" : "pt"}</small></span>
      </li>`;
  }).join("");
  return `<ol class="liste-f1">${html}</ol>`;
}

// Le prochain Grand Prix : le premier dont la course n'est pas encore finie
function prochainGP(calendrier) {
  const maintenant = Date.now();
  return calendrier.find((c) => new Date(c.date).getTime() + dureeSeance("Race") > maintenant);
}

// Prochain GP : présentation et programme du week-end
function construireProchainGP(donnees) {
  const calendrier = donnees.calendrier || [];
  const gp = prochainGP(calendrier);
  if (!gp) {
    return '<p class="message">Saison terminée : rendez-vous l\'an prochain !</p>';
  }
  const maintenant = Date.now();
  const courseCommencee = new Date(gp.date).getTime() <= maintenant;
  const sprint = gp.seances.some((s) => s.type === "Sprint");

  // Séances dans l'ordre, avec leur état
  const seances = [...gp.seances].sort((a, b) => new Date(a.date) - new Date(b.date));
  const suivante = seances.find((s) => new Date(s.date).getTime() > maintenant);

  const parJour = grouper(seances, (s) => new Date(s.date).toDateString());
  const programme = parJour.map(([, seancesDuJour]) => {
    const lignes = seancesDuJour.map((s) => {
      const debut = new Date(s.date).getTime();
      let etat = "";
      let droite;
      if (sansHeure(s.date)) {
        droite = '<span class="seance-heure seance-inconnue">Horaire à confirmer</span>';
      } else if (debut + dureeSeance(s.type) < maintenant) {
        etat = " seance-passee";
        droite = '<span class="seance-heure">Terminée</span>';
      } else if (debut <= maintenant) {
        etat = " seance-en-cours";
        droite = '<span class="seance-heure">En cours</span>';
      } else {
        droite = `<span class="seance-heure">${formatHeure.format(new Date(s.date))}</span>`;
      }
      if (s === suivante) etat += " seance-suivante";
      if (s.type === "Race") etat += " seance-course";
      return `
        <li class="seance${etat}">
          <span class="seance-nom">${NOMS_SEANCES[s.type] || echapper(s.type)}</span>
          ${droite}
        </li>`;
    }).join("");
    return `
      <h3 class="jour-titre">${echapper(formaterJourLong(seancesDuJour[0].date))}</h3>
      <ul class="liste-seances">${lignes}</ul>`;
  }).join("");

  return `
    <section class="bloc-f1">
      <article class="carte carte-gp">
        <div>
          <span class="lieu">Manche ${gp.manche} / ${calendrier.length}</span>
          ${sprint ? '<span class="lieu">Week-end sprint</span>' : ""}
          <h2 class="carte-nom">${echapper(nomGP(gp))}</h2>
          <p class="date-match">${echapper(lieuGP(gp))}</p>
        </div>
        <span class="compte-a-rebours">${courseCommencee ? "En course" : texteCompteARebours(joursRestants(gp.date))}</span>
      </article>
      ${programme}
      <p class="legende-forme">Horaires à l'heure de ton appareil (heure française en France).</p>
    </section>`;
}

// Quel écran construire pour chaque sous-onglet F1
const CONSTRUCTEURS_F1 = {
  resultats: construireResultatsF1,
  pilotes: construirePilotes,
  "prochain-gp": construireProchainGP
};


/* ---------- 8. Démarrage ---------- */

// Clic sur un onglet principal : on garde la même rubrique (Classement, Buteurs...) d'un championnat à l'autre
document.querySelector(".onglets").addEventListener("click", (evenement) => {
  const bouton = evenement.target.closest("[data-onglet]");
  if (!bouton) return;
  const onglet = bouton.dataset.onglet;
  const liste = sousOngletsDe(onglet);
  if (!liste) {
    aller("mes-clubs");
    return;
  }
  // Rubrique actuelle, ou son équivalent (Classement <-> Pilotes...), sinon la première
  let rubrique = lireRoute().sousOnglet;
  if (!liste[rubrique]) rubrique = RUBRIQUES_EQUIVALENTES[rubrique];
  aller(onglet + "/" + (liste[rubrique] ? rubrique : Object.keys(liste)[0]));
});

// Clic sur un sous-onglet
document.querySelector(".sous-onglets").addEventListener("click", (evenement) => {
  const bouton = evenement.target.closest("[data-sous-onglet]");
  if (!bouton) return;
  aller(lireRoute().onglet + "/" + bouton.dataset.sousOnglet);
});

// Boutons dans le contenu (ex. "Voir le classement")
document.getElementById("contenu").addEventListener("click", (evenement) => {
  const bouton = evenement.target.closest("[data-aller]");
  if (bouton) aller(bouton.dataset.aller);
});

// L'adresse change (clic, bouton retour, lien) : on réaffiche
window.addEventListener("hashchange", afficher);

afficher();
