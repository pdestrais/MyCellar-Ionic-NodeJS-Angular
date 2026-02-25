import { TranslateService } from "@ngx-translate/core";
import { Component, OnInit, effect, signal, computed, inject, DestroyRef } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { NavController, AlertController, IonHeader, IonToolbar, IonButtons, IonMenuButton, IonTitle, IonContent, IonList, IonItem, IonIcon, IonButton, IonLabel, IonInput } from "@ionic/angular/standalone";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { OrigineModel, VinModel } from "../models/cellar.model";
import { ToastController } from "@ionic/angular/standalone";
import { ActivatedRoute } from "@angular/router";

import { Store } from "@ngrx/store";
import { CommonModule } from "@angular/common";
import { ReactiveFormsModule, FormsModule } from "@angular/forms";
import { TranslateModule } from "@ngx-translate/core";
import { RouterModule } from "@angular/router";
import * as VinSelectors from "../state/vin/vin.selectors";
import * as OrigineActions from "../state/origine/origine.actions";
import { AppState } from "../state/app.state";
import { OrigineStore } from "../services/origine-state.store";

import { replacer } from "../util/util";

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
    private readonly store = inject(Store<AppState>);
    private readonly origineStore = inject(OrigineStore);
    private readonly destroyRef = inject(DestroyRef);

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

    // Wines for this origine - using a writable signal updated by effect
    private readonly _winesForOrigine = signal<VinModel[]>([]);
    readonly winesForOrigine = this._winesForOrigine.asReadonly();

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

        // Effect: Load wines for the selected origine
        effect(() => {
            const id = this.origineId();
            if (!id) {
                this._winesForOrigine.set([]);
                return;
            }
            
            // Subscribe to wines for this origine
            this.store.select(VinSelectors.getWinesByOrigine(id))
                .pipe(takeUntilDestroyed(this.destroyRef))
                .subscribe(wines => {
                    this._winesForOrigine.set(wines || []);
                });
        });

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
                    
                    // Reset Origine state to avoid shadow UI messages
                    this.store.dispatch(
                        OrigineActions.editOrigine({
                            id: origine._id!,
                            rev: origine._rev!,
                        })
                    );
                    this.origineForm.get("pays")!.setValue(origine.pays);
                    this.origineForm.get("region")!.setValue(origine.region);
                    debug("[ngOnInit]Origine loaded : " + JSON.stringify(origine));
                }
            } else {
                // No origine selected, creating new origine
                this.newOrigine.set(true);
                // Reset to empty origine for new creation
                this.currentOrigine.set(new OrigineModel({
                    _id: "",
                    pays: "",
                    region: "",
                }));
                this.store.dispatch(OrigineActions.editOrigine({ id: "", rev: "" }));
            }
        }, { allowSignalWrites: true });

        // Effect: Handle state changes from NgRx (for save/delete operations)
        const origineStateSignal = toSignal(this.store.select((state: AppState) => state.origines));
        effect(() => {
            const origineState = origineStateSignal();
            if (!origineState) return;
            
            switch (origineState.status) {
                case "saved":
                    debug(
                        "[ngOnInit] handling change to 'saved' status - ts " +
                        window.performance.now() +
                        "\norigineState : " +
                        JSON.stringify(origineState, replacer)
                    );

                    if (origineState.source == "internal") {
                        debug("[ngInit](I) Standard origine saved");
                        this.presentToast(
                            this.translate.instant("general.dataSaved"),
                            "success",
                            "home",
                            2000
                        );
                        this.store.dispatch(OrigineActions.setStatusToLoaded());
                    } else {
                        let filteredEventLog = origineState.eventLog.filter(
                            (value) =>
                                value.id == origineState.currentOrigine!.id &&
                                value.rev == origineState.currentOrigine!.rev &&
                                value.action == "create"
                        );
                        debug("[ngInit](II) FilteredEventLog : " + JSON.stringify(filteredEventLog));
                        
                        if (filteredEventLog.length == 2) {
                            debug("[ngInit](II.A) Duplicate state change for the same origine");
                            this.store.dispatch(OrigineActions.setStatusToLoaded());
                        } else if (
                            origineState.eventLog[origineState.eventLog.length - 1].id ==
                            origineState.currentOrigine!.id &&
                            origineState.eventLog[origineState.eventLog.length - 1].rev ==
                            origineState.currentOrigine!.rev &&
                            origineState.eventLog[origineState.eventLog.length - 1].action ==
                            "create" &&
                            this.origineForm.dirty
                        ) {
                            debug("[ngInit](II.C) Concurrent editing on the same origine");
                            this.presentToast(
                                this.translate.instant("wine.savedConcurrentlyOnAnotherInstance"),
                                "warning",
                                "",
                                0,
                                "Close"
                            );
                        } else {
                            debug("[ngInit](II.B) Update of another origine");
                        }
                    }
                    break;
                    
                case "error":
                    this.presentToast(
                        this.translate.instant("general.DBError") + " " + origineState.error,
                        "error",
                        null,
                        5000
                    );
                    break;
                    
                case "deleted":
                    if (origineState.source == "internal") {
                        debug("[ngInit](I) Standard origine deleted");
                        this.presentToast(
                            this.translate.instant("wine.wineDeleted"),
                            "success",
                            "home",
                            2000
                        );
                        this.store.dispatch(OrigineActions.setStatusToLoaded());
                    } else {
                        const deleteEventsForCurrentOrigine = origineState.eventLog.filter(
                            (value) =>
                                value.id == origineState.currentOrigine!.id &&
                                value.rev >= origineState.currentOrigine!.rev &&
                                value.action == "delete"
                        );
                        
                        if (deleteEventsForCurrentOrigine.length >= 1) {
                            // This is the external event following our internal delete
                            debug("[ngInit](II.A) Duplicate state change for the same origine (external after internal)");
                            this.store.dispatch(OrigineActions.setStatusToLoaded());
                        } else if (
                            origineState.eventLog[origineState.eventLog.length - 1].id ==
                            origineState.currentOrigine!.id &&
                            origineState.eventLog[origineState.eventLog.length - 1].action ==
                            "delete"
                        ) {
                            debug("[ngInit](II.C) Concurrent editing on the same origine");
                            this.presentToast(
                                this.translate.instant("wine.deletedConcurrentlyOnAnotherInstance"),
                                "warning",
                                "home",
                                0,
                                "Close"
                            );
                        } else {
                            debug("[ngInit](II.B) Delete of another origine");
                        }
                    }
                    break;
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

    public saveOrigine() {
        debug("[saveOrigine]entering");
        this.submitted.set(true);
        
        if (this.origineForm.valid) {
            debug("[saveOrigine]Origine valid");
            const currentOrigine = this.currentOrigine();
            const updatedOrigine = {
                ...currentOrigine,
                ...this.origineForm.value,
            };
            this.currentOrigine.set(updatedOrigine);

            this.store.dispatch(
                OrigineActions.createOrigine({ origine: updatedOrigine })
            );
        } else {
            debug("[saveOrigine]origine invalid");
            this.presentToast(
                this.translate.instant("general.invalidData"),
                "error",
                null
            );
        }
    }

    public deleteOrigine() {
        // Check if origine is used by any wines
        const currentOrigine = this.currentOrigine();
        const wineList = this.winesForOrigine();
        const used = wineList.length > 0;
        
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
                                    OrigineActions.deleteOrigine({
                                        origine: currentOrigine,
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
