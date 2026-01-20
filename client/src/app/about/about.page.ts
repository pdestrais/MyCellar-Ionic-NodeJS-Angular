import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { TranslateModule } from "@ngx-translate/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { environment } from "../../environments/environment";
import { IonHeader, IonToolbar, IonButtons, IonMenuButton, IonTitle, IonContent, IonCard, IonCardHeader, IonCardContent } from "@ionic/angular/standalone";

@Component({
    selector: "app-about",
    templateUrl: "./about.page.html",
    styleUrls: ["./about.page.scss"],
    standalone: true,
    imports: [CommonModule, TranslateModule, FormsModule, ReactiveFormsModule, IonHeader, IonToolbar, IonButtons, IonMenuButton, IonTitle, IonContent, IonCard, IonCardHeader, IonCardContent]
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
