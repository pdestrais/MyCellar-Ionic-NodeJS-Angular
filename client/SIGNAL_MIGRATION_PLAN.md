# Migration vers Signaux (Angular 21) — Plan et liste des candidats

But

- Migrer progressivement les parties du client Angular qui utilisent des Observables/BehaviorSubject/.subscribe vers l'API Signaux (`signal`, `computed`, `effect`, `store.selectSignal`) pour réduire la dépendance à Zone.js et simplifier la détection de changements.

Contexte et recommandations générales

- Migration progressive recommandée : convertir d'abord les services centraux (ex. `auth.service`) puis des pages simples.
- Tester à chaque étape (`npm run buildProd`, tests unitaires, vérifications manuelles des UI principales).
- Ne pas retirer `zone.js` avant d'avoir validé que les dépendances tierces (Ionic, librairies) fonctionnent sans la zone ou que la logique n'en dépend pas.

Fichiers candidats (priorité haute → basse)

- services / state (priorité haute)

  - `src/app/services/auth.service.ts` (utilise `BehaviorSubject` pour `currentUser`) — très bon candidat
  - `src/app/services/menu.service.ts` (écoute `authenticationService.currentUser`) — dépendant de `auth.service`

- Pages / Components (utiliser `store.selectSignal` / `computed` / `signal`) :

  - `src/app/appellation/appellation.page.ts` (plusieurs `.subscribe`)
  - `src/app/region/region.page.ts` (plusieurs `.subscribe`)
  - `src/app/rapport/origines/origines.component.ts` (`route.data.subscribe`, autres subscribes)
  - `src/app/rapport/types/types.component.ts` (`route.data.subscribe`)
  - `src/app/rapport/wines/wines.component.ts` (`route.data.subscribe`)
  - `src/app/rapport/years/years.component.ts` (`route.data.subscribe`)
  - `src/app/ready-to-drink/ready-to-drink.page.ts` (observables/routing)
  - `src/app/app-home` / `home.page.ts` (déjà utilise `signal()`/`computed()` — bon modèle à suivre)
  - `src/app/user-management/*` (resetpwd/profile changepwd) — formulaires qui utilisent ReactiveForms/Observables

- Cas d'utilisation mixtes (examinés plus tard)
  - composants réutilisables (`viewer.component.ts`, `multi-level-side-menu.component.ts`) — vérifier dépendances à RxJS
  - modules NgRx usages : conserver les Observables côté effets, mais consommer via `store.selectSignal` si possible

Approche détaillée (étapes)

1. Préparation

   - Créer une branche `feature/signals-migration-plan` (prêt à merger).
   - Ajouter un test smoke baseline (build + run) pour comparer avant/après.

2. Étape 1 — Service d'authentification (Quick win)

   - Remplacer `BehaviorSubject<User|null>` par `signal<User|null>` interne.
   - Exposer un getter en lecture seule, ex: `currentUserSignal = computed(() => this._user());` ou `asReadonlySignal` pattern.
   - Adapter consommateurs : remplacer `auth.currentUser.subscribe(...)` par `computed(() => auth.currentUserSignal())` ou lecture directe `auth.currentUserSignal()` pour templates.
   - Tests : build + navigation login/profile + toast flows.

   Exemple de transformation (esquisse) :

   ```ts
   // avant (auth.service.ts)
   private currentUserSubject = new BehaviorSubject<User|null>(null);
   public currentUser = this.currentUserSubject.asObservable();

   // après
   private _currentUser = signal<User|null>(null);
   public currentUserSignal = computed(() => this._currentUser());

   // pour mettre à jour
   this._currentUser.set(user);
   ```

3. Étape 2 — Consommateurs simples

   - Remplacer les `.subscribe` qui se contentent d'assigner une variable locale par des `const mySignal = computed(() => this.store.selectSignal(selector)());` ou `toSignal(obs$)` si provient d'un observable externe.
   - Convertir `route.data.subscribe(...)` → `this.route.snapshot.data` (si données statiques à l'activation) ou `toSignal(this.route.data)` si besoin de réactivité.

4. Étape 3 — Pages avec formulaires et logiques plus lourdes

   - Utiliser `signal()` pour l'état local (ex. listes filtrées) et `computed` pour vues dérivées.
   - Remplacer les abonnements longs par `effect()` si nécessaire.

5. Étape 4 — Audit et cleanup

   - Rechercher et éliminer abonnements manuels (`.subscribe`) non nécessaires.
   - S'assurer que tous les `takeUntil(this.unsubscribe$)` sont maintenus dans les composants où l'abonnement est encore nécessaire.

6. Validation finale
   - `npm run buildProd` et tests unitaires
   - Tests manuels des écrans critiques (login, home, vin, rapport, préférences)

Risques & recommandations

- Certaines librairies attendent Zone.js — testez Ionic > 6 compatibility avec zoneless.
- Pour NgRx : garder l'utilisation d'Effects et Observables côté effets; consommer via `store.selectSignal` côté UI.

Plan de PR proposé

- Un premier PR « migration auth.service → signaux + adaptateurs consommateurs (menu.service, quelques pages) ».
- PR séparés pour conversions par groupe de pages (rapport, region/appellation, user-management).

Prochaine étape proposée

- Je peux implémenter automatiquement l'étape 1 (auth.service + menu.service + 2 pages consommateurs) et générer une branche/PR. Voulez-vous que je commence par cela ?

---

_Note : la liste ci‑dessus est basée sur une première analyse automatique. Je peux générer une liste plus complète (tous `.subscribe` détectés) et produire un diff ciblé avant d'appliquer des changements._
