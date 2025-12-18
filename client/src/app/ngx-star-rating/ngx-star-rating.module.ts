import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxStarRatingComponent } from './ngx-star-rating.component';

@NgModule({
  imports: [
    CommonModule,
    NgxStarRatingComponent,
  ],
  exports: [NgxStarRatingComponent]
})
export class NgxStarRatingModule { }
