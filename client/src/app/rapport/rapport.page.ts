import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { IonHeader, IonToolbar, IonTitle, IonContent } from "@ionic/angular/standalone";

@Component({
    selector: 'app-rapport',
    templateUrl: './rapport.page.html',
    styleUrls: ['./rapport.page.scss'],
    standalone: true,
    imports: [CommonModule, TranslateModule, IonHeader, IonToolbar, IonTitle, IonContent]
})
export class RapportPage implements OnInit {

    constructor() { }

    ngOnInit() {
    }

}
