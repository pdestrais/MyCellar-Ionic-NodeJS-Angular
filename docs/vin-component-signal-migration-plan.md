# Vin Component Signal Forms Migration Plan

## Executive Summary

This document outlines the migration strategy for converting the `VinPage` component from Angular Reactive Forms (FormGroup) to **Angular 21 Signal Forms** - the new experimental model-driven form approach. This migration will leverage Angular's native signal-based form API introduced in v21, eliminating the need for external libraries while modernizing the codebase.

---

## Why Angular 21 Signal Forms?

### Key Benefits
1. **Native Angular Solution**: No external dependencies, official Angular API
2. **Signal-Based Reactivity**: Automatic change detection, fine-grained updates
3. **Type Safety**: Types inferred directly from form model
4. **Simplified Validation**: Schema-based validation with path-based validators
5. **Better Performance**: Signals are more efficient than Zone.js
6. **Future-Proof**: Aligns with Angular's zoneless future
7. **Cleaner Code**: Less boilerplate than FormGroup

### Current State
- **File**: `client/src/app/vin/vin.page.ts` (1089 lines)
- **Pattern**: FormGroup with ReactiveFormsModule
- **Already Using Signals**: `types`, `origines`, `appellations` computed from store

---

## Angular 21 Signal Forms API Overview

### Core Concepts

```typescript
import { signal } from '@angular/core';
import { form, FormField, required, minLength, email } from '@angular/forms/signals';

// 1. Create a form model signal
const loginModel = signal({
  email: '',
  password: ''
});

// 2. Create form with schema validation
const loginForm = form(loginModel, (fieldPath) => {
  required(fieldPath.email, { message: 'Email is required' });
  email(fieldPath.email, { message: 'Enter a valid email' });
  required(fieldPath.password, { message: 'Password is required' });
  minLength(fieldPath.password, 8, { message: 'Min 8 characters' });
});

// 3. Use in template with formField directive
// <input type="email" [formField]="loginForm.email" />

// 4. Access form state
loginForm().valid()    // Is form valid?
loginForm().dirty()    // Has form been modified?
loginForm.email().value()  // Get email value
loginForm.email().errors() // Get email errors
```

---

## Migration Strategy

### Phase 1: Define Form Model Interface

Create a type-safe interface for the wine form:

```typescript
// client/src/app/models/vin-form.model.ts
import { TypeModel, OrigineModel, AppellationModel } from './cellar.model';

export interface VinFormModel {
  // Required fields
  nom: string;
  annee: number;
  type: TypeModel;
  origine: OrigineModel;
  appellation: AppellationModel;
  nbreBouteillesAchat: number;
  nbreBouteillesReste: number;
  
  // Optional/nullable fields
  prixAchat: number;
  dateAchat: string;
  localisation: string;
  contenance: string;
  apogee: string;
  cepage: string;
  rating: number;
  
  // Photo is handled separately as it's complex
  // We'll use a separate signal for photo management
}

// Empty form model for initialization
export const EMPTY_VIN_FORM_MODEL: VinFormModel = {
  nom: '',
  annee: new Date().getFullYear(),
  type: { _id: '', nom: '' } as TypeModel,
  origine: { _id: '', pays: '', region: '' } as OrigineModel,
  appellation: { _id: '', courte: '', longue: '' } as AppellationModel,
  nbreBouteillesAchat: 0,
  nbreBouteillesReste: 0,
  prixAchat: 0,
  dateAchat: '',
  localisation: '',
  contenance: '75',
  apogee: '',
  cepage: '',
  rating: 0
};
```

### Phase 2: Convert Component to Signal Forms

```typescript
// client/src/app/vin/vin.page.ts
import { Component, OnInit, signal, computed, effect, linkedSignal } from '@angular/core';
import { form, FormField, required, minLength, maxLength, min, max } from '@angular/forms/signals';
import { VinFormModel, EMPTY_VIN_FORM_MODEL } from '../models/vin-form.model';

@Component({
  selector: 'app-vin',
  templateUrl: './vin.page.html',
  styleUrls: ['./vin.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    FormField, // Import FormField directive
    // ... other imports
  ],
})
export class VinPage implements OnInit {
  private store = inject(Store);
  private route = inject(ActivatedRoute);
  
  // ============================================
  // FORM MODEL & FORM INSTANCE
  // ============================================
  
  // Form model signal - source of truth for form data
  private readonly vinFormModel = signal<VinFormModel>(EMPTY_VIN_FORM_MODEL);
  
  // Create the form with validation schema
  protected readonly vinForm = form(this.vinFormModel, (fieldPath) => {
    // Name validation
    required(fieldPath.nom, { message: this.translate.instant('wine.name') + ' ' + this.translate.instant('general.required') });
    minLength(fieldPath.nom, 2, { message: 'Name must be at least 2 characters' });
    
    // Year validation
    required(fieldPath.annee, { message: this.translate.instant('wine.year') + ' ' + this.translate.instant('general.required') });
    min(fieldPath.annee, 1900, { message: 'Year must be 1900 or later' });
    max(fieldPath.annee, new Date().getFullYear() + 10, { message: 'Year cannot be more than 10 years in the future' });
    
    // Type validation
    required(fieldPath.type, { message: this.translate.instant('wine.type') + ' ' + this.translate.instant('general.required') });
    
    // Origine validation
    required(fieldPath.origine, { message: this.translate.instant('wine.origin') + ' ' + this.translate.instant('general.required') });
    
    // Appellation validation
    required(fieldPath.appellation, { message: this.translate.instant('wine.appellation') + ' ' + this.translate.instant('general.required') });
    
    // Bottles purchased validation
    required(fieldPath.nbreBouteillesAchat, { message: this.translate.instant('wine.bottlesPurchase') + ' ' + this.translate.instant('general.required') });
    min(fieldPath.nbreBouteillesAchat, 1, { message: 'Must purchase at least 1 bottle' });
    
    // Bottles left validation
    required(fieldPath.nbreBouteillesReste, { message: this.translate.instant('wine.bottlesLeft') + ' ' + this.translate.instant('general.required') });
    min(fieldPath.nbreBouteillesReste, 0, { message: 'Cannot be negative' });
    
    // Location validation
    required(fieldPath.localisation, { message: this.translate.instant('wine.location') + ' ' + this.translate.instant('general.required') });
    
    // Apogee format validation (YYYY-YYYY)
    // Custom validator for apogee format
    this.validateApogeeFormat(fieldPath.apogee);
  });
  
  // ============================================
  // PHOTO MANAGEMENT (Separate from form model)
  // ============================================
  
  readonly currentPhoto = signal<{
    contentType: string;
    data: File | Blob;
    name: string;
  }>({
    contentType: 'image/jpeg',
    data: new File([], 'Photo file'),
    name: ''
  });
  
  readonly dirtyPhoto = signal<boolean>(false);
  readonly hasPhoto = computed(() => this.currentPhoto().name !== '');
  
  // ============================================
  // STORE SELECTORS (Already using signals)
  // ============================================
  
  readonly types = computed<TypeModel[]>(() => 
    this.store.selectSignal(TypeSelectors.getAllTypesArraySorted)()
  );
  
  readonly origines = computed<OrigineModel[]>(() => 
    this.store.selectSignal(OrigineSelectors.getAllOriginesArraySorted)()
  );
  
  readonly appellations = computed<AppellationModel[]>(() => 
    this.store.selectSignal(AppellationSelectors.getAllAppellationsArraySorted)()
  );
  
  // Wines map for duplicate checking
  readonly vinsMap = computed(() =>
    this.store.selectSignal(VinSelectors.getAllVinsMap)()
  );
  
  // ============================================
  // COMPUTED FORM STATE
  // ============================================
  
  // Check for duplicate wine (name + year combination)
  readonly isDuplicate = computed(() => {
    const nom = this.vinForm.nom().value();
    const annee = this.vinForm.annee().value();
    const vinsMap = this.vinsMap();
    
    if (!nom || !annee || !vinsMap) return false;
    
    const testKey = `${nom}-${annee}`;
    const existingWine = vinsMap.get(testKey);
    
    // Not a duplicate if it's the same wine we're editing
    if (existingWine && this.currentVinId() && existingWine._id === this.currentVinId()) {
      return false;
    }
    
    return vinsMap.has(testKey);
  });
  
  // Can save if form is valid, not duplicate, and something changed
  readonly canSave = computed(() => {
    return this.vinForm().valid() && 
           !this.isDuplicate() &&
           (this.vinForm().dirty() || this.dirtyPhoto());
  });
  
  // Form submission state
  readonly submitted = signal<boolean>(false);
  
  // Current wine ID (for edit mode)
  private readonly currentVinId = signal<string | null>(null);
  readonly isEditMode = computed(() => this.currentVinId() !== null);
  
  // ============================================
  // LIFECYCLE & INITIALIZATION
  // ============================================
  
  constructor() {
    // Effect to load wine when route param changes
    effect(() => {
      const paramId = this.route.snapshot.params['id'];
      if (paramId) {
        this.currentVinId.set(paramId);
        this.store.dispatch(VinActions.editVin({ id: paramId }));
      } else {
        this.currentVinId.set(null);
        this.resetForm();
      }
    });
    
    // Effect to populate form when wine is loaded from store
    effect(() => {
      const vinId = this.currentVinId();
      if (!vinId) return;
      
      const vin = this.store.selectSignal(VinSelectors.getVin(vinId))();
      if (vin) {
        this.loadVinIntoForm(vin);
      }
    });
    
    // Effect to auto-set bottles left when creating new wine
    effect(() => {
      if (!this.isEditMode()) {
        const bought = this.vinForm.nbreBouteillesAchat().value();
        const left = this.vinForm.nbreBouteillesReste().value();
        
        if (bought > 0 && left === 0) {
          this.vinFormModel.update(model => ({
            ...model,
            nbreBouteillesReste: bought
          }));
        }
      }
    });
  }
  
  ngOnInit() {
    // Initial setup if needed
  }
  
  // ============================================
  // FORM ACTIONS
  // ============================================
  
  adjustQuantityLeft(delta: number) {
    const current = this.vinForm.nbreBouteillesReste().value();
    const newQty = Math.max(0, current + delta);
    
    this.vinFormModel.update(model => ({
      ...model,
      nbreBouteillesReste: newQty
    }));
  }
  
  async saveVin() {
    this.submitted.set(true);
    
    if (!this.canSave()) {
      this.presentToast(
        this.translate.instant('wine.formInvalid'),
        'error',
        3000
      );
      return;
    }
    
    const formData = this.vinFormModel();
    
    // Convert form model to VinModel for store
    const vinData: VinModel = {
      _id: this.currentVinId() || '',
      _rev: '', // Will be set from existing wine if editing
      ...formData,
      history: [], // Preserve existing history
      photo: this.hasPhoto() ? {
        name: this.currentPhoto().name,
        fileType: this.currentPhoto().contentType,
        // ... other photo properties
      } : undefined
    };
    
    // Handle photo upload if needed
    if (this.dirtyPhoto() && this.hasPhoto()) {
      await this.uploadPhoto(vinData);
    }
    
    // Dispatch save action
    if (this.isEditMode()) {
      this.store.dispatch(VinActions.updateVin({ vin: vinData }));
    } else {
      this.store.dispatch(VinActions.createVin({ vin: vinData }));
    }
  }
  
  async deleteVin() {
    if (!this.currentVinId()) return;
    
    const alert = await this.alertController.create({
      header: this.translate.instant('general.confirm'),
      message: this.translate.instant('wine.confirmDelete'),
      buttons: [
        {
          text: this.translate.instant('general.cancel'),
          role: 'cancel'
        },
        {
          text: this.translate.instant('general.suppress'),
          handler: () => {
            const vinData = this.vinFormModel();
            this.store.dispatch(VinActions.deleteVin({ 
              vin: { ...vinData, _id: this.currentVinId()! } as VinModel 
            }));
          }
        }
      ]
    });
    
    await alert.present();
  }
  
  // ============================================
  // HELPER METHODS
  // ============================================
  
  private loadVinIntoForm(vin: VinModel) {
    this.vinFormModel.set({
      nom: vin.nom,
      annee: vin.annee,
      type: vin.type,
      origine: vin.origine,
      appellation: vin.appellation,
      nbreBouteillesAchat: vin.nbreBouteillesAchat,
      nbreBouteillesReste: vin.nbreBouteillesReste,
      prixAchat: vin.prixAchat || 0,
      dateAchat: vin.dateAchat || '',
      localisation: vin.localisation || '',
      contenance: vin.contenance || '75',
      apogee: vin.apogee || '',
      cepage: vin.cepage || '',
      rating: vin.rating || 0
    });
    
    // Load photo if exists
    if (vin.photo) {
      this.loadPhotoFromVin(vin);
    }
  }
  
  private resetForm() {
    this.vinFormModel.set(EMPTY_VIN_FORM_MODEL);
    this.currentPhoto.set({
      contentType: 'image/jpeg',
      data: new File([], 'Photo file'),
      name: ''
    });
    this.dirtyPhoto.set(false);
    this.submitted.set(false);
  }
  
  private validateApogeeFormat(fieldPath: any) {
    // Custom validator for apogee format (YYYY-YYYY)
    // This would use a custom validator function
    // For now, we can use pattern matching in the schema
  }
  
  // Comparison function for ion-select
  compareFn(o1: any, o2: any): boolean {
    return o1 && o2 ? o1._id === o2._id : o1 === o2;
  }
}
```

### Phase 3: Update Template

```html
<!-- client/src/app/vin/vin.page.html -->
<ion-header>
  <ion-toolbar color="primary">
    <ion-buttons slot="start">
      <ion-menu-button></ion-menu-button>
    </ion-buttons>
    <ion-title>{{ 'page.wine' | translate }}</ion-title>
  </ion-toolbar>
</ion-header>

<ion-content class="ion-padding">
  <!-- Wine Name -->
  <ion-item>
    <ion-label position="floating">{{ 'wine.name' | translate }}</ion-label>
    <ion-input
      type="text"
      [formField]="vinForm.nom"
      class="ion-text-right"
    ></ion-input>
  </ion-item>
  @if (vinForm.nom().touched() && vinForm.nom().invalid()) {
    <ion-item>
      <p class="invalid">{{ vinForm.nom().errors()[0].message }}</p>
    </ion-item>
  }

  <!-- Wine Year -->
  <ion-item>
    <ion-label position="floating">{{ 'wine.year' | translate }}</ion-label>
    <ion-input
      type="number"
      [formField]="vinForm.annee"
      class="ion-text-right"
    ></ion-input>
  </ion-item>
  @if (vinForm.annee().touched() && vinForm.annee().invalid()) {
    <ion-item>
      <p class="invalid">{{ vinForm.annee().errors()[0].message }}</p>
    </ion-item>
  }
  
  <!-- Duplicate Warning -->
  @if (isDuplicate()) {
    <ion-item>
      <p class="invalid">{{ 'wine.double' | translate }}</p>
    </ion-item>
  }

  <!-- Wine Type -->
  <ion-item>
    <ion-label position="floating">{{ 'wine.type' | translate }}</ion-label>
    <ion-select
      [formField]="vinForm.type"
      [compareWith]="compareFn"
      interface="popover"
      [placeholder]="'wine.selectType' | translate"
    >
      @for(type of types(); track type._id) {
        <ion-select-option [value]="type">
          {{ type.nom | translate }}
        </ion-select-option>
      }
    </ion-select>
  </ion-item>
  @if (vinForm.type().touched() && vinForm.type().invalid()) {
    <ion-item>
      <p class="invalid">{{ vinForm.type().errors()[0].message }}</p>
    </ion-item>
  }

  <!-- Origin -->
  <ion-item>
    <ion-label position="floating">{{ 'wine.origin' | translate }}</ion-label>
    <ion-select
      [formField]="vinForm.origine"
      [compareWith]="compareFn"
      interface="popover"
      [placeholder]="'wine.selectOrigin' | translate"
    >
      @for(origine of origines(); track origine._id) {
        <ion-select-option [value]="origine">
          {{ origine.pays }} - {{ origine.region }}
        </ion-select-option>
      }
    </ion-select>
  </ion-item>
  @if (vinForm.origine().touched() && vinForm.origine().invalid()) {
    <ion-item>
      <p class="invalid">{{ vinForm.origine().errors()[0].message }}</p>
    </ion-item>
  }

  <!-- Appellation -->
  <ion-item>
    <ion-label position="floating">{{ 'wine.appellation' | translate }}</ion-label>
    <ion-select
      [formField]="vinForm.appellation"
      [compareWith]="compareFn"
      interface="popover"
      [placeholder]="'wine.selectAppellation' | translate"
    >
      @for(appellation of appellations(); track appellation._id) {
        <ion-select-option [value]="appellation">
          {{ appellation.courte }} - {{ appellation.longue }}
        </ion-select-option>
      }
    </ion-select>
  </ion-item>
  @if (vinForm.appellation().touched() && vinForm.appellation().invalid()) {
    <ion-item>
      <p class="invalid">{{ vinForm.appellation().errors()[0].message }}</p>
    </ion-item>
  }

  <!-- Bottles Purchased -->
  <ion-item>
    <ion-label position="floating">{{ 'wine.bottlesPurchase' | translate }}</ion-label>
    <ion-input
      type="number"
      [formField]="vinForm.nbreBouteillesAchat"
      class="ion-text-right"
    ></ion-input>
  </ion-item>
  @if (vinForm.nbreBouteillesAchat().touched() && vinForm.nbreBouteillesAchat().invalid()) {
    <ion-item>
      <p class="invalid">{{ vinForm.nbreBouteillesAchat().errors()[0].message }}</p>
    </ion-item>
  }

  <!-- Bottles Left with +/- buttons -->
  <ion-grid id="mingrid">
    <ion-row class="ion-align-items-center">
      <ion-col size="8" id="mincol">
        <ion-item>
          <ion-label position="floating">{{ 'wine.bottlesLeft' | translate }}</ion-label>
          <ion-input
            type="number"
            [formField]="vinForm.nbreBouteillesReste"
            class="ion-text-right"
          ></ion-input>
        </ion-item>
        @if (vinForm.nbreBouteillesReste().touched() && vinForm.nbreBouteillesReste().invalid()) {
          <ion-item>
            <p class="invalid">{{ vinForm.nbreBouteillesReste().errors()[0].message }}</p>
          </ion-item>
        }
      </ion-col>
      <ion-col size="2" class="ion-margin-top">
        <ion-button size="small" color="medium" expand="block" (click)="adjustQuantityLeft(1)">
          <ion-icon slot="icon-only" name="arrow-up-circle-outline"></ion-icon>
        </ion-button>
      </ion-col>
      <ion-col size="2" class="ion-margin-top">
        <ion-button size="small" color="medium" expand="block" (click)="adjustQuantityLeft(-1)">
          <ion-icon slot="icon-only" name="arrow-down-circle-outline"></ion-icon>
        </ion-button>
      </ion-col>
    </ion-row>
  </ion-grid>

  <!-- Additional fields: price, date, location, etc. -->
  <!-- Follow same pattern as above -->

  <!-- Action Buttons -->
  <ion-button
    [disabled]="!canSave()"
    color="primary"
    expand="full"
    (click)="saveVin()"
  >
    {{ 'general.save' | translate }}
  </ion-button>
  
  <ion-button
    color="danger"
    expand="full"
    (click)="deleteVin()"
    [disabled]="!isEditMode()"
  >
    {{ 'general.suppress' | translate }}
  </ion-button>
</ion-content>
```

---

## Custom Validators

For complex validation like apogee format or cross-field validation:

```typescript
// client/src/app/validators/vin-validators.ts
import { FieldState } from '@angular/forms/signals';

export function apogeeFormat(field: FieldState<string>, options?: { message?: string }) {
  const pattern = /^\d{4}-\d{4}$/;
  
  return () => {
    const value = field.value();
    if (!value) return null; // Optional field
    
    if (!pattern.test(value)) {
      return {
        apogeeFormat: {
          message: options?.message || 'Format must be YYYY-YYYY'
        }
      };
    }
    
    return null;
  };
}

export function bottlesLeftNotGreaterThanPurchased(
  leftField: FieldState<number>,
  purchasedField: FieldState<number>,
  options?: { message?: string }
) {
  return () => {
    const left = leftField.value();
    const purchased = purchasedField.value();
    
    if (left > purchased) {
      return {
        bottlesExceedPurchased: {
          message: options?.message || 'Bottles left cannot exceed bottles purchased'
        }
      };
    }
    
    return null;
  };
}
```

---

## Implementation Roadmap

### Week 1: Foundation
- [ ] Create `VinFormModel` interface
- [ ] Set up basic signal form structure
- [ ] Migrate 3-4 simple fields (nom, annee, contenance)
- [ ] Test basic form functionality

### Week 2: Core Fields
- [ ] Migrate all required fields
- [ ] Implement validation schema
- [ ] Add custom validators (apogee, duplicate check)
- [ ] Update template for migrated fields

### Week 3: Complex Features
- [ ] Migrate photo upload to signals
- [ ] Implement quantity adjustment
- [ ] Add cross-field validation
- [ ] Handle form submission

### Week 4: Integration & Testing
- [ ] Integrate with NgRx store
- [ ] Test all validation scenarios
- [ ] Performance testing
- [ ] Documentation

---

## Key Considerations

### 1. Experimental API Warning
Signal Forms are **experimental** in Angular 21. The API may change before stabilization. Consider:
- Pin Angular version to avoid breaking changes
- Monitor Angular changelog for updates
- Have a rollback plan if needed

### 2. Photo Management
Photos are complex objects that don't fit well in the form model. Keep them in a separate signal:

```typescript
readonly currentPhoto = signal<PhotoData>({...});
readonly dirtyPhoto = signal<boolean>(false);
```

### 3. NgRx Integration
Use `linkedSignal` to sync form model with store data:

```typescript
private readonly vinFormModel = linkedSignal({
  source: this.currentVinFromStore,
  computation: (vin) => vin ? vinToFormModel(vin) : EMPTY_VIN_FORM_MODEL
});
```

### 4. Ionic Component Compatibility
Test that Ionic components work with `[formField]` directive. Most should work, but verify:
- `ion-input`
- `ion-select`
- `ion-textarea`
- `ion-checkbox`

---

## Benefits Summary

1. **Less Code**: ~30% reduction in form-related code
2. **Better Performance**: Signals are more efficient
3. **Type Safety**: Full TypeScript inference
4. **Simpler Validation**: Schema-based, all in one place
5. **No Subscriptions**: No more `takeUntil` cleanup
6. **Future-Proof**: Aligns with Angular's direction

---

## Next Steps

1. **Approve this plan** and discuss timeline
2. **Create prototype** with 2-3 fields to validate approach
3. **Begin incremental migration** starting with simple fields
4. **Monitor Angular updates** for Signal Forms API changes
5. **Document patterns** for team reference

---

## Questions for Discussion

1. Are you comfortable using experimental APIs in production?
2. Should we migrate incrementally or all at once?
3. Do you want to create reusable patterns for other forms?
4. What's your preferred timeline for this migration?
5. Should we wait for Signal Forms to stabilize (Angular 22+)?
