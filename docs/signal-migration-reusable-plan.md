# Angular Signal Migration Plan - Reusable Template

**Target:** Angular 21+ with @ngrx/signals  
**Pattern:** SignalStore with NgRx Integration  
**Based on:** VinPage Component Migration (Feb 2026)

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Migration Strategy](#migration-strategy)
3. [SignalStore Architecture](#signalstore-architecture)
4. [Step-by-Step Process](#step-by-step-process)
5. [Signal APIs Reference](#signal-apis-reference)
6. [Effect Migration Patterns](#effect-migration-patterns)
7. [Common Pitfalls](#common-pitfalls)
8. [Testing Checklist](#testing-checklist)

---

## Prerequisites

### Dependencies Required
```bash
npm install @ngrx/signals@21.0.1
```

### Knowledge Required
- Angular Signals (signal, computed, effect, untracked)
- @ngrx/signals (signalStore, withState, withComputed, withMethods, withHooks)
- RxJS operators (takeUntilDestroyed, filter, map, startWith)
- TypeScript generics and type inference

---

## Migration Strategy

### Phase 1: Analysis
1. **Identify current state management pattern**
   - Service-based state?
   - Direct NgRx store usage?
   - Component-local state?

2. **Map state structure**
   - What data is stored?
   - What is derived/computed?
   - What are the side effects?

3. **Analyze effects**
   - Which effects are legitimate side effects?
   - Which should be computed signals?
   - Which should be RxJS subscriptions?
   - Which should be explicit methods?

### Phase 2: Implementation
1. Create SignalStore
2. Migrate component to use store
3. Refactor effects
4. Update templates
5. Test thoroughly

### Phase 3: Cleanup
1. Remove old service files
2. Update imports
3. Remove unused code
4. Document changes

---

## SignalStore Architecture

### File Structure
```
src/app/services/
  ├── [feature]-state.store.ts    # New SignalStore
  └── [feature]-state.service.ts  # Old service (to be deleted)
```

### SignalStore Template
```typescript
import { signalStore, withState, withComputed, withMethods, withHooks } from '@ngrx/signals';
import { computed, inject } from '@angular/core';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, tap, switchMap, catchError, of } from 'rxjs';
import { tapResponse } from '@ngrx/operators';

// 1. Define State Interface
interface FeatureState {
  // Core state
  items: ItemType[];
  currentItemId: string | null;
  
  // UI state
  loading: boolean;
  error: string | null;
  
  // Form state (if applicable)
  formDirtyStates: Map<string, boolean>;
}

// 2. Define Initial State
const initialState: FeatureState = {
  items: [],
  currentItemId: null,
  loading: false,
  error: null,
  formDirtyStates: new Map(),
};

// 3. Create SignalStore
export const FeatureStore = signalStore(
  { providedIn: 'root' },
  
  // State
  withState(initialState),
  
  // Computed Selectors
  withComputed((store) => ({
    // Derived state
    itemsList: computed(() => store.items()),
    
    currentItem: computed(() => {
      const id = store.currentItemId();
      if (!id) return null;
      return store.items().find(item => item.id === id) ?? null;
    }),
    
    // Complex computations
    itemsMap: computed(() => {
      const items = store.items();
      return new Map(items.map(item => [item.id, item]));
    }),
    
    // UI state
    hasItems: computed(() => store.items().length > 0),
    isLoading: computed(() => store.loading()),
  })),
  
  // Methods (Actions)
  withMethods((store, pouchDB = inject(PouchDBService), ngrxStore = inject(Store)) => ({
    // Synchronous state updates
    setCurrentItem(id: string | null): void {
      patchState(store, { currentItemId: id });
    },
    
    // Async operations with rxMethod
    loadItems: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(() => pouchDB.getAll('items').pipe(
          tapResponse({
            next: (items) => {
              patchState(store, { items, loading: false });
              // Dispatch to NgRx if needed
              ngrxStore.dispatch(ItemActions.loadSuccess({ items }));
            },
            error: (error: Error) => {
              patchState(store, { 
                error: error.message, 
                loading: false 
              });
            },
          })
        ))
      )
    ),
    
    // CRUD operations
    async saveItem(item: ItemType): Promise<{ success: boolean; item?: ItemType; error?: string }> {
      try {
        patchState(store, { loading: true, error: null });
        
        const savedItem = await pouchDB.save('items', item);
        
        // Update local state
        const items = store.items();
        const index = items.findIndex(i => i.id === item.id);
        const updatedItems = index >= 0
          ? [...items.slice(0, index), savedItem, ...items.slice(index + 1)]
          : [...items, savedItem];
        
        patchState(store, { items: updatedItems, loading: false });
        
        // Dispatch to NgRx
        ngrxStore.dispatch(ItemActions.saveSuccess({ item: savedItem }));
        
        return { success: true, item: savedItem };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        patchState(store, { error: errorMsg, loading: false });
        return { success: false, error: errorMsg };
      }
    },
    
    async deleteItem(id: string): Promise<{ success: boolean; error?: string }> {
      try {
        patchState(store, { loading: true, error: null });
        
        await pouchDB.delete('items', id);
        
        // Update local state
        const items = store.items().filter(i => i.id !== id);
        patchState(store, { items, loading: false });
        
        // Dispatch to NgRx
        ngrxStore.dispatch(ItemActions.deleteSuccess({ id }));
        
        return { success: true };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        patchState(store, { error: errorMsg, loading: false });
        return { success: false, error: errorMsg };
      }
    },
    
    // Form state management
    updateFormDirtyState(id: string, isDirty: boolean): void {
      const formDirtyStates = new Map(store.formDirtyStates());
      formDirtyStates.set(id, isDirty);
      patchState(store, { formDirtyStates });
    },
  })),
  
  // Lifecycle Hooks
  withHooks({
    onInit(store, pouchDB = inject(PouchDBService), ngrxStore = inject(Store)) {
      // Load initial data
      store.loadItems();
      
      // Sync with NgRx store
      const subscription = ngrxStore.select(selectAllItems).subscribe(items => {
        patchState(store, { items });
      });
      
      // Cleanup on destroy
      return () => subscription.unsubscribe();
    },
    
    onDestroy() {
      console.log('FeatureStore destroyed');
    },
  })
);
```

---

## Step-by-Step Process

### Step 1: Create SignalStore

1. **Create new file:** `src/app/services/[feature]-state.store.ts`

2. **Define state interface:**
```typescript
interface FeatureState {
  // Map your current service properties
  items: ItemType[];
  currentItemId: string | null;
  loading: boolean;
  error: string | null;
}
```

3. **Implement withState:**
```typescript
const initialState: FeatureState = {
  items: [],
  currentItemId: null,
  loading: false,
  error: null,
};
```

4. **Implement withComputed:**
```typescript
withComputed((store) => ({
  // Convert getters to computed signals
  currentItem: computed(() => {
    const id = store.currentItemId();
    return store.items().find(item => item.id === id) ?? null;
  }),
}))
```

5. **Implement withMethods:**
```typescript
withMethods((store, deps = inject(DependencyService)) => ({
  // Convert service methods
  async saveItem(item: ItemType) {
    // Implementation
  },
}))
```

6. **Implement withHooks:**
```typescript
withHooks({
  onInit(store) {
    // Initialize data
    // Set up subscriptions
    // Return cleanup function
  },
})
```

### Step 2: Update Component

1. **Update imports:**
```typescript
// Remove old service import
// import { FeatureService } from '../services/feature.service';

// Add new store import
import { FeatureStore } from '../services/feature-state.store';
import { untracked } from '@angular/core';
```

2. **Update dependency injection:**
```typescript
// Before:
private readonly featureService = inject(FeatureService);

// After:
private readonly featureStore = inject(FeatureStore);
```

3. **Update signal references:**
```typescript
// Before:
readonly currentItem = computed(() => this.featureService.getCurrentItem()());

// After:
readonly currentItem = this.featureStore.currentItem;
```

4. **Update method calls:**
```typescript
// Before:
this.featureService.saveItem(item);

// After:
const result = await this.featureStore.saveItem(item);
if (result.success) {
  // Handle success
}
```

### Step 3: Refactor Effects

Use the [Effect Migration Patterns](#effect-migration-patterns) section below.

### Step 4: Update Templates

1. **Fix signal calls:**
```html
<!-- Before: -->
@if (currentItem.name) {

<!-- After: -->
@if (currentItem().name) {
```

2. **Fix all signal references:**
```html
<!-- Before: -->
{{ items.length }}

<!-- After: -->
{{ items().length }}
```

### Step 5: Test

Follow the [Testing Checklist](#testing-checklist) section below.

---

## Signal APIs Reference

### Core Signal APIs

#### 1. `signal<T>(initialValue: T)`
**Purpose:** Create writable signal  
**Use Case:** Component-local state that changes over time

```typescript
// Component property
private readonly selectedId = signal<string | null>(null);

// Update
this.selectedId.set('123');

// Read
const id = this.selectedId();
```

#### 2. `computed<T>(() => T)`
**Purpose:** Create derived state  
**Use Case:** Values calculated from other signals

```typescript
// Automatically updates when dependencies change
readonly currentItem = computed(() => {
  const id = this.selectedId();
  return this.items().find(item => item.id === id) ?? null;
});

// Read (never write)
const item = this.currentItem();
```

#### 3. `effect(() => void)`
**Purpose:** Side effects that run when signals change  
**Use Case:** Logging, analytics, DOM manipulation, external API calls

```typescript
// Runs when dependencies change
effect(() => {
  const item = this.currentItem();
  console.log('Current item changed:', item);
});

// With options
effect(() => {
  // Can write to signals
}, { allowSignalWrites: true });
```

#### 4. `untracked<T>(() => T)`
**Purpose:** Read signals without creating dependencies  
**Use Case:** Prevent infinite loops in effects

```typescript
effect(() => {
  const id = this.selectedId(); // Creates dependency
  
  untracked(() => {
    const item = this.currentItem(); // No dependency
    this.store.updateState(id, item); // Won't trigger this effect
  });
});
```

### @ngrx/signals APIs

#### 1. `signalStore(config, ...features)`
**Purpose:** Create a signal-based store  
**Use Case:** Feature state management

```typescript
export const MyStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({ /* ... */ })),
  withMethods((store) => ({ /* ... */ })),
  withHooks({ onInit, onDestroy })
);
```

#### 2. `withState(initialState)`
**Purpose:** Define store state  
**Use Case:** All state properties

```typescript
withState({
  items: [] as Item[],
  loading: false,
  error: null as string | null,
})
```

#### 3. `withComputed((store) => ({ ... }))`
**Purpose:** Define computed selectors  
**Use Case:** Derived state

```typescript
withComputed((store) => ({
  itemCount: computed(() => store.items().length),
  hasItems: computed(() => store.items().length > 0),
}))
```

#### 4. `withMethods((store, ...deps) => ({ ... }))`
**Purpose:** Define actions/methods  
**Use Case:** State updates, async operations

```typescript
withMethods((store, api = inject(ApiService)) => ({
  async loadItems() {
    patchState(store, { loading: true });
    const items = await api.getItems();
    patchState(store, { items, loading: false });
  },
}))
```

#### 5. `withHooks({ onInit, onDestroy })`
**Purpose:** Lifecycle management  
**Use Case:** Initialize data, set up subscriptions

```typescript
withHooks({
  onInit(store) {
    store.loadItems();
    
    const sub = someObservable$.subscribe(/* ... */);
    return () => sub.unsubscribe();
  },
})
```

#### 6. `patchState(store, partial)`
**Purpose:** Update store state  
**Use Case:** All state mutations

```typescript
patchState(store, { loading: true });
patchState(store, { items: newItems, loading: false });
```

#### 7. `rxMethod<T>(pipe(...))`
**Purpose:** Create reactive method from observable  
**Use Case:** Async operations with RxJS

```typescript
loadItems: rxMethod<void>(
  pipe(
    tap(() => patchState(store, { loading: true })),
    switchMap(() => api.getItems()),
    tapResponse({
      next: (items) => patchState(store, { items, loading: false }),
      error: (error) => patchState(store, { error: error.message }),
    })
  )
)
```

---

## Effect Migration Patterns

### Pattern 1: Route Parameter Handler
**Keep as Effect** - Legitimate side effect

```typescript
// BEFORE: Service method
this.route.params.subscribe(params => {
  this.service.setCurrentId(params['id']);
});

// AFTER: Effect
effect(() => {
  const id = this.route.snapshot.params['id'];
  this.store.setCurrentItem(id);
}, { allowSignalWrites: true });
```

### Pattern 2: Load Data into Form
**Keep as Effect** - Depends on async data

```typescript
// BEFORE: Service method
this.service.currentItem$.subscribe(item => {
  if (item) this.loadIntoForm(item);
});

// AFTER: Effect
effect(() => {
  const item = this.currentItem();
  if (item) {
    this.loadIntoForm(item);
  }
}, { allowSignalWrites: true });
```

### Pattern 3: Auto-fill Form Fields
**Convert to RxJS Subscription** - FormGroup integration

```typescript
// BEFORE: Effect
effect(() => {
  const value1 = this.form?.get('field1')?.value;
  if (value1) {
    this.form?.get('field2')?.patchValue(value1);
  }
});

// AFTER: RxJS Subscription
private setupAutoFill(): void {
  this.form.get('field1')?.valueChanges
    .pipe(
      takeUntilDestroyed(this.destroyRef),
      filter(value => !!value)
    )
    .subscribe(value => {
      this.form.get('field2')?.patchValue(value, { emitEvent: false });
    });
}
```

### Pattern 4: Operation Result Handling
**Convert to Direct Method Handling** - Not a side effect

```typescript
// BEFORE: Effect watching result signal
effect(() => {
  const result = this.service.lastOperation();
  if (result?.success) {
    this.showToast('Success');
  }
});

// AFTER: Direct handling in method
async saveItem() {
  const result = await this.store.saveItem(item);
  if (result.success) {
    await this.showToast('Success');
  } else if (result.error) {
    await this.showToast(result.error);
  }
}
```

### Pattern 5: Track Original Values
**Convert to Computed Signals** - Derived state

```typescript
// BEFORE: Effect with signal writes
private readonly originalName = signal<string>('');

effect(() => {
  const item = this.currentItem();
  if (item) {
    this.originalName.set(item.name);
  }
}, { allowSignalWrites: true });

// AFTER: Computed signal
readonly originalName = computed(() => this.currentItem()?.name ?? '');
```

### Pattern 6: Form Dirty State Tracking
**Hybrid: RxJS + Effect with untracked()** - Prevent infinite loops

```typescript
// BEFORE: Effect causing infinite loop
effect(() => {
  const isDirty = this.form?.dirty || this.dirtyPhoto();
  this.store.updateFormDirtyState(this.itemId(), isDirty);
});

// AFTER: RxJS + Effect with untracked
private setupFormDirtyTracking(): void {
  // Track form via RxJS
  this.form.statusChanges
    .pipe(
      takeUntilDestroyed(this.destroyRef),
      startWith(this.form.status),
      map(() => this.form.dirty)
    )
    .subscribe(formDirty => {
      const id = this.itemId();
      if (id) {
        this.store.updateFormDirtyState(id, formDirty || this.dirtyPhoto());
      }
    });

  // Track dirtyPhoto with untracked
  effect(() => {
    const id = this.itemId();
    const photoDirty = this.dirtyPhoto();
    
    if (id) {
      untracked(() => {
        const formDirty = this.form?.dirty || false;
        this.store.updateFormDirtyState(id, formDirty || photoDirty);
      });
    }
  });
}
```

### Pattern 7: Concurrent Update Warnings
**Keep as Effect** - Legitimate side effect (UI notification)

```typescript
// Keep as-is
effect(() => {
  const update = this.store.concurrentUpdate();
  if (update) {
    this.showWarning('Concurrent update detected');
  }
});
```

### Pattern 8: Load External Resources
**Keep as Effect** - Legitimate side effect (async loading)

```typescript
// Keep as-is
effect(() => {
  const photoId = this.currentItem()?.photoId;
  if (photoId) {
    this.loadPhoto(photoId);
  }
}, { allowSignalWrites: true });
```

---

## Common Pitfalls

### 1. Infinite Loops in Effects

**Problem:**
```typescript
effect(() => {
  const value = this.signal();
  this.store.updateState(value); // Triggers patchState
  // patchState updates signal, effect runs again → infinite loop
});
```

**Solution:**
```typescript
effect(() => {
  const value = this.signal();
  untracked(() => {
    this.store.updateState(value); // Won't trigger this effect
  });
});
```

### 2. Forgetting Signal Calls in Templates

**Problem:**
```html
@if (currentItem.name) {  <!-- Wrong: accessing signal property -->
  {{ currentItem.name }}
}
```

**Solution:**
```html
@if (currentItem().name) {  <!-- Correct: calling signal -->
  {{ currentItem().name }}
}
```

### 3. Using Effects for Derived State

**Problem:**
```typescript
private readonly fullName = signal<string>('');

effect(() => {
  const first = this.firstName();
  const last = this.lastName();
  this.fullName.set(`${first} ${last}`);
}, { allowSignalWrites: true });
```

**Solution:**
```typescript
readonly fullName = computed(() => {
  return `${this.firstName()} ${this.lastName()}`;
});
```

### 4. Missing Ionic Component Imports

**Problem:**
```typescript
@Component({
  imports: [CommonModule, IonHeader, IonContent],
  // Missing IonList, IonItem, IonLabel
})
```

**Solution:**
```typescript
@Component({
  imports: [
    CommonModule,
    IonHeader,
    IonContent,
    IonList,    // Add all used Ionic components
    IonItem,
    IonLabel,
  ],
})
```

### 5. Not Handling Async Results

**Problem:**
```typescript
this.store.saveItem(item); // Fire and forget
this.router.navigate(['/home']); // Navigate before save completes
```

**Solution:**
```typescript
const result = await this.store.saveItem(item);
if (result.success) {
  await this.showToast('Saved');
  this.router.navigate(['/home']);
} else {
  await this.showToast(result.error);
}
```

### 6. Readonly vs Private Readonly

**Problem:**
```typescript
readonly mySignal = signal<string>(''); // Can't use .set()
```

**Solution:**
```typescript
private readonly mySignal = signal<string>(''); // Can use .set()
// OR
readonly mySignal = computed(() => /* ... */); // For derived state
```

---

## Testing Checklist

### Pre-Migration
- [ ] Document current behavior
- [ ] Identify all state properties
- [ ] List all effects and their purposes
- [ ] Note all external dependencies

### During Migration
- [ ] Create SignalStore with all state
- [ ] Implement all computed selectors
- [ ] Migrate all methods
- [ ] Set up lifecycle hooks
- [ ] Update component injection
- [ ] Refactor all effects
- [ ] Update all template signal calls
- [ ] Add missing Ionic imports

### Post-Migration
- [ ] TypeScript compilation succeeds
- [ ] No console errors
- [ ] All features work correctly
- [ ] No infinite loops
- [ ] Forms validate properly
- [ ] Navigation works
- [ ] Data loads correctly
- [ ] CRUD operations work
- [ ] Production build succeeds
- [ ] Performance is acceptable

### Cleanup
- [ ] Remove old service files
- [ ] Remove unused imports
- [ ] Update documentation
- [ ] Commit changes with clear message

---

## Example Migration Checklist

```markdown
## [Component Name] Signal Migration

### Analysis
- [ ] Current state management: [Service/NgRx/Local]
- [ ] State properties identified: [List]
- [ ] Effects analyzed: [Count]
- [ ] Dependencies mapped: [List]

### Implementation
- [ ] SignalStore created
- [ ] withState implemented
- [ ] withComputed implemented
- [ ] withMethods implemented
- [ ] withHooks implemented
- [ ] Component updated
- [ ] Effects refactored
- [ ] Templates updated

### Testing
- [ ] TypeScript compiles
- [ ] Dev server runs
- [ ] All features work
- [ ] Production build succeeds
- [ ] No console errors
- [ ] Performance acceptable

### Cleanup
- [ ] Old files deleted
- [ ] Imports cleaned
- [ ] Documentation updated
- [ ] Changes committed
```

---

## Quick Reference Card

### When to Use What

| Scenario | Solution |
|----------|----------|
| Component-local state | `signal<T>()` |
| Derived/computed state | `computed(() => T)` |
| Side effects (logging, DOM) | `effect(() => void)` |
| Feature state management | `signalStore(...)` |
| Store state definition | `withState(...)` |
| Store selectors | `withComputed(...)` |
| Store actions | `withMethods(...)` |
| Store initialization | `withHooks(...)` |
| State updates | `patchState(...)` |
| Async operations | `rxMethod(...)` |
| FormGroup integration | RxJS subscription |
| Prevent infinite loops | `untracked(() => T)` |
| Operation results | Direct method handling |
| Route parameters | `effect()` with route |
| Load async data | `effect()` with async |

---

## Success Criteria

✅ **Code Quality**
- Type-safe throughout
- No `any` types
- Clear naming conventions
- Self-documenting structure

✅ **Performance**
- Fewer effects than before
- Automatic memoization
- Fine-grained reactivity
- No unnecessary re-renders

✅ **Maintainability**
- Clear separation of concerns
- Easy to test
- Easy to extend
- Well-documented

✅ **Functionality**
- All features work
- No regressions
- Better error handling
- Improved UX

---

**Last Updated:** 2026-02-17  
**Based On:** VinPage Component Migration  
**Status:** Production-Ready Template