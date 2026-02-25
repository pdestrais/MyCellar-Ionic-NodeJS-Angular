import { Component, OnInit, computed, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { TranslateModule } from "@ngx-translate/core";
import { RouterModule } from "@angular/router";
import { VinModel } from "../models/cellar.model";
import { Router } from "@angular/router";
import { VinStore } from "../services/vin-state.store";
import { IonAccordionGroup, IonRouterLink, IonHeader, IonToolbar, IonButtons, IonMenuButton, IonTitle, IonContent, IonAccordion, IonItem, IonLabel, IonList, IonIcon, IonBadge } from "@ionic/angular/standalone";

import Debugger from "debug";

const debug = Debugger("app:readytodrink");

@Component({
    selector: "app-ready-to-drink",
    templateUrl: "./ready-to-drink.page.html",
    styleUrls: ["./ready-to-drink.page.scss"],
    standalone: true,
    imports: [CommonModule, TranslateModule, RouterModule, IonRouterLink, IonHeader, IonToolbar, IonButtons, IonMenuButton, IonTitle, IonContent, IonAccordionGroup, IonAccordion, IonItem, IonLabel, IonList, IonIcon, IonBadge]
})
export class ReadyToDrinkPage implements OnInit {
    private readonly router = inject(Router);
    private readonly vinStore = inject(VinStore);

    // ============================================
    // COMPUTED STATE FROM VINSTORE
    // ============================================
    
    // Get wines by maturity category from VinStore
    readonly AlertRTDList = computed(() => this.vinStore.getWinesByMaturity('ARTD')());
    readonly RTDList = computed(() => this.vinStore.getWinesByMaturity('RTD')());
    readonly NearlyRTDList = computed(() => this.vinStore.getWinesByMaturity('NRTD')());
    readonly NotRTDList = computed(() => this.vinStore.getWinesByMaturity('NotRTD')());
    
    // Get maturity counts from VinStore
    readonly maturityCounts = this.vinStore.maturityCounts;
    readonly nbrARTD = computed(() => this.maturityCounts().ARTD);
    readonly nbrRTD = computed(() => this.maturityCounts().RTD);
    readonly nbrNearlyRTD = computed(() => this.maturityCounts().NRTD);
    readonly nbrNotRTD = computed(() => this.maturityCounts().NotRTD);

    ngOnInit() {
        debug("[ngOnInit] entering");
        // Load wines via VinStore
        this.vinStore.loadVins();
    }

    selectWine(wine: VinModel) {
        this.router.navigate(["/vin", wine._id]);
    }
}
