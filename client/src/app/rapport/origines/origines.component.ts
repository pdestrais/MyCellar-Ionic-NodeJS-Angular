import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { IonicModule } from "@ionic/angular";
import { TranslateModule } from "@ngx-translate/core";
import { BreadcrumbComponent } from "../breadcrumb/breadcrumb.component";
import { ElementListComponent } from "../element-list/element-list.component";
import { PouchdbService } from "../../services/pouchdb.service";
import { ActivatedRoute } from "@angular/router";
import { VinModel } from "../../models/cellar.model";

import * as d3 from "d3";

import Debugger from "debug";
const debug = Debugger("app:rapport:years");

@Component({
    selector: "app-origines",
    templateUrl: "./origines.component.html",
    styleUrls: ["./origines.component.scss"],
    standalone: true,
    imports: [CommonModule, IonicModule, TranslateModule, BreadcrumbComponent, ElementListComponent]
})
export class OriginesComponent implements OnInit {
    public typeView: string = "";
    private wines: Array<VinModel> = [];
    public elementList: Array<any> = [];
    private elementListType: string = "";
    public type: string = "";
    public year: string = "";
    public breadcrumb: Array<any> = [];

    constructor(
        private route: ActivatedRoute,
        private pouchdbService: PouchdbService
    ) { }

    ngOnInit() {
        // route data is static for this activated route; read snapshot instead of subscribing
        this.typeView = this.route.snapshot.data["typeView"];
        this.type = this.route.snapshot.paramMap.get("type")!;
        this.year = this.route.snapshot.paramMap.get("year")!;
        // fectch breadcrumb
        this.breadcrumb = JSON.parse(sessionStorage.getItem("breadcrumb")!);

        this.pouchdbService.getDocsOfType("vin").then((docs) => {
            this.wines = docs;
            this.wines.map((v) => {
                v.origine.groupVal = v.origine.pays + " - " + v.origine.region;
            });

            this.elementListType = "origine";
            if (this.year) {
                // we have the type and the year
                this.elementList = d3
                    .rollups(
                        this.wines.filter(
                            (w) =>
                                w.nbreBouteillesReste != 0 &&
                                w.type.nom == this.type &&
                                w.annee == this.year
                        ),
                        (v) => d3.sum(v, (d) => d.nbreBouteillesReste),
                        (d) => d.origine.groupVal
                        /* (d) => d.origine.pays + " - " + d.origine.region */
                    )
                    .map((el) => {
                        return { key: el[0], value: el[1] };
                    });

                /* 				this.elementList = d3
                            .nest()
                            .key(function(d: any) {
                                return d.origine.pays + ' - ' + d.origine.region;
                            })
                            .rollup(function(v) {
                                return d3.sum(v, function(d: any) {
                                    return d.nbreBouteillesReste;
                                });
                            })
                            .entries(
                                this.wines.filter(
                                    (w) => w.nbreBouteillesReste != 0 && w.type.nom == this.type && w.annee == this.year
                                )
                            );
         */
                debug(
                    "elementList (type & year selected): " +
                    JSON.stringify(this.elementList)
                );
            } else {
                // we only have the type
                this.elementList = d3
                    .rollups(
                        this.wines.filter(
                            (w) => w.nbreBouteillesReste != 0 && w.type.nom == this.type
                        ),
                        (v) => d3.sum(v, (d) => d.nbreBouteillesReste),
                        (d) => d.origine.groupVal
                        /* (d) => d.origine.pays + " - " + d.origine.region */
                    )
                    .map((el) => {
                        return { key: el[0], value: el[1] };
                    });

                /* 				  this.elementList = d3
                            .nest()
                            .key(function(d: any) {
                                return d.origine.pays + ' - ' + d.origine.region;
                            })
                            .rollup(function(v) {
                                return d3.sum(v, function(d: any) {
                                    return d.nbreBouteillesReste;
                                });
                            })
                            .entries(this.wines.filter((w) => w.nbreBouteillesReste != 0 && w.type.nom == this.type));
         */
                debug(
                    "elementList (type selected): " + JSON.stringify(this.elementList)
                );
            }
            this.elementList.sort((a, b) => {
                return a.key < b.key ? -1 : 1;
            });
        });
    }
}
