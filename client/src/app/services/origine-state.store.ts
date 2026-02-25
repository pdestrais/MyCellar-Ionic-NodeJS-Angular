import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import { OrigineModel } from '../models/cellar.model';
import { PouchdbService } from './pouchdb.service';
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
  withMethods((store, pouchService = inject(PouchdbService)) => {
    // Local function to get a specific origine by ID
    const getOrigineById = (id: string) =>
      computed(() => {
        const originesMap = store.origines();
        return originesMap.get(id);
      });

    return {
      // Get a specific origine by ID (returns computed signal)
      getOrigineById,

      // Handle external change from PouchDB sync
      handleExternalChange(change: any): void {
        debug('[handleExternalChange] Received change:', change);
        
        if (change.deleted) {
          // External delete
          const newOriginesMap = new Map(store.origines());
          newOriginesMap.delete(change.id);
          patchState(store, { origines: newOriginesMap });
        } else {
          // External create/update
          const origine = change.doc as OrigineModel;
          const newOriginesMap = new Map(store.origines());
          newOriginesMap.set(origine._id, origine);
          patchState(store, { origines: newOriginesMap });
        }
      },

      // Load origines from PouchDB
      loadOrigines: async () => {
        debug('[loadOrigines] Loading origines from PouchDB');
        patchState(store, { isLoading: true });
        
        try {
          const origines = await pouchService.getDocsOfType$('origine').toPromise() as OrigineModel[];
          const originesMap = new Map<string, OrigineModel>(origines.map(o => [o._id, o]));
          
          debug('[loadOrigines] Loaded origines:', originesMap.size);
          patchState(store, {
            origines: originesMap,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to load origines';
          debug('[loadOrigines] Error:', errorMessage);
          patchState(store, {
            isLoading: false,
            error: errorMessage,
          });
        }
      },

      // Save origine (create or update)
      saveOrigine: async (origine: OrigineModel) => {
        debug('[saveOrigine] Saving origine:', origine.pays, origine.region);
        patchState(store, { isLoading: true, error: null });
        
        try {
          const result = await pouchService.saveDoc(origine, 'origine');
          
          const updatedOrigine: OrigineModel = {
            ...origine,
            _id: result.id,
            _rev: result.rev
          };
          
          // Update local state
          const newOriginesMap = new Map(store.origines());
          newOriginesMap.set(result.id, updatedOrigine);
          
          debug('[saveOrigine] Origine saved successfully:', updatedOrigine._id);
          patchState(store, {
            origines: newOriginesMap,
            isLoading: false,
            error: null,
          });
          
          return updatedOrigine;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to save origine';
          debug('[saveOrigine] Error:', errorMessage);
          patchState(store, {
            isLoading: false,
            error: errorMessage,
          });
          throw error;
        }
      },

      // Delete origine
      deleteOrigine: async (origine: OrigineModel) => {
        debug('[deleteOrigine] Deleting origine:', origine._id);
        patchState(store, { isLoading: true, error: null });
        
        try {
          await pouchService.deleteDoc(origine);
          
          // Remove from local state
          const newOriginesMap = new Map(store.origines());
          newOriginesMap.delete(origine._id);
          
          debug('[deleteOrigine] Origine deleted successfully:', origine._id);
          patchState(store, {
            origines: newOriginesMap,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to delete origine';
          debug('[deleteOrigine] Error:', errorMessage);
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
      debug('[OrigineStore] Initializing');
      
      // Auto-load origines on initialization
      store.loadOrigines();
      
      // Subscribe to PouchDB changes for real-time sync
      pouchService.dbChanges$.subscribe((change) => {
        if (change.id && change.id.startsWith('origine|')) {
          debug('[PouchDB Change] Received change for origine:', change.id);
          store.handleExternalChange(change);
        }
      });
      
      debug('[OrigineStore] Hooks initialized');
    },
    onDestroy() {
      debug('[OrigineStore] Destroying');
    },
  })
);

// Made with Bob
