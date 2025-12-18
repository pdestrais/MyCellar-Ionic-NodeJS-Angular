import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { TranslateModule } from "@ngx-translate/core";

import { HomePage } from "./home.page";
import { IonicModule } from "@ionic/angular";

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        RouterModule.forChild([
            {
                path: "",
                component: HomePage,
            },
        ]),
        TranslateModule,
        IonicModule,
        HomePage,
    ],
    declarations: [],
})
export class HomePageModule { }
