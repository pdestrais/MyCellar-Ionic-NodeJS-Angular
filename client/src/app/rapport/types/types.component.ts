import { Component, OnInit } from "@angular/core";
import { PouchdbService } from "../../services/pouchdb.service";
import { ActivatedRoute } from "@angular/router";
import { VinModel } from "../../models/cellar.model";

import * as d3 from "d3";

import * as Debugger from "debug";
const debug = Debugger("app:rapport:types");

@Component({
  selector: "app-types",
  templateUrl: "./types.component.html",
  styleUrls: ["./types.component.scss"],
})
export class TypesComponent implements OnInit {
  public typeView: string = "";
  private wines: Array<VinModel> = [];
  public elementList: Array<any> = [];
  public elementListType: string = "";

  constructor(
    private route: ActivatedRoute,
    private pouchdbService: PouchdbService
  ) {}

  ngOnInit() {
    this.route.data.subscribe((data) => {
      this.typeView = data["typeView"];
    });
    this.pouchdbService.getDocsOfType("vin").then((docs) => {
      this.wines = docs;
      this.elementListType = "type";

      this.elementList = d3.rollups(
        this.wines.filter((w) => w.nbreBouteillesReste != 0),
        (v) => d3.sum(v, (d) => d.nbreBouteillesReste),
        (d) => d.type.nom
      );
      this.elementList = this.elementList.map((el) => {
        return { key: el[0], value: el[1] };
      });
      console.log(
        "[types component]elementList : " + JSON.stringify(this.elementList)
      );
      /* 			this.elementList = d3
				.nest()
				.key(function(d: any) {
					return d.type.nom;
				})
				.rollup(function(v) {
					return d3.sum(v, function(d: any) {
						return d.nbreBouteillesReste;
					});
				})
				.entries(this.wines.filter((w) => w.nbreBouteillesReste != 0));
 */
    });
  }
}
