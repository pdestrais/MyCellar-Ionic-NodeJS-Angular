import { TranslateService } from "@ngx-translate/core";
import {
  Component,
  ElementRef,
  ViewChild,
  signal,
  computed,
  inject,
  effect,
  untracked,
  linkedSignal,
  DestroyRef,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { CommonModule } from "@angular/common";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { TranslateModule } from "@ngx-translate/core";
import { Observable } from "rxjs";
import {
  NavController,
  AlertController,
  ModalController,
  LoadingController,
  Platform,
  IonHeader,
  IonToolbar,
  IonButtons,
  IonMenuButton,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonGrid,
  IonRow,
  IonCol,
  IonButton,
  IonIcon,
} from "@ionic/angular/standalone";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { PouchdbService } from "../services/pouchdb.service";
import {
  VinModel,
  AppellationModel,
  OrigineModel,
  TypeModel,
} from "../models/cellar.model";
import { VinFormModel, EMPTY_VIN_FORM_MODEL } from "../models/vin-form.model";

import { Store } from "@ngrx/store";
import * as TypeSelectors from "../state/type/type.selectors";
import * as OrigineSelectors from "../state/origine/origine.selectors";
import * as AppellationSelectors from "../state/appellation/appellation.selectors";

import { HttpClient } from "@angular/common/http";
import dayjs from "dayjs";
import { ToastController } from "@ionic/angular/standalone";
import { ActivatedRoute } from "@angular/router";
import { ViewerComponent } from "./viewer/viewer.component";
import { NgxStarRatingComponent } from "../ngx-star-rating/ngx-star-rating.component";
import { VinStore } from "../services/vin-state.store";

import Debugger from "debug";
import { environment } from "../../environments/environment";
import { addIcons } from "ionicons";
import {
  arrowUpCircleOutline,
  arrowDownCircleOutline,
  eyeOutline,
  image,
  clipboardOutline,
} from "ionicons/icons";
import { toSignal } from "@angular/core/rxjs-interop";
import { startWith, map, filter } from "rxjs/operators";

const debug = Debugger("app:vin");

@Component({
  selector: "app-vin",
  templateUrl: "./vin.page.html",
  styleUrls: ["./vin.page.scss"],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TranslateModule,
    ViewerComponent,
    NgxStarRatingComponent,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonMenuButton,
    IonTitle,
    IonContent,
    IonItem,
    IonLabel,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonGrid,
    IonRow,
    IonCol,
    IonButton,
    IonIcon,
  ],
})
export class VinPage {
  // ============================================
  // DEPENDENCIES (Inject)
  // ============================================
  private readonly route = inject(ActivatedRoute);
  private readonly navCtrl = inject(NavController);
  private readonly pouch = inject(PouchdbService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly translate = inject(TranslateService);
  private readonly alertController = inject(AlertController);
  private readonly modalCtrl = inject(ModalController);
  private readonly http = inject(HttpClient);
  private readonly toastCtrl = inject(ToastController);
  private readonly loadingCtrl = inject(LoadingController);
  private readonly platform = inject(Platform);
  private readonly store = inject(Store);
  private readonly vinStore = inject(VinStore);
  private readonly destroyRef = inject(DestroyRef);

  // ============================================
  // ROUTE PARAMETERS (Signal-based)
  // ============================================
  private readonly routeParams = toSignal(this.route.params);
  readonly vinId = computed(() => this.routeParams()?.["id"] || null);
  readonly isEditMode = computed(() => this.vinId() !== null);

  // ============================================
  // STORE SELECTORS (Signal-based)
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

  // ============================================
  // COMPONENT STATE (All Signals)
  // ============================================

  // Current wine being edited (from VinStore)
  // Use the store's currentVin computed signal directly
  readonly currentVin = this.vinStore.currentVin;

  // Form model - linked to current vin
  readonly vinFormModel = computed<VinFormModel>(() => {
    const vin = this.currentVin();
    return vin ? this.vinToFormModel(vin) : EMPTY_VIN_FORM_MODEL;
  });

  // Form instance (still using FormGroup for now - full Signal Forms migration is complex)
  public vinForm: FormGroup;

  // Form submission state
  readonly submitted = signal<boolean>(false);

  // Original values for comparison (to detect changes) - converted to computed signals
  readonly originalName = computed(() => this.currentVin()?.nom ?? '');
  readonly originalYear = computed(() => {
    const annee = this.currentVin()?.annee;
    return typeof annee === 'string' ? parseInt(annee) : (annee ?? 0);
  });
  readonly nbreAvantUpdate = computed(() => this.currentVin()?.nbreBouteillesReste ?? 0);

  // Photo management
  readonly currentPhoto = signal<{
    contentType: string;
    data: File | Blob;
    name: string;
  }>({
    contentType: "image/jpeg",
    data: new File([], "Photo file"),
    name: "",
  });

  readonly dirtyPhoto = signal<boolean>(false);
  readonly hasPhoto = computed(() => this.currentPhoto().name !== "");

  // Duplicate detection
  readonly vinsMap = this.vinStore.vinMapForDuplicates;

  readonly isDuplicate = computed(() => {
    const nom = this.vinForm?.get("nom")?.value;
    const annee = this.vinForm?.get("annee")?.value;
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
    return (
      this.vinForm?.valid &&
      !this.isDuplicate() &&
      (this.vinForm?.dirty || this.dirtyPhoto())
    );
  });

  // Concurrent update detection
  readonly concurrentUpdate = this.vinStore.concurrentUpdate;
  
  // Last operation result
  readonly lastOperation = this.vinStore.lastOperation;

  // ViewChild references (still needed for file input)
  @ViewChild("hiddenInput", { static: false })
  hiddenInput!: ElementRef;
  @ViewChild("photoImage", { static: false }) photoImage: any;
  @ViewChild("uploadphoto", { static: false })
  inputUploader!: ElementRef<HTMLInputElement>;

  // ============================================
  // CONSTRUCTOR & EFFECTS
  // ============================================

  constructor() {
    // Initialize icons
    addIcons({
      arrowUpCircleOutline,
      arrowDownCircleOutline,
      eyeOutline,
      image,
      clipboardOutline,
    });

    // Initialize form
    this.vinForm = this.formBuilder.group({
      nom: ["", Validators.required],
      annee: [
        "",
        Validators.compose([
          Validators.minLength(4),
          Validators.maxLength(4),
          Validators.pattern("[0-9]*"),
          Validators.required,
        ]),
      ],
      type: ["", Validators.required],
      origine: ["", Validators.required],
      appellation: ["", Validators.required],
      nbreBouteillesAchat: [0, Validators.required],
      nbreBouteillesReste: [
        0,
        Validators.compose([Validators.pattern("[0-9]*"), Validators.required]),
      ],
      prixAchat: [
        0,
        Validators.compose([
          Validators.pattern("^[0-9]+((,[0-9]{1,2})|(.[0-9]{1,2}))?$"),
          Validators.required,
        ]),
      ],
      dateAchat: ["", Validators.required],
      localisation: ["", Validators.required],
      apogee: ["", Validators.pattern("^[0-9]{4,4}-[0-9]{4,4}$")],
      contenance: [""],
      cepage: [""],
      GWSScore: [""],
      rating: [0],
    });

    // Effect 1: Handle route changes and set current vin
    effect(
      () => {
        const vinId = this.vinId();
        debug("[Effect:route] Vin ID changed:", vinId);

        if (vinId) {
          this.vinStore.setCurrentVin(vinId);
        } else {
          this.vinStore.setCurrentVin(null);
          this.resetForm();
        }
      },
      { allowSignalWrites: true }
    );

    // Effect 2: Load vin into form when currentVin changes
    // This is separate from Effect 1 because currentVin() depends on the vin being loaded into state
    effect(
      () => {
        const vin = this.currentVin();
        debug("[Effect:loadVin] Current vin changed:", vin?._id);

        if (vin) {
          this.loadVinIntoForm(vin);
        }
      },
      { allowSignalWrites: true }
    );

    // Setup form auto-fill for bottles (RxJS approach)
    this.setupBottleAutoFill();

    // Setup form dirty state tracking (RxJS approach)
    this.setupFormDirtyTracking();

    // Effect 7: Handle concurrent update warnings
    effect(
      () => {
        const concurrent = this.concurrentUpdate();
        console.log('[VinPage Effect 7] Concurrent update state:', concurrent);
        if (concurrent.detected && concurrent.message) {
          console.log('[VinPage Effect 7] Showing concurrent update warning');
          this.presentToast(
            this.translate.instant(concurrent.message),
            concurrent.severity === "error" ? "error" : "warning",
            null,
            0,
            this.translate.instant("general.ok")
          );
        }
      },
      { allowSignalWrites: true }
    );

    // Effect 8: Load photo when vin has photo
    effect(
      () => {
        const vin = this.currentVin();
        if (vin?.photo?.name) {
          this.loadPhoto(vin);
        }
      },
      { allowSignalWrites: true }
    );
  }

  // ============================================
  // FORM MANAGEMENT
  // ============================================

  private vinToFormModel(vin: VinModel): VinFormModel {
    return {
      nom: vin.nom,
      annee: typeof vin.annee === 'string' ? parseInt(vin.annee) : vin.annee,
      type: vin.type,
      origine: vin.origine,
      appellation: vin.appellation,
      nbreBouteillesAchat: vin.nbreBouteillesAchat,
      nbreBouteillesReste: vin.nbreBouteillesReste,
      prixAchat: vin.prixAchat || 0,
      dateAchat: vin.dateAchat || "",
      localisation: vin.localisation || "",
      contenance: vin.contenance || "75",
      apogee: vin.apogee || "",
      cepage: vin.cepage || "",
      rating: vin.rating || 0,
    };
  }

  private loadVinIntoForm(vin: VinModel): void {
    debug("[loadVinIntoForm] Loading vin into form:", vin._id);

    this.vinForm.patchValue({
      nom: vin.nom,
      annee: vin.annee,
      type: vin.type,
      origine: vin.origine,
      appellation: vin.appellation,
      nbreBouteillesAchat: vin.nbreBouteillesAchat,
      nbreBouteillesReste: vin.nbreBouteillesReste,
      prixAchat: vin.prixAchat || 0,
      dateAchat: vin.dateAchat || "",
      localisation: vin.localisation || "",
      contenance: vin.contenance || "75",
      apogee: vin.apogee || "",
      cepage: vin.cepage || "",
      GWSScore: vin.GWSScore || 0,
      rating: vin.rating || 0,
    });

    this.vinForm.markAsPristine();
  }

  private resetForm(): void {
    debug("[resetForm] Resetting form");

    this.vinForm.reset({
      nom: "",
      annee: "",
      type: "",
      origine: "",
      appellation: "",
      nbreBouteillesAchat: 0,
      nbreBouteillesReste: 0,
      prixAchat: 0,
      dateAchat: "",
      localisation: "",
      contenance: "75",
      apogee: "",
      cepage: "",
      GWSScore: 0,
      rating: 0,
    });

    this.currentPhoto.set({
      contentType: "image/jpeg",
      data: new File([], "Photo file"),
      name: "",
    });

    this.dirtyPhoto.set(false);
    this.submitted.set(false);
    this.vinForm.markAsPristine();
  }

  /**
   * Setup auto-fill for bottles left when bottles bought changes
   * Uses RxJS instead of effect() for proper FormGroup integration
   */
  private setupBottleAutoFill(): void {
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

  /**
   * Setup form dirty state tracking
   * Uses RxJS to convert FormGroup dirty state to signal-compatible tracking
   */
  private setupFormDirtyTracking(): void {
    // Track form status changes
    this.vinForm.statusChanges
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        startWith(this.vinForm.status),
        map(() => this.vinForm.dirty)
      )
      .subscribe(formDirty => {
        const vinId = this.vinId();
        if (vinId) {
          this.vinStore.updateFormDirtyState(vinId, formDirty || this.dirtyPhoto());
        }
      });

    // Track dirtyPhoto changes separately using effect with untracked
    // Use untracked to prevent reading formDirtyStates and causing infinite loop
    effect(() => {
      const vinId = this.vinId();
      const photoDirty = this.dirtyPhoto();
      
      if (vinId) {
        // Use untracked to read form dirty without creating dependency
        untracked(() => {
          const formDirty = this.vinForm?.dirty || false;
          this.vinStore.updateFormDirtyState(vinId, formDirty || photoDirty);
        });
      }
    });
  }

  // ============================================
  // PHOTO MANAGEMENT
  // ============================================

  private async loadPhoto(vin: VinModel): Promise<void> {
    if (!vin.photo?.name) return;

    const currentUserString = localStorage.getItem("currentUser");
    const currentUser = currentUserString ? JSON.parse(currentUserString) : null;
    if (!currentUser?.username) return;

    const baseUrl = environment.production
      ? window.location.origin + "/api/photo/"
      : environment.APIEndpoint + "/api/photo/";

    const url = `${baseUrl}${currentUser.username}/${vin._id}`;

    try {
      const response: any = await this.http.get(url).toPromise();
      if (response?.data?.Body?.data) {
        this.currentPhoto.set({
          name: vin.photo.name,
          data: new Blob([new Uint8Array(response.data.Body.data)], {
            type: "image/jpeg",
          }),
          contentType: vin.photo.fileType || "image/jpeg",
        });
      }
    } catch (error) {
      debug("[loadPhoto] Error loading photo:", error);
    }
  }

  async loadImageAndView(type: "file" | "blob") {
    if (type === "file") {
      const el = this.inputUploader?.nativeElement;
      if (el?.files?.[0]) {
        const file = el.files[0];
        this.currentPhoto.set({
          data: file,
          contentType: file.type,
          name:
            this.platform.is("ios") || this.platform.is("ipad")
              ? `${dayjs().format("YYYY-MM-DD_hh-mm-ss")}_img.jpeg`
              : file.name,
        });

        await this.showWineImageModal("add");
      }
    } else {
      await this.showWineImageModal("modify");
    }
  }

  private async showWineImageModal(action: "add" | "modify") {
    const modal = await this.modalCtrl.create({
      component: ViewerComponent,
      componentProps: {
        fileOrBlob: this.currentPhoto().data,
        action,
      },
      cssClass: "auto-height",
      backdropDismiss: false,
    });

    await modal.present();
    const { data } = await modal.onDidDismiss();

    if (data?.choice) {
      this.handlePhotoModalResult(data);
    }
  }

  private handlePhotoModalResult(data: any) {
    switch (data.choice) {
      case "delete":
        this.currentPhoto.set({
          contentType: "image/jpeg",
          data: new File([], "Photo file"),
          name: "",
        });
        this.dirtyPhoto.set(true);
        break;

      case "cancel":
        if (data.from === "add") {
          this.currentPhoto.set({
            contentType: "image/jpeg",
            data: new File([], "Photo file"),
            name: "",
          });
        }
        break;

      case "replace":
      case "keep":
        this.currentPhoto.set({
          data: data.compressedBlob,
          contentType: data.selectedFile.type,
          name: data.selectedFile.name,
        });
        this.dirtyPhoto.set(true);
        break;
    }
  }

  private async uploadPhoto(vinId: string): Promise<void> {
    const currentUserString = localStorage.getItem("currentUser");
    const currentUser = currentUserString ? JSON.parse(currentUserString) : null;

    if (!currentUser?.username) return;

    const formData = new FormData();
    formData.append("image", this.currentPhoto().data);
    formData.append("name", vinId);
    formData.append("user", currentUser.username);

    const url = environment.production
      ? window.location.origin + "/api/photo"
      : environment.APIEndpoint + "/api/photo";

    try {
      await this.http.post(url, formData).toPromise();
      debug("[uploadPhoto] Photo uploaded successfully");
    } catch (error) {
      debug("[uploadPhoto] Error uploading photo:", error);
      throw error;
    }
  }

  private async deletePhoto(vinId: string): Promise<void> {
    const currentUserString = localStorage.getItem("currentUser");
    const currentUser = currentUserString ? JSON.parse(currentUserString) : null;

    if (!currentUser?.username) return;

    const baseUrl = environment.production
      ? window.location.origin + "/api/photo/"
      : environment.APIEndpoint + "/api/photo/";

    const url = `${baseUrl}${currentUser.username}/${vinId}`;

    try {
      await this.http.delete(url).toPromise();
      debug("[deletePhoto] Photo deleted successfully");
    } catch (error) {
      debug("[deletePhoto] Error deleting photo:", error);
    }
  }

  // ============================================
  // SAVE & DELETE OPERATIONS
  // ============================================

  public async saveVin() {
    debug("[saveVin] Entering");
    this.submitted.set(true);

    if (!this.vinForm.valid) {
      debug("[saveVin] Form invalid");
      await this.presentToast(
        this.translate.instant("general.invalidData"),
        "error",
        null,
        3000
      );
      return;
    }

    if (this.isDuplicate()) {
      debug("[saveVin] Duplicate detected");
      await this.presentToast(
        this.translate.instant("wine.duplicateWine"),
        "error",
        null,
        3000
      );
      return;
    }

    try {
      // Build VinModel from form data
      const currentVin = this.currentVin();
      const formData = this.vinForm.value;

      const lastUpdated = new Date().toISOString();
      const vinData: VinModel = {
        _id: currentVin?._id || "",
        _rev: currentVin?._rev || "",
        id: currentVin?.id || currentVin?._id || "",
        rev: currentVin?.rev || currentVin?._rev || "",
        nom: formData.nom,
        annee: formData.annee,
        type: formData.type,
        origine: formData.origine,
        appellation: formData.appellation,
        nbreBouteillesAchat: formData.nbreBouteillesAchat,
        nbreBouteillesReste: formData.nbreBouteillesReste,
        prixAchat: formData.prixAchat,
        dateAchat: formData.dateAchat,
        localisation: formData.localisation,
        contenance: formData.contenance,
        apogee: formData.apogee,
        cepage: formData.cepage,
        GWSScore: formData.GWSScore,
        rating: formData.rating,
        remarque: "",
        history: currentVin?.history || [],
        lastUpdated: lastUpdated,
        cotes: currentVin?.cotes || [],
        photo: this.hasPhoto()
          ? {
              name: this.currentPhoto().name,
              fileType: this.currentPhoto().contentType,
              width: 0,
              heigth: 0,
              orientation: 1,
            }
          : currentVin?.photo,
      };

      // Add history entry for creation
      if (!this.isEditMode()) {
        vinData.history = [
          {
            type: "creation",
            difference: vinData.nbreBouteillesReste,
            date: lastUpdated,
            comment: "",
          },
        ];
      } else {
        // Add history entry if bottles changed
        const bottlesDiff = vinData.nbreBouteillesReste - this.nbreAvantUpdate();
        if (bottlesDiff !== 0) {
          vinData.history = [
            ...(vinData.history || []),
            {
              type: "update",
              difference: bottlesDiff,
              date: lastUpdated,
              comment: "",
            },
          ];
        }
      }

      // Save vin to database
      const result = await this.vinStore.saveVin(vinData);

      if (result.success && result.vin) {
        // Handle photo upload/delete if needed
        if (this.dirtyPhoto()) {
          if (this.hasPhoto()) {
            await this.uploadPhoto(result.vin._id);
          } else if (currentVin?.photo?.name) {
            await this.deletePhoto(result.vin._id);
          }
        }

        debug("[saveVin] Vin saved successfully");
        
        // Show success message and navigate
        await this.presentToast(
          this.translate.instant("wine.saved"),
          "success",
          "/home",
          2000
        );
      } else if (result.error) {
        // Show error message
        await this.presentToast(
          result.error,
          "error",
          null,
          3000
        );
      }
    } catch (error) {
      debug("[saveVin] Error:", error);
      await this.presentToast(
        this.translate.instant("wine.saveFailed"),
        "error",
        null,
        3000
      );
    }
  }

  async deleteVin() {
    const vin = this.currentVin();
    if (!vin) return;

    const alert = await this.alertController.create({
      header: this.translate.instant("general.confirm"),
      message: this.translate.instant("general.sure"),
      buttons: [
        {
          text: this.translate.instant("general.cancel"),
        },
        {
          text: this.translate.instant("general.ok"),
          handler: async () => {
            try {
              const result = await this.vinStore.deleteVin(vin);
              debug("[deleteVin] Vin deleted successfully");
              
              if (result.success) {
                // Show success message and navigate
                await this.presentToast(
                  this.translate.instant("wine.deleted"),
                  "success",
                  "/home",
                  2000
                );
              } else if (result.error) {
                // Show error message
                await this.presentToast(
                  result.error,
                  "error",
                  null,
                  3000
                );
              }
            } catch (error) {
              debug("[deleteVin] Error:", error);
              await this.presentToast(
                this.translate.instant("wine.deleteFailed"),
                "error",
                null,
                3000
              );
            }
          },
        },
      ],
    });

    await alert.present();
  }

  // ============================================
  // UI ACTIONS
  // ============================================

  public cancel() {
    this.navCtrl.back();
  }

  adjustQuantityLeft(q: number) {
    const ctrlLeft = this.vinForm.get("nbreBouteillesReste");
    const ctrlBought = this.vinForm.get("nbreBouteillesAchat");

    if (ctrlLeft && ctrlBought) {
      let nbrBought = ctrlBought.value;
      if (typeof ctrlBought.value === "string")
        nbrBought = parseFloat(ctrlBought.value.replace(",", "."));

      let newQty = ctrlLeft.value + q;
      if (typeof ctrlLeft.value === "string")
        newQty = parseFloat(ctrlLeft.value.replace(",", ".")) + q;

      ctrlLeft.patchValue(Math.max(Math.min(newQty, nbrBought), 0));
      this.vinForm.markAsDirty();
    }
  }

  async addComment() {
    const alert = await this.alertController.create({
      header: this.translate.instant("wine.addComment"),
      inputs: [
        {
          type: "text",
          name: "comment",
        },
      ],
      buttons: [
        {
          text: "Cancel",
        },
        {
          text: "Save",
          handler: async (data) => {
            if (data.comment) {
              const vin = this.currentVin();
              if (vin) {
                const updatedVin: VinModel = {
                  ...vin,
                  history: [
                    ...(vin.history || []),
                    {
                      type: "comment",
                      date: new Date().toISOString(),
                      comment: data.comment,
                      difference: 0,
                    },
                  ],
                };
                await this.vinStore.saveVin(updatedVin);
              }
            }
          },
        },
      ],
    });

    await alert.present();
  }

  public async showHistory() {
    const vin = this.currentVin();
    if (!vin) return;

    const modal = await this.modalCtrl.create({
      component: ModalPage,
      componentProps: { vin },
    });

    await modal.present();
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  public toNumber(attribute: string) {
    const value = this.vinForm.get(attribute)?.value;
    if (typeof value === "string") {
      const numValue = parseFloat(value.replace(",", "."));
      this.vinForm.get(attribute)?.patchValue(numValue);
    }
  }

  public showDate(ISODateString: string) {
    return ISODateString.substring(0, 10);
  }

  compareFn(o1: any, o2: any): boolean {
    return o1 && o2 ? o1._id === o2._id : o1 === o2;
  }

  async presentToast(
    message: string,
    type: string,
    nextPageUrl: string | null,
    duration?: number,
    closeButtonText?: string
  ) {
    if (duration && duration != 0) {
      const toast = await this.toastCtrl.create({
        color:
          type == "success"
            ? "secondary"
            : type == "warning"
              ? "warning"
              : "danger",
        message: message,
        duration: duration ? duration : 2000,
      });
      toast.present();
      if (nextPageUrl) this.navCtrl.navigateRoot(nextPageUrl);
    } else {
      const toast = await this.toastCtrl.create({
        color:
          type == "success"
            ? "secondary"
            : type == "warning"
              ? "warning"
              : "danger",
        message: message,
        buttons: [
          {
            text: closeButtonText,
            role: "cancel",
            handler: () => {
              if (nextPageUrl) this.navCtrl.navigateRoot(nextPageUrl);
            },
          },
        ],
      });
      toast.present();
    }
  }

  async presentLoading() {
    const loading = await this.loadingCtrl.create({
      message: "getting GWS Score",
    });
    await loading.present();
  }
}

// ============================================
// MODAL PAGE (History)
// ============================================
@Component({
  selector: "app-modal",
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ "wine.history" | translate }}</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="dismiss()">
            {{ "general.close" | translate }}
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list>
        <ion-item *ngFor="let entry of vin?.history">
          <ion-label>
            <h2>{{ entry.type }}</h2>
            <p>{{ entry.date | date : "short" }}</p>
            <p *ngIf="entry.comment">{{ entry.comment }}</p>
            <p *ngIf="entry.difference !== 0">
              {{ entry.difference > 0 ? "+" : "" }}{{ entry.difference }}
            </p>
          </ion-label>
        </ion-item>
      </ion-list>
    </ion-content>
  `,
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonList,
    IonItem,
    IonLabel
  ],
})
export class ModalPage {
  vin: VinModel | null = null;

  constructor(private modalCtrl: ModalController) {}

  dismiss() {
    this.modalCtrl.dismiss();
  }
}

// Made with Bob
