/* =========================================================
   Données FICTIVES, au format de l'API football-data.org (v4)

   Une entrée par compétition, repérée par son code dans l'API :
     FL1 = Ligue 1, PD = LaLiga, CL = Ligue des champions.

   Chaque entrée regroupe ce que renverront plus tard trois appels :
     /competitions/{code}/standings -> season + standings
     /competitions/{code}/matches   -> matches
     /competitions/{code}/scorers   -> scorers

   Ce fichier est un .js (et non un .json) pour que la page
   fonctionne en l'ouvrant par simple double-clic.
   ========================================================= */

(function () {
  "use strict";

  /* ---------- Outils pour écrire les données plus vite ---------- */

  // Date (format ISO, heure UTC) située à "n" jours d'aujourd'hui, à l'heure locale indiquée
  function dansJours(n, heure) {
    const [heures, minutes] = heure.split(":").map(Number);
    const date = new Date();
    date.setDate(date.getDate() + n);
    date.setHours(heures, minutes, 0, 0);
    return date.toISOString();
  }

  // Toutes les équipes : code -> [identifiant, nom complet, nom court]
  const EQUIPES = {
    // Ligue 1
    PSG: [524, "Paris Saint-Germain", "PSG"],
    OM: [516, "Olympique de Marseille", "Marseille"],
    RCL: [546, "RC Lens", "Lens"],
    LIL: [521, "Lille OSC", "Lille"],
    ASM: [548, "AS Monaco", "Monaco"],
    OL: [523, "Olympique Lyonnais", "Lyon"],
    RCS: [576, "RC Strasbourg Alsace", "Strasbourg"],
    NIC: [522, "OGC Nice", "Nice"],
    REN: [529, "Stade Rennais FC", "Rennes"],
    HAC: [533, "Le Havre AC", "Le Havre"],
    TFC: [511, "Toulouse FC", "Toulouse"],
    BRE: [512, "Stade Brestois 29", "Brest"],
    PFC: [1045, "Paris FC", "Paris FC"],
    FCL: [525, "FC Lorient", "Lorient"],
    SCO: [532, "Angers SCO", "Angers"],
    AJA: [519, "AJ Auxerre", "Auxerre"],
    FCN: [543, "FC Nantes", "Nantes"],
    FCM: [545, "FC Metz", "Metz"],
    // LaLiga
    RMA: [86, "Real Madrid CF", "Real Madrid"],
    FCB: [81, "FC Barcelona", "Barcelone"],
    VIL: [94, "Villarreal CF", "Villarreal"],
    ATM: [78, "Club Atlético de Madrid", "Atlético"],
    BET: [90, "Real Betis Balompié", "Betis"],
    ESP: [80, "RCD Espanyol", "Espanyol"],
    ATH: [77, "Athletic Club", "Athletic"],
    ELC: [285, "Elche CF", "Elche"],
    SEV: [559, "Sevilla FC", "Séville"],
    GET: [82, "Getafe CF", "Getafe"],
    ALA: [263, "Deportivo Alavés", "Alavés"],
    RSO: [92, "Real Sociedad", "Real Sociedad"],
    CEL: [558, "RC Celta de Vigo", "Celta Vigo"],
    OSA: [79, "CA Osasuna", "Osasuna"],
    RAY: [87, "Rayo Vallecano", "Rayo"],
    MLL: [89, "RCD Mallorca", "Majorque"],
    VAL: [95, "Valencia CF", "Valence"],
    LEV: [88, "Levante UD", "Levante"],
    GIR: [298, "Girona FC", "Gérone"],
    OVI: [1048, "Real Oviedo", "Oviedo"],
    // Autres clubs de Ligue des champions
    LIV: [64, "Liverpool FC", "Liverpool"],
    ARS: [57, "Arsenal FC", "Arsenal"],
    MCI: [65, "Manchester City FC", "Manchester City"],
    CHE: [61, "Chelsea FC", "Chelsea"],
    NEW: [67, "Newcastle United FC", "Newcastle"],
    BAY: [5, "FC Bayern München", "Bayern Munich"],
    BVB: [4, "Borussia Dortmund", "Dortmund"],
    B04: [3, "Bayer 04 Leverkusen", "Leverkusen"],
    RBL: [721, "RB Leipzig", "Leipzig"],
    INT: [108, "FC Internazionale Milano", "Inter Milan"],
    NAP: [113, "SSC Napoli", "Naples"],
    JUV: [109, "Juventus FC", "Juventus"],
    MIL: [98, "AC Milan", "AC Milan"],
    ATA: [102, "Atalanta BC", "Atalanta"],
    BEN: [1903, "SL Benfica", "Benfica"],
    POR: [503, "FC Porto", "Porto"],
    SCP: [498, "Sporting Clube de Portugal", "Sporting"],
    AJX: [678, "AFC Ajax", "Ajax"],
    PSV: [674, "PSV Eindhoven", "PSV"],
    FEY: [675, "Feyenoord Rotterdam", "Feyenoord"],
    CLU: [851, "Club Brugge KV", "Bruges"],
    CLT: [732, "Celtic FC", "Celtic"],
    GAL: [610, "Galatasaray SK", "Galatasaray"],
    OLY: [654, "Olympiacos FC", "Olympiakos"],
    SLA: [930, "SK Slavia Praha", "Slavia Prague"],
    FCK: [1876, "FC København", "Copenhague"],
    BOD: [5721, "FK Bodø/Glimt", "Bodø/Glimt"],
    USG: [3929, "Royale Union Saint-Gilloise", "Union SG"],
    QAR: [611, "Qarabağ FK", "Qarabağ"]
  };

  // Objet "équipe" tel que le renvoie l'API
  function equipe(code) {
    const [id, name, shortName] = EQUIPES[code];
    return { id, name, shortName, tla: code };
  }

  // Ligne de classement : position, équipe, joués, gagnés, nuls, perdus, buts pour, buts contre
  function ligne(position, code, j, g, n, p, bp, bc) {
    return {
      position,
      team: equipe(code),
      playedGames: j,
      won: g,
      draw: n,
      lost: p,
      points: 3 * g + n,
      goalsFor: bp,
      goalsAgainst: bc,
      goalDifference: bp - bc
    };
  }

  // Match : journée, jours par rapport à aujourd'hui, heure, domicile, extérieur, [buts dom, buts ext]
  // Sans score = match à venir
  let prochainId = 1;
  function match(journee, jours, heure, dom, ext, butsDom, butsExt) {
    const termine = butsDom !== undefined;
    let vainqueur = null;
    if (termine) {
      vainqueur = butsDom > butsExt ? "HOME_TEAM" : butsDom < butsExt ? "AWAY_TEAM" : "DRAW";
    }
    return {
      id: prochainId++,
      utcDate: dansJours(jours, heure),
      status: termine ? "FINISHED" : "TIMED",
      matchday: journee,
      homeTeam: equipe(dom),
      awayTeam: equipe(ext),
      score: {
        winner: vainqueur,
        fullTime: { home: termine ? butsDom : null, away: termine ? butsExt : null }
      }
    };
  }

  // Buteur : nom, code du club, nombre de buts
  function buteur(nom, code, buts) {
    return { player: { name: nom }, team: equipe(code), goals: buts };
  }

  // Calcule un classement à partir des matchs terminés (utilisé pour la Ligue des champions)
  function calculerClassement(matchs) {
    const lignes = {};
    const lignePour = (eq) => {
      if (!lignes[eq.tla]) {
        lignes[eq.tla] = ligne(0, eq.tla, 0, 0, 0, 0, 0, 0);
      }
      return lignes[eq.tla];
    };
    matchs.forEach((m) => {
      const dom = lignePour(m.homeTeam);
      const ext = lignePour(m.awayTeam);
      if (m.status !== "FINISHED") return;
      const { home, away } = m.score.fullTime;
      [[dom, home, away], [ext, away, home]].forEach(([l, pour, contre]) => {
        l.playedGames++;
        l.goalsFor += pour;
        l.goalsAgainst += contre;
        if (pour > contre) l.won++;
        else if (pour === contre) l.draw++;
        else l.lost++;
        l.points = 3 * l.won + l.draw;
        l.goalDifference = l.goalsFor - l.goalsAgainst;
      });
    });
    // Tri : points, puis différence de buts, puis buts marqués, puis nom
    return Object.values(lignes)
      .sort((a, b) =>
        b.points - a.points ||
        b.goalDifference - a.goalDifference ||
        b.goalsFor - a.goalsFor ||
        a.team.shortName.localeCompare(b.team.shortName))
      .map((l, i) => Object.assign(l, { position: i + 1 }));
  }


  /* ---------- Ligue 1 : 8 journées jouées ---------- */

  const classementLigue1 = [
    ligne(1, "PSG", 8, 6, 1, 1, 19, 7),
    ligne(2, "OM", 8, 6, 0, 2, 18, 9),
    ligne(3, "RCL", 8, 5, 2, 1, 13, 6),
    ligne(4, "LIL", 8, 5, 1, 2, 15, 9),
    ligne(5, "ASM", 8, 4, 2, 2, 14, 10),
    ligne(6, "OL", 8, 4, 2, 2, 12, 9),
    ligne(7, "RCS", 8, 4, 1, 3, 13, 11),
    ligne(8, "NIC", 8, 3, 3, 2, 11, 10),
    ligne(9, "REN", 8, 3, 2, 3, 12, 12),
    ligne(10, "HAC", 8, 3, 2, 3, 9, 10),
    ligne(11, "BRE", 8, 2, 3, 3, 9, 11),
    ligne(12, "PFC", 8, 2, 3, 3, 8, 11),
    ligne(13, "FCL", 8, 2, 2, 4, 9, 13),
    ligne(14, "TFC", 8, 2, 1, 5, 9, 13),
    ligne(15, "AJA", 8, 2, 1, 5, 8, 14),
    ligne(16, "FCN", 8, 1, 3, 4, 7, 13),
    ligne(17, "SCO", 8, 1, 2, 5, 6, 13),
    ligne(18, "FCM", 8, 1, 1, 6, 6, 17)
  ];

  const matchsLigue1 = [
    // Derniers matchs du Havre (pour la forme)
    match(4, -30, "15:00", "HAC", "SCO", 2, 0),
    match(5, -23, "17:00", "OL", "HAC", 2, 1),
    match(6, -16, "15:00", "HAC", "BRE", 1, 1),
    match(7, -9, "17:15", "AJA", "HAC", 0, 1),
    // Journée 8 (terminée)
    match(8, -2, "17:00", "SCO", "AJA", 1, 2),
    match(8, -2, "19:00", "HAC", "LIL", 0, 2),
    match(8, -2, "21:05", "PSG", "FCN", 3, 1),
    match(8, -1, "15:00", "ASM", "NIC", 2, 2),
    match(8, -1, "15:00", "BRE", "FCM", 1, 0),
    match(8, -1, "15:00", "PFC", "FCL", 0, 0),
    match(8, -1, "17:15", "RCL", "REN", 1, 0),
    match(8, -1, "17:15", "OL", "RCS", 1, 1),
    match(8, -1, "20:45", "OM", "TFC", 2, 0),
    // Journée 9 (à venir)
    match(9, 4, "20:45", "FCM", "SCO"),
    match(9, 5, "17:00", "HAC", "OM"),
    match(9, 5, "21:00", "LIL", "PSG"),
    match(9, 6, "15:00", "FCN", "RCL"),
    match(9, 6, "15:00", "NIC", "BRE"),
    match(9, 6, "15:00", "RCS", "PFC"),
    match(9, 6, "17:15", "REN", "ASM"),
    match(9, 6, "17:15", "TFC", "OL"),
    match(9, 6, "20:45", "FCL", "AJA")
  ];

  const buteursLigue1 = [
    buteur("Mason Greenwood", "OM", 8),
    buteur("Bradley Barcola", "PSG", 6),
    buteur("Esteban Lepaul", "REN", 6),
    buteur("Joaquín Panichelli", "RCS", 5),
    buteur("Ansu Fati", "ASM", 5),
    buteur("Hamed Traoré", "AJA", 4)
  ];


  /* ---------- LaLiga : 9 journées jouées ---------- */

  const classementLaLiga = [
    ligne(1, "RMA", 9, 7, 1, 1, 23, 8),
    ligne(2, "FCB", 9, 7, 0, 2, 26, 11),
    ligne(3, "VIL", 9, 6, 1, 2, 18, 9),
    ligne(4, "ATM", 9, 5, 3, 1, 15, 8),
    ligne(5, "BET", 9, 4, 4, 1, 13, 9),
    ligne(6, "ESP", 9, 4, 3, 2, 12, 10),
    ligne(7, "ATH", 9, 4, 2, 3, 10, 9),
    ligne(8, "ELC", 9, 3, 4, 2, 11, 10),
    ligne(9, "SEV", 9, 4, 1, 4, 13, 13),
    ligne(10, "GET", 9, 3, 3, 3, 9, 10),
    ligne(11, "ALA", 9, 3, 2, 4, 9, 10),
    ligne(12, "RSO", 9, 2, 4, 3, 10, 12),
    ligne(13, "CEL", 9, 2, 4, 3, 9, 11),
    ligne(14, "OSA", 9, 3, 0, 6, 8, 11),
    ligne(15, "RAY", 9, 2, 3, 4, 9, 13),
    ligne(16, "MLL", 9, 2, 2, 5, 9, 15),
    ligne(17, "VAL", 9, 1, 4, 4, 8, 14),
    ligne(18, "LEV", 9, 1, 3, 5, 10, 17),
    ligne(19, "GIR", 9, 1, 3, 5, 7, 18),
    ligne(20, "OVI", 9, 1, 3, 5, 4, 15)
  ];

  const matchsLaLiga = [
    // Derniers matchs du Real Madrid (pour la forme)
    match(7, -16, "21:00", "ATM", "RMA", 2, 1),
    match(8, -9, "16:15", "RMA", "GET", 3, 0),
    // Journée 9 (terminée)
    match(9, -3, "19:00", "MLL", "LEV", 1, 0),
    match(9, -3, "21:00", "VIL", "OVI", 2, 0),
    match(9, -3, "21:00", "ELC", "CEL", 1, 1),
    match(9, -2, "16:15", "ATH", "ALA", 1, 0),
    match(9, -2, "18:30", "FCB", "VAL", 3, 1),
    match(9, -2, "21:00", "SEV", "RMA", 1, 2),
    match(9, -1, "14:00", "ESP", "GET", 2, 1),
    match(9, -1, "16:15", "OSA", "RAY", 0, 1),
    match(9, -1, "18:30", "RSO", "GIR", 2, 2),
    match(9, -1, "21:00", "ATM", "BET", 1, 1),
    // Journée 10 (à venir)
    match(10, 2, "21:00", "LEV", "OSA"),
    match(10, 3, "18:30", "ALA", "ESP"),
    match(10, 3, "21:00", "BET", "VIL"),
    match(10, 4, "14:00", "GET", "ATM"),
    match(10, 4, "16:15", "OVI", "ATH"),
    match(10, 4, "18:30", "VAL", "SEV"),
    match(10, 4, "21:00", "RMA", "FCB"),
    match(10, 5, "14:00", "RAY", "ELC"),
    match(10, 5, "18:30", "GIR", "MLL"),
    match(10, 5, "21:00", "CEL", "RSO")
  ];

  const buteursLaLiga = [
    buteur("Kylian Mbappé", "RMA", 11),
    buteur("Ferran Torres", "FCB", 7),
    buteur("Julián Álvarez", "ATM", 6),
    buteur("Vinícius Júnior", "RMA", 5),
    buteur("Ayoze Pérez", "VIL", 5),
    buteur("Lamine Yamal", "FCB", 4)
  ];


  /* ---------- Ligue des champions : phase de ligue, 2 journées jouées ---------- */

  const matchsLdc = [
    // Journée 1
    match(1, -21, "18:45", "AJX", "OM", 1, 2),
    match(1, -21, "18:45", "SLA", "BOD", 1, 2),
    match(1, -21, "21:00", "PSV", "FCB", 1, 2),
    match(1, -21, "21:00", "ATM", "GAL", 3, 1),
    match(1, -21, "21:00", "PSG", "USG", 4, 0),
    match(1, -21, "21:00", "LIV", "ATA", 3, 1),
    match(1, -21, "21:00", "BAY", "CLU", 3, 0),
    match(1, -21, "21:00", "RBL", "INT", 0, 1),
    match(1, -21, "21:00", "FEY", "OLY", 0, 0),
    match(1, -20, "18:45", "RCL", "SCP", 1, 1),
    match(1, -20, "18:45", "NEW", "QAR", 4, 1),
    match(1, -20, "21:00", "RMA", "BEN", 2, 0),
    match(1, -20, "21:00", "VIL", "JUV", 1, 1),
    match(1, -20, "21:00", "ARS", "FCK", 2, 0),
    match(1, -20, "21:00", "MCI", "NAP", 1, 0),
    match(1, -20, "21:00", "CHE", "BVB", 2, 2),
    match(1, -20, "21:00", "B04", "POR", 1, 1),
    match(1, -20, "21:00", "MIL", "CLT", 2, 1),
    // Journée 2
    match(2, -14, "18:45", "BOD", "RBL", 2, 2),
    match(2, -14, "18:45", "CLU", "QAR", 2, 1),
    match(2, -14, "21:00", "FCB", "OLY", 3, 0),
    match(2, -14, "21:00", "INT", "ATM", 2, 1),
    match(2, -14, "21:00", "BAY", "PSG", 2, 1),
    match(2, -14, "21:00", "ARS", "AJX", 3, 0),
    match(2, -14, "21:00", "MCI", "FEY", 2, 0),
    match(2, -14, "21:00", "SCP", "PSV", 2, 1),
    match(2, -14, "21:00", "POR", "CLT", 2, 0),
    match(2, -13, "18:45", "VIL", "SLA", 2, 0),
    match(2, -13, "18:45", "GAL", "FCK", 3, 1),
    match(2, -13, "21:00", "LIV", "RMA", 1, 1),
    match(2, -13, "21:00", "OM", "ATA", 1, 0),
    match(2, -13, "21:00", "BVB", "RCL", 2, 1),
    match(2, -13, "21:00", "BEN", "B04", 1, 1),
    match(2, -13, "21:00", "NAP", "CHE", 2, 2),
    match(2, -13, "21:00", "JUV", "USG", 2, 0),
    match(2, -13, "21:00", "NEW", "MIL", 1, 1),
    // Journée 3 (à venir)
    match(3, 8, "18:45", "LIV", "CLU"),
    match(3, 8, "18:45", "ATA", "RBL"),
    match(3, 8, "18:45", "OLY", "SLA"),
    match(3, 8, "21:00", "RMA", "JUV"),
    match(3, 8, "21:00", "MCI", "VIL"),
    match(3, 8, "21:00", "NEW", "OM"),
    match(3, 8, "21:00", "CHE", "BEN"),
    match(3, 8, "21:00", "PSV", "GAL"),
    match(3, 8, "21:00", "USG", "QAR"),
    match(3, 9, "18:45", "RCL", "NAP"),
    match(3, 9, "18:45", "FCK", "BOD"),
    match(3, 9, "21:00", "FCB", "BAY"),
    match(3, 9, "21:00", "ARS", "ATM"),
    match(3, 9, "21:00", "PSG", "B04"),
    match(3, 9, "21:00", "BVB", "INT"),
    match(3, 9, "21:00", "MIL", "POR"),
    match(3, 9, "21:00", "SCP", "AJX"),
    match(3, 9, "21:00", "FEY", "CLT")
  ];

  const buteursLdc = [
    buteur("Kylian Mbappé", "RMA", 3),
    buteur("Harry Kane", "BAY", 3),
    buteur("Erling Haaland", "MCI", 2),
    buteur("Ousmane Dembélé", "PSG", 2),
    buteur("Lamine Yamal", "FCB", 2),
    buteur("Viktor Gyökeres", "ARS", 2)
  ];


  /* ---------- Export : les données rangées par code de compétition ---------- */

  window.DONNEES_EXEMPLE = {
    FL1: {
      competition: { code: "FL1", name: "Ligue 1" },
      season: { startDate: "2026-08-14", endDate: "2027-05-22", currentMatchday: 9 },
      standings: [{ stage: "REGULAR_SEASON", type: "TOTAL", table: classementLigue1 }],
      matches: matchsLigue1,
      scorers: buteursLigue1
    },
    PD: {
      competition: { code: "PD", name: "Primera Division" },
      season: { startDate: "2026-08-14", endDate: "2027-05-23", currentMatchday: 10 },
      standings: [{ stage: "REGULAR_SEASON", type: "TOTAL", table: classementLaLiga }],
      matches: matchsLaLiga,
      scorers: buteursLaLiga
    },
    CL: {
      competition: { code: "CL", name: "UEFA Champions League" },
      season: { startDate: "2026-09-15", endDate: "2027-05-29", currentMatchday: 3 },
      standings: [{ stage: "LEAGUE_STAGE", type: "TOTAL", table: calculerClassement(matchsLdc) }],
      matches: matchsLdc,
      scorers: buteursLdc
    }
  };
})();
