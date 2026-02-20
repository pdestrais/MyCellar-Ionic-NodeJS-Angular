# HomePage/Search Component Signal Migration Plan

**Date:** 2026-02-19  
**Component:** `client/src/app/home/home.page.ts`  
**Strategy:** Reuse VinStore + Remove NgRx Subscriptions

---

## Executive Summary

Migrate HomePage (search functionality) from NgRx subscriptions to signal-based VinStore. This approach:
- ✅ Reuses existing VinStore (single source of truth)
- ✅ Adds search/filter computed signals to VinStore
- ✅ Removes all NgRx subscriptions from HomePage
- ✅ Maintains backward compatibility with NgRx for other components

---

## Current State Analysis

### HomePage Current Implementation
```typescript
// Uses NgRx subscriptions (lines 121-132)
this.store.pipe(select(VinSelectors.getAllVins)).subscribe((wineList) => {
  this.wines.set(Array.from(wineList.values()));
  this.nbrARTD.set(...);
  this.nbrRTD.set(...);
  // Manual signal updates
});

// Uses NgRx selectors via computed (line 52)
filteredWines = computed(() =>
  this.store.selectSignal(VinSelectors.getFilteredWines(...))()
);
```

### Issues to Fix
1. ❌ Manual subscriptions with no cleanup
2. ❌ Mixing NgRx subscriptions with signals
3. ❌ Duplicate state (wines signal + NgRx store)
4. ❌ Manual signal updates in subscriptions
5. ❌ No OnDestroy cleanup

---

## Implementation Plan

### Phase 1: Enhance VinStore with Search/Filter Computed Signals

**File:** `client/src/app/services/vin-state.store.ts`

**Add to `withComputed` section (after line 134):**

```typescript
// Search and filter functionality
getFilteredWines: (searchString: string, inStockOnly: boolean) => computed(() => {
  const vins = store.vinsList();
  
  // Return empty if search string too short
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
}),

// Get wines by maturity category
getWinesByMaturity: (category: string) => computed(() => {
  const vins = store.vinsList();
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
  
  return maturityList.sort((a, b) =>
    a.annee + a.nom < b.annee + b.nom ? -1 : 1
  );
}),

// Maturity counts for dashboard
maturityCounts: computed(() => {
  const vins = store.vinsList();
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
```

**Add dayjs import at top of file:**
```typescript
import dayjs from 'dayjs';
```

---

### Phase 2: Migrate HomePage to Use VinStore

**File:** `client/src/app/home/home.page.ts`

**Complete new implementation:**

```typescript
import { Component, computed, inject, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { AlertController, NavController } from "@ionic/angular/standalone";
import { TranslateModule } from "@ngx-translate/core";
import { VinModel } from "../models/cellar.model";
import { VinStore } from "../services/vin-state.store";
import { Store } from "@ngrx/store";
import * as TypeActions from "../state/type/type.actions";
import * as OrigineActions from "../state/origine/origine.actions";
import * as AppellationActions from "../state/appellation/appellation.actions";
import { AppState } from "../state/app.state";
import { addIcons } from "ionicons";
import { arrowBackOutline, searchOutline } from "ionicons/icons";
import { 
  IonRouterLink, IonHeader, IonToolbar, IonButtons, IonMenuButton, 
  IonTitle, IonContent, IonButton, IonIcon, IonList, IonItem, 
  IonBadge, IonSearchbar, IonSpinner, IonToggle, IonLabel 
} from "@ionic/angular/standalone";
import Debug from "debug";

const debug = Debug("app:home");

@Component({
  selector: "app-home",
  templateUrl: "home.page.html",
  styleUrls: ["home.page.scss"],
  standalone: true,
  imports: [
    CommonModule, RouterModule, TranslateModule, IonRouterLink, 
    IonHeader, IonToolbar, IonButtons, IonMenuButton, IonTitle, 
    IonContent, IonButton, IonIcon, IonList, IonItem, IonBadge, 
    IonSearchbar, IonSpinner, IonToggle, IonLabel
  ],
})
export class HomePage implements OnInit {
  // Inject VinStore
  private readonly vinStore = inject(VinStore);
  private readonly store = inject(Store<AppState>);
  private readonly alertCtrl = inject(AlertController);
  private readonly navCtrl = inject(NavController);
  
  // ============================================
  // LOCAL UI STATE (Component-specific signals)
  // ============================================
  
  // Search and filter state
  readonly searchString = signal<string>("");
  readonly isInStock = signal<boolean>(true);
  readonly dashboardSelectedMaturity = signal<string>("");
  
  // ============================================
  // COMPUTED STATE FROM VINSTORE
  // ============================================
  
  // Loading state from VinStore
  readonly loading = this.vinStore.isLoading;
  
  // Filtered wines based on search
  readonly filteredWines = computed<VinModel[]>(() =>
    this.vinStore.getFilteredWines(
      this.searchString(), 
      this.isInStock()
    )
  );
  
  // Wines by maturity category
  readonly maturityWinesList = computed<VinModel[]>(() => {
    const category = this.dashboardSelectedMaturity();
    if (category === "") {
      return [];
    }
    return this.vinStore.getWinesByMaturity(category);
  });
  
  // Maturity counts for dashboard
  readonly maturityCounts = this.vinStore.maturityCounts;
  
  // Individual counts (for template compatibility)
  readonly nbrARTD = computed(() => this.maturityCounts().ARTD);
  readonly nbrRTD = computed(() => this.maturityCounts().RTD);
  readonly nbrNRTD = computed(() => this.maturityCounts().NRTD);
  readonly nbrNotRTD = computed(() => this.maturityCounts().NotRTD);
  
  constructor() {
    addIcons({ arrowBackOutline, searchOutline });
  }
  
  async alertNoRemoteDB() {
    const alert = await this.alertCtrl.create({
      header: "Alert",
      subHeader: "No Cloudant DB defined",
      message:
        "No Cloudant remote DB is defined to store your notes. Only the local storage will be used and no synchronization between devices will be possible.",
      buttons: [
        {
          text: "Ok",
          handler: () => {
            window.localStorage.setItem("localUse", "true");
            console.log("Confirm Ok");
          },
        },
        {
          text: "Configure Cloudant DB",
          handler: () => {
            this.navCtrl.navigateForward("/preferences");
            console.log("Confirm Cancel");
          },
        },
      ],
    });
    
    await alert.present();
  }
  
  ngOnInit() {
    debug("[ngOnInit] entering method");
    
    // Load vins via VinStore
    this.vinStore.loadVins();
    
    // Load reference data (types, origines, appellations) via NgRx
    // These will be migrated in future iterations
    this.store.dispatch(TypeActions.loadTypes());
    this.store.dispatch(OrigineActions.loadOrigines());
    this.store.dispatch(AppellationActions.loadAppellations());
    
    // Check for remote DB configuration
    const result = window.localStorage.getItem("myCellar.remoteDBURL");
    if (!result || !result.startsWith("http")) {
      debug("[ngOnInit] no remote db initialized, using local database");
      if (!window.localStorage.getItem("localUse")) {
        this.alertNoRemoteDB();
      }
    }
  }
  
  cancelSearch() {
    this.searchString.set("");
  }
  
  goToVin(params: string) {
    if (!params) params = "";
    this.navCtrl.navigateForward("/vin/" + params);
  }
}
```

---

### Phase 3: Update Template (No Changes Required!)

**File:** `client/src/app/home/home.page.html`

✅ **No template changes needed!** The template already uses signal syntax correctly:
- `filteredWines()` ✅
- `maturityWinesList()` ✅
- `nbrARTD()`, `nbrRTD()`, etc. ✅
- `loading()` ✅
- `dashboardSelectedMaturity()` ✅

---

## Changes Summary

### Files Modified

#### 1. `client/src/app/services/vin-state.store.ts`
**Changes:**
- Add `dayjs` import
- Add `getFilteredWines()` computed signal
- Add `getWinesByMaturity()` computed signal
- Add `maturityCounts` computed signal

**Lines Added:** ~120 lines

#### 2. `client/src/app/home/home.page.ts`
**Changes:**
- Remove `wines` signal (use VinStore directly)
- Remove NgRx subscriptions (lines 121-132)
- Inject `VinStore` instead of using NgRx selectors
- Convert all state to computed signals from VinStore
- Remove unused imports

**Lines Removed:** ~30 lines  
**Lines Added:** ~20 lines  
**Net Change:** -10 lines (simpler code!)

#### 3. `client/src/app/home/home.page.html`
**Changes:** None! ✅

---

## Benefits

### 1. **Code Reduction**
- Removed manual subscriptions
- Removed duplicate state management
- Cleaner, more declarative code

### 2. **Better Performance**
- Automatic memoization via computed signals
- Fine-grained reactivity
- No manual subscription cleanup needed

### 3. **Single Source of Truth**
- VinStore owns all wine data
- No data duplication
- Consistent state across components

### 4. **Maintainability**
- Easier to understand data flow
- Less boilerplate
- Type-safe throughout

### 5. **Future-Proof**
- Ready for zoneless Angular
- Modern signal-based architecture
- Easy to test

---

## Testing Checklist

### Functionality Tests
- [ ] Search wines by name
- [ ] Filter by "in stock" toggle
- [ ] Click maturity dashboard categories (ARTD, RTD, NRTD, NotRTD)
- [ ] View wines in each maturity category
- [ ] Navigate to wine detail page
- [ ] Loading spinner shows during data load
- [ ] Empty search shows no results
- [ ] Search with < 3 characters shows no results

### Integration Tests
- [ ] VinStore loads wines on init
- [ ] Maturity counts update correctly
- [ ] Filtered wines update on search input
- [ ] Stock filter works correctly
- [ ] Dashboard navigation works
- [ ] Remote DB alert shows when needed

### Performance Tests
- [ ] No memory leaks (no manual subscriptions)
- [ ] Fast search response (< 100ms)
- [ ] Smooth UI updates
- [ ] No unnecessary re-renders

---

## Migration Steps

### Step 1: Enhance VinStore (15 minutes)
1. Add dayjs import
2. Add getFilteredWines computed
3. Add getWinesByMaturity computed
4. Add maturityCounts computed
5. Test in isolation

### Step 2: Update HomePage (10 minutes)
1. Inject VinStore
2. Remove NgRx subscriptions
3. Convert to computed signals
4. Remove unused code
5. Update imports

### Step 3: Test (15 minutes)
1. Run application
2. Test all search functionality
3. Test maturity dashboard
4. Verify no console errors
5. Check performance

### Step 4: Commit (5 minutes)
1. Review changes
2. Commit with descriptive message
3. Push to branch

**Total Time:** ~45 minutes

---

## Rollback Plan

If issues arise:
1. Revert commit
2. VinStore changes are additive (won't break VinPage)
3. HomePage can be reverted independently
4. No database changes required

---

## Next Steps After HomePage

Once HomePage migration is complete and tested:

1. **TypePage** - Migrate to TypeStore (similar pattern)
2. **OriginePage** - Migrate to OrigineStore
3. **AppellationPage** - Migrate to AppellationStore
4. **StatsPage** - Use VinStore for statistics
5. **RapportPage** - Use VinStore for reports

Each component follows the same pattern established here.

---

## Documentation Updates

After successful migration, update:
- [ ] `docs/signal-migration-changes-summary.md` - Add HomePage section
- [ ] `docs/signal-migration-reusable-plan.md` - Add HomePage as example
- [ ] README.md - Update architecture section

---

## Conclusion

This migration:
- ✅ Reuses VinStore (no new store needed)
- ✅ Removes NgRx subscriptions from HomePage
- ✅ Maintains backward compatibility
- ✅ Improves code quality and performance
- ✅ Sets pattern for other component migrations

**Ready to implement!** 🚀