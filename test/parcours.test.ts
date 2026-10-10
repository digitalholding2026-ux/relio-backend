import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { buildApp } from '../src/app.js';
import { EXERCICES } from '../src/contenu/exercices.js';
import { DEBUT_ANNEE_DEFAUT } from '../src/lib/calendrier.js';

/**
 * Tests des routes métier du MVP.
 *
 * `app.inject()` : aucun port ouvert, aucun trafic sortant. La date est forcée
 * par `DATE_NAVIGATION_TEST` pour rendre l'ouverture des blocs déterministe.
 */

const configDeTest = {
  port: 0,
  host: '127.0.0.1',
  env: 'test' as const,
  corsOrigins: ['https://relio-frontend.vercel.app'],
  isProduction: false,
};

/** Semaine de cours voulue : 1-based. */
function forcerSemaine(semaine: number): void {
  const debut = new Date(`${DEBUT_ANNEE_DEFAUT}T00:00:00.000Z`);
  debut.setUTCDate(debut.getUTCDate() + (semaine - 1) * 7 + 3);
  process.env.DATE_NAVIGATION_TEST = debut.toISOString().slice(0, 10);
}

type App = Awaited<ReturnType<typeof buildApp>>;
let app: App;

beforeEach(async () => {
  app = await buildApp(configDeTest);
});

afterEach(async () => {
  // Les deux variables pilotent le calendrier : elles ne doivent jamais
  // survivre à un test, sous peine de contaminer le suivant.
  delete process.env.DATE_NAVIGATION_TEST;
  delete process.env.ANNEE_SCOLAIRE_DEBUT;
  await app.close();
});

describe('GET /api/v1/parcours', () => {
  it('n’expose que le bloc ouvert à la semaine courante', async () => {
    forcerSemaine(1);

    const corps = (await app.inject({ method: 'GET', url: '/api/v1/parcours' })).json();

    assert.equal(corps.anneeScolaire.semaine, 1);
    const ouverts = corps.blocs.filter((bloc: { disponible: boolean }) => bloc.disponible);
    assert.deepEqual(ouverts.map((bloc: { id: string }) => bloc.id), ['B1']);
    // Les exercices des blocs fermés ne sont même pas envoyés.
    const fermes = corps.blocs.find((bloc: { id: string }) => bloc.id === 'B3');
    assert.deepEqual(fermes.exercices, []);
  });

  it('ouvre B2 en semaine 5 et B3 en semaine 10', async () => {
    forcerSemaine(5);
    const semaine5 = (await app.inject({ method: 'GET', url: '/api/v1/parcours' })).json();
    assert.deepEqual(
      semaine5.blocs.filter((b: { disponible: boolean }) => b.disponible).map((b: { id: string }) => b.id),
      ['B1', 'B2'],
    );

    forcerSemaine(10);
    const semaine10 = (await app.inject({ method: 'GET', url: '/api/v1/parcours' })).json();
    assert.deepEqual(
      semaine10.blocs.filter((b: { disponible: boolean }) => b.disponible).map((b: { id: string }) => b.id),
      ['B1', 'B2', 'B3'],
    );
    assert.equal(semaine10.blocs.find((b: { id: string }) => b.id === 'B3').exercices.length, 3);
  });

  it('annonce explicitement la fermeture hors année scolaire', async () => {
    forcerSemaine(45);

    const corps = (await app.inject({ method: 'GET', url: '/api/v1/parcours' })).json();

    assert.equal(corps.anneeScolaire.dansAnneeScolaire, false);
    assert.equal(corps.anneeScolaire.anneeTerminee, true);
    assert.match(corps.message, /terminée/);
    for (const bloc of corps.blocs) {
      assert.equal(bloc.disponible, false);
      assert.deepEqual(bloc.exercices, []);
    }
  });

  it('ne transmet jamais la réponse attendue', async () => {
    forcerSemaine(10);

    const corps = (await app.inject({ method: 'GET', url: '/api/v1/parcours' })).json();

    for (const bloc of corps.blocs) {
      for (const exercice of bloc.exercices) {
        const attendu = EXERCICES.find((e) => e.id === exercice.id)?.reponseAttendue ?? null;
        assert.ok(!JSON.stringify(exercice).includes(attendu ?? '§'));
      }
      assert.ok(!JSON.stringify(bloc).includes('reponseAttendue'));
    }
  });
});

describe('GET /api/v1/exercices/:id', () => {
  it('renvoie l’énoncé d’un exercice ouvert', async () => {
    forcerSemaine(1);

    const reponse = await app.inject({ method: 'GET', url: '/api/v1/exercices/MVP-B1-E1' });

    assert.equal(reponse.statusCode, 200);
    const corps = reponse.json();
    assert.equal(corps.id, 'MVP-B1-E1');
    assert.ok(corps.enonce.length > 0);
    assert.equal(corps.nbIndices, 3);
    assert.equal(corps.sourceBepc, undefined);
  });

  it('refuse un exercice d’un bloc encore fermé', async () => {
    forcerSemaine(1);

    const reponse = await app.inject({ method: 'GET', url: '/api/v1/exercices/MVP-B3-E1' });

    assert.equal(reponse.statusCode, 403);
    assert.match(reponse.json().error.message, /semaine 10/);
  });

  it('renvoie 404 pour un exercice inconnu', async () => {
    const reponse = await app.inject({ method: 'GET', url: '/api/v1/exercices/INCONNU' });
    assert.equal(reponse.statusCode, 404);
  });

  it('exige un identifiant', async () => {
    // Une route paramétrée sans segment : l'identifiant est vide, pas « absent ».
    const reponse = await app.inject({ method: 'GET', url: '/api/v1/exercices/' });
    assert.ok([400, 404].includes(reponse.statusCode), `Statut inattendu : ${reponse.statusCode}`);
  });
});

describe('GET /api/v1/exercices/:id/indice/:palier', () => {
  it('renvoie les paliers un par un', async () => {
    forcerSemaine(1);

    const premier = await app.inject({ method: 'GET', url: '/api/v1/exercices/MVP-B1-E1/indice/1' });
    assert.equal(premier.statusCode, 200);
    assert.equal(premier.json().palier, 1);

    const horsBornes = await app.inject({ method: 'GET', url: '/api/v1/exercices/MVP-B1-E1/indice/9' });
    assert.equal(horsBornes.statusCode, 404);
  });
});

describe('POST /api/v1/corrections', () => {
  it('corrige une réponse juste et renvoie les trois axes', async () => {
    forcerSemaine(1);

    const reponse = await app.inject({
      method: 'POST',
      url: '/api/v1/corrections',
      payload: { exerciceId: 'MVP-B1-E1', reponse: '1 + 2x' },
    });

    assert.equal(reponse.statusCode, 200);
    const corps = reponse.json();
    assert.equal(corps.mathemathiquementJuste, true);
    assert.equal(corps.formeRespectee, null);
    assert.equal(corps.statut, 'correcte');
    assert.equal(corps.exerciceId, 'MVP-B1-E1');
  });

  it('distingue valeur juste et forme non respectée', async () => {
    forcerSemaine(1);

    const reponse = await app.inject({
      method: 'POST',
      url: '/api/v1/corrections',
      payload: { exerciceId: 'MVP-B1-E4', reponse: '4x^2 - 9' },
    });

    const corps = reponse.json();
    assert.equal(corps.mathemathiquementJuste, true);
    assert.equal(corps.formeRespectee, false);
    assert.equal(corps.statut, 'partielle');
    assert.equal(corps.signatureErreur, 'non_factorise');
    // Décision D5 : le verdict est renvoyé et tranché, avec son libellé.
    assert.equal(corps.verdict, 'resultat_juste_consigne_non_respectee');
    assert.match(corps.libelle, /Ton calcul est juste/);
    assert.equal(corps.lectureArbitree, true);
    assert.deepEqual(corps.pointsArbitrage, []);
  });

  it('renvoie 422 sur une réponse illisible, sans rien divulguer', async () => {
    forcerSemaine(1);

    const reponse = await app.inject({
      method: 'POST',
      url: '/api/v1/corrections',
      payload: { exerciceId: 'MVP-B1-E1', reponse: '$$$' },
    });

    assert.equal(reponse.statusCode, 422);
    const corps = reponse.json();
    assert.equal(corps.erreurSaisie, true);
    assert.ok(corps.message.length > 0);
    assert.ok(!JSON.stringify(corps).includes('2x + 1'));
  });

  it('valide le corps de la requête', async () => {
    const sansId = await app.inject({ method: 'POST', url: '/api/v1/corrections', payload: {} });
    assert.equal(sansId.statusCode, 400);

    const sansReponse = await app.inject({
      method: 'POST',
      url: '/api/v1/corrections',
      payload: { exerciceId: 'MVP-B1-E1' },
    });
    assert.equal(sansReponse.statusCode, 400);

    const exerciceInconnu = await app.inject({
      method: 'POST',
      url: '/api/v1/corrections',
      payload: { exerciceId: 'INCONNU', reponse: '1' },
    });
    assert.equal(exerciceInconnu.statusCode, 404);
  });

  it('accepte une réponse algébriquement équivalente à la réponse attendue', async () => {
    forcerSemaine(1);

    const reponse = await app.inject({
      method: 'POST',
      url: '/api/v1/corrections',
      payload: { exerciceId: 'MVP-B1-E5', reponse: 'x^2 - 7x' },
    });

    const corps = reponse.json();
    // La réponse est juste, mais pas dans la forme demandée.
    assert.equal(corps.mathemathiquementJuste, true);
    assert.equal(corps.statut, 'partielle');
  });

  // ── Garde-fou calendrier (chantier 6, F2) ──────────────────────────────
  // Masquer la liste du parcours ne suffit pas : un identifiant deviné ou une
  // URL connue ne doit pas permettre de travailler une leçon non encore
  // enseignée. Le même contrôle doit donc s'appliquer à l'énoncé, à l'indice
  // **et** à la correction.
  it('refuse de corriger un exercice d’un bloc pas encore ouvert', async () => {
    forcerSemaine(1);

    const reponse = await app.inject({
      method: 'POST',
      url: '/api/v1/corrections',
      payload: { exerciceId: 'MVP-B3-E1', reponse: '1/8' },
    });

    assert.equal(reponse.statusCode, 403);
    assert.match(reponse.json().error.message, /semaine 10/);
    // Le refus ne doit rien divulguer de l'exercice.
    assert.ok(!JSON.stringify(reponse.json()).includes('irréductible'));
  });

  it('refuse un indice d’un bloc pas encore ouvert', async () => {
    forcerSemaine(1);

    const reponse = await app.inject({
      method: 'GET',
      url: '/api/v1/exercices/MVP-B3-E1/indice/1',
    });

    assert.equal(reponse.statusCode, 403);
  });

  it('laisse corriger un bloc ouvert', async () => {
    forcerSemaine(10);

    const reponse = await app.inject({
      method: 'POST',
      url: '/api/v1/corrections',
      payload: { exerciceId: 'MVP-B3-E1', reponse: '1/8' },
    });

    assert.equal(reponse.statusCode, 200);
    assert.equal(reponse.json().statut, 'correcte');
  });

  it('ferme tous les accès aux exercices hors année scolaire', async () => {
    forcerSemaine(45);

    for (const requete of [
      { method: 'GET' as const, url: '/api/v1/exercices/MVP-B1-E1' },
      { method: 'GET' as const, url: '/api/v1/exercices/MVP-B1-E1/indice/1' },
      {
        method: 'POST' as const,
        url: '/api/v1/corrections',
        payload: { exerciceId: 'MVP-B1-E1', reponse: '2x + 1' },
      },
    ]) {
      const reponse = await app.inject(requete);
      assert.equal(reponse.statusCode, 403, `${requete.method} ${requete.url}`);
    }
  });
});

describe('année scolaire 2026-2027 — configuration et protection des blocs', () => {
  // Le helper `forcerSemaine` de ce fichier ancre la date sur
  // `DEBUT_ANNEE_DEFAUT`, qui vaut désormais 2026-09-07 (lundi). Ces tests
  // vérifient que l'API lit bien la variable d'environnement, et que le
  // garde-fou calendrier tient sur l'année réellement en cours.

  it('expose la date de début configurée dans la réponse', async () => {
    forcerSemaine(1);
    const corps = (await app.inject({ method: 'GET', url: '/api/v1/parcours' })).json();
    assert.equal(corps.anneeScolaire.debut, '2026-09-07');
  });

  it('suit la variable ANNEE_SCOLAIRE_DEBUT lorsqu’elle est définie', async () => {
    // ⚠️ `forcerSemaine` ancre la date sur `DEBUT_ANNEE_DEFAUT` (7 septembre),
    // pas sur la variable. Pour tester une rentrée plus tardive, il faut une
    // date postérieure à cette rentrée-là : on se place donc en semaine 1 de
    // septembre, mais au moment où la nouvelle rentrée est déjà passée.
    //
    // Le but du test est de prouver que la variable **prime sur le défaut** :
    // avec une rentrée au 14 septembre, une date du 7 septembre (semaine 1
    // du défaut) doit être déclarée « hors année scolaire ».
    forcerSemaine(1);
    process.env.ANNEE_SCOLAIRE_DEBUT = '2026-09-14';

    const corps = (await app.inject({ method: 'GET', url: '/api/v1/parcours' })).json();

    // La variable est bien celle qui est utilisée…
    assert.equal(corps.anneeScolaire.debut, '2026-09-14');
    // …et elle prime effectivement sur le défaut du code : le 7 septembre
    // serait la semaine 1 si le défaut était encore utilisé.
    assert.equal(corps.anneeScolaire.dansAnneeScolaire, false);
    assert.equal(corps.anneeScolaire.semaine, null);

    delete process.env.ANNEE_SCOLAIRE_DEBUT;

    // Sans la variable, le défaut reprend la main et la même date est en S1.
    const avecDefaut = (await app.inject({ method: 'GET', url: '/api/v1/parcours' })).json();
    assert.equal(avecDefaut.anneeScolaire.debut, '2026-09-07');
    assert.equal(avecDefaut.anneeScolaire.semaine, 1);
    assert.ok(
      avecDefaut.blocs.find((b: { id: string }) => b.id === 'B1').disponible,
      'B1 doit être ouvert en semaine 1 de l’année par défaut.',
    );
  });

  it('retombe sur le défaut quand la variable est absente', async () => {
    delete process.env.ANNEE_SCOLAIRE_DEBUT;
    forcerSemaine(1);
    const corps = (await app.inject({ method: 'GET', url: '/api/v1/parcours' })).json();
    assert.equal(corps.anneeScolaire.debut, DEBUT_ANNEE_DEFAUT);
  });

  it('ouvre les trois blocs aux semaines 1, 5 et 10 de 2026-2027', async () => {
    forcerSemaine(1);
    const s1 = (await app.inject({ method: 'GET', url: '/api/v1/parcours' })).json();
    assert.deepEqual(
      s1.blocs.filter((b: { disponible: boolean }) => b.disponible).map((b: { id: string }) => b.id),
      ['B1'],
    );

    forcerSemaine(5);
    const s5 = (await app.inject({ method: 'GET', url: '/api/v1/parcours' })).json();
    assert.deepEqual(
      s5.blocs.filter((b: { disponible: boolean }) => b.disponible).map((b: { id: string }) => b.id),
      ['B1', 'B2'],
    );

    forcerSemaine(10);
    const s10 = (await app.inject({ method: 'GET', url: '/api/v1/parcours' })).json();
    assert.deepEqual(
      s10.blocs.filter((b: { disponible: boolean }) => b.disponible).map((b: { id: string }) => b.id),
      ['B1', 'B2', 'B3'],
    );
  });

  it('refuse énoncé, indice et correction d’un bloc fermé, en 2026-2027', async () => {
    forcerSemaine(1); // semaine 1 : seuls B1 est ouvert

    // B3 ouvre en semaine 10 : tout son contenu doit être refusé.
    for (const requete of [
      { method: 'GET' as const, url: '/api/v1/exercices/MVP-B3-E1' },
      { method: 'GET' as const, url: '/api/v1/exercices/MVP-B3-E1/indice/1' },
      { method: 'GET' as const, url: '/api/v1/exercices/MVP-B2-E1/indice/2' },
      {
        method: 'POST' as const,
        url: '/api/v1/corrections',
        payload: { exerciceId: 'MVP-B3-E1', reponse: '1/8' },
      },
      {
        method: 'POST' as const,
        url: '/api/v1/progression',
        payload: { reponses: [{ exerciceId: 'MVP-B2-E1', statut: 'fausse' }] },
      },
    ]) {
      const reponse = await app.inject(requete);
      assert.equal(reponse.statusCode, 403, `${requete.method} ${requete.url}`);
    }

    // B1 est ouvert : le même exercice est accessible.
    const ouvert = await app.inject({ method: 'GET', url: '/api/v1/exercices/MVP-B1-E1' });
    assert.equal(ouvert.statusCode, 200);
  });

  it('laisse corriger et donner un indice dans un bloc ouvert', async () => {
    forcerSemaine(10); // B3 ouvert

    const indice = await app.inject({ method: 'GET', url: '/api/v1/exercices/MVP-B3-E1/indice/1' });
    assert.equal(indice.statusCode, 200);
    assert.ok(indice.json().texte.length > 0);

    const correction = await app.inject({
      method: 'POST',
      url: '/api/v1/corrections',
      payload: { exerciceId: 'MVP-B3-E1', reponse: '1/8' },
    });
    assert.equal(correction.statusCode, 200);
    assert.equal(correction.json().statut, 'correcte');
  });
});

describe('décision D5 — cohérence du verdict renvoyé par l’API', () => {
  // Le frontend affiche `libelle` tel quel : le texte vu par l'élève est donc
  // produit, et vérifié, par le serveur. Ces tests verrouillent que l'API
  // renvoie bien les quatre verdicts et un libellé non vide, sans quoi
  // l'écran afficherait un champ vide.

  const CAS: ReadonlyArray<readonly [string, string, string]> = [
    ['MVP-B1-E4', '(2x-3)(2x+3)', 'correct'],
    ['MVP-B1-E4', '4x^2 - 9', 'resultat_juste_consigne_non_respectee'],
    ['MVP-B2-E1', '√(25×2)', 'partiellement_correct'],
    ['MVP-B2-E1', '7√2', 'incorrect'],
  ];

  it('renvoie le verdict et son libellé pour chaque cas', async () => {
    forcerSemaine(10); // tous les blocs ouverts

    for (const [exerciceId, reponse, verdictAttendu] of CAS) {
      const corps = (
        await app.inject({
          method: 'POST',
          url: '/api/v1/corrections',
          payload: { exerciceId, reponse },
        })
      ).json();

      assert.equal(corps.verdict, verdictAttendu, `${exerciceId} / « ${reponse} »`);
      assert.ok(
        typeof corps.libelle === 'string' && corps.libelle.trim().length > 0,
        `${exerciceId} / « ${reponse} » : libellé absent`,
      );
      // La décision D5 : jamais « incorrect » quand la valeur est exacte.
      if (corps.mathemathiquementJuste) {
        assert.notEqual(corps.verdict, 'incorrect', `${exerciceId} / « ${reponse} »`);
      }
    }
  });

  it('donne un libellé différent pour chaque verdict', async () => {
    forcerSemaine(10);
    const libelles = new Map<string, string>();

    for (const [exerciceId, reponse, verdict] of CAS) {
      const corps = (
        await app.inject({
          method: 'POST',
          url: '/api/v1/corrections',
          payload: { exerciceId, reponse },
        })
      ).json();

      const precedent = libelles.get(verdict);
      assert.ok(
        precedent === undefined || precedent === corps.libelle,
        `Verdict ${verdict} : deux libellés différents.`,
      );
      libelles.set(verdict, corps.libelle);
    }

    assert.equal(libelles.size, 4, 'Les quatre verdicts doivent être distincts.');
  });

  it('renvoie les trois axes séparés avec le verdict', async () => {
    forcerSemaine(10);
    const corps = (
      await app.inject({
        method: 'POST',
        url: '/api/v1/corrections',
        payload: { exerciceId: 'MVP-B2-E1', reponse: '√(25×2)' },
      })
    ).json();

    assert.equal(corps.mathemathiquementJuste, true);
    assert.equal(corps.formeRespectee, false);
    assert.equal(corps.achevement, 'inacheve');
    assert.equal(corps.verdict, 'partiellement_correct');
    assert.equal(corps.statut, 'partielle');
  });

  it('ne fuit pas la réponse attendue dans le libellé', async () => {
    forcerSemaine(10);
    for (const [exerciceId, reponse] of CAS) {
      const exercice = EXERCICES.find((e) => e.id === exerciceId);
      const corps = (
        await app.inject({
          method: 'POST',
          url: '/api/v1/corrections',
          payload: { exerciceId, reponse },
        })
      ).json();

      assert.ok(
        !JSON.stringify(corps.libelle).includes(exercice?.reponseAttendue ?? '§'),
        `${exerciceId} : la réponse attendue fuit dans le libellé.`,
      );
    }
  });
});

describe('POST /api/v1/progression', () => {
  it('calcule un statut par objectif sans rien stocker', async () => {
    // La date est forcée : ces tests ne doivent pas dépendre du jour réel, qui
    // est très probablement hors année scolaire — auquel cas tous les blocs
    // sont légitimement fermés et le test échouerait pour une bonne raison.
    forcerSemaine(10);

    const reponse = await app.inject({
      method: 'POST',
      url: '/api/v1/progression',
      payload: {
        reponses: [
          { exerciceId: 'MVP-B1-E1', statut: 'fausse' },
          { exerciceId: 'MVP-B1-E2', statut: 'fausse' },
        ],
      },
    });

    assert.equal(reponse.statusCode, 200);
    const corps = reponse.json();
    assert.equal(corps.objectifs.length, 5);
    assert.equal(corps.objectifs.find((o: { objectifId: string }) => o.objectifId === 'OO-L1-1').statut, 'hypothese');
    assert.match(corps.avertissement, /ne donne aucun niveau/);
  });

  it('refuse un exercice inconnu plutôt que de l’ignorer', async () => {
    forcerSemaine(10);

    const reponse = await app.inject({
      method: 'POST',
      url: '/api/v1/progression',
      payload: { reponses: [{ exerciceId: 'INCONNU', statut: 'correcte' }] },
    });
    assert.equal(reponse.statusCode, 404);
  });

  it('valide le format de la liste', async () => {
    forcerSemaine(10);

    const reponse = await app.inject({
      method: 'POST',
      url: '/api/v1/progression',
      payload: { reponses: 'nimporte quoi' },
    });
    assert.equal(reponse.statusCode, 400);
  });

  it('refuse un statut hors du vocabulaire fermé', async () => {
    forcerSemaine(10);

    // Le statut vient du client. Sans contrôle, celui-ci pourrait introduire
    // `non_acquis` ou `niveau_3` — des états que le modèle n'a pas le droit
    // d'émettre, et dont la règle des trois ne sait pas que faire.
    for (const statut of ['non_acquis', 'acquis', 'maitrise', 'CORRECTE', '']) {
      const reponse = await app.inject({
        method: 'POST',
        url: '/api/v1/progression',
        payload: { reponses: [{ exerciceId: 'MVP-B1-E1', statut }] },
      });
      assert.equal(reponse.statusCode, 400, `Statut accepté à tort : « ${statut} »`);
      assert.match(reponse.json().error.message, /Statut inconnu/);
    }
  });

  it('accepte chacun des quatre statuts du vocabulaire', async () => {
    forcerSemaine(10);

    for (const statut of ['correcte', 'partielle', 'fausse', 'indeterminee']) {
      const reponse = await app.inject({
        method: 'POST',
        url: '/api/v1/progression',
        payload: { reponses: [{ exerciceId: 'MVP-B1-E1', statut }] },
      });
      assert.equal(reponse.statusCode, 200, `Statut refusé à tort : « ${statut} »`);
    }
  });

  it('refuse une réponse portant sur un exercice d’un bloc fermé', async () => {
    forcerSemaine(1);

    const reponse = await app.inject({
      method: 'POST',
      url: '/api/v1/progression',
      payload: { reponses: [{ exerciceId: 'MVP-B3-E1', statut: 'fausse' }] },
    });

    assert.equal(reponse.statusCode, 403);
  });

  it('laisse un objectif sans réponse rester non_evalue', async () => {
    forcerSemaine(10);

    const reponse = await app.inject({
      method: 'POST',
      url: '/api/v1/progression',
      payload: { reponses: [{ exerciceId: 'MVP-B1-E1', statut: 'fausse' }] },
    });

    const corps = reponse.json();
    // Un objectif non testé ne doit jamais être dégradé en « non_acquis ».
    for (const objectif of corps.objectifs) {
      assert.notEqual(objectif.statut, 'non_acquis');
    }
    const nonTeste = corps.objectifs.find(
      (o: { objectifId: string }) => o.objectifId === 'OO-L3-1',
    );
    assert.equal(nonTeste.statut, 'non_evalue');
    assert.equal(nonTeste.sansDonnee, true);
  });
});
// ---------------------------------------------------------------------------
// Chantier 7.5 — tutorat et suivi
// ---------------------------------------------------------------------------

describe('POST /api/v1/corrections — tutorat (7.5)', () => {
  it('renvoie le premier niveau sans divulguer la réponse', async () => {
    forcerSemaine(1);

    const reponse = await app.inject({
      method: 'POST',
      url: '/api/v1/corrections',
      payload: { exerciceId: 'MVP-B1-E1', reponse: '4x + 1' },
    });

    assert.equal(reponse.statusCode, 200);
    const corps = reponse.json();
    assert.equal(corps.tutorat.niveau, 1);
    assert.equal(corps.tutorat.origine, 'signature');
    assert.equal(corps.tutorat.resume, null, 'Pas de bilan avant d’avoir compris.');
    assert.ok(!corps.tutorat.message.includes('2x + 1'), 'La réponse attendue est divulguée.');
  });

  it('fait progresser le niveau avec nbEchecs', async () => {
    forcerSemaine(1);

    const niveaux = [];
    for (const nbEchecs of [0, 1, 2]) {
      const reponse = await app.inject({
        method: 'POST',
        url: '/api/v1/corrections',
        payload: { exerciceId: 'MVP-B1-E1', reponse: '4x + 1', nbEchecs },
      });
      niveaux.push(reponse.json().tutorat.niveau);
    }

    assert.deepEqual(niveaux, [1, 2, 3]);
  });

  it('ignore un nbEchecs aberrant sans jamais planter', async () => {
    forcerSemaine(1);

    // Valeurs inexploitables : le contexte est traité comme absent, donc premier
    // niveau. Le serveur ne doit jamais se laisser porter par une valeur
    //arbinaire envoyée par un client.
    for (const valeur of [-3, 'beaucoup', null, {}]) {
      const reponse = await app.inject({
        method: 'POST',
        url: '/api/v1/corrections',
        payload: { exerciceId: 'MVP-B1-E1', reponse: '4x + 1', nbEchecs: valeur },
      });
      assert.equal(reponse.statusCode, 200, String(valeur));
      assert.equal(reponse.json().tutorat.niveau, 1, String(valeur));
    }
  });

  it('borne un nbEchecs surdimensionné au dernier niveau', async () => {
    forcerSemaine(1);

    // Un nombre aberrant mais numérique est plafonné. L'élève qui a réellement
    // échoué autant de fois reçoit le niveau 3, jamais un niveau hors échelle.
    const reponse = await app.inject({
      method: 'POST',
      url: '/api/v1/corrections',
      payload: { exerciceId: 'MVP-B1-E1', reponse: '4x + 1', nbEchecs: 1e9 },
    });

    assert.equal(reponse.statusCode, 200);
    assert.equal(reponse.json().tutorat.niveau, 3);
  });

  it('renvoie un bilan de méthode quand la réponse est juste', async () => {
    forcerSemaine(1);

    const reponse = await app.inject({
      method: 'POST',
      url: '/api/v1/corrections',
      payload: { exerciceId: 'MVP-B1-E1', reponse: '2x + 1', nbEchecs: 2 },
    });

    const corps = reponse.json();
    assert.equal(corps.tutorat.origine, 'bilan');
    assert.match(corps.tutorat.message, /2 essais/);
    assert.ok(corps.tutorat.resume && corps.tutorat.resume.length > 20);
    assert.equal(corps.categorieDifficulte, null, 'Une réussite n’est pas une difficulté.');
  });

  it('ne renvoie aucune catégorie quand la réponse est juste', async () => {
    // Semaine tardive : les trois blocs sont ouverts, les douze exercices
    // sont donc tous corrigibles.
    forcerSemaine(30);

    for (const exercice of EXERCICES) {
      const reponse = await app.inject({
        method: 'POST',
        url: '/api/v1/corrections',
        payload: { exerciceId: exercice.id, reponse: exercice.reponseAttendue },
      });
      assert.equal(reponse.json().categorieDifficulte, null, exercice.id);
    }
  });

  it('classe une erreur reconnue dans une catégorie nommée', async () => {
    forcerSemaine(1);

    const reponse = await app.inject({
      method: 'POST',
      url: '/api/v1/corrections',
      payload: { exerciceId: 'MVP-B1-E1', reponse: '4x + 1' },
    });

    assert.equal(reponse.json().categorieDifficulte, 'oubli_de_distribuer_un_facteur');
  });

  it('classe une erreur non reconnue comme inconnue, jamais comme une cause', async () => {
    forcerSemaine(1);

    const reponse = await app.inject({
      method: 'POST',
      url: '/api/v1/corrections',
      payload: { exerciceId: 'MVP-B1-E1', reponse: '999x + 999' },
    });

    assert.equal(reponse.json().categorieDifficulte, 'erreur_non_identifiee');
  });

  it('qualifie une saisie illisible sans lui attribuer de cause', async () => {
    forcerSemaine(1);

    const reponse = await app.inject({
      method: 'POST',
      url: '/api/v1/corrections',
      payload: { exerciceId: 'MVP-B1-E1', reponse: '$$$' },
    });

    assert.equal(reponse.statusCode, 422);
    const corps = reponse.json();
    assert.equal(corps.categorieDifficulte, 'reponse_illisible');
    assert.ok(corps.tutorat, 'Une aide doit être proposée même sur une saisie illisible.');
    assert.doesNotMatch(corps.tutorat.message, /tu as (oublié|confondu|perdu)/i);
  });

  it('reste fermé au calendrier : le tutorat ne déverrouille aucun bloc', async () => {
    forcerSemaine(1);

    const ouvert = await app.inject({
      method: 'POST',
      url: '/api/v1/corrections',
      payload: { exerciceId: 'MVP-B1-E1', reponse: '4x + 1', nbEchecs: 5 },
    });
    assert.equal(ouvert.statusCode, 200, 'sanité : B1 est ouvert en semaine 1');

    // Un bloc encore fermé reste inaccessible, même avec un contexte d'échecs.
    const ferme = await app.inject({
      method: 'POST',
      url: '/api/v1/corrections',
      payload: { exerciceId: 'MVP-B3-E1', reponse: '1/2', nbEchecs: 5 },
    });
    assert.equal(ferme.statusCode, 403);
    assert.equal(ferme.json().tutorat, undefined, 'Aucune aide n’est rendue sur un bloc fermé.');
  });
});

describe('POST /api/v1/suivi (7.5)', () => {
  const observation = (partiel: Record<string, unknown>) => ({
    exerciceId: 'MVP-B1-E1',
    rang: 1,
    reponse: '4x + 1',
    statut: 'fausse',
    categorie: 'erreur_de_signe',
    niveauAide: 1,
    reussiteApresAides: false,
    ...partiel,
  });

  it('agrège les observations par objectif', async () => {
    forcerSemaine(1);

    const reponse = await app.inject({
      method: 'POST',
      url: '/api/v1/suivi',
      payload: {
        observations: [
          observation({ rang: 1 }),
          observation({ rang: 2, statut: 'correcte', categorie: null }),
        ],
      },
    });

    assert.equal(reponse.statusCode, 200);
    const corps = reponse.json();
    const objectif = corps.objectifs.find((o: { objectifId: string }) => o.objectifId === 'OO-L1-1');
    assert.ok(objectif);
    assert.equal(objectif.reussisApresUnIndice, 1);
    assert.equal(objectif.niveau, 'a_confirmer');
  });

  it('reste vide et prudent sans observation', async () => {
    forcerSemaine(1);

    const reponse = await app.inject({
      method: 'POST',
      url: '/api/v1/suivi',
      payload: {},
    });

    assert.equal(reponse.statusCode, 200);
    for (const objectif of reponse.json().objectifs) {
      assert.equal(objectif.niveau, 'donnee_insuffisante');
    }
  });

  it('rappelle que rien n’est conservé et qu’aucun niveau global n’est produit', async () => {
    forcerSemaine(1);

    const corps = (
      await app.inject({ method: 'POST', url: '/api/v1/suivi', payload: {} })
    ).json();

    assert.match(corps.avertissement, /aucun niveau global/i);
    assert.match(corps.avertissement, /maîtrise/i);
    assert.match(corps.conservation, /Aucune donnée n’est conservée/);
  });

  it('refuse une catégorie de difficulté hors catalogue', async () => {
    forcerSemaine(1);

    const reponse = await app.inject({
      method: 'POST',
      url: '/api/v1/suivi',
      payload: { observations: [observation({ categorie: 'eleve_paresseux' })] },
    });

    assert.equal(reponse.statusCode, 400);
    assert.match(reponse.json().error.message, /Catégorie de difficulté inconnue/);
  });

  it('refuse un statut hors vocabulaire fermé', async () => {
    forcerSemaine(1);

    const reponse = await app.inject({
      method: 'POST',
      url: '/api/v1/suivi',
      payload: { observations: [observation({ statut: 'non_acquis' })] },
    });

    assert.equal(reponse.statusCode, 400);
  });

  it('refuse un niveau d’aide hors {1,2,3}', async () => {
    forcerSemaine(1);

    const reponse = await app.inject({
      method: 'POST',
      url: '/api/v1/suivi',
      payload: { observations: [observation({ niveauAide: 4 })] },
    });

    assert.equal(reponse.statusCode, 400);
  });

  it('refuse un rang impossible', async () => {
    forcerSemaine(1);

    for (const rang of [0, -1, 1.5, 999]) {
      const reponse = await app.inject({
        method: 'POST',
        url: '/api/v1/suivi',
        payload: { observations: [observation({ rang })] },
      });
      assert.equal(reponse.statusCode, 400, String(rang));
    }
  });

  it('n’accepte pas une observation sur un exercice inaccessible', async () => {
    forcerSemaine(1);

    const reponse = await app.inject({
      method: 'POST',
      url: '/api/v1/suivi',
      payload: { observations: [observation({ exerciceId: 'EXERCICE-IMAGINAIRE' })] },
    });

    assert.equal(reponse.statusCode, 404);
  });
});
