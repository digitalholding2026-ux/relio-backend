/**
 * Suivi des difficultés par objectif — chantier 7.5.
 *
 * ## Ce que ce module n'est pas
 *
 * Ce n'est **pas** une note, ni un niveau, ni un classement. Aucun total
 * global, aucune moyenne, aucun pourcentage de réussite. Le chantier 7.5
 * demande de savoir *à quel niveau* l'élève rencontre une difficulté, ce qui
 * est une information locale et par objectif.
 *
 * ## La prudence est reprise de `progression.ts`
 *
 * `progression.ts` a posé une règle qu'il est dangereux d'oublier :
 * **une seule réponse juste ne prouve pas une maîtrise**. Ici, la même idée
 * est appliquée sous une forme lisible par l'enseignant : ce qu'on peut
 * affirmer porte sur le *nombre d'aides dont l'élève a eu besoin*, jamais sur
 * un acquis durable. Le vocabulaire ci-dessous est donc délibérément
 * faible — il n'existe aucun état nommé « maîtrisé ».
 *
 * ## Aucune persistance
 *
 * Ce module est une fonction pure : il agrège des observations que le client
 * lui transmet. Le serveur ne conserve rien. La conservation, elle, est
 * locale au navigateur — voir `observations.ts` côté frontend, et les limites
 * énoncées dans le rapport de chantier.
 */

import type { StatutReponse } from '../contenu/types.js';
import type { CategorieDifficulte, NiveauAide } from '../contenu/tutorat.js';

/**
 * Une tentative observée, telle que conservée par le client.
 *
 * Aucun nom, aucun identifiant d'élève, aucune date de naissance : le modèle
 * ne collectionne que ce qui sert au suivi pédagogique. `reponse` est le texte
 * que l'élève a lui-même saisi sur son appareil.
 */
export interface Observation {
  readonly exerciceId: string;
  /** Objectif principal de l'exercice — renseigné par le serveur. */
  readonly objectifId: string;
  /** Rang de la tentative sur cet exercice, à partir de 1. */
  readonly rang: number;
  readonly reponse: string;
  readonly statut: StatutReponse;
  /** `null` = aucune erreur (réponse juste). */
  readonly categorie: CategorieDifficulte | null;
  /** Niveau d'aide déjà reçu avant cette tentative, si la réponse est fausse. */
  readonly niveauAide: NiveauAide | null;
  /** L'élève a fini par réussir cet exercice. */
  readonly reussiteApresAides: boolean;
}

/**
 * Niveau de suivi d'un objectif.
 *
 * Aucun de ces états n'affirme une maîtrise. `a_confirmer` dit exactement ce
 * qu'il sait : la réussite a eu lieu, mais après des aides.
 */
export type NiveauSuivi =
  /** Trop peu de données pour dire quoi que ce soit. */
  | 'donnee_insuffisante'
  /** Les exercices tentés ont été réussis du premier coup. */
  | 'reussite_immediate'
  /** Réussite, mais seulement après des aides. */
  | 'a_confirmer'
  /** Difficulté constatée sur au moins deux exercices. */
  | 'difficulte';

export interface DifficulteRecurrente {
  readonly categorie: CategorieDifficulte;
  readonly occurrences: number;
}

export interface SuiviObjectif {
  readonly objectifId: string;
  readonly exercicesTraites: number;
  readonly tentatives: number;
  /** Exercices réussis sans aucune aide. */
  readonly reussisSansAide: number;
  /** Exercices réussis à la deuxième tentative exactement. */
  readonly reussisApresUnIndice: number;
  /** Exercices réussis seulement à la troisième tentative ou au-delà. */
  readonly reussisApresPlusieursAides: number;
  /** Exercices sur lesquels aucune réponse juste n'a été obtenue. */
  readonly nonReussis: number;
  readonly niveau: NiveauSuivi;
  readonly difficultesRecurrentes: readonly DifficulteRecurrente[];
}

/** Une réponse juste au sens de la progression : statut `correcte`. */
function estReussite(statut: StatutReponse): boolean {
  return statut === 'correcte';
}

/**
 * Regroupe les observations par exercice.
 *
 * L'ordre des tentatives est reconstruit depuis `rang` plutôt que trusting
 * l'ordre d'arrivée du tableau : un client peut envoyer ses observations dans
 * le désordre après une reconnexion, et « a réussi du premier coup » n'a de
 * sens que si les tentatives sont ordonnées.
 */
function parExercice(observations: readonly Observation[]): Map<string, Observation[]> {
  const groupes = new Map<string, Observation[]>();
  for (const observation of observations) {
    const liste = groupes.get(observation.exerciceId) ?? [];
    liste.push(observation);
    groupes.set(observation.exerciceId, liste);
  }
  for (const liste of groupes.values()) {
    liste.sort((a, b) => a.rang - b.rang);
  }
  return groupes;
}

/**
 * Nombre d'aides subies avant la **première** réussite.
 *
 * `null` si l'élève n'a jamais réussi l'exercice : il ne s'agit alors pas
 * d'une réussite tardive mais d'un échec.
 */
function aidesAvantReussite(tentatives: readonly Observation[]): number | null {
  const premiere = tentatives.findIndex((t) => estReussite(t.statut));
  if (premiere === -1) return null;
  // La réussite elle-même n'est pas une aide : c'est le nombre de tentatives
  // **qui ont précédé** la première réponse juste.
  return premiere;
}

/** Suivi d'un exercice isolé. */
function suivreExercice(tentatives: readonly Observation[]): {
  aidesAvantReussite: number | null;
  nonReussi: boolean;
} {
  const aides = aidesAvantReussite(tentatives);
  return { aidesAvantReussite: aides, nonReussi: aides === null };
}

/** Suivi d'un objectif. */
export function suivreObjectif(
  objectifId: string,
  observations: readonly Observation[],
): SuiviObjectif {
  const concernees = observations.filter((o) => o.objectifId === objectifId);
  const groupes = parExercice(concernees);

  let reussisSansAide = 0;
  let reussisApresUnIndice = 0;
  let reussisApresPlusieursAides = 0;
  let nonReussis = 0;

  for (const tentatives of groupes.values()) {
    const suivi = suivreExercice(tentatives);
    if (suivi.nonReussi) {
      nonReussis += 1;
      continue;
    }
    if (suivi.aidesAvantReussite === 0) reussisSansAide += 1;
    else if (suivi.aidesAvantReussite === 1) reussisApresUnIndice += 1;
    else reussisApresPlusieursAides += 1;
  }

  // --- Difficultés récurrentes ------------------------------------------------
  // Une difficulté n'est dite « récurrente » qu'à partir de **deux**
  // observations de même catégorie. En dessous, c'est un simple aléa d'un seul
  // exercice : le qualifier de difficulté serait une affirmation de plus que
  // les données ne permettent.
  const compteurs = new Map<CategorieDifficulte, number>();
  for (const observation of concernees) {
    if (observation.categorie === null) continue;
    compteurs.set(observation.categorie, (compteurs.get(observation.categorie) ?? 0) + 1);
  }
  const difficultesRecurrentes: DifficulteRecurrente[] = [];
  for (const [categorie, occurrences] of compteurs) {
    if (occurrences >= 2) difficultesRecurrentes.push({ categorie, occurrences });
  }
  difficultesRecurrentes.sort((a, b) => b.occurrences - a.occurrences);

  // --- Niveau -----------------------------------------------------------------
  const exercicesTraites = groupes.size;
  let niveau: NiveauSuivi;

  if (exercicesTraites === 0) {
    niveau = 'donnee_insuffisante';
  } else if (difficultesRecurrentes.length > 0 || nonReussis >= 2) {
    niveau = 'difficulte';
  } else if (reussisApresPlusieursAides > 0) {
    niveau = 'a_confirmer';
  } else if (reussisApresUnIndice > 0) {
    niveau = 'a_confirmer';
  } else if (nonReussis === 1) {
    // Un seul exercice non abouti : un constat isolé, pas une difficulté.
    niveau = 'a_confirmer';
  } else if (reussisSansAide >= 2) {
    niveau = 'reussite_immediate';
  } else {
    // Un seul exercice réussi sans aide : informatif, pas concluant.
    niveau = 'donnee_insuffisante';
  }

  return {
    objectifId,
    exercicesTraites,
    tentatives: concernees.length,
    reussisSansAide,
    reussisApresUnIndice,
    reussisApresPlusieursAides,
    nonReussis,
    niveau,
    difficultesRecurrentes,
  };
}

/** Suivi de plusieurs objectifs. */
export function suivreProgression(
  observations: readonly Observation[],
  objectifsIds: readonly string[],
): SuiviObjectif[] {
  return objectifsIds.map((id) => suivreObjectif(id, observations));
}