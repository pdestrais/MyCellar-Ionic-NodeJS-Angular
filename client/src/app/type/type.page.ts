import { TranslateService } from "@ngx-translate/core";
import { Component, OnInit, effect, signal, computed, inject, DestroyRef } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
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
import { Store } from "@ngrx/store";
import * as VinSelectors from "../state/vin/vin.selectors";
import * as TypeActions from "../state/type/type.actions";
import { AppState } from "../state/app.state";
import { TypeStore } from "../services/type-state.store";

import { replacer } from "../util/util";
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
    private readonly store = inject(Store<AppState>);
    private readonly typeStore = inject(TypeStore);
    private readonly destroyRef = inject(DestroyRef);

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
                    
                    // Reset Type state to avoid shadow UI messages
                    this.store.dispatch(
                        TypeActions.editType({
                            id: type._id,
                            rev: type._rev,
                        })
                    );
                    this.typeForm.get("nom")!.setValue(type.nom);
                    debug("[ngOnInit]Type loaded : " + JSON.stringify(type));
                }
            } else {
                // No type selected, creating new type
                this.newType.set(true);
                // Reset to empty type for new creation
                this.currentType.set(new TypeModel({
                    _id: "",
                    nom: "",
                }));
                this.store.dispatch(TypeActions.editType({ id: "", rev: "" }));
            }
        }, { allowSignalWrites: true });

        // Effect: Handle state changes from NgRx (for save/delete operations)
        const typeStateSignal = toSignal(this.store.select((state: AppState) => state.types));
        effect(() => {
            const typeState = typeStateSignal();
            if (!typeState) return;
            
            switch (typeState.status) {
                case "saved":
                    debug(
                        "[ngOnInit] handling change to 'saved' status - ts " +
                        window.performance.now() +
                        "\ntypeState : " +
                        JSON.stringify(typeState, replacer)
                    );

                    if (typeState.source == "internal") {
                        debug("[ngInit](I) Standard type saved");
                        this.presentToast(
                            this.translate.instant("general.dataSaved"),
                            "success",
                            "home",
                            2000
                        );
                        this.store.dispatch(TypeActions.setStatusToLoaded());
                    } else {
                        let filteredEventLog = typeState.eventLog.filter(
                            (value) =>
                                value.id == typeState.currentType.id &&
                                value.rev == typeState.currentType.rev &&
                                value.action == "create"
                        );
                        debug("[ngInit](II) FilteredEventLog : " + JSON.stringify(filteredEventLog));
                        
                        if (filteredEventLog.length == 2) {
                            debug("[ngInit](II.A) Duplicate state change for the same type");
                            this.store.dispatch(TypeActions.setStatusToLoaded());
                        } else if (
                            typeState.eventLog[typeState.eventLog.length - 1].id ==
                            typeState.currentType.id &&
                            typeState.eventLog[typeState.eventLog.length - 1].rev ==
                            typeState.currentType.rev &&
                            typeState.eventLog[typeState.eventLog.length - 1].action ==
                            "create" &&
                            this.typeForm.dirty
                        ) {
                            debug("[ngInit](II.C) Concurrent editing on the same type");
                            this.presentToast(
                                this.translate.instant("wine.savedConcurrentlyOnAnotherInstance"),
                                "warning",
                                "",
                                0,
                                "Close"
                            );
                        } else {
                            debug("[ngInit](II.B) Update of another type");
                        }
                    }
                    break;
                    
                case "error":
                    this.presentToast(
                        this.translate.instant("general.DBError") + " " + typeState.error,
                        "error",
                        null,
                        5000
                    );
                    break;
                    
                case "deleted":
                    if (typeState.source == "internal") {
                        debug("[ngInit](I) Standard type deleted");
                        this.presentToast(
                            this.translate.instant("type.typeDeleted"),
                            "success",
                            "home",
                            2000
                        );
                        this.store.dispatch(TypeActions.setStatusToLoaded());
                    } else {
                        const deleteEventsForCurrentType = typeState.eventLog.filter(
                            (value) =>
                                value.id == typeState.currentType.id &&
                                value.rev >= typeState.currentType.rev &&
                                value.action == "delete"
                        );
                        
                        if (deleteEventsForCurrentType.length >= 1) {
                            // This is the external event following our internal delete
                            debug("[ngInit](II.A) Duplicate state change for the same type (external after internal)");
                            this.store.dispatch(TypeActions.setStatusToLoaded());
                        } else if (
                            typeState.eventLog[typeState.eventLog.length - 1].id ==
                            typeState.currentType.id &&
                            typeState.eventLog[typeState.eventLog.length - 1].action ==
                            "delete"
                        ) {
                            debug("[ngInit](II.C) Concurrent editing on the same type");
                            this.presentToast(
                                this.translate.instant("type.deletedConcurrentlyOnAnotherInstance"),
                                "warning",
                                "home",
                                0,
                                "Close"
                            );
                        } else {
                            debug("[ngInit](II.B) Delete of another type");
                        }
                    }
                    break;
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

    public saveType() {
        debug("[saveType]entering");
        this.submitted.set(true);
        
        if (this.typeForm.valid) {
            debug("[saveType]Type valid");
            const currentType = this.currentType();
            const updatedType = {
                ...currentType,
                ...this.typeForm.value,
            };
            this.currentType.set(updatedType);

            this.store.dispatch(TypeActions.createType({ _type: updatedType }));
        } else {
            debug("[saveType]type invalid");
            this.presentToast(
                this.translate.instant("general.invalidData"),
                "error",
                null
            );
        }
    }

    public deleteType() {
        // Check if type is used by any wines
        const currentType = this.currentType();
        let used = false;
        this.store
            .select(VinSelectors.getWinesByType(currentType._id))
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((wineListForType) =>
                wineListForType.length > 0 ? (used = true) : (used = false)
            );
            
        if (!used) {
            this.alertController
                .create({
                    header: this.translate.instant("general.confirm"),
                    message: this.translate.instant("general.sure"),
                    buttons: [
                        {
                            text: this.translate.instant("general.cancel"),
                        },
                        {
                            text: this.translate.instant("general.ok"),
                            handler: () => {
                                this.store.dispatch(
                                    TypeActions.deleteType({
                                        _type: currentType,
                                    })
                                );
                            },
                        },
                    ],
                })
                .then((alert) => {
                    alert.present();
                });
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
