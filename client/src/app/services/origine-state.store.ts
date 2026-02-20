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
import { OrigineModel } from '../models/cellar.model';
import { AppState } from '../state/app.state';
import * as OrigineSelectors from '../state/origine/origine.selectors';
import Debugger from 'debug';

const debug = Debugger('app:origine-store');

// ============================================
// STATE INTERFACE
// ============================================
interface OrigineStoreState {
  origines: Map<string, OrigineModel>;
  isLoading: boolean;
  error: string | null;
}

// ============================================
// INITIAL STATE
// ============================================
const initialState: OrigineStoreState = {
  origines: new Map<string, OrigineModel>(),
  isLoading: false,
  error: null,
};

// ============================================
// ORIGINE STORE
// ============================================
export const OrigineStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  // ============================================
  // COMPUTED SIGNALS
  // ============================================
  withComputed((store) => ({
    // Sorted list of all origines (by pays + region)
    originesList: computed(() => {
      const originesMap = store.origines();
      return Array.from(originesMap.values()).sort((a, b) => {
        const aKey = (a.pays || '') + (a.region || '');
        const bKey = (b.pays || '') + (b.region || '');
        return aKey.localeCompare(bKey);
      });
    }),

    // Map for duplicate detection (key: pays + region)
    origineMapForDuplicates: computed(() => {
      const originesMap = store.origines();
      const duplicateMap = new Map<string, OrigineModel>();
      originesMap.forEach((origine) => {
        const key = (origine.pays || '') + (origine.region || '');
        duplicateMap.set(key, origine);
      });
      return duplicateMap;
    }),
  })),

  // ============================================
  // METHODS
  // ============================================
  withMethods((store, ngrxStore = inject(Store<AppState>), destroyRef = inject(DestroyRef)) => {
    // Local function to get a specific origine by ID
    const getOrigineById = (id: string) =>
      computed(() => {
        const originesMap = store.origines();
        return originesMap.get(id);
      });

    return {
      // Get a specific origine by ID (returns computed signal)
      getOrigineById,

      // Load origines from NgRx store (keeps subscription alive for updates)
      loadOrigines: () => {
        debug('[loadOrigines] Loading origines and subscribing to updates');
        patchState(store, { isLoading: true });
        
        // Subscribe to NgRx store and keep subscription alive for continuous updates
        ngrxStore.select(OrigineSelectors.getAllOrigines)
          .pipe(takeUntilDestroyed(destroyRef))
          .subscribe({
            next: (originesMap) => {
              debug('[loadOrigines] Received origines update. Size:', originesMap.size);
              
              // Filter out any non-origine documents and create new Map
              const newMap = new Map<string, OrigineModel>();
              originesMap.forEach((value, key) => {
                // Only add if it's a valid origine document
                if (key && key.startsWith('origine|') && value && value._id) {
                  newMap.set(key, value);
                } else {
                  debug('[loadOrigines] Filtered out invalid entry:', { key, value });
                }
              });
              
              patchState(store, {
                origines: newMap,
                isLoading: false,
                error: null,
              });
            },
            error: (error) => {
              debug('[loadOrigines] Error:', error);
              patchState(store, {
                isLoading: false,
                error: error.message || 'Failed to load origines',
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
      debug('[OrigineStore] Initializing');
      // Auto-load origines on initialization
      store.loadOrigines();
    },
    onDestroy() {
      debug('[OrigineStore] Destroying');
    },
  })
);

// Made with Bob
