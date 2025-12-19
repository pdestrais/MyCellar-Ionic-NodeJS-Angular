import { Component, OnInit, ViewChild } from "@angular/core";
import { CommonModule } from "@angular/common";
import { IonicModule } from "@ionic/angular";
import { TranslateModule } from "@ngx-translate/core";
import { RouterModule } from "@angular/router";
import { PouchdbService } from "../services/pouchdb.service";
import { VinModel } from "../models/cellar.model";
import dayjs from "dayjs";
import { Router } from "@angular/router";
import { IonAccordionGroup } from "@ionic/angular/standalone";

import Debugger from "debug";
import { IonRouterLink } from "@ionic/angular/standalone";

const debug = Debugger("app:readytodrink");

@Component({
    selector: "app-ready-to-drink",
    templateUrl: "./ready-to-drink.page.html",
    styleUrls: ["./ready-to-drink.page.scss"],
    standalone: true,
    imports: [CommonModule, IonicModule, TranslateModule, RouterModule]
})
export class ReadyToDrinkPage implements OnInit {
    public wines: Array<VinModel> = [];
    public readyToDrinkList: Array<VinModel> = [];
    public RTDList: Array<VinModel> = [];
    public NotRTDList: Array<VinModel> = [];
    public NearlyRTDList: Array<VinModel> = [];
    public AlertRTDList: Array<VinModel> = [];
    public nbrARTD: number = 0;
    public nbrRTD: number = 0;
    public nbrNearlyRTD: number = 0;
    public nbrNotRTD: number = 0;

    // @ViewChild(IonAccordionGroup, { static: true })
    // accordionGroup: IonAccordionGroup;

    constructor(private router: Router, private PouchdbService: PouchdbService) { }

    ngOnInit() {
        debug("[ngOnInit]entering");
        this.getAllWines();
    }

    getAllWines() {
        this.PouchdbService.getDocsOfType("vin")
            .then((data) => {
                this.wines = data;
                let now = dayjs();
                //debug('[getAllWines] all wines loaded into component ' + JSON.stringify(this.wines));
                this.wines.forEach((v: any) => {
                    if (v.apogee && v.nbreBouteillesReste > 0) {
                        let drinkFromTo = v.apogee.split("-");
                        v.apogeeTo = drinkFromTo[1];
                        v.apogeeFrom = drinkFromTo[0];
                        /* apogee :                 FROM-2          FROM            TO            */
                        /*             <----NotRTD ---|--NearlyRTD---|-----RTD------|----ARTD---> */
                        if (now.year() - v.apogeeTo >= 0) {
                            this.nbrARTD++;
                            this.AlertRTDList.push(v);
                        } else if (now.year() <= v.apogeeTo && now.year() > v.apogeeFrom) {
                            this.nbrRTD++;
                            this.RTDList.push(v);
                        } else if (
                            now.year() > v.apogeeFrom - 2 &&
                            now.year() <= v.apogeeFrom
                        ) {
                            this.nbrNearlyRTD++;
                            this.NearlyRTDList.push(v);
                        } else {
                            this.nbrNotRTD++;
                            this.NotRTDList.push(v);
                        }
                    }
                });
                this.AlertRTDList.sort((a: any, b: any) => a.apogeeTo - b.apogeeTo);
                this.RTDList.sort((a: any, b: any) => a.apogeeTo - b.apogeeTo);
                this.NearlyRTDList.sort((a: any, b: any) => a.apogeeTo - b.apogeeTo);
                this.NotRTDList.sort((a: any, b: any) => a.apogeeTo - b.apogeeTo);
            })
            .catch((error) => {
                console.error(
                    "[getAllWines]problem to load vins - error : " + JSON.stringify(error)
                );
            });
    }

    selectWine(wine) {
        this.router.navigate(["/vin", wine._id]);
    }
}
