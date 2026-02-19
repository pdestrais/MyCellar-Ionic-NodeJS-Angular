# Signal-Based State Management Migration
## Replacing NgRx with Signals

## Executive Summary

This document outlines how to replace NgRx Store with a **signal-based state management** solution for your MyCellar application. This is a significant architectural change that will:

1. Eliminate NgRx dependencies (Store, Effects, Reducers, Actions)
2. Replace with native Angular signals and services
3. Simplify state management with less boilerplate
4. Maintain the same reactive patterns and data flow
5. Improve performance with fine-grained reactivity

---

## Current NgRx Architecture Analysis

### Your Current Setup

```
State Structure:
├── vins (VinState)
├── types (TypeState)
├── origines (OrigineState)
└── appellations (AppellationState)

Each state slice has:
├── Actions (create, update, delete, load)
├── Reducers (state transitions)
├── Effects (side effects, API calls)
└── Selectors (derived state)
```

### NgRx Components You're Using
- **Store**: Central state container
- **Actions**: Dispatched events
- **Reducers**: Pure functions for state updates
- **Effects**: Side effect handlers (PouchDB calls)
- **Selectors**: Memoized state queries

---

## Signal-Based State Management Architecture

### Core Concept

Replace NgRx with **Signal Services** - injectable services that use signals for state management:

```typescript
@Injectable({ providedIn: 'root' })
export class VinStateService {
  // Private writable signals
  private readonly _vins = signal<Map<string, VinModel>>(new Map());
  private readonly _status = signal<'idle' | 'loading' | 'error'>('idle');
  
  // Public readonly signals
  readonly vins = this._vins.asReadonly();
  readonly status = this._status.asReadonly();
  
  // Computed signals (like selectors)
  readonly vinsList = computed(() => Array.from(this._vins().values()));
  readonly vinsCount = computed(() => this._vins().size);
  
  // Actions (methods that update state)
  async loadVins() {
    this._status.set('loading');
    try {
      const vins = await this.pouchService.getDocsOfType$('vin');
      this._vins.set(new Map(vins.map(v => [v._id, v])));
      this._status.set('idle');
    } catch (error) {
      this._status.set('error');
    }
  }
}
```

---

## Complete Implementation

### 1. Vin State Service

```typescript
// client/src/app/services/vin-state.service.ts
import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { VinModel } from '../models/cellar.model';
import { PouchdbService } from './pouchdb.service';

export interface VinOperationResult {
  success: boolean;
  error?: string;
  vin?: VinModel;
}

@Injectable({ providedIn: 'root' })
export class VinStateService {
  private readonly pouchService = inject(PouchdbService);
  
  // ============================================
  // PRIVATE STATE (Writable Signals)
  // ============================================
  
  private readonly _vins = signal<Map<string, VinModel>>(new Map());
  private readonly _status = signal<'idle' | 'loading' | 'saving' | 'deleting' | 'error'>('idle');
  private readonly _error = signal<string | null>(null);
  private readonly _currentVinId = signal<string | null>(null);
  private readonly _lastOperation = signal<VinOperationResult | null>(null);
  
  // Event log for tracking operations (like NgRx eventLog)
  private readonly _eventLog = signal<Array<{
    id: string;
    rev: string;
    action: 'create' | 'update' | 'delete';
    timestamp: number;
  }>>([]);
  
  // ============================================
  // PUBLIC STATE (Readonly Signals)
  // ============================================
  
  readonly vins = this._vins.asReadonly();
  readonly status = this._status.asReadonly();
  readonly error = this._error.asReadonly();
  readonly currentVinId = this._currentVinId.asReadonly();
  readonly lastOperation = this._lastOperation.asReadonly();
  readonly eventLog = this._eventLog.asReadonly();
  
  // ============================================
  // COMPUTED STATE (Like Selectors)
  // ============================================
  
  // Get all vins as array, sorted
  readonly vinsList = computed(() => {
    const vinsMap = this._vins();
    return Array.from(vinsMap.values())
      .sort((a, b) => (a.nom + a.annee < b.nom + b.annee ? -1 : 1));
  });
  
  // Get vins count
  readonly vinsCount = computed(() => this._vins().size);
  
  // Get current vin
  readonly currentVin = computed(() => {
    const id = this._currentVinId();
    return id ? this._vins().get(id) : null;
  });
  
  // Get vins map for duplicate checking (name + year)
  readonly vinMapForDuplicates = computed(() => {
    const duplicateMap = new Map<string, VinModel>();
    this._vins().forEach(vin => {
      duplicateMap.set(`${vin.nom}-${vin.annee}`, vin);
    });
    return duplicateMap;
  });
  
  // Get filtered vins (in stock, with search)
  getFilteredVins(searchString: string, inStockOnly: boolean) {
    return computed(() => {
      let filtered = this.vinsList();
      
      if (inStockOnly) {
        filtered = filtered.filter(v => v.nbreBouteillesReste > 0);
      }
      
      if (searchString) {
        const search = searchString.toLowerCase();
        filtered = filtered.filter(v => 
          v.nom.toLowerCase().includes(search) ||
          v.appellation.courte.toLowerCase().includes(search) ||
          v.origine.region.toLowerCase().includes(search)
        );
      }
      
      return filtered;
    });
  }
  
  // Get vins by appellation
  getVinsByAppellation(appellationId: string) {
    return computed(() => 
      this.vinsList().filter(v => v.appellation._id === appellationId)
    );
  }
  
  // Get vins by type
  getVinsByType(typeId: string) {
    return computed(() => 
      this.vinsList().filter(v => v.type._id === typeId)
    );
  }
  
  // Get vins by origin
  getVinsByOrigin(origineId: string) {
    return computed(() => 
      this.vinsList().filter(v => v.origine._id === origineId)
    );
  }
  
  // ============================================
  // ACTIONS (Methods that update state)
  // ============================================
  
  /**
   * Load all vins from PouchDB
   */
  async loadVins(): Promise<void> {
    this._status.set('loading');
    this._error.set(null);
    
    try {
      const vins = await this.pouchService.getDocsOfType$<VinModel>('vin');
      const vinsMap = new Map(vins.map(v => [v._id, v]));
      
      this._vins.set(vinsMap);
      this._status.set('idle');
    } catch (error) {
      this._error.set(error instanceof Error ? error.message : 'Failed to load vins');
      this._status.set('error');
      throw error;
    }
  }
  
  /**
   * Set current vin for editing
   */
  setCurrentVin(id: string | null): void {
    this._currentVinId.set(id);
  }
  
  /**
   * Create or update a vin
   */
  async saveVin(vin: VinModel): Promise<VinOperationResult> {
    this._status.set('saving');
    this._error.set(null);
    
    try {
      const result = await this.pouchService.saveDoc(vin, 'vin');
      
      // Update local state
      const updatedVin: VinModel = {
        ...vin,
        _id: result.id,
        _rev: result.rev
      };
      
      this._vins.update(vins => {
        const newMap = new Map(vins);
        newMap.set(result.id, updatedVin);
        return newMap;
      });
      
      // Add to event log
      this._eventLog.update(log => [
        ...log,
        {
          id: result.id,
          rev: result.rev,
          action: vin._id ? 'update' : 'create',
          timestamp: Date.now()
        }
      ]);
      
      this._status.set('idle');
      
      const operationResult: VinOperationResult = {
        success: true,
        vin: updatedVin
      };
      
      this._lastOperation.set(operationResult);
      
      return operationResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save vin';
      this._error.set(errorMessage);
      this._status.set('error');
      
      const operationResult: VinOperationResult = {
        success: false,
        error: errorMessage
      };
      
      this._lastOperation.set(operationResult);
      
      return operationResult;
    }
  }
  
  /**
   * Delete a vin
   */
  async deleteVin(vin: VinModel): Promise<VinOperationResult> {
    this._status.set('deleting');
    this._error.set(null);
    
    try {
      await this.pouchService.deleteDoc(vin);
      
      // Remove from local state
      this._vins.update(vins => {
        const newMap = new Map(vins);
        newMap.delete(vin._id);
        return newMap;
      });
      
      // Add to event log
      this._eventLog.update(log => [
        ...log,
        {
          id: vin._id,
          rev: vin._rev,
          action: 'delete',
          timestamp: Date.now()
        }
      ]);
      
      this._status.set('idle');
      
      const operationResult: VinOperationResult = {
        success: true
      };
      
      this._lastOperation.set(operationResult);
      
      return operationResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete vin';
      this._error.set(errorMessage);
      this._status.set('error');
      
      const operationResult: VinOperationResult = {
        success: false,
        error: errorMessage
      };
      
      this._lastOperation.set(operationResult);
      
      return operationResult;
    }
  }
  
  /**
   * Handle external changes (from PouchDB sync)
   */
  handleExternalChange(change: any): void {
    if (change.deleted) {
      this._vins.update(vins => {
        const newMap = new Map(vins);
        newMap.delete(change.id);
        return newMap;
      });
    } else {
      const vin = change.doc as VinModel;
      this._vins.update(vins => {
        const newMap = new Map(vins);
        newMap.set(vin._id, vin);
        return newMap;
      });
    }
    
    // Add to event log
    this._eventLog.update(log => [
      ...log,
      {
        id: change.id,
        rev: change.doc?._rev || '',
        action: change.deleted ? 'delete' : 'update',
        timestamp: Date.now()
      }
    ]);
  }
  
  /**
   * Clear error state
   */
  clearError(): void {
    this._error.set(null);
  }
  
  /**
   * Reset state
   */
  reset(): void {
    this._vins.set(new Map());
    this._status.set('idle');
    this._error.set(null);
    this._currentVinId.set(null);
    this._lastOperation.set(null);
    this._eventLog.set([]);
  }
}
```

### 2. Type State Service

```typescript
// client/src/app/services/type-state.service.ts
import { Injectable, signal, computed, inject } from '@angular/core';
import { TypeModel } from '../models/cellar.model';
import { PouchdbService } from './pouchdb.service';

@Injectable({ providedIn: 'root' })
export class TypeStateService {
  private readonly pouchService = inject(PouchdbService);
  
  private readonly _types = signal<Map<string, TypeModel>>(new Map());
  private readonly _status = signal<'idle' | 'loading' | 'error'>('idle');
  
  readonly types = this._types.asReadonly();
  readonly status = this._status.asReadonly();
  
  readonly typesList = computed(() => 
    Array.from(this._types().values())
      .sort((a, b) => a.nom < b.nom ? -1 : 1)
  );
  
  readonly typeMapForDuplicates = computed(() => {
    const map = new Map<string, TypeModel>();
    this._types().forEach(type => {
      map.set(type.nom, type);
    });
    return map;
  });
  
  async loadTypes(): Promise<void> {
    this._status.set('loading');
    try {
      const types = await this.pouchService.getDocsOfType$<TypeModel>('type');
      this._types.set(new Map(types.map(t => [t._id, t])));
      this._status.set('idle');
    } catch (error) {
      this._status.set('error');
      throw error;
    }
  }
  
  async saveType(type: TypeModel): Promise<void> {
    const result = await this.pouchService.saveDoc(type, 'type');
    this._types.update(types => {
      const newMap = new Map(types);
      newMap.set(result.id, { ...type, _id: result.id, _rev: result.rev });
      return newMap;
    });
  }
  
  async deleteType(type: TypeModel): Promise<void> {
    await this.pouchService.deleteDoc(type);
    this._types.update(types => {
      const newMap = new Map(types);
      newMap.delete(type._id);
      return newMap;
    });
  }
  
  handleExternalChange(change: any): void {
    if (change.deleted) {
      this._types.update(types => {
        const newMap = new Map(types);
        newMap.delete(change.id);
        return newMap;
      });
    } else {
      const type = change.doc as TypeModel;
      this._types.update(types => {
        const newMap = new Map(types);
        newMap.set(type._id, type);
        return newMap;
      });
    }
  }
}
```

### 3. Similar Services for Origine and Appellation

Create `origine-state.service.ts` and `appellation-state.service.ts` following the same pattern.

---

## Component Usage

### Before (NgRx)

```typescript
export class VinPage {
  types = computed(() => 
    this.store.selectSignal(TypeSelectors.getAllTypesArraySorted)()
  );
  
  ngOnInit() {
    this.store.dispatch(VinActions.loadVins());
    this.store.dispatch(TypeActions.loadTypes());
  }
  
  saveVin() {
    this.store.dispatch(VinActions.createVin({ vin: this.vin }));
  }
}
```

### After (Signal Services)

```typescript
export class VinPage {
  private readonly vinState = inject(VinStateService);
  private readonly typeState = inject(TypeStateService);
  
  // Direct access to signals
  readonly types = this.typeState.typesList;
  readonly vins = this.vinState.vinsList;
  
  constructor() {
    // Load data on initialization
    effect(() => {
      this.vinState.loadVins();
      this.typeState.loadTypes();
    }, { allowSignalWrites: true });
    
    // React to operation results
    effect(() => {
      const result = this.vinState.lastOperation();
      if (result?.success) {
        this.presentToast('Saved successfully', 'success');
        this.navCtrl.navigateBack('/home');
      } else if (result?.error) {
        this.presentToast(result.error, 'error');
      }
    });
  }
  
  async saveVin() {
    await this.vinState.saveVin(this.vin);
  }
}
```

---

## Migration Strategy

### Phase 1: Create Signal Services (Week 1)
1. Create `VinStateService`
2. Create `TypeStateService`
3. Create `OrigineStateService`
4. Create `AppellationStateService`
5. Test services in isolation

### Phase 2: Parallel Implementation (Week 2)
1. Keep NgRx running
2. Inject signal services alongside Store
3. Migrate one component at a time
4. Compare behavior between NgRx and signals

### Phase 3: Component Migration (Week 3-4)
1. Update `HomePage` to use signal services
2. Update `VinPage` to use signal services
3. Update other components
4. Remove NgRx dispatches and selectors

### Phase 4: Cleanup (Week 5)
1. Remove NgRx imports
2. Delete actions, reducers, effects, selectors
3. Remove `@ngrx/*` from package.json
4. Update tests
5. Final verification

---

## Comparison: NgRx vs Signal Services

### Code Reduction

**NgRx (per entity):**
- Actions file: ~60 lines
- Reducer file: ~200 lines
- Effects file: ~150 lines
- Selectors file: ~100 lines
- **Total: ~510 lines**

**Signal Service (per entity):**
- Service file: ~250 lines
- **Total: ~250 lines**

**Savings: ~50% code reduction**

### Performance

| Aspect | NgRx | Signal Services |
|--------|------|-----------------|
| Change Detection | Zone.js | Signals (fine-grained) |
| Memory | Higher (RxJS operators) | Lower (native signals) |
| Bundle Size | +100KB | +0KB (native) |
| Reactivity | Observable-based | Signal-based |

### Developer Experience

| Aspect | NgRx | Signal Services |
|--------|------|-----------------|
| Boilerplate | High | Low |
| Learning Curve | Steep | Gentle |
| Debugging | DevTools required | Simple console.log |
| Type Safety | Good | Excellent |
| Testing | Complex | Simple |

---

## Benefits of Signal-Based State

1. **Less Boilerplate**: ~50% code reduction
2. **Better Performance**: Fine-grained reactivity
3. **Simpler Mental Model**: Direct state access
4. **Easier Testing**: No mocking required
5. **Better TypeScript**: Full inference
6. **No Dependencies**: Native Angular
7. **Future-Proof**: Zoneless-ready

---

## Risks & Mitigation

### Risk 1: Loss of Time-Travel Debugging
**Mitigation**: Implement custom devtools or use browser extensions

### Risk 2: No Redux DevTools
**Mitigation**: Create simple logging service for state changes

### Risk 3: Team Familiarity with NgRx
**Mitigation**: Training sessions, documentation, gradual migration

### Risk 4: Complex State Logic
**Mitigation**: Signal services can handle complexity with computed signals and effects

---

## Recommendation

**YES, migrate to signal-based state management!**

### Why?
1. Your app is already using signals (types, origines, appellations)
2. Angular 21 makes signals first-class
3. Significant code reduction and performance gains
4. Simpler architecture for your team
5. Future-proof for zoneless Angular

### When?
- **After** completing the Signal Forms migration
- **Before** adding new features
- **Gradually** over 4-5 weeks

### How?
1. Start with one entity (e.g., Types - simplest)
2. Run in parallel with NgRx
3. Migrate components one by one
4. Remove NgRx when all components migrated

---

## Next Steps

1. **Review this plan** with your team
2. **Prototype** TypeStateService
3. **Test** in one component
4. **Decide** on migration timeline
5. **Execute** phase by phase
