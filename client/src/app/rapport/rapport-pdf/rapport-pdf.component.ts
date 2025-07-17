import { Component, OnInit } from "@angular/core";
import { VinModel } from "./../../models/cellar.model";
import { PouchdbService } from "./../../services/pouchdb.service";
import { jsPDF } from "jspdf";
import * as d3 from "d3";

@Component({
    selector: "app-rapport-pdf",
    templateUrl: "./rapport-pdf.component.html",
    styleUrls: ["./rapport-pdf.component.scss"],
    standalone: false
})
export class RapportPdfComponent implements OnInit {
    private doc: jsPDF;
    private vins: Array<VinModel> = [];
    private vinsFiltered;
    private typesGrouping: Array<any> = [];
    private typesOrigineGrouping: Array<any> = [];
    private typesOrigineYearGrouping: Array<any> = [];

    constructor(private pouch: PouchdbService) {
        this.doc = new jsPDF("landscape", "cm", "a4");
    }

    ngOnInit() {
        this.cellarToPDF();
    }

    public cellarToPDF() {
        // PDF doc initialization
        var yPageMax = 20;
        var startY = 2.2;
        var y = startY;
        var pageNum = 0;

        this.pouch.getDocsOfType("vin").then((vins: VinModel[]) => {
            this.vins = vins;
            // Filter out wines with no remaining bottles as those should not be included in the report
            this.vins = this.vins.filter((w) => w.nbreBouteillesReste != 0);
            this.vins.map((v) => {
                v.origine.groupVal = v.origine.pays + " - " + v.origine.region;
                // some years are integer, some are string, we need to convert them all to string, otherwize , this cause issues for the report
                if (typeof v.annee === "number") {
                    v.annee = "" + v.annee;
                }
            });
            // sort wines by v.origine.groupVal, then by v.annee, then by v.nom
            this.vins.sort((a, b) => {
                if ((a.origine.groupVal ?? "") < (b.origine.groupVal ?? "")) {
                    return -1;
                }
                if ((a.origine.groupVal ?? "") > (b.origine.groupVal ?? "")) {
                    return 1;
                }
                // groupVal must be equal, sort by annee
                if (a.annee < b.annee) {
                    return -1;
                }
                if (a.annee > b.annee) {
                    return 1;
                }
                // annee must be equal, sort by nom
                if (a.nom < b.nom) {
                    return -1;
                }
                if (a.nom > b.nom) {
                    return 1;
                }
                // names must be equal  
                return 0;
            });

            console.log("[Rapport - cellarToPDF]#wine loaded : " + this.vins.length);
            // first report dimension is wine type
            this.typesGrouping = d3.rollup(
                this.vins,
                (v) => d3.sum(v, (d) => d.nbreBouteillesReste),
                (d) => d.type.nom
            );

            console.log(
                "[Rapport - ionViewDidLoad]typesGrouping : " +
                JSON.stringify(this.typesGrouping)
            );

            this.typesGrouping.forEach((itemTypeValue: any, itemTypeKey: any) => {
                // Page construction - Types
                pageNum++;
                y = startY;
                this.createNewPDFPageAndHeader(pageNum);
                this.doc.setLineWidth(0.05);
                this.doc.setDrawColor(0.1);
                this.doc.setFillColor("#FFFFFF");
                this.doc.rect(1, y, 28, 0.8, "DF");
                y = y + 0.5;
                console.log("Font list : " + JSON.stringify(this.doc.getFontList()));
                this.doc.setFontSize(12);
                this.doc.setTextColor(0);
                this.doc.setFont("helvetica", "bold");
                this.doc.text(itemTypeKey + " (" + itemTypeValue + ")", 1.2, y);
                y = y + 0.3;

                // second report dimension is wine origin
                this.typesOrigineGrouping = d3.rollup(
                    this.vins.filter(
                        (w) => w.type.nom == itemTypeKey
                    ),
                    (v) => d3.sum(v, (d) => d.nbreBouteillesReste),
                    (d) => d.origine.groupVal
                    /* (d) => d.origine.pays + " - " + d.origine.region */
                );

                this.typesOrigineGrouping.forEach(
                    (itemOrigineValue: any, itemOrigineKey: any) => {
                        // check if we have enough space for origine and at least one extra line bellow
                        if (y + 0.8 + 0.3 >= yPageMax) {
                            pageNum++;
                            y = startY;
                            this.createNewPDFPageAndHeader(pageNum);
                        }
                        this.doc.setLineWidth(0.02);
                        this.doc.setDrawColor(120);
                        this.doc.setFillColor("#BBBBBB");
                        this.doc.rect(1, y, 28, 0.5, "DF");
                        y = y + 0.35;
                        this.doc.setFontSize(12);
                        this.doc.setFont("helvetica", "normal");
                        this.doc.setTextColor(0);
                        this.doc.text(
                            itemOrigineKey + " (" + itemOrigineValue + ")",
                            2.2,
                            y
                        );
                        y = y + 0.25;
                        /* create year divider */
                        this.doc.setFontSize(9);
                        this.doc.setTextColor(0);
                        this.doc.setDrawColor(0);

                        // third report dimension is wine years
                        this.typesOrigineYearGrouping = d3.rollups(
                            this.vins.filter(
                                (w) =>
                                    w.type.nom == itemTypeKey &&
                                    w.origine.groupVal == itemOrigineKey
                                /* w.origine.pays + " - " + w.origine.region == itemOrigineKey */
                            ),
                            (v) => d3.sum(v, (d) => d.nbreBouteillesReste),
                            (d) => d.annee
                        );

                        // sort by year
                        this.typesOrigineYearGrouping.sort(function (a, b) {
                            if (a.key < b.key) {
                                return -1;
                            }
                            if (a.key > b.key) {
                                return 1;
                            }
                            // names must be equal
                            return 0;
                        });

                        this.typesOrigineYearGrouping.forEach(
                            (itemYearValue: any, itemYearKey: any) => {
                                this.vinsFiltered = this.vins.filter((v) => {
                                    return (
                                        v.nbreBouteillesReste != 0 &&
                                        v.type.nom == itemTypeKey &&
                                        v.origine.pays + " - " + v.origine.region ==
                                        itemOrigineKey &&
                                        v.annee == itemYearValue[0]
                                    );
                                });
                                this.vinsFiltered.forEach(
                                    (wineItem: any, iWineItem: number) => {
                                        let ytemp, ymax, c;
                                        //Compute how much space is needed for the next line to display :
                                        //- minimum 0.3 in no comment history, and only one location.
                                        //- otherwize : 0.3 * max (# of comments in history, # of locations)
                                        let commentsHistoryNbr = 0;
                                        if (wineItem.history)
                                            wineItem.history.map((value, index) => {
                                                if (
                                                    value.comment &&
                                                    value.type == "comment" &&
                                                    value.comment.trim() != ""
                                                ) {
                                                    commentsHistoryNbr++;
                                                }
                                            });
                                        let locationNbr = 0;
                                        wineItem.localisation.split("&").map((value, index) => {
                                            locationNbr++;
                                        });

                                        ymax =
                                            y + Math.max(commentsHistoryNbr, locationNbr) * 0.3 + 0.1;
                                        if (ymax >= yPageMax) {
                                            pageNum++;
                                            y = startY + 0.1;
                                            ymax =
                                                y +
                                                Math.max(commentsHistoryNbr, locationNbr) * 0.3 +
                                                0.1;
                                            this.createNewPDFPageAndHeader(pageNum);
                                            this.doc.setFontSize(9);
                                            this.doc.setTextColor(0);
                                            this.doc.setDrawColor(0);
                                        }
                                        y = y + 0.3;
                                        if (iWineItem == 0)
                                            this.doc.text(
                                                wineItem.annee + " (" + itemYearValue[1] + ")",
                                                1.2,
                                                y
                                            );
                                        this.doc.text(wineItem.nom, 3, y);
                                        this.doc.text(wineItem.appellation.courte, 11, y);
                                        this.doc.text("" + wineItem.prixAchat, 13.3, y);
                                        this.doc.text("" + wineItem.nbreBouteillesReste, 15.5, y);
                                        //Display Localisation on multiple lines if needed
                                        ytemp = y;
                                        c = 0;
                                        wineItem.localisation.split("&").map((value, index) => {
                                            ytemp = y + c * 0.3;
                                            this.doc.text(value.trim(), 17, ytemp);
                                            c++;
                                        });
                                        //this.doc.text(17,y,wineItem.localisation);
                                        //Display either a remarque (old style)
                                        wineItem.remarque
                                            ? this.doc.text(wineItem.remarque, 18.5, y)
                                            : this.doc.text("", 18.5, y);
                                        //... or a new remark created based on history ... on multiple lines
                                        ytemp = y;
                                        c = 0;
                                        if (wineItem.history)
                                            wineItem.history.map((value, index) => {
                                                if (
                                                    value.comment &&
                                                    value.type == "comment" &&
                                                    value.comment.trim() != ""
                                                ) {
                                                    ytemp = y + c * 0.3;
                                                    this.doc.text(
                                                        value.date.slice(0, 10) + ": " + value.comment,
                                                        18.5,
                                                        ytemp
                                                    );
                                                    c++;
                                                }
                                            });
                                        //y=y+0.1;
                                        y = ymax;
                                        this.doc.setLineWidth(0.02);
                                        this.doc.rect(1, y, 28, 0.0, "DF");
                                    },
                                    this
                                );
                            },
                            this
                        );
                    },
                    this
                );
            }); // = vins.map(v => v.doc))
            /* after type level */

            this.doc.setFontSize(14);
            this.doc.setTextColor(0);
            this.doc.setDrawColor(0);
            if (y + 1.2 >= yPageMax) {
                pageNum++;
                y = startY;
                this.createNewPDFPageAndHeader(pageNum);
            }
            this.doc.save("Contenu cave.pdf");
            console.log("after pdf generation");
        });
    }

    private createNewPDFPageAndHeader(pgNum) {
        if (pgNum > 1) {
            this.doc.addPage();
        }
        // adding header
        this.doc.setFontSize(18);
        this.doc.setFont("helvetica", "normal");
        let reportDate = new Date();
        this.doc.text(
            "Contenu cave le " + reportDate.toLocaleDateString("fr-FR"),
            12,
            1
        );
        this.doc.setLineWidth(0.05);
        this.doc.setDrawColor(50);
        this.doc.setFillColor("#666666");
        this.doc.rect(1, 1.3, 28, 1, "DF");
        this.doc.setFontSize(12);
        this.doc.setTextColor(255);
        this.doc.setFont("helvetica", "bold");
        this.doc.text("Année", 1.2, 1.9);
        this.doc.text("Nom", 3, 1.9);
        this.doc.text("Appellation", 10, 1.9);
        this.doc.text("Prix achat", 12.7, 1.9);
        this.doc.text("Reste", 15, 1.9);
        this.doc.text("Loc.", 16.7, 1.65);
        this.doc.text("G/D.y.x", 16.7, 2.1);
        this.doc.text("Commentaire", 18.6, 1.9);

        // adding footer
        this.doc.setLineWidth(0.05);
        this.doc.setDrawColor(50);
        this.doc.setFillColor("#666666");
        this.doc.rect(1, 20, 28, 0.0, "DF");
        this.doc.setFontSize(9);
        this.doc.setFont("helvetica", "normal");
        this.doc.setTextColor(0);
        //		doc.setFont("Verdana");
        this.doc.text(reportDate.toLocaleDateString("fr-FR"), 1, 20.3);
        this.doc.text("page " + pgNum, 27, 20.3);
    }
}
