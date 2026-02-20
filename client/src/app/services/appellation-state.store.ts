import { computed, inject, DestroyRef } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { AppellationModel } from '../models/cellar.model';
import { AppState } from '../state/app.state';
import * as AppellationSelectors from '../state/appellation/appellation.selectors';
import Debugger from 'debug';

const debug = Debugger('app:appellation-store');

// ============================================
// STATE INTERFACE
// ============================================
interface AppellationStoreState {
  appellations: Map<string, AppellationModel>;
  isLoading: boolean;
  error: string | null;
}

// ============================================
// INITIAL STATE
// ============================================
const initialState: AppellationStoreState = {
  appellations: new Map<string, AppellationModel>(),
  isLoading: false,
  error: null,
};

// ============================================
// APPELLATION STORE
// ============================================
export const AppellationStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  // ============================================
  // COMPUTED SIGNALS
  // ============================================
  withComputed((store) => ({
    // Sorted list of all appellations (by courte + longue)
    appellationsList: computed(() => {
      const appellationsMap = store.appellations();
      return Array.from(appellationsMap.values()).sort((a, b) => {
        const aKey = (a.courte || '') + (a.longue || '');
        const bKey = (b.courte || '') + (b.longue || '');
        return aKey.localeCompare(bKey);
      });
    }),

    // Map for duplicate detection (key: courte + longue)
    appellationMapForDuplicates: computed(() => {
      const appellationsMap = store.appellations();
      const duplicateMap = new Map<string, AppellationModel>();
      appellationsMap.forEach((appellation) => {
        const key = (appellation.courte || '') + (appellation.longue || '');
        duplicateMap.set(key, appellation);
      });
      return duplicateMap;
    }),
  })),

  // ============================================
  // METHODS
  // ============================================
  withMethods((store, ngrxStore = inject(Store<AppState>), destroyRef = inject(DestroyRef)) => {
    // Local function to get a specific appellation by ID
    const getAppellationById = (id: string) =>
      computed(() => {
        const appellationsMap = store.appellations();
        return appellationsMap.get(id);
      });

    return {
      // Get a specific appellation by ID (returns computed signal)
      getAppellationById,

      // Load appellations from NgRx store (keeps subscription alive for updates)
      loadAppellations: () => {
        debug('[loadAppellations] Loading appellations and subscribing to updates');
        patchState(store, { isLoading: true });
        
        // Subscribe to NgRx store and keep subscription alive for continuous updates
        ngrxStore.select(AppellationSelectors.getAllAppellations)
          .pipe(takeUntilDestroyed(destroyRef))
          .subscribe({
            next: (appellationsMap) => {
              debug('[loadAppellations] Received appellations update:', appellationsMap.size);
              patchState(store, {
                appellations: new Map(appellationsMap),
                isLoading: false,
                error: null,
              });
            },
            error: (error) => {
              debug('[loadAppellations] Error:', error);
              patchState(store, {
                isLoading: false,
                error: error.message || 'Failed to load appellations',
              });
            },
          });
      },
    };
  }),

  // ============================================
  // LIFECYCLE HOOKS
  // ============================================
  withHooks({
    onInit(store) {
      debug('[AppellationStore] Initializing');
      // Auto-load appellations on initialization
      store.loadAppellations();
    },
    onDestroy() {
      debug('[AppellationStore] Destroying');
    },
  })
);

// Made with Bob
