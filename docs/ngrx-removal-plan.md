# NgRx Store Removal Plan

**Date:** 2026-02-25  
**Status:** Ready for Implementation  
**Goal:** Remove NgRx Store and consolidate on @ngrx/signals (signalStore) only

---

## Executive Summary

Now that all components have been migrated to use signal stores (VinStore, TypeStore, OrigineStore, AppellationStore), we can **completely remove the traditional NgRx Store** and simplify the architecture to use only `@ngrx/signals`.

### Current Situation
- ✅ All components migrated to signal stores
- ❌ Still maintaining NgRx Store for backward compatibility
- ❌ Duplicate state management (signals + NgRx)
- ❌ Unnecessary complexity

### Proposed Solution
- ✅ Keep `@ngrx/signals` (signalStore) - Modern, lightweight
- ❌ Remove `@ngrx/store` - Traditional store, no longer needed
- ❌ Remove all NgRx actions, reducers, effects, selectors
- ✅ Simplify to single state management approach

---

## Architecture Comparison

### Current (Dual State Management)
```
┌─────────────────────────────────────────────────────────┐
│                  Application State                       │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────┐         ┌──────────────┐              │
│  │ SignalStores │◄────────┤  NgRx Store  │              │
│  │  (Modern)    │────────►│  (Legacy)    │              │
│  └──────────────┘         └──────────────┘              │
│         ▲                         ▲                      │
│         │                         │                      │
│         │    Synchronized via     │                      │
│         │    dispatches           │                      │
│         │                         │                      │
│    ┌────┴────┐              ┌────┴────┐                 │
│    │Components│              │Components│                 │
│    │(Signals) │              │ (NgRx)  │                 │
│    └─────────┘              └─────────┘                 │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### Proposed (Single State Management)
```
┌─────────────────────────────────────────────────────────┐
│                  Application State                       │
├─────────────────────────────────────────────────────────┤
│                                                           │
│              ┌──────────────────┐                        │
│              │  SignalStores    │                        │
│              │  (@ngrx/signals) │                        │
│              └──────────────────┘                        │
│                       ▲                                   │
│                       │                                   │
│                       │                                   │
│              ┌────────┴────────┐                         │
│              │   Components    │                         │
│              │   (All Signals) │                         │
│              └─────────────────┘                         │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

---

## Benefits of Removal

### 1. **Simplified Architecture**
- Single state management approach
- No dual synchronization needed
- Easier to understand and maintain

### 2. **Reduced Bundle Size**
- Remove `@ngrx/store` package (~50KB)
- Remove `@ngrx/effects` package (~30KB)
- Remove all actions, reducers, effects, selectors (~20KB of code)
- **Total savings: ~100KB**

### 3. **Better Performance**
- No NgRx middleware overhead
- Direct signal reactivity
- Fine-grained updates
- No action dispatching overhead

### 4. **Simpler Code**
- No boilerplate (actions, reducers, effects)
- Direct method calls instead of dispatches
- Computed signals instead of selectors
- Less indirection

### 5. **Modern Angular**
- Aligned with Angular's signal direction
- Ready for zoneless Angular
- Uses latest Angular patterns

---

## Components Using NgRx Store

### Currently Using NgRx (Need Updates)

1. **home.page.ts** - Uses Store for Type/Origine/Appellation actions
2. **stats.page.ts** - Imports Store (but already migrated to VinStore)
3. **login.component.ts** - Uses Store for VinActions
4. **type.page.ts** - Uses Store (already has TypeStore)
5. **region.page.ts** - Uses Store
6. **vin.page.ts** - Uses Store for Type/Origine/Appellation selectors
7. **appellation.page.ts** - Uses Store (already has AppellationStore)

### Signal Stores Available

1. ✅ **VinStore** - `client/src/app/services/vin-state.store.ts`
2. ✅ **TypeStore** - `client/src/app/services/type-state.store.ts`
3. ✅ **OrigineStore** - `client/src/app/services/origine-state.store.ts`
4. ✅ **AppellationStore** - `client/src/app/services/appellation-state.store.ts`

---

## Removal Plan

### Phase 1: Remove NgRx Dispatches from Signal Stores

**Files to Update:**
- `client/src/app/services/vin-state.store.ts`
- `client/src/app/services/type-state.store.ts`
- `client/src/app/services/origine-state.store.ts`
- `client/src/app/services/appellation-state.store.ts`

**Changes:**
1. Remove `Store` injection
2. Remove all `store.dispatch()` calls
3. Remove NgRx action imports
4. Keep only signal-based state management

**Example (VinStore):**
```typescript
// BEFORE
import { Store } from '@ngrx/store';
import * as VinActions from '../state/vin/vin.actions';

export const VinStore = signalStore(
  { providedIn: 'root' },
  withMethods((store, pouchService = inject(PouchdbService), ngrxStore = inject(Store)) => ({
    async loadVins() {
      const vins = await pouchService.getDocsOfType$('vin').toPromise();
      patchState(store, { vins: new Map(vins.map(v => [v._id, v])) });
      
      // ❌ Remove this
      ngrxStore.dispatch(VinActions.loadVinsSuccess({ vins }));
    }
  }))
);

// AFTER
export const VinStore = signalStore(
  { providedIn: 'root' },
  withMethods((store, pouchService = inject(PouchdbService)) => ({
    async loadVins() {
      const vins = await pouchService.getDocsOfType$('vin').toPromise();
      patchState(store, { vins: new Map(vins.map(v => [v._id, v])) });
      // ✅ That's it! No NgRx dispatch needed
    }
  }))
);
```

### Phase 2: Update Components to Remove NgRx Store Injection

**Files to Update:**
1. `client/src/app/home/home.page.ts`
2. `client/src/app/stats/stats.page.ts`
3. `client/src/app/authentication/login/login.component.ts`
4. `client/src/app/type/type.page.ts`
5. `client/src/app/region/region.page.ts`
6. `client/src/app/vin/vin.page.ts`
7. `client/src/app/appellation/appellation.page.ts`

**Changes:**
1. Remove `Store` injection
2. Remove NgRx action imports
3. Use signal stores directly
4. Replace `store.dispatch()` with direct method calls

**Example (home.page.ts):**
```typescript
// BEFORE
import { Store } from "@ngrx/store";
import * as TypeActions from "../state/type/type.actions";
import * as OrigineActions from "../state/origine/origine.actions";
import * as AppellationActions from "../state/appellation/appellation.actions";

export class HomePage implements OnInit {
  private readonly store = inject(Store<AppState>);
  
  ngOnInit() {
    this.vinStore.loadVins();
    this.store.dispatch(TypeActions.loadTypes());
    this.store.dispatch(OrigineActions.loadOrigines());
    this.store.dispatch(AppellationActions.loadAppellations());
  }
}

// AFTER
import { TypeStore } from "../services/type-state.store";
import { OrigineStore } from "../services/origine-state.store";
import { AppellationStore } from "../services/appellation-state.store";

export class HomePage implements OnInit {
  private readonly typeStore = inject(TypeStore);
  private readonly origineStore = inject(OrigineStore);
  private readonly appellationStore = inject(AppellationStore);
  
  ngOnInit() {
    this.vinStore.loadVins();
    this.typeStore.loadTypes();
    this.origineStore.loadOrigines();
    this.appellationStore.loadAppellations();
  }
}
```

### Phase 3: Remove NgRx State Directory

**Files to Delete:**
```
client/src/app/state/
├── app.state.ts
├── vin/
│   ├── vin.actions.ts
│   ├── vin.reducers.ts
│   ├── vin.effects.ts
│   └── vin.selectors.ts
├── type/
│   ├── type.actions.ts
│   ├── type.reducers.ts
│   ├── type.effects.ts
│   └── type.selectors.ts
├── origine/
│   ├── origine.actions.ts
│   ├── origine.reducers.ts
│   ├── origine.effects.ts
│   └── origine.selectors.ts
└── appellation/
    ├── appellation.actions.ts
    ├── appellation.reducers.ts
    ├── appellation.effects.ts
    └── appellation.selectors.ts
```

**Total files to delete: ~20 files**

### Phase 4: Update app.module.ts

**File:** `client/src/app/app.module.ts`

**Changes:**
```typescript
// BEFORE
import { StoreModule } from "@ngrx/store";
import { EffectsModule } from "@ngrx/effects";
import { reducers } from "./state/app.state";
import { VinEffects } from "./state/vin/vin.effects";
import { TypeEffects } from "./state/type/type.effects";
import { OrigineEffects } from "./state/origine/origine.effects";
import { AppellationEffects } from "./state/appellation/appellation.effects";

@NgModule({
  imports: [
    StoreModule.forRoot(reducers),
    EffectsModule.forRoot([
      VinEffects,
      TypeEffects,
      OrigineEffects,
      AppellationEffects
    ]),
    // ...
  ]
})

// AFTER
@NgModule({
  imports: [
    // ✅ NgRx Store removed!
    // Signal stores are provided via providedIn: 'root'
    // ...
  ]
})
```

### Phase 5: Update package.json

**File:** `client/package.json`

**Remove dependencies:**
```json
{
  "dependencies": {
    // ❌ Remove these
    "@ngrx/store": "^17.x.x",
    "@ngrx/effects": "^17.x.x",
    
    // ✅ Keep this
    "@ngrx/signals": "^17.x.x"
  }
}
```

### Phase 6: Run Tests and Verify

1. Run unit tests: `npm test`
2. Run e2e tests: `npm run e2e`
3. Manual testing of all components
4. Verify no console errors
5. Check bundle size reduction

---

## Migration Checklist

### Preparation
- [ ] Create new branch: `feature/remove-ngrx-store`
- [ ] Backup current state
- [ ] Review all NgRx usage

### Phase 1: Signal Stores
- [ ] Update VinStore - remove NgRx dispatches
- [ ] Update TypeStore - remove NgRx dispatches
- [ ] Update OrigineStore - remove NgRx dispatches
- [ ] Update AppellationStore - remove NgRx dispatches

### Phase 2: Components
- [ ] Update home.page.ts
- [ ] Update stats.page.ts
- [ ] Update login.component.ts
- [ ] Update type.page.ts
- [ ] Update region.page.ts
- [ ] Update vin.page.ts
- [ ] Update appellation.page.ts

### Phase 3: Cleanup
- [ ] Delete client/src/app/state/ directory
- [ ] Update app.module.ts
- [ ] Update package.json
- [ ] Run `npm install`

### Phase 4: Testing
- [ ] Run unit tests
- [ ] Run e2e tests
- [ ] Manual testing
- [ ] Performance testing
- [ ] Bundle size verification

### Phase 5: Documentation
- [ ] Update architecture documentation
- [ ] Update README.md
- [ ] Create migration summary
- [ ] Update signal-ngrx-integration.md

---

## Risk Assessment

### Low Risk ✅
- All components already using signal stores
- Signal stores fully functional
- No external dependencies on NgRx

### Medium Risk ⚠️
- Need thorough testing
- Potential edge cases in PouchDB sync
- Bundle size changes need verification

### Mitigation
- Comprehensive testing before merge
- Keep NgRx removal in separate branch
- Easy rollback if issues found
- Gradual rollout possible

---

## Expected Outcomes

### Code Reduction
- **~20 files deleted** (actions, reducers, effects, selectors)
- **~2000 lines of code removed**
- **~100KB bundle size reduction**

### Complexity Reduction
- Single state management approach
- No action/reducer boilerplate
- Direct method calls
- Simpler data flow

### Performance Improvement
- No NgRx middleware overhead
- Direct signal updates
- Fine-grained reactivity
- Faster change detection

### Maintainability
- Easier to understand
- Less code to maintain
- Modern Angular patterns
- Better developer experience

---

## Timeline

### Estimated Effort
- **Phase 1:** 2 hours (Update signal stores)
- **Phase 2:** 3 hours (Update components)
- **Phase 3:** 1 hour (Cleanup)
- **Phase 4:** 4 hours (Testing)
- **Phase 5:** 1 hour (Documentation)

**Total: ~11 hours (1.5 days)**

---

## Conclusion

Removing NgRx Store is:
- ✅ **Safe** - All components already migrated
- ✅ **Beneficial** - Simpler, faster, smaller
- ✅ **Modern** - Aligned with Angular's direction
- ✅ **Recommended** - No reason to keep dual state management

**Recommendation: Proceed with NgRx Store removal**

The application will be simpler, faster, and more maintainable with a single, modern state management approach using `@ngrx/signals`.