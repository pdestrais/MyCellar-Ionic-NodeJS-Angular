import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { IonicModule } from "@ionic/angular";
import { TranslateModule } from "@ngx-translate/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { environment } from "../../environments/environment";

@Component({
    selector: "app-about",
    templateUrl: "./about.page.html",
    styleUrls: ["./about.page.scss"],
    standalone: true,
    imports: [CommonModule, IonicModule, TranslateModule, FormsModule, ReactiveFormsModule]
})
export class AboutPage implements OnInit {
    public appInfo: any = {
        name: "MyCellar",
        version: environment.version,
        author: "Philippe Destrais",
        ionic: environment.ionic,
        angular: environment.angular,
    };

    constructor() { }

    ngOnInit() { }
}
