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
import { TypeModel } from '../models/cellar.model';
import { AppState } from '../state/app.state';
import * as TypeSelectors from '../state/type/type.selectors';
import Debugger from 'debug';

const debug = Debugger('app:type-store');

// ============================================
// STATE INTERFACE
// ============================================
interface TypeStoreState {
  types: Map<string, TypeModel>;
  isLoading: boolean;
  error: string | null;
}

// ============================================
// INITIAL STATE
// ============================================
const initialState: TypeStoreState = {
  types: new Map<string, TypeModel>(),
  isLoading: false,
  error: null,
};

// ============================================
// TYPE STORE
// ============================================
export const TypeStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  // ============================================
  // COMPUTED SIGNALS
  // ============================================
  withComputed((store) => ({
    // Sorted list of all types
    typesList: computed(() => {
      const typesMap = store.types();
      return Array.from(typesMap.values()).sort((a, b) =>
        (a.nom || '').localeCompare(b.nom || '')
      );
    }),

    // Map for duplicate detection (key: nom)
    typeMapForDuplicates: computed(() => {
      const typesMap = store.types();
      const duplicateMap = new Map<string, TypeModel>();
      typesMap.forEach((type) => {
        if (type.nom) {
          duplicateMap.set(type.nom, type);
        }
      });
      return duplicateMap;
    }),
  })),

  // ============================================
  // METHODS
  // ============================================
  withMethods((store, ngrxStore = inject(Store<AppState>), destroyRef = inject(DestroyRef)) => {
    // Local function to get a specific type by ID
    const getTypeById = (id: string) =>
      computed(() => {
        const typesMap = store.types();
        return typesMap.get(id);
      });

    return {
      // Get a specific type by ID (returns computed signal)
      getTypeById,

      // Load types from NgRx store (keeps subscription alive for updates)
      loadTypes: () => {
        debug('[loadTypes] Loading types and subscribing to updates');
        patchState(store, { isLoading: true });
        
        // Subscribe to NgRx store and keep subscription alive for continuous updates
        ngrxStore.select(TypeSelectors.getAllTypes)
          .pipe(takeUntilDestroyed(destroyRef))
          .subscribe({
            next: (typesMap) => {
              debug('[loadTypes] Received types update:', typesMap.size);
              patchState(store, {
                types: new Map(typesMap),
                isLoading: false,
                error: null,
              });
            },
            error: (error) => {
              debug('[loadTypes] Error:', error);
              patchState(store, {
                isLoading: false,
                error: error.message || 'Failed to load types',
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
      debug('[TypeStore] Initializing');
      // Auto-load types on initialization
      store.loadTypes();
    },
    onDestroy() {
      debug('[TypeStore] Destroying');
    },
  })
);

// Made with Bob
