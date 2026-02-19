# Effect() Usage Analysis - Angular Best Practices Review

**Component**: `client/src/app/vin/vin.page.ts`  
**Date**: 2026-02-13  
**Angular Version**: 21.0.5

---

## Angular's Official Guidelines for effect()

According to Angular documentation, `effect()` should be used **RARELY** and only for:

1. ✅ **Logging/Analytics** - Tracking signal changes for debugging
2. ✅ **Synchronization with external systems** - DOM APIs, localStorage, etc.
3. ✅ **Custom rendering** - Canvas, WebGL, third-party libraries
4. ❌ **NOT for state propagation** - Use `computed()` instead
5. ❌ **NOT for event handlers** - Use template event bindings
6. ❌ **NOT for HTTP requests** - Use explicit methods or RxJS

### Key Rule: Effects are for SIDE EFFECTS, not data flow

---

## Current Implementation Analysis

### ❌ VIOLATION 1: Effect 1 - Route Change Handler

```typescript
// Effect 1: Handle route changes and set current vin
effect(() => {
  const vinId = this.vinId();
  if (vinId) {
    this.vinState.setCurrentVin(vinId);
  } else {
    this.vinState.setCurrentVin(null);
    this.resetForm();
  }
}, { allowSignalWrites: true });
```

**Problem**: Using effect for state synchronization  
**Severity**: ⚠️ Medium  
**Why it's wrong**: This is reactive state propagation, not a side effect  
**Better approach**: Use `linkedSignal()` or move logic to service

**Correct Pattern**:
```typescript
// In VinStateService
readonly currentVinId = linkedSignal({
  source: () => this.routeVinId(),
  computation: (vinId) => vinId
});
```

---

### ❌ VIOLATION 2: Effect 2 - Load Vin into Form

```typescript
// Effect 2: Load vin data into form when current vin changes
effect(() => {
  const vin = this.currentVin();
  if (vin) {
    this.loadVinIntoForm(vin);
  }
}, { allowSignalWrites: true });
```

**Problem**: Using effect for data transformation/loading  
**Severity**: 🔴 High  
**Why it's wrong**: Form population is not a side effect, it's state management  
**Better approach**: Explicit method call or computed signal

**Correct Pattern**:
```typescript
// Option 1: Explicit in ngOnInit or route resolver
ngOnInit() {
  const vin = this.currentVin();
  if (vin) this.loadVinIntoForm(vin);
}

// Option 2: Watch route params with RxJS (traditional approach)
this.route.params.pipe(
  switchMap(params => this.vinState.getVin(params['id']))
).subscribe(vin => {
  if (vin) this.loadVinIntoForm(vin);
});
```

---

### ⚠️ QUESTIONABLE: Effect 3 - Auto-set Bottles

```typescript
// Effect 3: Auto-set bottles left for new wines
effect(() => {
  if (!this.isEditMode()) {
    const bought = this.vinForm?.get("nbreBouteillesAchat")?.value;
    const left = this.vinForm?.get("nbreBouteillesReste")?.value;
    if (bought > 0 && left === 0) {
      this.vinForm?.get("nbreBouteillesReste")?.patchValue(bought);
    }
  }
});
```

**Problem**: Mixing FormGroup (non-signal) with effect  
**Severity**: ⚠️ Medium  
**Why it's questionable**: FormGroup changes don't trigger effects reliably  
**Better approach**: Use FormGroup's valueChanges observable

**Correct Pattern**:
```typescript
// In constructor or ngOnInit
this.vinForm.get('nbreBouteillesAchat')?.valueChanges
  .pipe(takeUntilDestroyed())
  .subscribe(bought => {
    if (!this.isEditMode() && bought > 0) {
      const left = this.vinForm.get('nbreBouteillesReste')?.value;
      if (left === 0) {
        this.vinForm.get('nbreBouteillesReste')?.patchValue(bought);
      }
    }
  });
```

---

### ❌ VIOLATION 3: Effect 4 - Handle Operation Results

```typescript
// Effect 4: Handle operation results (save/delete)
effect(() => {
  const result = this.vinState.lastOperation();
  if (result && result.source === "internal") {
    if (result.success) {
      this.presentToast(...);
    } else if (result.error) {
      this.presentToast(...);
    }
  }
}, { allowSignalWrites: true });
```

**Problem**: Using effect for UI feedback after operations  
**Severity**: 🔴 High  
**Why it's wrong**: This should be handled in the save/delete method itself  
**Better approach**: Return result from async method and handle in caller

**Correct Pattern**:
```typescript
async saveVin() {
  const result = await this.vinState.saveVin(this.vin);
  
  if (result.success) {
    await this.presentToast('Saved successfully', 'success');
    this.navCtrl.navigateBack('/home');
  } else {
    await this.presentToast(result.error, 'error');
  }
}
```

---

### ✅ ACCEPTABLE: Effect 5 - Track Original Values

```typescript
// Effect 5: Track original values for comparison
effect(() => {
  const vin = this.currentVin();
  if (vin) {
    this.originalName.set(vin.nom);
    this.originalYear.set(...);
    this.nbreAvantUpdate.set(vin.nbreBouteillesReste);
  }
}, { allowSignalWrites: true });
```

**Status**: ⚠️ Borderline acceptable  
**Why**: Synchronizing derived state  
**Better approach**: Use `computed()` or `linkedSignal()`

**Correct Pattern**:
```typescript
readonly originalName = computed(() => this.currentVin()?.nom ?? '');
readonly originalYear = computed(() => {
  const annee = this.currentVin()?.annee;
  return typeof annee === 'string' ? parseInt(annee) : annee ?? 0;
});
readonly nbreAvantUpdate = computed(() => this.currentVin()?.nbreBouteillesReste ?? 0);
```

---

### ⚠️ QUESTIONABLE: Effect 6 - Update Form Dirty State

```typescript
// Effect 6: Update form dirty state in VinStateService
effect(() => {
  const vinId = this.vinId();
  const isDirty = this.vinForm?.dirty || this.dirtyPhoto();
  if (vinId) {
    this.vinState.updateFormDirtyState(vinId, isDirty);
  }
});
```

**Problem**: Synchronizing non-signal state (FormGroup) with signals  
**Severity**: ⚠️ Medium  
**Why it's questionable**: FormGroup.dirty is not reactive in signal context  
**Better approach**: Convert FormGroup to signal or use valueChanges

**Correct Pattern**:
```typescript
// Option 1: Convert form dirty to signal
readonly formDirty = toSignal(
  this.vinForm.statusChanges.pipe(
    map(() => this.vinForm.dirty)
  ),
  { initialValue: false }
);

// Option 2: Computed signal
readonly isDirty = computed(() => 
  this.formDirty() || this.dirtyPhoto()
);

// Then in effect (if really needed):
effect(() => {
  const vinId = this.vinId();
  const isDirty = this.isDirty();
  if (vinId) {
    this.vinState.updateFormDirtyState(vinId, isDirty);
  }
});
```

---

### ✅ ACCEPTABLE: Effect 7 - Concurrent Update Warnings

```typescript
// Effect 7: Handle concurrent update warnings
effect(() => {
  const concurrent = this.concurrentUpdate();
  if (concurrent.detected && concurrent.message) {
    this.presentToast(...);
  }
}, { allowSignalWrites: true });
```

**Status**: ✅ Acceptable  
**Why**: This is a legitimate side effect (showing UI notification)  
**Improvement**: Could add debouncing to prevent multiple toasts

**Improved Pattern**:
```typescript
private lastConcurrentWarning = signal<string | null>(null);

effect(() => {
  const concurrent = this.concurrentUpdate();
  if (concurrent.detected && concurrent.message) {
    // Prevent duplicate warnings
    if (this.lastConcurrentWarning() !== concurrent.message) {
      this.lastConcurrentWarning.set(concurrent.message);
      this.presentToast(
        this.translate.instant(concurrent.message),
        concurrent.severity === "error" ? "error" : "warning",
        null,
        0,
        this.translate.instant("general.ok")
      );
    }
  }
}, { allowSignalWrites: true });
```

---

## Summary of Violations

| Effect | Purpose | Violation | Severity | Should Use Instead |
|--------|---------|-----------|----------|-------------------|
| 1 | Route change handler | State sync | ⚠️ Medium | `linkedSignal()` or explicit method |
| 2 | Load vin into form | Data loading | 🔴 High | Explicit method call |
| 3 | Auto-set bottles | Form sync | ⚠️ Medium | FormGroup `valueChanges` |
| 4 | Operation results | UI feedback | 🔴 High | Handle in async method |
| 5 | Track original values | State sync | ⚠️ Medium | `computed()` signals |
| 6 | Form dirty state | State sync | ⚠️ Medium | `toSignal()` + `computed()` |
| 7 | Concurrent warnings | UI notification | ✅ OK | Current approach is fine |
| 8 | Load photo | External resource | ✅ OK | Legitimate side effect |

---

## Recommended Refactoring

### Priority 1: Remove Effects 2 & 4 (High Severity)

```typescript
// REMOVE Effect 2 - Replace with explicit method
constructor() {
  // Watch route params
  effect(() => {
    const vinId = this.vinId();
    if (vinId) {
      const vin = this.currentVin();
      if (vin) {
        // Call explicitly, not in effect
        this.loadVinIntoFormExplicitly(vin);
      }
    }
  });
}

// REMOVE Effect 4 - Handle in save method
async saveVin() {
  try {
    const result = await this.vinState.saveVin(this.getVinFromForm());
    
    if (result.success) {
      await this.presentToast(
        this.translate.instant('wine.saved'),
        'success'
      );
      this.navCtrl.navigateBack('/home');
    }
  } catch (error) {
    await this.presentToast(
      error.message,
      'error'
    );
  }
}
```

### Priority 2: Convert Effect 5 to Computed Signals

```typescript
// REPLACE Effect 5 with computed signals
readonly originalName = computed(() => this.currentVin()?.nom ?? '');
readonly originalYear = computed(() => {
  const annee = this.currentVin()?.annee;
  return typeof annee === 'string' ? parseInt(annee) : (annee ?? 0);
});
readonly nbreAvantUpdate = computed(() => 
  this.currentVin()?.nbreBouteillesReste ?? 0
);
```

### Priority 3: Fix Effect 3 with RxJS

```typescript
// REPLACE Effect 3 with RxJS subscription
private setupBottleAutoFill() {
  this.vinForm.get('nbreBouteillesAchat')?.valueChanges
    .pipe(
      takeUntilDestroyed(this.destroyRef),
      filter(() => !this.isEditMode())
    )
    .subscribe(bought => {
      const left = this.vinForm.get('nbreBouteillesReste')?.value;
      if (bought > 0 && left === 0) {
        this.vinForm.get('nbreBouteillesReste')?.patchValue(bought, {
          emitEvent: false
        });
      }
    });
}
```

### Priority 4: Fix Effect 6 with toSignal

```typescript
// REPLACE Effect 6 with proper signal conversion
readonly formDirtySignal = toSignal(
  this.vinForm.statusChanges.pipe(
    startWith(this.vinForm.status),
    map(() => this.vinForm.dirty)
  ),
  { initialValue: false }
);

readonly isDirty = computed(() => 
  this.formDirtySignal() || this.dirtyPhoto()
);

// Then update service when needed
effect(() => {
  const vinId = this.vinId();
  const isDirty = this.isDirty();
  if (vinId) {
    this.vinState.updateFormDirtyState(vinId, isDirty);
  }
});
```

---

## Angular Best Practices for effect()

### ✅ DO Use effect() For:

1. **Logging and debugging**
   ```typescript
   effect(() => {
     console.log('Current vin:', this.currentVin());
   });
   ```

2. **Synchronizing with external systems**
   ```typescript
   effect(() => {
     localStorage.setItem('lastVinId', this.vinId() ?? '');
   });
   ```

3. **DOM manipulation (when necessary)**
   ```typescript
   effect(() => {
     if (this.shouldFocus()) {
       this.inputElement.nativeElement.focus();
     }
   });
   ```

4. **Third-party library integration**
   ```typescript
   effect(() => {
     this.chart.updateData(this.chartData());
   });
   ```

### ❌ DON'T Use effect() For:

1. **State propagation** - Use `computed()` or `linkedSignal()`
2. **Event handling** - Use template event bindings
3. **HTTP requests** - Use explicit methods
4. **Form updates** - Use FormGroup APIs
5. **Navigation** - Call router methods explicitly
6. **Conditional logic** - Use `computed()` with ternary

---

## Conclusion

**Current Status**: 🔴 **5 out of 8 effects violate Angular best practices**

**Impact**:
- Harder to test
- Unpredictable execution order
- Potential infinite loops
- Poor performance (unnecessary re-runs)
- Difficult to debug

**Recommendation**: **Refactor immediately** to follow Angular guidelines

**Estimated Effort**: 4-6 hours to refactor all effects properly

---

## References

- [Angular Signals Documentation](https://angular.dev/guide/signals)
- [Angular effect() Best Practices](https://angular.dev/guide/signals#effects)
- [When NOT to use effect()](https://angular.dev/guide/signals#when-not-to-use-effects)