import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import { TypeModel } from '../models/cellar.model';
import { PouchdbService } from './pouchdb.service';
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
  withMethods((store, pouchService = inject(PouchdbService)) => {
    // Local function to get a specific type by ID
    const getTypeById = (id: string) =>
      computed(() => {
        const typesMap = store.types();
        return typesMap.get(id);
      });

    return {
      // Get a specific type by ID (returns computed signal)
      getTypeById,

      // Handle external change from PouchDB sync
      handleExternalChange(change: any): void {
        debug('[handleExternalChange] Received change:', change);
        
        if (change.deleted) {
          // External delete
          const newTypesMap = new Map(store.types());
          newTypesMap.delete(change.id);
          patchState(store, { types: newTypesMap });
        } else {
          // External create/update
          const type = change.doc as TypeModel;
          const newTypesMap = new Map(store.types());
          newTypesMap.set(type._id, type);
          patchState(store, { types: newTypesMap });
        }
      },

      // Load types from PouchDB
      loadTypes: async () => {
        debug('[loadTypes] Loading types from PouchDB');
        patchState(store, { isLoading: true });
        
        try {
          const types = await pouchService.getDocsOfType$('type').toPromise() as TypeModel[];
          const typesMap = new Map<string, TypeModel>(types.map(t => [t._id, t]));
          
          debug('[loadTypes] Loaded types:', typesMap.size);
          patchState(store, {
            types: typesMap,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to load types';
          debug('[loadTypes] Error:', errorMessage);
          patchState(store, {
            isLoading: false,
            error: errorMessage,
          });
        }
      },

      // Save type (create or update)
      saveType: async (type: TypeModel) => {
        debug('[saveType] Saving type:', type.nom);
        patchState(store, { isLoading: true, error: null });
        
        try {
          const result = await pouchService.saveDoc(type, 'type');
          
          const updatedType: TypeModel = {
            ...type,
            _id: result.id,
            _rev: result.rev
          };
          
          // Update local state
          const newTypesMap = new Map(store.types());
          newTypesMap.set(result.id, updatedType);
          
          debug('[saveType] Type saved successfully:', updatedType._id);
          patchState(store, {
            types: newTypesMap,
            isLoading: false,
            error: null,
          });
          
          return updatedType;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to save type';
          debug('[saveType] Error:', errorMessage);
          patchState(store, {
            isLoading: false,
            error: errorMessage,
          });
          throw error;
        }
      },

      // Delete type
      deleteType: async (type: TypeModel) => {
        debug('[deleteType] Deleting type:', type._id);
        patchState(store, { isLoading: true, error: null });
        
        try {
          await pouchService.deleteDoc(type);
          
          // Remove from local state
          const newTypesMap = new Map(store.types());
          newTypesMap.delete(type._id);
          
          debug('[deleteType] Type deleted successfully:', type._id);
          patchState(store, {
            types: newTypesMap,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to delete type';
          debug('[deleteType] Error:', errorMessage);
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
      debug('[TypeStore] Initializing');
      
      // Auto-load types on initialization
      store.loadTypes();
      
      // Subscribe to PouchDB changes for real-time sync
      pouchService.dbChanges$.subscribe((change) => {
        if (change.id && change.id.startsWith('type|')) {
          debug('[PouchDB Change] Received change for type:', change.id);
          store.handleExternalChange(change);
        }
      });
      
      debug('[TypeStore] Hooks initialized');
    },
    onDestroy() {
      debug('[TypeStore] Destroying');
    },
  })
);

// Made with Bob
