import { Component, OnInit } from "@angular/core";
import { PouchdbService } from "../../services/pouchdb.service";
import { ActivatedRoute, Router } from "@angular/router";
import { VinModel } from "../../models/cellar.model";

import * as d3 from "d3";

import * as Debugger from "debug";
const debug = Debugger("app:rapport:wines");

@Component({
    selector: "app-wines",
    templateUrl: "./wines.component.html",
    styleUrls: ["./wines.component.scss"],
})
export class WinesComponent implements OnInit {
    private typeView: string = "";
    private wines: Array<VinModel> = [];
    public filteredWines: Array<VinModel> = [];
    private type: string = "";
    private year: string = "";
    private origine: string = "";
    public breadcrumb: Array<any> = [];

    constructor(
        private router: Router,
        private route: ActivatedRoute,
        private pouchdbService: PouchdbService
    ) { }

    ngOnInit() {
        this.route.data.subscribe((data) => {
            this.typeView = data["typeView"];
        });
        this.type = this.route.snapshot.paramMap.get("type")!;
        this.year = this.route.snapshot.paramMap.get("year")!;
        this.origine = this.route.snapshot.paramMap.get("origine")!;
        // fectch breadcrumb
        this.breadcrumb = JSON.parse(sessionStorage.getItem("breadcrumb")!);

        this.pouchdbService.getDocsOfType("vin").then((docs) => {
            this.wines = docs;
            this.filteredWines = this.wines.filter(
                (v) =>
                    v.nbreBouteillesReste != 0 &&
                    v.type.nom == this.type &&
                    v.origine.pays + " - " + v.origine.region == this.origine &&
                    v.annee == this.year
            );
            this.filteredWines.sort((a, b) => {
                return a.nom < b.nom ? -1 : 1;
            });
        });
    }

    selectWine(wine) {
        //    this.navCtrl.setRoot(VinPage,{id:wine._id});
        this.router.navigateByUrl("/vin/" + wine._id);
    }
}
