import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Routes, RouterModule } from '@angular/router';

import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';

import { RapportPage } from './rapport.page';
import { TypesComponent } from './types/types.component';
import { YearsComponent } from './years/years.component';
import { OriginesComponent } from './origines/origines.component';
import { WinesComponent } from './wines/wines.component';
import { ElementListComponent } from './element-list/element-list.component';
import { BreadcrumbComponent } from './breadcrumb/breadcrumb.component';
import { RapportPdfComponent } from './rapport-pdf/rapport-pdf.component';

const routes: Routes = [
	{
		path: '',
		redirectTo: 'bytyo/types',
		pathMatch: 'full'
	},
	{ path: 'bytyo/types', data: { typeView: 'tyo' }, component: TypesComponent },
	{ path: 'bytoy/types', component: TypesComponent, data: { typeView: 'toy' } },
	{ path: 'type/:type/years', component: YearsComponent, data: { typeView: 'tyo' } },
	{ path: 'type/:type/year/:year/origines', component: OriginesComponent, data: { typeView: 'tyo' } },
	{ path: 'type/:type/origines', component: OriginesComponent, data: { typeView: 'toy' } },
	{ path: 'type/:type/origine/:origine/years', component: YearsComponent, data: { typeView: 'toy' } },
	{ path: 'wines/type/:type/origine/:origine/year/:year', component: WinesComponent, data: { typeView: 'toy' } },
	{ path: 'wines/type/:type/year/:year/origine/:origine', component: WinesComponent, data: { typeView: 'tyo' } },
	{ path: 'pdf', component: RapportPdfComponent }
];

@NgModule({
	imports: [ CommonModule, FormsModule, IonicModule, TranslateModule, RouterModule.forChild(routes) ],
	declarations: [
		RapportPage,
		TypesComponent,
		YearsComponent,
		OriginesComponent,
		WinesComponent,
		ElementListComponent,
		BreadcrumbComponent,
		RapportPdfComponent
	]
})
export class RapportPageModule {}
