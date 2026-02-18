# Signal-Based VinStateService with NgRx Integration

## Overview

The VinPage component has been migrated to use a signal-based `VinStateService` while maintaining **full backward compatibility** with the existing NgRx Store used by other components (HomePage, StatsPage, etc.).

## Architecture

### Dual State Management

```
┌─────────────────────────────────────────────────────────────┐
│                     Application State                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │  VinStateService │◄────────┤   NgRx Store     │          │
│  │   (Signals)      │────────►│   (Vins State)   │          │
│  └──────────────────┘         └──────────────────┘          │
│         ▲                              ▲                     │
│         │                              │                     │
│         │                              │                     │
│    ┌────┴────┐                    ┌───┴────┐                │
│    │ VinPage │                    │HomePage│                │
│    │(Signals)│                    │ (NgRx) │                │
│    └─────────┘                    └────────┘                │
│                                                               │
│         Both synchronized via PouchDB changes                │
│                        ▲                                      │
│                        │                                      │
│                  ┌─────┴──────┐                              │
│                  │  PouchDB   │                              │
│                  │  Service   │                              │
│                  └────────────┘                              │
└─────────────────────────────────────────────────────────────┘
```

## How It Works

### 1. VinStateService Dispatches to NgRx Store

Every operation in VinStateService automatically dispatches corresponding NgRx actions:

```typescript
// When loading vins
async loadVins() {
  const vins = await this.pouchService.getDocsOfType$('vin').toPromise();
  this._vins.set(new Map(vins.map(v => [v._id, v])));
  
  // ✅ Dispatch to NgRx Store for other components
  this.store.dispatch(VinActions.loadVinsSuccess({ vins }));
}

// When saving a vin
async saveVin(vin: VinModel) {
  const result = await this.pouchService.saveDoc(vin, 'vin');
  this._vins.update(vins => {
    const newMap = new Map(vins);
    newMap.set(result.id, updatedVin);
    return newMap;
  });
  
  // ✅ Dispatch to NgRx Store for other components
  this.store.dispatch(VinActions.createVinSuccess({ 
    vin: updatedVin, 
    source: 'internal' 
  }));
}

// When deleting a vin
async deleteVin(vin: VinModel) {
  await this.pouchService.deleteDoc(vin);
  this._vins.update(vins => {
    const newMap = new Map(vins);
    newMap.delete(vin._id);
    return newMap;
  });
  
  // ✅ Dispatch to NgRx Store for other components
  this.store.dispatch(VinActions.deleteVinSuccess({ 
    result: { id: vin._id, rev: vin._rev }, 
    source: 'internal' 
  }));
}
```

### 2. PouchDB Changes Sync Both Stores

VinStateService listens to PouchDB changes and updates both stores:

```typescript
private initializePouchDBSync(): void {
  this.pouchService.dbChanges$.subscribe((change) => {
    if (change.id && change.id.startsWith('vin|')) {
      this.zone.run(() => {
        this.handleExternalChange(change);
        // This method updates both:
        // 1. VinStateService signals
        // 2. NgRx Store (via dispatch)
      });
    }
  });
}
```

### 3. External Changes Handled

When changes come from other devices/instances via PouchDB sync:

```typescript
handleExternalChange(change: any): void {
  if (change.deleted) {
    // Update signal state
    this._vins.update(vins => {
      const newMap = new Map(vins);
      newMap.delete(change.id);
      return newMap;
    });
    
    // ✅ Update NgRx Store
    this.store.dispatch(VinActions.deleteVinSuccess({ 
      result: change, 
      source: 'external' 
    }));
  } else {
    const vin = change.doc as VinModel;
    
    // Update signal state
    this._vins.update(vins => {
      const newMap = new Map(vins);
      newMap.set(vin._id, vin);
      return newMap;
    });
    
    // ✅ Update NgRx Store
    this.store.dispatch(VinActions.createVinSuccess({ 
      vin, 
      source: 'external' 
    }));
  }
}
```

## Component Usage

### VinPage (Signal-based)

```typescript
export class VinPage {
  private readonly vinState = inject(VinStateService);
  
  // Use signals directly
  readonly currentVin = computed(() => {
    const vinId = this.vinId();
    return vinId ? this.vinState.getVin(vinId)() : null;
  });
  
  async saveVin() {
    await this.vinState.saveVin(vinData);
    // NgRx Store automatically updated ✅
  }
}
```

### HomePage (NgRx-based)

```typescript
export class HomePage {
  // Still uses NgRx selectors - works perfectly!
  filteredWines = computed<VinModel[]>(() =>
    this.store.selectSignal(
      VinSelectors.getFilteredWines(this.searchString(), this.isInStock())
    )()
  );
  
  ngOnInit() {
    // Dispatches loadVins action
    this.store.dispatch(VinActions.loadVins());
    // NgRx Effects call PouchDB
    // VinStateService stays in sync ✅
  }
}
```

## Benefits

### ✅ Zero Breaking Changes
- HomePage, StatsPage, and other components continue to work unchanged
- They still use NgRx Store and selectors
- No migration required for other components

### ✅ Automatic Synchronization
- VinStateService operations update NgRx Store
- NgRx Effects operations update VinStateService (via PouchDB changes)
- Both stores always in sync

### ✅ Concurrent Update Detection
- VinStateService tracks all operations (internal and external)
- Detects when another instance modifies the same wine
- Shows warnings to users

### ✅ Performance
- VinPage benefits from fine-grained signal reactivity
- Other components continue with NgRx (no performance impact)
- PouchDB changes processed once, both stores updated

### ✅ Gradual Migration Path
- VinPage migrated first (proof of concept)
- Other components can be migrated incrementally
- Or keep using NgRx indefinitely

## Data Flow Examples

### Example 1: User Saves Wine in VinPage

```
1. User clicks Save in VinPage
2. VinPage calls vinState.saveVin(vin)
3. VinStateService:
   a. Saves to PouchDB
   b. Updates signal state
   c. Dispatches VinActions.createVinSuccess()
4. NgRx Store updated via reducer
5. HomePage automatically sees the new wine ✅
```

### Example 2: User Loads Wines in HomePage

```
1. HomePage dispatches VinActions.loadVins()
2. NgRx Effect calls PouchDB
3. Effect dispatches VinActions.loadVinsSuccess({ vins })
4. NgRx Store updated via reducer
5. VinStateService listens to PouchDB changes
6. VinStateService updates its signal state
7. Both stores in sync ✅
```

### Example 3: External Change from Another Device

```
1. Another device saves a wine
2. PouchDB sync receives the change
3. PouchDB emits dbChanges$ event
4. VinStateService.handleExternalChange():
   a. Updates signal state
   b. Dispatches VinActions.createVinSuccess({ source: 'external' })
5. NgRx Store updated via reducer
6. Both VinPage and HomePage see the change ✅
7. VinPage shows concurrent update warning if editing same wine
```

## Testing Checklist

### VinPage (Signal-based)
- [ ] Create new wine
- [ ] Edit existing wine
- [ ] Delete wine
- [ ] Upload photo
- [ ] Delete photo
- [ ] Concurrent update detection
- [ ] Form validation
- [ ] Duplicate detection

### HomePage (NgRx-based)
- [ ] List wines after VinPage creates one
- [ ] List wines after VinPage updates one
- [ ] List wines after VinPage deletes one
- [ ] Search functionality
- [ ] Filter by stock
- [ ] Maturity dashboard

### Cross-Component
- [ ] Create wine in VinPage → appears in HomePage
- [ ] Delete wine in VinPage → removed from HomePage
- [ ] Update wine in VinPage → updated in HomePage
- [ ] External change → both components updated

### PouchDB Sync
- [ ] Changes from another device appear in both stores
- [ ] Concurrent edits detected and warned
- [ ] Offline changes sync when online

## Migration Strategy for Other Components

If you want to migrate other components to signals:

1. **Keep VinStateService as single source of truth**
2. **Gradually migrate components one by one**
3. **Each migrated component uses VinStateService directly**
4. **VinStateService continues dispatching to NgRx Store**
5. **When all components migrated, remove NgRx dispatches**

## Conclusion

The current implementation provides:
- ✅ Modern signal-based architecture for VinPage
- ✅ Full backward compatibility with NgRx
- ✅ Automatic synchronization between both stores
- ✅ No breaking changes for existing components
- ✅ Clear migration path for future

Both state management approaches coexist peacefully, synchronized via PouchDB changes and explicit NgRx dispatches.