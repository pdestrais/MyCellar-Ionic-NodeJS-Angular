import { TranslateService } from "@ngx-translate/core";
import { Component, OnInit, effect, signal, computed, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { NavController, AlertController, IonHeader, IonToolbar, IonButtons, IonMenuButton, IonTitle, IonContent, IonList, IonItem, IonIcon, IonButton, IonLabel, IonInput } from "@ionic/angular/standalone";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { OrigineModel, VinModel } from "../models/cellar.model";
import { ToastController } from "@ionic/angular/standalone";
import { ActivatedRoute } from "@angular/router";

import { CommonModule } from "@angular/common";
import { ReactiveFormsModule, FormsModule } from "@angular/forms";
import { TranslateModule } from "@ngx-translate/core";
import { RouterModule } from "@angular/router";
import { OrigineStore } from "../services/origine-state.store";
import { VinStore } from "../services/vin-state.store";

import Debugger from "debug";
import { addIcons } from "ionicons";
import { caretForwardOutline } from "ionicons/icons";

const debug = Debugger("app:region");

/* Restored comments from previous version:
 - We need to load the origine list even if we create or modify an origine because in this case we need the origine list to check for doubles
 - When an origine is selected from the store we reset the Origine state to avoid shadow UI messages coming from previous updates in other app instances
 - Handling state changes (originating from save, update or delete operations in the UI but also coming for synchronization with data from other application instances)
   - (I) internal ? => (wine/origine is saved in the application) a confirmation message is shown to the user and the app goes to the home screen
   - (II) external ?
       - (A) event comes from the local DB resulting from the update of the origine we just saved
       - (B) event comes from the remoteDB resulting from the update of an origine (not the one we are working on)
       - (C) event coming from the remoteDB resulting from the update of the origine we are working on (concurrent update)
 - Delete does not remove a doc; it creates a new document with "_delete" attribute set to true
*/

@Component({
    selector: "app-region",
    templateUrl: "./region.page.html",
    styleUrls: ["./region.page.scss"],
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, FormsModule, TranslateModule, RouterModule, IonHeader, IonToolbar, IonButtons, IonMenuButton, IonTitle, IonContent, IonList, IonItem, IonIcon, IonButton, IonLabel, IonInput]
})
export class RegionPage implements OnInit {
    // ============================================
    // DEPENDENCIES (Inject)
    // ============================================
    private readonly route = inject(ActivatedRoute);
    private readonly navCtrl = inject(NavController);
    private readonly formBuilder = inject(FormBuilder);
    private readonly translate = inject(TranslateService);
    private readonly alertController = inject(AlertController);
    private readonly toastCtrl = inject(ToastController);
    private readonly origineStore = inject(OrigineStore);
    private readonly vinStore = inject(VinStore);

    // ============================================
    // COMPONENT STATE (Signals)
    // ============================================
    // Current origine being edited - as a signal
    readonly currentOrigine = signal<OrigineModel>(new OrigineModel({
        _id: "",
        pays: "",
        region: "",
    }));

    // Get origines list from OrigineStore
    readonly origines = this.origineStore.originesList;
    
    // Get duplicate map from OrigineStore
    readonly originesMap = this.origineStore.origineMapForDuplicates;

    public submitted = signal<boolean>(false);
    public origineForm!: FormGroup;
    public list = signal<boolean>(true);
    public showWines = signal<boolean>(false);
    public newOrigine = signal<boolean>(false);

    // Route parameter as signal
    private readonly routeParams = toSignal(this.route.params);
    readonly origineId = computed(() => this.routeParams()?.["id"] || null);

    constructor() {
        addIcons({ caretForwardOutline });

        // Effect: Load selected origine when origineId changes
        effect(() => {
            const id = this.origineId();
            debug("[Effect:origineId] Origine ID changed:", id);

            if (id) {
                // Get origine from store
                const origineSignal = this.origineStore.getOrigineById(id);
                const origine = origineSignal();
                
                if (origine) {
                    this.list.set(false);
                    this.currentOrigine.set(origine);
                    this.newOrigine.set(false);
                    this.origineForm.get("pays")!.setValue(origine.pays);
                    this.origineForm.get("region")!.setValue(origine.region);
                    debug("[Effect:origineId] Origine loaded:", JSON.stringify(origine));
                }
            } else {
                // No origine selected, creating new origine
                this.newOrigine.set(true);
                this.currentOrigine.set(new OrigineModel({
                    _id: "",
                    pays: "",
                    region: "",
                }));
            }
        }, { allowSignalWrites: true });
    }

    public ngOnInit() {
        debug("[ngOnInit]called");
        
        // form initialization
        this.origineForm = this.formBuilder.group(
            {
                pays: ["", Validators.required],
                region: ["", Validators.required],
            },
            { validator: this.noDouble.bind(this) }
        );
        this.submitted.set(false);
        
        // Set list mode based on route data
        this.route.snapshot.data["action"] == "list"
            ? this.list.set(true)
            : this.list.set(false);
    }

    private noDouble(group: FormGroup) {
        debug("[noDouble] called");
        if (
            !group.controls["pays"] ||
            !group.controls["region"] ||
            !group.controls["pays"].dirty ||
            !group.controls["region"].dirty
        )
            return null;
        
        const originesMap = this.originesMap();
        if (
            originesMap &&
            originesMap.has(group.value.pays + group.value.region)
        ) {
            debug("[noDouble]double detected");
            return { double: true };
        } else return null;
    }

    public editOrigine(origine: OrigineModel | null) {
        if (origine && origine._id) this.navCtrl.navigateForward(["/region", origine._id]);
        else this.navCtrl.navigateForward(["/region"]);
    }

    public async saveOrigine() {
        debug("[saveOrigine] Entering");
        this.submitted.set(true);
        
        if (this.origineForm.valid) {
            debug("[saveOrigine] Origine valid");
            const currentOrigine = this.currentOrigine();
            const updatedOrigine = {
                ...currentOrigine,
                ...this.origineForm.value,
            };
            
            try {
                await this.origineStore.saveOrigine(updatedOrigine);
                this.presentToast(
                    this.translate.instant("general.dataSaved"),
                    "success",
                    "home",
                    2000
                );
            } catch (error) {
                debug("[saveOrigine] Error:", error);
                this.presentToast(
                    this.translate.instant("general.DBError"),
                    "error",
                    null,
                    5000
                );
            }
        } else {
            debug("[saveOrigine] Origine invalid");
            this.presentToast(
                this.translate.instant("general.invalidData"),
                "error",
                null
            );
        }
    }

    public async deleteOrigine() {
        // Check if origine is used by any wines
        const currentOrigine = this.currentOrigine();
        const winesByOrigineSignal = this.vinStore.getWinesByOrigine(currentOrigine._id);
        const wineList = winesByOrigineSignal();
        const used = wineList.length > 0;
        
        if (!used) {
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
                                await this.origineStore.deleteOrigine(currentOrigine);
                                this.presentToast(
                                    this.translate.instant("wine.wineDeleted"),
                                    "success",
                                    "home",
                                    2000
                                );
                            } catch (error) {
                                debug("[deleteOrigine] Error:", error);
                                this.presentToast(
                                    this.translate.instant("general.DBError"),
                                    "error",
                                    null,
                                    5000
                                );
                            }
                        },
                    },
                ],
            });
            await alert.present();
        } else {
            this.presentToast(
                this.translate.instant("origine.cantDeleteBecauseUsed"),
                "error",
                null
            );
        }
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
}

// Made with Bob
