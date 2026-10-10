/**
 * Calendrier scolaire — ouverture progressive des blocs.
 *
 * Le chantier 6 a établi (F2) que le diagnostic ne peut pas tester du contenu
 * non encore enseigné : la leçon « Équations » est programmée en S16–S17, donc
 * un parcours ouvert à la rentrée ne doit pas la proposer.
 *
 * Semaines extraites du référentiel annuel
 * `data/referentiel-maths-3e-cm-2025-2026.json` (sha256 `f766f412…`) :
 * L1 → S1, L3 → S5, L5 → S10. Aucune semaine n'est inventée ici.
 *
 * Le jour de début est une **décision projet** (le référentiel ne donne qu'un
 * mois), configurable par `ANNEE_SCOLAIRE_DEBUT` pour être ajustée sans
 * redéploiement. En dehors de l'année scolaire, aucun bloc n'est ouvert —
 * l'application affiche alors un message explicite plutôt qu'un parcours vide
 * sans explication.
 */

export interface PositionDansLAnnee {
  /** Numéro de semaine de cours (1..30), ou `null` hors année scolaire. */
  readonly semaine: number | null;
  readonly dansAnneeScolaire: boolean;
  /** Vrai si la date est postérieure à la dernière semaine de cours. */
  readonly anneeTerminee: boolean;
}

/** Durée de l'année scolaire, en semaines de cours. */
export const NOMBRE_SEMAINES = 30;

/**
 * Premier jour de la première semaine de cours de l'année scolaire en cours.
 *
 * Valeur retenue par le propriétaire de Relio pour l'année **2026-2027** :
 * le **lundi 7 septembre 2026**.
 *
 * Le jour de la semaine est délibéré. Une rentrée tombant un samedi décalait
 * les ouvertures de blocs d'un samedi, ce qui est inhabituel pour une année
 * scolaire : les semaines sont ici des blocs de sept jours à partir de la date
 * de rentrée, donc S1 tombe le samedi, S5 le samedi suivant, etc. Avec une
 * rentrée un lundi, **chaque ouverture tombe un lundi**, comme attendu.
 *
 * Trois précautions :
 *
 * - le référentiel annuel `data/referentiel-maths-3e-cm-2025-2026.json` donne
 *   des **mois**, pas des jours. Le 7 septembre est donc une décision
 *   projet, pas une donnée extraite du document source ;
 * - les semaines d'ouverture des blocs (S1, S5, S10) viennent du référentiel et
 *   ne changent pas : seule la date de début est une décision projet ;
 * - cette valeur est le **repli** utilisé quand `ANNEE_SCOLAIRE_DEBUT` est
 *   absente. La valeur définie en production reste prioritaire, car elle permet
 *   de changer d'année scolaire sans redéploiement.
 *
 * ⚠️ Une valeur périmée n'est pas anodine : avec une année antérieure, toute
 * date située après la fin de cette année-là est déclarée « année terminée »,
 * et **tous les blocs se referment** — y compris B1, prévu dès la semaine 1.
 * Une application de rentrée affichant « aucune leçon disponible » sans que
 * rien ne soit réellement indisponible est un défaut d'outillage, pas un
 * état pédagogique. C'est pourquoi le défaut est vérifié par un test.
 */
export const DEBUT_ANNEE_DEFAUT = '2026-09-07';

const MS_PAR_JOUR = 24 * 60 * 60 * 1000;

function debutAnnee(iso: string): Date {
  const date = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`ANNEE_SCOLAIRE_DEBUT invalide : « ${iso} » (format attendu AAAA-MM-JJ).`);
  }
  return date;
}

/**
 * Positionne une date dans l'année scolaire.
 *
 * La semaine 1 commence au premier jour fourni. Une date antérieure appartient
 * à l'année précédente (aucun bloc ouvert) ; une date postérieure de plus de
 * 30 semaines est « année terminée ».
 */
export function positionnerDansLAnnee(date: Date, isoDebut: string = DEBUT_ANNEE_DEFAUT): PositionDansLAnnee {
  const debut = debutAnnee(isoDebut);
  const jours = Math.floor((date.getTime() - debut.getTime()) / MS_PAR_JOUR);

  if (jours < 0) {
    return { semaine: null, dansAnneeScolaire: false, anneeTerminee: false };
  }

  const semaine = Math.floor(jours / 7) + 1;

  if (semaine > NOMBRE_SEMAINES) {
    return { semaine: null, dansAnneeScolaire: false, anneeTerminee: true };
  }

  return { semaine, dansAnneeScolaire: true, anneeTerminee: false };
}

/** Vrai si un bloc est ouvrable à la semaine donnée. */
export function blocDisponible(semaineDebut: number, position: PositionDansLAnnee): boolean {
  if (!position.dansAnneeScolaire || position.semaine === null) return false;
  return position.semaine >= semaineDebut;
}

/** Nombre de semaines restant avant l'ouverture d'un bloc (null si déjà ouvert). */
export function semainesAvantOuverture(
  semaineDebut: number,
  position: PositionDansLAnnee,
): number | null {
  if (!position.dansAnneeScolaire || position.semaine === null) return null;
  const reste = semaineDebut - position.semaine;
  return reste > 0 ? reste : null;
}