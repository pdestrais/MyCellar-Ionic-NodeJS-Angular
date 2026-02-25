import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import { AppellationModel } from '../models/cellar.model';
import { PouchdbService } from './pouchdb.service';
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
  withMethods((store, pouchService = inject(PouchdbService)) => {
    // Local function to get a specific appellation by ID
    const getAppellationById = (id: string) =>
      computed(() => {
        const appellationsMap = store.appellations();
        return appellationsMap.get(id);
      });

    return {
      // Get a specific appellation by ID (returns computed signal)
      getAppellationById,

      // Handle external change from PouchDB sync
      handleExternalChange(change: any): void {
        debug('[handleExternalChange] Received change:', change);
        
        if (change.deleted) {
          // External delete
          const newAppellationsMap = new Map(store.appellations());
          newAppellationsMap.delete(change.id);
          patchState(store, { appellations: newAppellationsMap });
        } else {
          // External create/update
          const appellation = change.doc as AppellationModel;
          const newAppellationsMap = new Map(store.appellations());
          newAppellationsMap.set(appellation._id, appellation);
          patchState(store, { appellations: newAppellationsMap });
        }
      },

      // Load appellations from PouchDB
      loadAppellations: async () => {
        debug('[loadAppellations] Loading appellations from PouchDB');
        patchState(store, { isLoading: true });
        
        try {
          const appellations = await pouchService.getDocsOfType$('appellation').toPromise() as AppellationModel[];
          const appellationsMap = new Map<string, AppellationModel>(appellations.map(a => [a._id, a]));
          
          debug('[loadAppellations] Loaded appellations:', appellationsMap.size);
          patchState(store, {
            appellations: appellationsMap,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to load appellations';
          debug('[loadAppellations] Error:', errorMessage);
          patchState(store, {
            isLoading: false,
            error: errorMessage,
          });
        }
      },

      // Save appellation (create or update)
      saveAppellation: async (appellation: AppellationModel) => {
        debug('[saveAppellation] Saving appellation:', appellation.courte, appellation.longue);
        patchState(store, { isLoading: true, error: null });
        
        try {
          const result = await pouchService.saveDoc(appellation, 'appellation');
          
          const updatedAppellation: AppellationModel = {
            ...appellation,
            _id: result.id,
            _rev: result.rev
          };
          
          // Update local state
          const newAppellationsMap = new Map(store.appellations());
          newAppellationsMap.set(result.id, updatedAppellation);
          
          debug('[saveAppellation] Appellation saved successfully:', updatedAppellation._id);
          patchState(store, {
            appellations: newAppellationsMap,
            isLoading: false,
            error: null,
          });
          
          return updatedAppellation;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to save appellation';
          debug('[saveAppellation] Error:', errorMessage);
          patchState(store, {
            isLoading: false,
            error: errorMessage,
          });
          throw error;
        }
      },

      // Delete appellation
      deleteAppellation: async (appellation: AppellationModel) => {
        debug('[deleteAppellation] Deleting appellation:', appellation._id);
        patchState(store, { isLoading: true, error: null });
        
        try {
          await pouchService.deleteDoc(appellation);
          
          // Remove from local state
          const newAppellationsMap = new Map(store.appellations());
          newAppellationsMap.delete(appellation._id);
          
          debug('[deleteAppellation] Appellation deleted successfully:', appellation._id);
          patchState(store, {
            appellations: newAppellationsMap,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to delete appellation';
          debug('[deleteAppellation] Error:', errorMessage);
          patchState(store, {
            isLoading: false,
            error: errorMessage,
          });
          throw error;
        }
      },
    };
  }),

  // ============================================
  // LIFECYCLE HOOKS
  // ============================================
  withHooks({
    onInit(store, pouchService = inject(PouchdbService)) {
      debug('[AppellationStore] Initializing');
      
      // Auto-load appellations on initialization
      store.loadAppellations();
      
      // Subscribe to PouchDB changes for real-time sync
      pouchService.dbChanges$.subscribe((change) => {
        if (change.id && change.id.startsWith('appellation|')) {
          debug('[PouchDB Change] Received change for appellation:', change.id);
          store.handleExternalChange(change);
        }
      });
      
      debug('[AppellationStore] Hooks initialized');
    },
    onDestroy() {
      debug('[AppellationStore] Destroying');
    },
  })
);

// Made with Bob
