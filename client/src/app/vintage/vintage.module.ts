import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Routes, RouterModule } from "@angular/router";
import { TranslateModule } from "@ngx-translate/core";
import { IonicModule } from "@ionic/angular";

import { VintageComponent } from "./vintage.component";

const routes: Routes = [
  {
    path: "",
    component: VintageComponent,
  },
];

@NgModule({
  declarations: [VintageComponent],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    TranslateModule,
    IonicModule,
  ],
})
export class VintageModule {}
