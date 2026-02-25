import { TranslateService } from "@ngx-translate/core";
import { Component, OnInit, effect, signal, computed, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { NavController, AlertController, IonHeader, IonToolbar, IonButtons, IonMenuButton, IonTitle, IonContent, IonList, IonItem, IonIcon, IonButton, IonLabel, IonInput } from "@ionic/angular/standalone";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { TypeModel } from "../models/cellar.model";
import { ToastController } from "@ionic/angular/standalone";
import { ActivatedRoute } from "@angular/router";

import Debugger from "debug";
import { CommonModule } from "@angular/common";
import { ReactiveFormsModule, FormsModule } from "@angular/forms";
import { TranslateModule } from "@ngx-translate/core";
import { RouterModule } from "@angular/router";
import { TypeStore } from "../services/type-state.store";
import { VinStore } from "../services/vin-state.store";

import { addIcons } from "ionicons";
import { caretForwardOutline } from "ionicons/icons";

const debug = Debugger("app:type");

/* Restored comments from previous version:
 - We need to load the type list even if we create or modify a type because in this case we need the type list to check for doubles
 - When a type is selected from the store we reset the Type state to avoid shadow UI messages coming from previous updates in other app instances
 - Handling state changes (originating from save, update or delete operations in the UI but also coming for synchronization with data from other application instances)
   - (I) internal ? => (type is saved in the application) a confirmation message is shown to the user and the app goes to the home screen
   - (II) external ?
       - (A) event comes from the local DB resulting from the update of the type we just saved
       - (B) event comes from the remoteDB resulting from the update of a type (not the one we are working on)
       - (C) event coming from the remoteDB resulting from the update of the type we are working on (concurrent update)
 - Delete does not remove a doc; it creates a new document with "_delete" attribute set to true
*/

@Component({
    selector: "app-type",
    templateUrl: "./type.page.html",
    styleUrls: ["./type.page.scss"],
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, FormsModule, TranslateModule, RouterModule, IonHeader, IonToolbar, IonButtons, IonMenuButton, IonTitle, IonContent, IonList, IonItem, IonIcon, IonButton, IonLabel, IonInput]
})
export class TypePage implements OnInit {
    // ============================================
    // DEPENDENCIES (Inject)
    // ============================================
    private readonly route = inject(ActivatedRoute);
    private readonly navCtrl = inject(NavController);
    private readonly formBuilder = inject(FormBuilder);
    private readonly translate = inject(TranslateService);
    private readonly alertController = inject(AlertController);
    private readonly toastCtrl = inject(ToastController);
    private readonly typeStore = inject(TypeStore);
    private readonly vinStore = inject(VinStore);

    // ============================================
    // COMPONENT STATE (Signals)
    // ============================================
    // Current type being edited - as a signal
    readonly currentType = signal<TypeModel>(new TypeModel({
        _id: "",
        nom: "",
    }));

    // Get types list from TypeStore
    readonly wineTypes = this.typeStore.typesList;
    
    // Get duplicate map from TypeStore
    readonly typesMap = this.typeStore.typeMapForDuplicates;

    public submitted = signal<boolean>(false);
    public typeForm!: FormGroup;
    public list = signal<boolean>(true);
    public newType = signal<boolean>(true);

    // Route parameter as signal
    private readonly routeParams = toSignal(this.route.params);
    readonly typeId = computed(() => this.routeParams()?.["id"] || null);

    constructor() {
        addIcons({ caretForwardOutline });

        // Effect: Load selected type when typeId changes
        effect(() => {
            const id = this.typeId();
            debug("[Effect:typeId] Type ID changed:", id);

            if (id) {
                // Get type from store
                const typeSignal = this.typeStore.getTypeById(id);
                const type = typeSignal();
                
                if (type) {
                    this.list.set(false);
                    this.currentType.set(type);
                    this.newType.set(false);
                    this.typeForm.get("nom")!.setValue(type.nom);
                    debug("[Effect:typeId] Type loaded:", JSON.stringify(type));
                }
            } else {
                // No type selected, creating new type
                this.newType.set(true);
                this.currentType.set(new TypeModel({
                    _id: "",
                    nom: "",
                }));
            }
        }, { allowSignalWrites: true });
    }

    public ngOnInit() {
        debug("[ngOnInit]called");
        
        // form initialization
        this.typeForm = this.formBuilder.group(
            {
                nom: ["", Validators.required],
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
        if (!group.controls["nom"] || !group.controls["nom"].dirty) return null;
        
        const typesMap = this.typesMap();
        if (typesMap && typesMap.has(group.value.nom)) {
            debug("[noDouble]double detected");
            return { double: true };
        } else return null;
    }

    public editType(type: TypeModel | null) {
        if (type && type._id) this.navCtrl.navigateForward(["/type", type._id]);
        else this.navCtrl.navigateForward(["/type"]);
    }

    public async saveType() {
        debug("[saveType] Entering");
        this.submitted.set(true);
        
        if (this.typeForm.valid) {
            debug("[saveType] Type valid");
            const currentType = this.currentType();
            const updatedType = {
                ...currentType,
                ...this.typeForm.value,
            };
            
            try {
                await this.typeStore.saveType(updatedType);
                this.presentToast(
                    this.translate.instant("general.dataSaved"),
                    "success",
                    "home",
                    2000
                );
            } catch (error) {
                debug("[saveType] Error:", error);
                this.presentToast(
                    this.translate.instant("general.DBError"),
                    "error",
                    null,
                    5000
                );
            }
        } else {
            debug("[saveType] Type invalid");
            this.presentToast(
                this.translate.instant("general.invalidData"),
                "error",
                null
            );
        }
    }

    public async deleteType() {
        // Check if type is used by any wines
        const currentType = this.currentType();
        const winesByTypeSignal = this.vinStore.getWinesByType(currentType._id);
        const wineListForType = winesByTypeSignal();
        const used = wineListForType.length > 0;
            
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
                                await this.typeStore.deleteType(currentType);
                                this.presentToast(
                                    this.translate.instant("type.typeDeleted"),
                                    "success",
                                    "home",
                                    2000
                                );
                            } catch (error) {
                                debug("[deleteType] Error:", error);
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
                this.translate.instant("type.cantDeleteBecauseUsed"),
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
