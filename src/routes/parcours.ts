/**
 * Routes métier du MVP pédagogique — préfixées par `/api/v1` comme le reste
 * de l'API. `/health` et `/api/v1` ne sont pas modifiés : le contrat existant
 * reste valable, seule la liste `endpoints` de `/api/v1` s'allonge.
 *
 * 🔒 Règle de sécurité structurante : **aucune réponse attendue ne transite
 * vers le client**. Les énoncés, les indices et les verdicts sont calculés
 * côté serveur ; le frontend ne reçoit jamais la solution.
 */

import type { FastifyInstance } from 'fastify';

import { BLOCS, OBJECTIFS, trouverBloc, trouverObjectif } from '../contenu/blocs.js';
import { corriger, formeDemandee, messagePourErreur, type CorrectionComplete } from '../contenu/correction.js';
import {
  categoriePour,
  construireTutorat,
  CATEGORIES_DIFICULTE,
  estCategorieDifficulte,
  normaliserNbEchecs,
  tutoratSaisieInvalide,
  type NiveauAide,
} from '../contenu/tutorat.js';
import { exercicesDuBloc, trouverExercice } from '../contenu/exercices.js';
import { LEÇONS_CANDIDATES, type SignatureErreur } from '../contenu/signatures.js';
import type { Exercice } from '../contenu/types.js';
import { estStatutReponse, STATUTS_REPONSE } from '../contenu/types.js';
import { ApiError } from '../lib/errors.js';
import {
  blocDisponible,
  DEBUT_ANNEE_DEFAUT,
  positionnerDansLAnnee,
  semainesAvantOuverture,
  type PositionDansLAnnee,
} from '../lib/calendrier.js';
import { evaluerProgression, type ReponseExercice } from '../lib/progression.js';
import { suivreProgression, type Observation } from '../lib/suivi.js';

/** Version de la forme du contrat métier. */
export const PARCOURS_VERSION = 'mvp-1';

/** Début de l'année scolaire, configurable sans redéploiement. */
function debutAnnee(): string {
  return process.env.ANNEE_SCOLAIRE_DEBUT ?? DEBUT_ANNEE_DEFAUT;
}

/** Date injectable : permet de tester l'ouverture des blocs sans dépendre du jour. */
function dateDuJour(): Date {
  const force = process.env.DATE_NAVIGATION_TEST;
  if (force !== undefined) {
    const date = new Date(`${force}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
      throw new ApiError(500, 'INTERNAL_ERROR', 'Date de test invalide.');
    }
    return date;
  }
  return new Date();
}

// ---------------------------------------------------------------------------
// Vue publique d'un exercice — jamais la réponse attendue
// ---------------------------------------------------------------------------

export interface ExercicePublic {
  readonly id: string;
  readonly blocId: string;
  readonly rang: number;
  readonly objectifs: readonly string[];
  readonly enonce: string;
  readonly consigne: string;
  readonly typeReponse: string;
  readonly formeDemandee: string | null;
  readonly nbIndices: number;
  readonly origine: string;
}

/** Projection sûre d'un exercice vers le client. */
export function exercicePublic(exercice: Exercice): ExercicePublic {
  return {
    id: exercice.id,
    blocId: exercice.blocId,
    rang: exercice.rang,
    objectifs: exercice.objectifs,
    enonce: exercice.enonce,
    consigne: exercice.consigne,
    typeReponse: exercice.typeReponse,
    formeDemandee: formeDemandee(exercice),
    nbIndices: exercice.indices.length,
    origine: exercice.origine,
  };
}

export interface BlocPublic {
  readonly id: string;
  readonly titre: string;
  readonly leconId: string;
  readonly volumeHoraireH: number;
  readonly semaineDebut: number;
  readonly disponible: boolean;
  readonly semainesAvantOuverture: number | null;
  readonly objectifs: ReadonlyArray<{
    readonly id: string;
    readonly libelle: string;
    readonly prerequis: readonly string[];
  }>;
  readonly exercices: readonly ExercicePublic[];
}

export interface ParcoursResponse {
  readonly version: string;
  readonly anneeScolaire: {
    readonly debut: string;
    readonly semaine: number | null;
    readonly dansAnneeScolaire: boolean;
    readonly anneeTerminee: boolean;
  };
  readonly message: string;
  readonly blocs: readonly BlocPublic[];
}

function construireParcours(position: PositionDansLAnnee): ParcoursResponse {
  const blocs: BlocPublic[] = BLOCS.map((bloc) => {
    const disponible = blocDisponible(bloc.semaineDebut, position);
    return {
      id: bloc.id,
      titre: bloc.titre,
      leconId: bloc.leconId,
      volumeHoraireH: bloc.volumeHoraireH,
      semaineDebut: bloc.semaineDebut,
      disponible,
      semainesAvantOuverture: semainesAvantOuverture(bloc.semaineDebut, position),
      objectifs: bloc.objectifs.map((id) => {
        const objectif = trouverObjectif(id);
        return {
          id,
          libelle: objectif?.libelle ?? '',
          prerequis: objectif?.prerequis ?? [],
        };
      }),
      // ⚠️ Les exercices d'un bloc non ouvert ne sont **pas** envoyés : on
      // n'expose à l'élève que ce qu'il peut réellement travailler.
      exercices: disponible ? exercicesDuBloc(bloc.id).map(exercicePublic) : [],
    };
  });

  const message = position.dansAnneeScolaire
    ? `Semaine ${position.semaine} de l’année scolaire.`
    : position.anneeTerminee
      ? 'L’année scolaire du référentiel est terminée. Les blocs se rouvrent à la rentrée.'
      : 'L’année scolaire n’a pas commencé. Les blocs restent fermés.';

  return {
    version: PARCOURS_VERSION,
    anneeScolaire: {
      debut: debutAnnee(),
      semaine: position.semaine,
      dansAnneeScolaire: position.dansAnneeScolaire,
      anneeTerminee: position.anneeTerminee,
    },
    message,
    blocs,
  };
}

// ---------------------------------------------------------------------------
// Contrôle d'accès au contenu
// ---------------------------------------------------------------------------

/**
 * Un exercice n'est servi que si son bloc est **ouvert à la date du jour**.
 *
 * Le garde-fou est unique et appelé par *toutes* les routes qui touchent à un
 * exercice : énoncé, indice et correction. Il ne suffit pas de masquer la
 * liste du parcours — une URL d'énoncé connue, ou un identifiant d'exercice
 * deviné, ne doit pas contourner le calendrier.
 */
function verifierExerciceAccessible(exercice: Exercice): void {
  const bloc = trouverBloc(exercice.blocId);
  const position = positionnerDansLAnnee(dateDuJour(), debutAnnee());

  if (!bloc || !blocDisponible(bloc.semaineDebut, position)) {
    // 403 : l'exercice existe mais n'est pas encore au programme de l'élève.
    throw new ApiError(
      403,
      'BAD_REQUEST',
      `Ce contenu fait partie du bloc « ${bloc?.titre ?? exercice.blocId} », qui s’ouvre en semaine ${bloc?.semaineDebut ?? '?'}.`,
    );
  }
}

/** Résout un identifiant d'exercice et contrôle son ouverture. */
function exerciceAccessible(id: unknown): Exercice {
  if (typeof id !== 'string' || id === '') {
    throw new ApiError(400, 'BAD_REQUEST', 'Champ « exerciceId » manquant.');
  }
  const exercice = trouverExercice(id);
  if (!exercice) {
    throw ApiError.notFound('Exercice introuvable.');
  }
  verifierExerciceAccessible(exercice);
  return exercice;
}

// ---------------------------------------------------------------------------
// Enregistrement des routes
// ---------------------------------------------------------------------------

export function registerParcoursRoutes(app: FastifyInstance): void {
  /** Panorama des blocs et de leur ouverture. */
  app.get('/api/v1/parcours', async () => construireParcours(positionnerDansLAnnee(dateDuJour(), debutAnnee())));

  /** Un exercice précis. Refusé si son bloc n'est pas encore ouvert. */
  app.get('/api/v1/exercices/:id', async (request, reply) => {
    const params = request.params as { id?: string };
    const exercice = exerciceAccessible(params.id);
    return reply.status(200).send(exercicePublic(exercice));
  });

  /** Un indice, palier par palier. Jamais la solution complète. */
  app.get('/api/v1/exercices/:id/indice/:palier', async (request, reply) => {
    const params = request.params as { id?: string; palier?: string };
    const exercice = exerciceAccessible(params.id);

    const palier = Number(params.palier);
    if (!Number.isInteger(palier) || palier < 1 || palier > exercice.indices.length) {
      throw ApiError.notFound('Indice indisponible.');
    }

    const indice = exercice.indices[palier - 1];
    return reply.status(200).send({ palier, texte: indice?.texte ?? '' });
  });

  /**
   * Correction d'une réponse.
   *
   * Le corps ne contient que l'identifiant de l'exercice, la saisie et le
   * **nombre d'échecs déjà essuyés** sur cet exercice. Aucun nom, aucun
   * identifiant d'élève, aucune date de naissance. Rien n'est stocké côté
   * serveur — la réponse est corrigée, l'aide est calculée, puis tout est
   * oublié. La mémoire de la tentative est locale au navigateur de l'élève.
   */
  app.post('/api/v1/corrections', async (request, reply) => {
    const corps = (request.body ?? {}) as {
      exerciceId?: unknown;
      reponse?: unknown;
      indiceDemande?: unknown;
      nbEchecs?: unknown;
    };

    if (typeof corps.exerciceId !== 'string' || corps.exerciceId === '') {
      throw new ApiError(400, 'BAD_REQUEST', 'Champ « exerciceId » manquant.');
    }
    if (typeof corps.reponse !== 'string') {
      throw new ApiError(400, 'BAD_REQUEST', 'Champ « reponse » manquant.');
    }

    // Même garde que l'énoncé et l'indice : on ne corrige pas une leçon qui
    // n'est pas encore au programme de l'élève.
    const exercice = exerciceAccessible(corps.exerciceId);

    const indiceDemande =
      typeof corps.indiceDemande === 'number' ? corps.indiceDemande : null;

    // Le nombre d'échecs est une **contexte de progression**, pas une donnée
    // sensible : il détermine quel niveau d'aide rendre. Il est borné et
    // normalisé, et une valeur absurde retombe sur le niveau 1 plutôt que
    // d'escalader.
    const nbEchecs = normaliserNbEchecs(corps.nbEchecs);

    let correction: CorrectionComplete;
    try {
      correction = corriger(exercice, corps.reponse, indiceDemande);
    } catch (erreur) {
      // 422 : la requête est comprise, la réponse d'élève ne l'est pas. Le
      // message est destiné à l'élève et ne révèle rien du corrigé.
      //
      // Une saisie illisible n'est pas une erreur de l'élève sur le fond : on ne
      // lui attribue donc **aucune** cause, seulement une consigne de réécriture.
      return reply.status(422).send({
        erreurSaisie: true,
        message: messagePourErreur(erreur),
        exerciceId: exercice.id,
        categorieDifficulte: 'reponse_illisible',
        tutorat: tutoratSaisieInvalide(exercice),
      });
    }

    return reply.status(200).send({
      exerciceId: correction.exerciceId,
      objectifId: correction.objectifId,
      // Les trois axes, séparément : le client ne doit jamais les confondre.
      mathemathiquementJuste: correction.mathemathiquementJuste,
      formeRespectee: correction.formeRespectee,
      achevement: correction.achevement,
      statut: correction.statut,
      // Verdict pédagogique (décision D5) et son libellé exact. Le frontend
      // affiche `libelle` tel quel : il ne peut pas diverger de la règle.
      verdict: correction.verdict,
      libelle: correction.libelle,
      signatureErreur: correction.signatureErreur,
      leconsCandidates: LEÇONS_CANDIDATES[correction.signatureErreur as SignatureErreur] ?? [],
      explication: correction.explication,
      indice: correction.indice,
      // Signale explicitement qu'une lecture n'est pas arbitrée. Le client ne
      // doit pas présenter ce cas comme une conclusion ferme.
      lectureArbitree: correction.lectureArbitree,
      pointsArbitrage: correction.pointsArbitrage,
      // --- Chantier 7.5 : accompagnement pas à pas -------------------------
      // Le verdict D5 ne change pas. `tutorat` s'y ajoute : c'est le texte
      // progressif réellement affiché à l'élève, choisi selon le verdict et le
      // nombre d'échecs déjà essuyés.
      //
      // `categorieDifficulte` vaut `null` quand la réponse est juste : aucune
      // erreur n'est alors constatée. Une erreur non qualifiable donne
      // `erreur_non_identifiee` — jamais une cause devinée.
      categorieDifficulte: categoriePour(correction),
      tutorat: construireTutorat(exercice, correction, nbEchecs),
    });
  });

  /**
   * Progression d'un élève, calculée **sans aucune persistance**.
   *
   * Le client transmet uniquement des statuts (et des identifiants
   * d'exercice) ; le serveur ne conserve rien. C'est la conséquence directe
   * du fait que la durée de conservation des réponses n'est pas arbitrée :
   * tant qu'elle ne l'est pas, on n'écrit rien.
   */
  app.post('/api/v1/progression', async (request, reply) => {
    const corps = (request.body ?? {}) as { reponses?: unknown };
    if (corps.reponses !== undefined && !Array.isArray(corps.reponses)) {
      throw new ApiError(400, 'BAD_REQUEST', 'Champ « reponses » : une liste est attendue.');
    }

    const brutes = (corps.reponses ?? []) as Array<Record<string, unknown>>;
    const reponses: ReponseExercice[] = [];

    for (const item of brutes) {
      const exerciceId = item.exerciceId;
      const statut = item.statut;
      if (typeof exerciceId !== 'string' || typeof statut !== 'string') {
        throw new ApiError(400, 'BAD_REQUEST', 'Chaque réponse doit porter exerciceId et statut.');
      }
      // ⚠️ Le statut est un **vocabulaire fermé**. L'accepter tel quel
      // reviendrait à laisser le client introduire des états que le moteur ne
      // connaît pas — dont `non_acquis`, qui n'existe pas dans ce modèle et
      // n'a rien à y faire. Une valeur hors liste est refusée, jamais devinée.
      if (!estStatutReponse(statut)) {
        throw new ApiError(
          400,
          'BAD_REQUEST',
          `Statut inconnu : « ${statut} ». Valeurs acceptées : ${STATUTS_REPONSE.join(', ')}.`,
        );
      }
      const exercice = exerciceAccessible(exerciceId);
      reponses.push({
        exerciceId,
        objectifId: exercice.objectifs[0] ?? '',
        statut,
      });
    }

    const idsObjectifs = OBJECTIFS.map((objectif) => objectif.id);
    return reply.status(200).send({
      objectifs: evaluerProgression(reponses, idsObjectifs),
      // Rappel permanent : aucun niveau global n'est produit.
      avertissement:
        'Cette progression porte sur les seuls exercices-traités. Elle ne donne aucun niveau et aucune note.',
    });
  });

  /**
   * Suivi des difficultés par objectif — chantier 7.5.
   *
   * ## Calculé, jamais stocké
   *
   * Comme `/api/v1/progression`, cette route est **sans état**. Le client lui
   * transmet ses observations, le serveur les agrège et les rend : rien n'est
   * écrit. La conservation est locale au navigateur (voir `observations.ts`),
   * et le rapport de chantier énonce les limites de ce choix.
   *
   * ## Chaque champ est validé, rien n'est deviné
   *
   * Le serveur applique la même règle que pour les statuts : un vocabulaire
   * **fermé**, contrôlé à l'exécution. Une observation portant une catégorie
   * de difficulté hors catalogue, ou un statut inconnu, est refusée. Le client
   * ne peut pas introduire un état que le moteur n'a jamais émis.
   *
   * Chaque `exerciceId` passe par le même garde d'accès que l'énoncé et la
   * correction : on ne suit pas une leçon que l'élève n'a pas le droit de
   * travailler.
   */
  app.post('/api/v1/suivi', async (request, reply) => {
    const corps = (request.body ?? {}) as { observations?: unknown };
    if (corps.observations !== undefined && !Array.isArray(corps.observations)) {
      throw new ApiError(400, 'BAD_REQUEST', 'Champ « observations » : une liste est attendue.');
    }

    const brutes = (corps.observations ?? []) as Array<Record<string, unknown>>;
    const observations: Observation[] = [];

    for (const item of brutes) {
      const exerciceId = item.exerciceId;
      if (typeof exerciceId !== 'string' || exerciceId === '') {
        throw new ApiError(400, 'BAD_REQUEST', 'Chaque observation doit porter un exerciceId.');
      }

      const statut = item.statut;
      if (typeof statut !== 'string' || !estStatutReponse(statut)) {
        throw new ApiError(
          400,
          'BAD_REQUEST',
          `Statut inconnu : « ${String(statut)} ». Valeurs acceptées : ${STATUTS_REPONSE.join(', ')}.`,
        );
      }

      // La catégorie est facultative : l'absence signifie « aucune erreur ».
      // Une valeur présente doit appartenir au catalogue — sinon elle est
      // refusée, jamais ramenée de force à « inconnue », qui dirait autre chose.
      const categorie = item.categorie;
      if (categorie !== undefined && categorie !== null) {
        if (typeof categorie !== 'string' || !estCategorieDifficulte(categorie)) {
          throw new ApiError(
            400,
            'BAD_REQUEST',
            `Catégorie de difficulté inconnue. Valeurs acceptées : ${CATEGORIES_DIFICULTE.join(', ')}.`,
          );
        }
      }

      const rang = item.rang;
      if (typeof rang !== 'number' || !Number.isInteger(rang) || rang < 1 || rang > 50) {
        throw new ApiError(400, 'BAD_REQUEST', 'Champ « rang » : un entier entre 1 et 50 est attendu.');
      }

      const niveauAide = item.niveauAide;
      if (niveauAide !== undefined && niveauAide !== null) {
        if (niveauAide !== 1 && niveauAide !== 2 && niveauAide !== 3) {
          throw new ApiError(400, 'BAD_REQUEST', 'Champ « niveauAide » : 1, 2 ou 3 est attendu.');
        }
      }

      const reponse = item.reponse;
      if (typeof reponse !== 'string' || reponse.length > 200) {
        throw new ApiError(400, 'BAD_REQUEST', 'Champ « reponse » : texte court attendu.');
      }

      // Même garde que l'énoncé et la correction : le suivi ne doit pas
      // devenir un canal d'accès à un bloc fermé.
      const exercice = exerciceAccessible(exerciceId);

      observations.push({
        exerciceId,
        objectifId: exercice.objectifs[0] ?? '',
        rang,
        reponse,
        statut,
        categorie: (categorie ?? null) as Observation['categorie'],
        niveauAide: (niveauAide ?? null) as NiveauAide | null,
        reussiteApresAides: item.reussiteApresAides === true,
      });
    }

    const idsObjectifs = OBJECTIFS.map((objectif) => objectif.id);
    return reply.status(200).send({
      objectifs: suivreProgression(observations, idsObjectifs),
      // Rappel permanent, aligné sur celui de `/progression`.
      avertissement:
        'Ce suivi porte sur les seuls exercices travaillés sur cet appareil. Il ne donne aucun niveau global, aucune note, et une réussite après aide ne vaut pas maîtrise confirmée.',
      // Rappel explicite du lieu de conservation, pour que personne ne croie à
      // un historique durable côté serveur.
      conservation:
        'Aucune donnée n’est conservée par le serveur : les observations sont conservées dans le navigateur de l’élève et lui sont renvoyées pour calcul.',
    });
  });
}