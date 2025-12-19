import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';

@Component({
    selector: 'app-rapport',
    templateUrl: './rapport.page.html',
    styleUrls: ['./rapport.page.scss'],
    standalone: true,
    imports: [CommonModule, IonicModule, TranslateModule]
})
export class RapportPage implements OnInit {

    constructor() { }

    ngOnInit() {
    }

}
