import { computed, inject } from '@angular/core';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  withHooks,
  patchState,
  type
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { tapResponse } from '@ngrx/operators';
import { VinModel } from '../models/cellar.model';
import { PouchdbService } from './pouchdb.service';
import { Store } from '@ngrx/store';
import * as VinActions from '../state/vin/vin.actions';
import * as VinSelectors from '../state/vin/vin.selectors';
import { pipe, tap, switchMap, catchError, of } from 'rxjs';
import Debug from 'debug';
import dayjs from 'dayjs';

const debug = Debug('app:vin-signal-store');

/**
 * Event tracking for concurrent update detection
 */
export interface VinEvent {
  id: string;
  rev: string;
  action: 'create' | 'update' | 'delete';
  timestamp: number;
  source: 'internal' | 'external';
}

/**
 * Concurrent update detection result
 */
export interface ConcurrentUpdateDetection {
  detected: boolean;
  affectedVinId: string | null;
  message: string | null;
  severity: 'warning' | 'error' | null;
}

/**
 * Operation result for save/delete operations
 */
export interface VinOperationResult {
  success: boolean;
  source: 'internal' | 'external';
  vin?: VinModel;
  error?: string;
}

/**
 * State interface for VinStore
 */
interface VinState {
  vins: Map<string, VinModel>;
  status: 'idle' | 'loading' | 'saving' | 'deleting' | 'error';
  error: string | null;
  currentVinId: string | null;
  currentVinRev: string | null;
  eventLog: VinEvent[];
  lastOperation: VinOperationResult | null;
  concurrentUpdate: ConcurrentUpdateDetection;
  formDirtyStates: Map<string, boolean>;
}

/**
 * Initial state
 */
const initialState: VinState = {
  vins: new Map(),
  status: 'idle',
  error: null,
  currentVinId: null,
  currentVinRev: null,
  eventLog: [],
  lastOperation: null,
  concurrentUpdate: {
    detected: false,
    affectedVinId: null,
    message: null,
    severity: null
  },
  formDirtyStates: new Map()
};

/**
 * Signal Store for Vin (Wine) Management
 * Modern @ngrx/signals implementation with full SignalStore API
 */
export const VinStore = signalStore(
  { providedIn: 'root' },
  
  // State
  withState(initialState),
  
  // Computed Signals (Selectors)
  withComputed((store) => ({
    // Get all vins as array, sorted by name and year
    vinsList: computed(() => {
      const vinsMap = store.vins();
      return Array.from(vinsMap.values())
        .sort((a, b) => (a.nom + a.annee < b.nom + b.annee ? -1 : 1));
    }),
    
    // Get vins count
    vinsCount: computed(() => store.vins().size),
    
    // Get current vin being edited
    currentVin: computed(() => {
      const id = store.currentVinId();
      return id ? store.vins().get(id) || null : null;
    }),
    
    // Get vins map for duplicate checking (name + year)
    vinMapForDuplicates: computed(() => {
      const duplicateMap = new Map<string, VinModel>();
      store.vins().forEach(vin => {
        duplicateMap.set(`${vin.nom}-${vin.annee}`, vin);
      });
      return duplicateMap;
    }),
    
    // Check if loading
    isLoading: computed(() => store.status() === 'loading'),
    
    // Check if saving
    isSaving: computed(() => store.status() === 'saving'),
    
    // Check if has error
    hasError: computed(() => store.status() === 'error'),
    
    // ============================================
    // SEARCH AND FILTER FUNCTIONALITY
    // ============================================
    
    /**
     * Maturity counts for dashboard
     * Computes counts for all maturity categories
     */
    maturityCounts: computed(() => {
      // Get vins from store and convert to array
      const vinsMap = store.vins();
      const vins = Array.from(vinsMap.values());
      const now = dayjs();
      
      const counts = {
        ARTD: 0,
        RTD: 0,
        NRTD: 0,
        NotRTD: 0
      };
      
      vins.forEach(v => {
        if (v.apogee && v.nbreBouteillesReste > 0) {
          const drinkFromTo = v.apogee.split('-');
          const apogeeTo = parseInt(drinkFromTo[1]);
          const apogeeFrom = parseInt(drinkFromTo[0]);
          
          if (now.year() - apogeeTo >= 0) {
            counts.ARTD++;
          } else if (now.year() <= apogeeTo && now.year() > apogeeFrom) {
            counts.RTD++;
          } else if (now.year() > apogeeFrom - 2 && now.year() <= apogeeFrom) {
            counts.NRTD++;
          } else {
            counts.NotRTD++;
          }
        }
      });
      
      return counts;
    })
  })),
  
  // Methods (Actions)
  withMethods((store, pouchService = inject(PouchdbService), ngrxStore = inject(Store)) => {
    
    /**
     * Detect concurrent updates by analyzing event log
     * Replicates logic from original vin.page.ts lines 367-424
     */
    const detectConcurrentUpdate = (
      newEvent: VinEvent,
      formIsDirty: boolean
    ): ConcurrentUpdateDetection => {
      const eventLog = store.eventLog();
      const currentVinId = store.currentVinId();
      
      // Only check for concurrent updates on external events
      if (newEvent.source === 'internal') {
        return {
          detected: false,
          affectedVinId: null,
          message: null,
          severity: null
        };
      }
      
      // Check if this is a duplicate event (same id, rev, action)
      const duplicateEvents = eventLog.filter(
        event =>
          event.id === newEvent.id &&
          event.rev === newEvent.rev &&
          event.action === newEvent.action
      );
      
      if (duplicateEvents.length >= 1) {
        // (II.A) Duplicate event - already processed
        debug('[ConcurrentDetection] Duplicate event detected, ignoring');
        return {
          detected: false,
          affectedVinId: null,
          message: null,
          severity: null
        };
      }
      
      // Check if this event affects the wine currently being edited
      const isCurrentWine = newEvent.id === currentVinId;
      
      if (isCurrentWine && formIsDirty) {
        // (II.C) Concurrent update detected!
        // Someone else modified the wine we're currently editing
        const message = newEvent.action === 'delete'
          ? 'wine.deletedConcurrentlyOnAnotherInstance'
          : 'wine.savedConcurrentlyOnAnotherInstance';
        
        debug('[ConcurrentDetection] Concurrent update detected!', {
          vinId: newEvent.id,
          action: newEvent.action,
          formIsDirty
        });
        
        return {
          detected: true,
          affectedVinId: newEvent.id,
          message,
          severity: 'warning'
        };
      }
      
      // (II.B) Update of another wine - not relevant
      debug('[ConcurrentDetection] Update of different wine, ignoring');
      return {
        detected: false,
        affectedVinId: null,
        message: null,
        severity: null
      };
    };
    
    /**
     * Get filtered wines based on search string and stock filter
     * Matches NgRx selector logic from vin.selectors.ts
     */
    const getFilteredWines = (searchString: string, inStockOnly: boolean) => computed(() => {
      // Get vins from store and convert to sorted array
      const vinsMap = store.vins();
      const vins = Array.from(vinsMap.values())
        .sort((a, b) => (a.nom + a.annee < b.nom + b.annee ? -1 : 1));
      
      // Return empty if search string too short (matching NgRx selector)
      if (searchString.length <= 2) {
        return [];
      }
      
      let filtered = vins;
      
      // Filter by stock
      if (inStockOnly) {
        filtered = filtered.filter(v => v.nbreBouteillesReste > 0);
      }
      
      // Filter by search term (name only, matching NgRx selector)
      const searchLower = searchString.toLowerCase();
      filtered = filtered.filter(v =>
        v.nom.toLowerCase().indexOf(searchLower) > -1
      );
      
      return filtered;
    });
    
    /**
     * Get wines by maturity category
     * Matches NgRx selector logic from vin.selectors.ts
     */
    const getWinesByMaturity = (category: string) => computed(() => {
      // Get vins from store and convert to sorted array
      const vinsMap = store.vins();
      const vins = Array.from(vinsMap.values())
        .sort((a, b) => (a.nom + a.annee < b.nom + b.annee ? -1 : 1));
      
      const now = dayjs();
      const maturityList: VinModel[] = [];
      
      vins.forEach(v => {
        if (v.apogee && v.nbreBouteillesReste > 0) {
          const drinkFromTo = v.apogee.split('-');
          const apogeeTo = parseInt(drinkFromTo[1]);
          const apogeeFrom = parseInt(drinkFromTo[0]);
          
          /* apogee :                 FROM-2          FROM            TO            */
          /*             <----NotRTD ---|--NearlyRTD---|-----RTD------|----ARTD---> */
          switch (category) {
            case 'ARTD':
              if (now.year() - apogeeTo >= 0) {
                maturityList.push(v);
              }
              break;
            case 'RTD':
              if (now.year() <= apogeeTo && now.year() > apogeeFrom) {
                maturityList.push(v);
              }
              break;
            case 'NRTD':
              if (now.year() > apogeeFrom - 2 && now.year() <= apogeeFrom) {
                maturityList.push(v);
              }
              break;
            default:
              maturityList.push(v);
          }
        }
      });
      
      // Sort by type first, then by name
      return maturityList.sort((a, b) => {
        // First sort by type (Rouge, Blanc, etc.)
        const typeCompare = a.type.nom.localeCompare(b.type.nom);
        if (typeCompare !== 0) return typeCompare;
        
        // Then sort by name + year
        return (a.nom + a.annee).localeCompare(b.nom + b.annee);
      });
    });
    
    return {
    // Expose filter/search methods
    getFilteredWines,
    getWinesByMaturity,
    
    /**
     * Load all vins from PouchDB
     */
    loadVins: rxMethod<void>(
      pipe(
        tap(() => {
          patchState(store, { status: 'loading', error: null });
          debug('[loadVins] Loading vins...');
        }),
        switchMap(() => pouchService.getDocsOfType$('vin')),
        tap((vins: VinModel[]) => {
          const vinsMap = new Map(vins.map(v => [v._id, v]));
          patchState(store, { 
            vins: vinsMap, 
            status: 'idle' 
          });
          
          // Dispatch to NgRx Store for backward compatibility
          ngrxStore.dispatch(VinActions.loadVinsSuccess({ vins }));
          
          debug('[loadVins] Loaded vins:', vins.length);
        }),
        catchError((error) => {
          const errorMessage = error instanceof Error ? error.message : 'Failed to load vins';
          patchState(store, { 
            error: errorMessage, 
            status: 'error' 
          });
          
          // Dispatch error to NgRx Store
          ngrxStore.dispatch(VinActions.loadVinsFailure({ error: errorMessage }));
          
          debug('[loadVins] Error:', errorMessage);
          return of(null);
        })
      )
    ),
    
    /**
     * Set current vin for editing
     */
    setCurrentVin(id: string | null, rev: string | null = null): void {
      patchState(store, { 
        currentVinId: id, 
        currentVinRev: rev,
        concurrentUpdate: {
          detected: false,
          affectedVinId: null,
          message: null,
          severity: null
        }
      });
      debug('[setCurrentVin] Current vin set to:', id);
    },
    
    /**
     * Save vin
     */
    async saveVin(vin: VinModel): Promise<VinOperationResult> {
      patchState(store, { status: 'saving', error: null });
      
      const formIsDirty = store.formDirtyStates().get(vin._id) ?? false;
      
      try {
        const saveResult = await pouchService.saveDoc(vin, 'vin');
        
        const updatedVin: VinModel = {
          ...vin,
          _id: saveResult.id,
          _rev: saveResult.rev
        };
        
        // Update local state
        const newVinsMap = new Map(store.vins());
        newVinsMap.set(saveResult.id, updatedVin);
        
        // Add INTERNAL event to log
        const event: VinEvent = {
          id: saveResult.id,
          rev: saveResult.rev,
          action: vin._id ? 'update' : 'create',
          timestamp: Date.now(),
          source: 'internal'
        };
        
        const newEventLog = [...store.eventLog(), event];
        
        patchState(store, { 
          vins: newVinsMap,
          eventLog: newEventLog,
          status: 'idle'
        });
        
        // Dispatch to NgRx Store for backward compatibility
        ngrxStore.dispatch(VinActions.createVinSuccess({ vin: updatedVin, source: 'internal' }));
        
        const result: VinOperationResult = {
          success: true,
          source: 'internal',
          vin: updatedVin
        };
        
        patchState(store, { lastOperation: result });
        
        debug('[saveVin] Vin saved successfully:', updatedVin._id);
        return result;
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to save vin';
        patchState(store, { 
          error: errorMessage, 
          status: 'error' 
        });
        
        const result: VinOperationResult = {
          success: false,
          source: 'internal',
          error: errorMessage
        };
        
        patchState(store, { lastOperation: result });
        
        debug('[saveVin] Error:', errorMessage);
        throw error;
      }
    },
    
    /**
     * Delete vin
     */
    async deleteVin(vin: VinModel): Promise<VinOperationResult> {
      patchState(store, { status: 'deleting', error: null });
      
      const formIsDirty = store.formDirtyStates().get(vin._id) ?? false;
      
      try {
        await pouchService.deleteDoc(vin);
        
        // Remove from local state
        const newVinsMap = new Map(store.vins());
        newVinsMap.delete(vin._id);
        
        // Add INTERNAL event to log
        const event: VinEvent = {
          id: vin._id,
          rev: vin._rev,
          action: 'delete',
          timestamp: Date.now(),
          source: 'internal'
        };
        
        const newEventLog = [...store.eventLog(), event];
        
        patchState(store, { 
          vins: newVinsMap,
          eventLog: newEventLog,
          status: 'idle'
        });
        
        // Dispatch to NgRx Store for backward compatibility
        ngrxStore.dispatch(VinActions.deleteVinSuccess({ result: { id: vin._id, rev: vin._rev }, source: 'internal' }));
        
        const result: VinOperationResult = {
          success: true,
          source: 'internal'
        };
        
        patchState(store, { lastOperation: result });
        
        debug('[deleteVin] Vin deleted successfully:', vin._id);
        return result;
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to delete vin';
        patchState(store, { 
          error: errorMessage, 
          status: 'error' 
        });
        
        const result: VinOperationResult = {
          success: false,
          source: 'internal',
          error: errorMessage
        };
        
        patchState(store, { lastOperation: result });
        
        debug('[deleteVin] Error:', errorMessage);
        throw error;
      }
    },
    
    /**
     * Update form dirty state for a specific wine
     */
    updateFormDirtyState(vinId: string | null, isDirty: boolean): void {
      if (!vinId) return;
      
      const newStates = new Map(store.formDirtyStates());
      newStates.set(vinId, isDirty);
      patchState(store, { formDirtyStates: newStates });
    },
    
    /**
     * Sync vins from NgRx store
     */
    syncFromNgRxStore(vinsMap: Map<string, VinModel>): void {
      if (vinsMap && vinsMap.size > 0) {
        debug('[syncFromNgRxStore] Syncing vins from NgRx store:', vinsMap.size);
        patchState(store, { vins: new Map(vinsMap) });
      }
    },
    
    /**
     * Handle external change from PouchDB sync
     */
    handleExternalChange(change: any): void {
      debug('[handleExternalChange] Received change:', change);
      
      if (change.deleted) {
        // External delete
        const newVinsMap = new Map(store.vins());
        newVinsMap.delete(change.id);
        
        const formIsDirty = store.formDirtyStates().get(change.id) ?? false;
        
        // Add EXTERNAL event to log
        const event: VinEvent = {
          id: change.id,
          rev: change.doc?._rev || '',
          action: 'delete',
          timestamp: Date.now(),
          source: 'external'
        };
        
        const newEventLog = [...store.eventLog(), event];
        
        // Detect concurrent updates using local function
        const detection = detectConcurrentUpdate(event, formIsDirty);
        
        patchState(store, {
          vins: newVinsMap,
          eventLog: newEventLog,
          concurrentUpdate: detection.detected ? detection : store.concurrentUpdate()
        });
        
        // Dispatch to NgRx Store for backward compatibility
        ngrxStore.dispatch(VinActions.deleteVinSuccess({ result: change, source: 'external' }));
        
        patchState(store, {
          lastOperation: {
            success: true,
            source: 'external'
          }
        });
        
      } else {
        // External create/update
        const vin = change.doc as VinModel;
        
        const newVinsMap = new Map(store.vins());
        newVinsMap.set(vin._id, vin);
        
        const formIsDirty = store.formDirtyStates().get(vin._id) ?? false;
        
        // Add EXTERNAL event to log
        const event: VinEvent = {
          id: vin._id,
          rev: vin._rev,
          action: 'update',
          timestamp: Date.now(),
          source: 'external'
        };
        
        const newEventLog = [...store.eventLog(), event];
        
        // Detect concurrent updates using local function
        const detection = detectConcurrentUpdate(event, formIsDirty);
        
        patchState(store, {
          vins: newVinsMap,
          eventLog: newEventLog,
          concurrentUpdate: detection.detected ? detection : store.concurrentUpdate()
        });
        
        // Dispatch to NgRx Store for backward compatibility
        ngrxStore.dispatch(VinActions.createVinSuccess({ vin, source: 'external' }));
        
        patchState(store, {
          lastOperation: {
            success: true,
            source: 'external',
            vin
          }
        });
      }
    },
    
    /**
     * Clear concurrent update warning
     */
    clearConcurrentUpdate(): void {
      patchState(store, {
        concurrentUpdate: {
          detected: false,
          affectedVinId: null,
          message: null,
          severity: null
        }
      });
    },
    
    /**
     * Clear error state
     */
    clearError(): void {
      patchState(store, { error: null });
    },
    
    /**
     * Reset state
     */
    reset(): void {
      patchState(store, initialState);
      debug('[reset] State reset');
    }
    };
  }),
  
  // Lifecycle Hooks
  withHooks({
    onInit(store, pouchService = inject(PouchdbService), ngrxStore = inject(Store)) {
      debug('[VinStore] Initialized');
      
      // Subscribe to PouchDB changes
      pouchService.dbChanges$.subscribe((change) => {
        if (change.id && change.id.startsWith('vin|')) {
          debug('[PouchDB Change] Received change for vin:', change.id);
          store.handleExternalChange(change);
        }
      });
      
      // Subscribe to NgRx store for synchronization
      ngrxStore.select(VinSelectors.getAllVins).subscribe((vinsMap) => {
        store.syncFromNgRxStore(vinsMap);
      });
      
      debug('[VinStore] Hooks initialized');
    },
    
    onDestroy() {
      debug('[VinStore] Destroyed');
    }
  })
);

// Made with Bob
