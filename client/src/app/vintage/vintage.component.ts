import { Component, OnInit } from "@angular/core";
import vintageData from "../../assets/data/vintage-table.json";

@Component({
    selector: "app-vintage",
    templateUrl: "./vintage.component.html",
    styleUrls: ["./vintage.component.scss"],
    standalone: false
})
export class VintageComponent implements OnInit {
    public appellationList: Array<string> = [];
    public appellationDetails: any = {};
    private lang: string = "en";

    constructor() { }

    ngOnInit() {
        console.log("[entering vintage component");
        this.lang = window.localStorage.getItem("myCellar.language") || "en";
        vintageData.forEach((row) => {
            this.appellationList.push(row.wineType[this.lang]);
        });
    }

    appellationSelected($event) {
        this.appellationDetails = vintageData.filter(
            (row) => row.wineType[this.lang] == $event.target.value
        )[0];
        this.appellationDetails.ratings.forEach((rating) => {
            switch (rating.maturityStatus) {
                case "H":
                    rating.image = "assets/icons/NotRTD.png";
                    break;
                case "NAP":
                    rating.image = "assets/icons/NRTD.png";
                    break;
                case "AP":
                    rating.image = "assets/icons/RTD.png";
                    break;
                case "PP":
                    rating.image = "assets/icons/PastPeak.svg";
                    break;
            }
        });
        console.log(
            "selected appellation : " + JSON.stringify(this.appellationDetails)
        );
    }
}
