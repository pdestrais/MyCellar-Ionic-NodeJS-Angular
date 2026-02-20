import { TranslateService } from "@ngx-translate/core";
import { Component, OnInit, effect, signal, computed, inject, DestroyRef } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { NavController, AlertController, IonHeader, IonToolbar, IonButtons, IonMenuButton, IonTitle, IonContent, IonList, IonItem, IonIcon, IonButton, IonLabel, IonInput } from "@ionic/angular/standalone";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { AppellationModel, VinModel } from "../models/cellar.model";
import { ToastController } from "@ionic/angular/standalone";
import { ActivatedRoute } from "@angular/router";
import { CommonModule } from "@angular/common";
import { ReactiveFormsModule, FormsModule } from "@angular/forms";
import { TranslateModule } from "@ngx-translate/core";
import { RouterModule } from "@angular/router";

import Debugger from "debug";
import { Store } from "@ngrx/store";
import * as VinSelectors from "../state/vin/vin.selectors";
import * as AppellationActions from "../state/appellation/appellation.actions";
import { AppState } from "../state/app.state";
import { AppellationStore } from "../services/appellation-state.store";

import { replacer } from "../util/util";
import { addIcons } from "ionicons";
import { caretForwardOutline } from "ionicons/icons";

const debug = Debugger("app:appellation");

@Component({
    selector: "app-appellation",
    templateUrl: "./appellation.page.html",
    styleUrls: ["./appellation.page.scss"],
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        FormsModule,
        TranslateModule,
        RouterModule,
        IonHeader,
        IonToolbar,
        IonButtons,
        IonMenuButton,
        IonTitle,
        IonContent,
        IonList,
        IonItem,
        IonIcon,
        IonButton,
        IonLabel,
        IonInput
    ]
})
export class AppellationPage implements OnInit {
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
    private readonly appellationStore = inject(AppellationStore);
    private readonly destroyRef = inject(DestroyRef);

    // ============================================
    // COMPONENT STATE (Signals)
    // ============================================
    // Current appellation being edited - as a signal
    readonly currentAppellation = signal<AppellationModel>(new AppellationModel({
        _id: "",
        courte: "",
        longue: "",
    }));

    // Get appellations list from AppellationStore
    readonly appellations = this.appellationStore.appellationsList;
    
    // Get duplicate map from AppellationStore
    readonly appellationsMap = this.appellationStore.appellationMapForDuplicates;

    // Wines for this appellation - using a writable signal updated by effect
    private readonly _winesForAppellation = signal<VinModel[]>([]);
    readonly winesForAppellation = this._winesForAppellation.asReadonly();

    public submitted = signal<boolean>(false);
    public appellationForm!: FormGroup;
    public list = signal<boolean>(true);
    public showWines = signal<boolean>(false);

    // Route parameter as signal
    private readonly routeParams = toSignal(this.route.params);
    readonly appellationId = computed(() => this.routeParams()?.["id"] || null);

    constructor() {
        addIcons({ caretForwardOutline });

        // Effect: Load wines for the selected appellation
        effect(() => {
            const id = this.appellationId();
            if (!id) {
                this._winesForAppellation.set([]);
                return;
            }
            
            // Subscribe to wines for this appellation
            this.store.select(VinSelectors.getWinesByAppellation(id))
                .pipe(takeUntilDestroyed(this.destroyRef))
                .subscribe(wines => {
                    this._winesForAppellation.set(wines || []);
                });
        });

        // Effect: Load selected appellation when appellationId changes
        effect(() => {
            const id = this.appellationId();
            debug("[Effect:appellationId] Appellation ID changed:", id);

            if (id) {
                // Get appellation from store
                const appellationSignal = this.appellationStore.getAppellationById(id);
                const appellation = appellationSignal();
                
                if (appellation) {
                    this.list.set(false);
                    this.currentAppellation.set(appellation);

                    // Reset Appellation state to avoid shadow UI messages
                    this.store.dispatch(
                        AppellationActions.editAppellation({
                            id: appellation._id,
                            rev: appellation._rev,
                        })
                    );
                    this.appellationForm.get("courte")!.setValue(appellation.courte);
                    this.appellationForm.get("longue")!.setValue(appellation.longue);
                    debug("[ngOnInit]Appellation loaded : " + JSON.stringify(appellation));
                }
            } else {
                // No appellation selected, creating new appellation
                // Reset to empty appellation for new creation
                this.currentAppellation.set(new AppellationModel({
                    _id: "",
                    courte: "",
                    longue: "",
                }));
                this.store.dispatch(
                    AppellationActions.editAppellation({ id: "", rev: "" })
                );
            }
        }, { allowSignalWrites: true });

        // Effect: Handle state changes from NgRx (for save/delete operations)
        const appellationStateSignal = toSignal(this.store.select((state: AppState) => state.appellations));
        effect(() => {
            const appellationState = appellationStateSignal();
            if (!appellationState) return;
            
            switch (appellationState.status) {
                case "saved":
                    debug(
                        "[ngOnInit] handling change to 'saved' status - ts " +
                        window.performance.now() +
                        "\nappellationState : " +
                        JSON.stringify(appellationState, replacer)
                    );

                    if (appellationState.source == "internal") {
                        debug("[ngInit](I) Standard appellation saved");
                        this.presentToast(
                            this.translate.instant("general.dataSaved"),
                            "success",
                            "home",
                            2000
                        );
                        this.store.dispatch(AppellationActions.setStatusToLoaded());
                    } else {
                        let filteredEventLog = appellationState.eventLog.filter(
                            (value) =>
                                value.id == appellationState.currentAppellation!.id &&
                                value.rev == appellationState.currentAppellation!.rev &&
                                value.action == "create"
                        );
                        debug(
                            "[ngInit](II) FilteredEventLog : " +
                            JSON.stringify(filteredEventLog)
                        );
                        
                        if (filteredEventLog.length == 2) {
                            debug(
                                "[ngInit](II.A) Duplicate state change for the same appellation"
                            );
                            this.store.dispatch(AppellationActions.setStatusToLoaded());
                        } else if (
                            appellationState.eventLog[appellationState.eventLog.length - 1]
                                .id == appellationState.currentAppellation!.id &&
                            appellationState.eventLog[appellationState.eventLog.length - 1]
                                .rev == appellationState.currentAppellation!.rev &&
                            appellationState.eventLog[appellationState.eventLog.length - 1]
                                .action == "create" &&
                            this.appellationForm.dirty
                        ) {
                            debug("[ngInit](II.C) Concurrent editing on the same appellation");
                            this.presentToast(
                                this.translate.instant(
                                    "wine.savedConcurrentlyOnAnotherInstance"
                                ),
                                "warning",
                                "",
                                0,
                                "Close"
                            );
                        } else {
                            debug("[ngInit](II.B) Update of another appellation");
                        }
                    }
                    break;
                    
                case "error":
                    this.presentToast(
                        this.translate.instant("general.DBError") +
                        " " +
                        appellationState.error,
                        "error",
                        null,
                        5000
                    );
                    break;
                    
                case "deleted":
                    if (appellationState.source == "internal") {
                        debug("[ngInit](I) Standard appellation deleted");
                        this.presentToast(
                            this.translate.instant("wine.wineDeleted"),
                            "success",
                            "home",
                            2000
                        );
                        this.store.dispatch(AppellationActions.setStatusToLoaded());
                    } else {
                        const deleteEventsForCurrentAppellation = appellationState.eventLog.filter(
                            (value) =>
                                value.id == appellationState.currentAppellation!.id &&
                                value.rev >= appellationState.currentAppellation!.rev &&
                                value.action == "delete"
                        );
                        
                        if (deleteEventsForCurrentAppellation.length >= 1) {
                            // This is the external event following our internal delete
                            debug(
                                "[ngInit](II.A) Duplicate state change for the same appellation (external after internal)"
                            );
                            this.store.dispatch(AppellationActions.setStatusToLoaded());
                        } else if (
                            appellationState.eventLog[appellationState.eventLog.length - 1]
                                .id == appellationState.currentAppellation!.id &&
                            appellationState.eventLog[appellationState.eventLog.length - 1]
                                .action == "delete"
                        ) {
                            debug("[ngInit](II.C) Concurrent editing on the same appellation");
                            this.presentToast(
                                this.translate.instant(
                                    "wine.deletedConcurrentlyOnAnotherInstance"
                                ),
                                "warning",
                                "home",
                                0,
                                "Close"
                            );
                        } else {
                            debug("[ngInit](II.B) Delete of another appellation");
                        }
                    }
                    break;
            }
        }, { allowSignalWrites: true });
    }

    public ngOnInit() {
        debug("[ngOnInit]called");
        
        // form initialization
        this.appellationForm = this.formBuilder.group(
            {
                courte: ["", Validators.required],
                longue: ["", Validators.required],
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
            !group.controls["courte"] ||
            !group.controls["longue"] ||
            !group.controls["courte"].dirty ||
            !group.controls["longue"].dirty
        )
            return null;
        
        const appellationsMap = this.appellationsMap();
        if (
            appellationsMap &&
            appellationsMap.has(group.value.courte + group.value.longue)
        ) {
            debug("[noDouble]double detected");
            return { double: true };
        } else return null;
    }

    public editAppellation(appellation: AppellationModel | null) {
        if (appellation && appellation._id)
            this.navCtrl.navigateForward(["/appellation", appellation._id]);
        else this.navCtrl.navigateForward(["/appellation"]);
    }

    public saveAppellation() {
        debug("[saveAppellation]entering");
        this.submitted.set(true);
        
        if (this.appellationForm.valid) {
            debug("[saveAppellation]Appellation valid");
            const currentAppellation = this.currentAppellation();
            const updatedAppellation = {
                ...currentAppellation,
                ...this.appellationForm.value,
            };
            this.currentAppellation.set(updatedAppellation);

            this.store.dispatch(
                AppellationActions.createAppellation({ appellation: updatedAppellation })
            );
        } else {
            debug("[saveAppellation]appellation invalid");
            this.presentToast(
                this.translate.instant("general.invalidData"),
                "error",
                null
            );
        }
    }

    public deleteAppellation() {
        // Check if appellation is used by any wines
        const currentAppellation = this.currentAppellation();
        const wineList = this.winesForAppellation();
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
                                    AppellationActions.deleteAppellation({
                                        appellation: currentAppellation,
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
                this.translate.instant("appellation.cantDeleteBecauseUsed"),
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
