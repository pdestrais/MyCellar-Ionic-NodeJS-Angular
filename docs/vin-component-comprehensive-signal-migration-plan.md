# Vin Component Comprehensive Signal Migration Plan

## Executive Summary

This document outlines a **complete migration** of the `VinPage` component to Angular 21's signal-based ecosystem. This goes beyond just Signal Forms to include:

1. **Signal Forms** - Replace FormGroup with signal-based forms
2. **Signal-based State** - Convert all component properties to signals
3. **Effects** - Replace Observable subscriptions with effects
4. **Computed Signals** - Derive state reactively
5. **Resource API** - Replace HttpClient subscriptions with resources
6. **Store Integration** - Use `selectSignal` throughout
7. **Lifecycle Simplification** - Remove OnInit/OnDestroy patterns

---

## Current State Analysis

### Component Complexity
- **Lines of Code**: 1089 lines
- **Subscriptions**: 5+ manual subscriptions with `takeUntil`
- **Lifecycle Hooks**: OnInit, OnDestroy, AfterViewInit
- **State Management**: Mix of properties, FormGroup, and observables
- **HTTP Calls**: Manual subscriptions for photo loading

### What Needs Migration

#### 1. Form State (FormGroup → Signal Forms)
```typescript
// Current
public vinForm: FormGroup;
this.vinForm = this.formBuilder.group({...});

// Target
readonly vinForm = form(this.vinFormModel, (fieldPath) => {...});
```

#### 2. Component Properties → Signals
```typescript
// Current
public newWine: boolean = true;
public vin: VinModel;
public submitted: boolean;
public photoBlob: any;
public dirtyPhoto: boolean;

// Target
readonly newWine = signal<boolean>(true);
readonly vin = signal<VinModel | null>(null);
readonly submitted = signal<boolean>(false);
readonly photoBlob = signal<Blob | null>(null);
readonly dirtyPhoto = signal<boolean>(false);
```

#### 3. Observable Subscriptions → Effects
```typescript
// Current
this.store.select(VinSelectors.getWine(paramId))
  .pipe(takeUntil(this.unsubscribe$))
  .subscribe((vin) => {...});

// Target
effect(() => {
  const vin = this.store.selectSignal(VinSelectors.getWine(this.vinId()))();
  if (vin) this.loadVinIntoForm(vin);
});
```

#### 4. HTTP Calls → Resource API
```typescript
// Current
this.http.get(url).subscribe((response) => {...});

// Target
readonly photoResource = resource({
  request: () => ({ url: this.photoUrl() }),
  loader: ({ request }) => this.http.get(request.url)
});
```

---

## Complete Migration Architecture

### 1. Signal-Based State Management

```typescript
import { 
  Component, 
  signal, 
  computed, 
  effect, 
  resource,
  linkedSignal,
  inject 
} from '@angular/core';
import { form, FormField, required, min, max } from '@angular/forms/signals';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-vin',
  templateUrl: './vin.page.html',
  standalone: true,
  imports: [FormField, /* ... */],
})
export class VinPage {
  // ============================================
  // DEPENDENCIES
  // ============================================
  private readonly store = inject(Store);
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  private readonly translate = inject(TranslateService);
  private readonly navCtrl = inject(NavController);
  private readonly alertController = inject(AlertController);
  private readonly modalCtrl = inject(ModalController);
  private readonly toastCtrl = inject(ToastController);
  private readonly platform = inject(Platform);
  
  // ============================================
  // ROUTE PARAMETERS (Signal-based)
  // ============================================
  
  // Convert route params to signal
  private readonly routeParams = toSignal(this.route.params);
  readonly vinId = computed(() => this.routeParams()?.['id'] || null);
  readonly isEditMode = computed(() => this.vinId() !== null);
  
  // ============================================
  // FORM MODEL & FORM INSTANCE
  // ============================================
  
  // Form model signal - source of truth
  private readonly vinFormModel = linkedSignal({
    source: computed(() => {
      const vinId = this.vinId();
      if (!vinId) return null;
      return this.store.selectSignal(VinSelectors.getWine(vinId))();
    }),
    computation: (vin) => vin ? this.vinToFormModel(vin) : EMPTY_VIN_FORM_MODEL
  });
  
  // Create form with validation schema
  protected readonly vinForm = form(this.vinFormModel, (fieldPath) => {
    // Name validation
    required(fieldPath.nom, { 
      message: this.translate.instant('wine.name') + ' ' + 
               this.translate.instant('general.required') 
    });
    minLength(fieldPath.nom, 2, { message: 'Min 2 characters' });
    
    // Year validation
    required(fieldPath.annee, { 
      message: this.translate.instant('wine.year') + ' ' + 
               this.translate.instant('general.required') 
    });
    min(fieldPath.annee, 1900, { message: 'Year must be 1900 or later' });
    max(fieldPath.annee, new Date().getFullYear() + 10, { 
      message: 'Year too far in future' 
    });
    
    // Type, Origin, Appellation validation
    required(fieldPath.type, { message: 'Type required' });
    required(fieldPath.origine, { message: 'Origin required' });
    required(fieldPath.appellation, { message: 'Appellation required' });
    
    // Bottles validation
    required(fieldPath.nbreBouteillesAchat, { message: 'Bottles purchased required' });
    min(fieldPath.nbreBouteillesAchat, 1, { message: 'Must purchase at least 1' });
    
    required(fieldPath.nbreBouteillesReste, { message: 'Bottles left required' });
    min(fieldPath.nbreBouteillesReste, 0, { message: 'Cannot be negative' });
    
    // Location validation
    required(fieldPath.localisation, { message: 'Location required' });
    
    // Custom validators
    this.validateApogeeFormat(fieldPath.apogee);
    this.validateBottlesLeft(fieldPath);
  });
  
  // ============================================
  // COMPONENT STATE (All Signals)
  // ============================================
  
  // Wine being edited (for reference, not form state)
  readonly currentVin = computed(() => {
    const vinId = this.vinId();
    if (!vinId) return null;
    return this.store.selectSignal(VinSelectors.getWine(vinId))();
  });
  
  // Form submission state
  readonly submitted = signal<boolean>(false);
  
  // Original values for comparison
  private readonly originalName = signal<string>('');
  private readonly originalYear = signal<number>(0);
  readonly nbreAvantUpdate = signal<number>(0);
  
  // Photo management
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
  
  // Photo loading with Resource API
  private readonly photoUrl = computed(() => {
    const vin = this.currentVin();
    if (!vin?.photo?.name) return null;
    
    const currentUserString = localStorage.getItem('currentUser');
    const currentUser = currentUserString ? JSON.parse(currentUserString) : null;
    if (!currentUser?.username) return null;
    
    const baseUrl = environment.production 
      ? window.location.origin + '/api/photo/'
      : environment.APIEndpoint + '/api/photo/';
    
    return `${baseUrl}${currentUser.username}/${vin._id}`;
  });
  
  readonly photoResource = resource({
    request: () => ({ url: this.photoUrl() }),
    loader: async ({ request }) => {
      if (!request.url) return null;
      return this.http.get(request.url).toPromise();
    }
  });
  
  // ============================================
  // STORE SELECTORS (Signal-based)
  // ============================================
  
  readonly types = computed(() => 
    this.store.selectSignal(TypeSelectors.getAllTypesArraySorted)()
  );
  
  readonly origines = computed(() => 
    this.store.selectSignal(OrigineSelectors.getAllOriginesArraySorted)()
  );
  
  readonly appellations = computed(() => 
    this.store.selectSignal(AppellationSelectors.getAllAppellationsArraySorted)()
  );
  
  // Wines map for duplicate checking
  readonly vinsMap = computed(() =>
    this.store.selectSignal(VinSelectors.vinMapForDuplicates)()
  );
  
  // Vin state for handling save/delete operations
  readonly vinState = computed(() =>
    this.store.selectSignal((state: AppState) => state.vins)()
  );
  
  // ============================================
  // COMPUTED VALIDATION & STATE
  // ============================================
  
  // Duplicate check
  readonly isDuplicate = computed(() => {
    const nom = this.vinForm.nom().value();
    const annee = this.vinForm.annee().value();
    const vinsMap = this.vinsMap();
    const currentVinId = this.vinId();
    
    if (!nom || !annee || !vinsMap) return false;
    
    const testKey = `${nom}-${annee}`;
    const existingWine = vinsMap.get(testKey);
    
    // Not duplicate if editing the same wine
    if (existingWine && currentVinId && existingWine._id === currentVinId) {
      return false;
    }
    
    return vinsMap.has(testKey);
  });
  
  // Can save
  readonly canSave = computed(() => {
    return this.vinForm().valid() && 
           !this.isDuplicate() &&
           (this.vinForm().dirty() || this.dirtyPhoto());
  });
  
  // ============================================
  // EFFECTS (Replace subscriptions)
  // ============================================
  
  constructor() {
    // Effect 1: Dispatch edit action when route changes
    effect(() => {
      const vinId = this.vinId();
      if (vinId) {
        this.store.dispatch(VinActions.editVin({ id: vinId, rev: '' }));
      } else {
        this.store.dispatch(VinActions.editVin({ id: '', rev: '' }));
        this.resetForm();
      }
    });
    
    // Effect 2: Load photo when available
    effect(() => {
      const photoData = this.photoResource.value();
      if (photoData && this.currentVin()?.photo) {
        this.currentPhoto.update(photo => ({
          ...photo,
          name: this.currentVin()!.photo!.name,
          data: new Blob([new Uint8Array(photoData.data.Body.data)], {
            type: 'image/jpeg'
          }),
          contentType: this.currentVin()!.photo!.fileType
        }));
      }
    });
    
    // Effect 3: Auto-set bottles left for new wines
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
    
    // Effect 4: Handle vin state changes (save/delete operations)
    effect(() => {
      const state = this.vinState();
      this.handleVinStateChange(state);
    });
    
    // Effect 5: Track original values for comparison
    effect(() => {
      const vin = this.currentVin();
      if (vin) {
        this.originalName.set(vin.nom);
        this.originalYear.set(vin.annee);
        this.nbreAvantUpdate.set(vin.nbreBouteillesReste);
      }
    });
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
      await this.presentToast(
        this.translate.instant('wine.formInvalid'),
        'error',
        3000
      );
      return;
    }
    
    const formData = this.vinFormModel();
    const currentVin = this.currentVin();
    
    // Build VinModel from form data
    const vinData: VinModel = {
      _id: currentVin?._id || '',
      _rev: currentVin?._rev || '',
      ...formData,
      history: currentVin?.history || [],
      lastUpdated: new Date().toISOString(),
      photo: this.hasPhoto() ? {
        name: this.currentPhoto().name,
        fileType: this.currentPhoto().contentType,
        width: 0,
        heigth: 0,
        orientation: 1
      } : undefined
    };
    
    // Add comment if bottles changed
    if (this.isEditMode() && 
        formData.nbreBouteillesReste !== this.nbreAvantUpdate()) {
      const difference = formData.nbreBouteillesReste - this.nbreAvantUpdate();
      const comment = difference > 0 
        ? `+${difference} bottle(s) added`
        : `${Math.abs(difference)} bottle(s) consumed`;
      
      vinData.history = [
        ...(vinData.history || []),
        {
          date: new Date().toISOString(),
          type: 'quantity',
          comment,
          difference
        }
      ];
    }
    
    // Handle photo upload if needed
    if (this.dirtyPhoto() && this.hasPhoto()) {
      await this.uploadPhoto(vinData);
    }
    
    // Dispatch save action
    this.store.dispatch(VinActions.createVin({ vin: vinData }));
  }
  
  async deleteVin() {
    if (!this.isEditMode()) return;
    
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
            const vin = this.currentVin();
            if (vin) {
              this.store.dispatch(VinActions.deleteVin({ vin }));
            }
          }
        }
      ]
    });
    
    await alert.present();
  }
  
  async addComment() {
    const alert = await this.alertController.create({
      header: this.translate.instant('wine.addComment'),
      inputs: [
        {
          name: 'comment',
          type: 'textarea',
          placeholder: this.translate.instant('wine.commentPlaceholder')
        }
      ],
      buttons: [
        {
          text: this.translate.instant('general.cancel'),
          role: 'cancel'
        },
        {
          text: this.translate.instant('general.add'),
          handler: (data) => {
            if (data.comment) {
              const vin = this.currentVin();
              if (vin) {
                const updatedVin = {
                  ...vin,
                  history: [
                    ...(vin.history || []),
                    {
                      date: new Date().toISOString(),
                      type: 'comment',
                      comment: data.comment,
                      difference: 0
                    }
                  ]
                };
                this.store.dispatch(VinActions.updateVin({ vin: updatedVin }));
              }
            }
          }
        }
      ]
    });
    
    await alert.present();
  }
  
  async showHistory() {
    const vin = this.currentVin();
    if (!vin) return;
    
    const modal = await this.modalCtrl.create({
      component: HistoryModalComponent,
      componentProps: { vin }
    });
    
    await modal.present();
  }
  
  // ============================================
  // PHOTO MANAGEMENT
  // ============================================
  
  async loadImageAndView(type: 'file' | 'blob') {
    if (type === 'file') {
      const el = this.inputUploader?.nativeElement;
      if (el?.files?.[0]) {
        const file = el.files[0];
        this.currentPhoto.update(photo => ({
          ...photo,
          data: file,
          contentType: file.type,
          name: this.platform.is('ios') || this.platform.is('ipad')
            ? `${dayjs().format('YYYY-MM-DD_hh-mm-ss')}_img.jpeg`
            : file.name
        }));
        
        await this.showWineImageModal('add');
      }
    } else {
      await this.showWineImageModal('modify');
    }
  }
  
  private async showWineImageModal(action: 'add' | 'modify') {
    const modal = await this.modalCtrl.create({
      component: ViewerComponent,
      componentProps: {
        fileOrBlob: this.currentPhoto().data,
        action
      },
      cssClass: 'auto-height',
      backdropDismiss: false
    });
    
    await modal.present();
    const { data } = await modal.onDidDismiss();
    
    if (data?.choice) {
      this.handlePhotoModalResult(data);
    }
  }
  
  private handlePhotoModalResult(data: any) {
    switch (data.choice) {
      case 'delete':
        this.currentPhoto.set({
          contentType: 'image/jpeg',
          data: new File([], 'Photo file'),
          name: ''
        });
        this.dirtyPhoto.set(true);
        break;
        
      case 'cancel':
        if (data.from === 'add') {
          this.currentPhoto.set({
            contentType: 'image/jpeg',
            data: new File([], 'Photo file'),
            name: ''
          });
        }
        break;
        
      case 'replace':
      case 'keep':
        this.currentPhoto.set({
          data: data.compressedBlob,
          contentType: data.selectedFile.type,
          name: data.selectedFile.name
        });
        this.dirtyPhoto.set(true);
        break;
    }
  }
  
  private async uploadPhoto(vin: VinModel) {
    const currentUserString = localStorage.getItem('currentUser');
    const currentUser = currentUserString ? JSON.parse(currentUserString) : null;
    
    if (!currentUser?.username) return;
    
    const formData = new FormData();
    formData.append('photo', this.currentPhoto().data);
    formData.append('vinId', vin._id);
    
    const url = environment.production
      ? `${window.location.origin}/api/photo/${currentUser.username}`
      : `${environment.APIEndpoint}/api/photo/${currentUser.username}`;
    
    try {
      await this.http.post(url, formData).toPromise();
    } catch (error) {
      console.error('Photo upload failed:', error);
      await this.presentToast('Photo upload failed', 'error', 3000);
    }
  }
  
  // ============================================
  // HELPER METHODS
  // ============================================
  
  private vinToFormModel(vin: VinModel): VinFormModel {
    return {
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
    };
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
  
  private handleVinStateChange(state: VinState) {
    switch (state.status) {
      case 'saved':
        if (state.source === 'internal') {
          this.presentToast(
            this.translate.instant('wine.saved'),
            'success',
            2000
          );
          this.navCtrl.navigateBack('/home');
        }
        break;
        
      case 'error':
        this.presentToast(
          `Error: ${state.error}`,
          'error',
          3000
        );
        break;
        
      case 'deleted':
        if (state.source === 'internal') {
          this.presentToast(
            this.translate.instant('wine.deleted'),
            'success',
            2000
          );
          this.navCtrl.navigateBack('/home');
        }
        break;
    }
  }
  
  private validateApogeeFormat(fieldPath: any) {
    // Custom validator for YYYY-YYYY format
    // Implementation depends on Signal Forms validator API
  }
  
  private validateBottlesLeft(fieldPath: any) {
    // Cross-field validation: bottles left <= bottles purchased
  }
  
  compareFn(o1: any, o2: any): boolean {
    return o1 && o2 ? o1._id === o2._id : o1 === o2;
  }
  
  async presentToast(message: string, color: string, duration: number) {
    const toast = await this.toastCtrl.create({
      message,
      duration,
      color: color as any
    });
    await toast.present();
  }
  
  // ViewChild references (still needed for file input)
  @ViewChild('uploadphoto') inputUploader!: ElementRef;
}
```

---

## Key Improvements Summary

### 1. **No More Subscriptions**
- ❌ Removed: `takeUntil`, `unsubscribe$`, `ngOnDestroy`
- ✅ Replaced with: `effect()`, `computed()`, `resource()`

### 2. **No More Manual State Management**
- ❌ Removed: Direct property assignments, manual change detection
- ✅ Replaced with: Signals that automatically trigger updates

### 3. **Simplified HTTP Calls**
- ❌ Removed: Manual `subscribe()` with error handling
- ✅ Replaced with: `resource()` API with automatic loading states

### 4. **Type-Safe Form State**
- ❌ Removed: FormGroup with string-based access
- ✅ Replaced with: Signal Forms with full type inference

### 5. **Reactive Validation**
- ❌ Removed: Manual validator calls, `setErrors()`
- ✅ Replaced with: Schema-based validation that runs automatically

### 6. **Cleaner Lifecycle**
- ❌ Removed: `ngOnInit`, `ngOnDestroy`, `ngAfterViewInit`
- ✅ Replaced with: Constructor with effects

---

## Migration Checklist

### Phase 1: Infrastructure (Week 1)
- [ ] Create `VinFormModel` interface
- [ ] Set up signal-based form structure
- [ ] Convert route params to signals
- [ ] Create computed selectors for store data

### Phase 2: State Migration (Week 2)
- [ ] Convert all properties to signals
- [ ] Replace observables with computed signals
- [ ] Implement effects for side effects
- [ ] Remove `takeUntil` and `unsubscribe$`

### Phase 3: Form Migration (Week 2-3)
- [ ] Migrate FormGroup to Signal Forms
- [ ] Implement validation schema
- [ ] Update template with `[formField]`
- [ ] Test form validation

### Phase 4: HTTP & Resources (Week 3)
- [ ] Convert photo loading to Resource API
- [ ] Replace HTTP subscriptions with resources
- [ ] Handle loading/error states

### Phase 5: Cleanup (Week 4)
- [ ] Remove lifecycle hooks
- [ ] Remove unused imports
- [ ] Update tests
- [ ] Performance testing
- [ ] Documentation

---

## Benefits

1. **~40% Code Reduction**: From 1089 lines to ~700 lines
2. **Zero Memory Leaks**: No manual subscription management
3. **Better Performance**: Fine-grained reactivity
4. **Type Safety**: Full inference throughout
5. **Easier Testing**: Pure functions, no async complexity
6. **Maintainability**: Clear data flow, reactive patterns
7. **Future-Proof**: Zoneless-ready

---

## Risks & Mitigation

### Risk 1: Experimental APIs
**Mitigation**: Pin Angular version, monitor changelog, have rollback plan

### Risk 2: Learning Curve
**Mitigation**: Team training, pair programming, code reviews

### Risk 3: Third-Party Compatibility
**Mitigation**: Test all Ionic components, create adapters if needed

### Risk 4: Resource API Limitations
**Mitigation**: Keep HttpClient as fallback for complex scenarios

---

## Next Steps

1. **Review & approve** this comprehensive plan
2. **Create prototype** with 2-3 fields to validate
3. **Begin incremental migration** following the checklist
4. **Regular check-ins** to address issues early
5. **Document patterns** for team reference
