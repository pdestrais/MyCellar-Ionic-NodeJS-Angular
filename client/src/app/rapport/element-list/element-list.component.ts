import { Component, OnInit, Input } from '@angular/core';
import { Router } from '@angular/router';

@Component({
	selector: 'app-element-list',
	templateUrl: './element-list.component.html',
	styleUrls: [ './element-list.component.scss' ]
})
export class ElementListComponent implements OnInit {
	@Input() elementList: Array<any>;
	@Input() typeView: string;
	@Input() elementType: string;
	@Input() preSelectedType: string;
	@Input() preSelectedYear: string;
	@Input() preSelectedOrigine: string;

	constructor(private router: Router) {}

	ngOnInit() {
		console.log('elementList : ' + this.elementList);
	}

	selectItem(key, value) {
		switch (this.elementType) {
			case 'type':
				sessionStorage.clear();
				if (this.typeView == 'toy') {
					let bcType = [ { key: key, value: value, backUrlTree: [ '/rapport/bytoy/types' ] } ];
					sessionStorage.setItem('breadcrumb', JSON.stringify(bcType));

					this.router.navigate([ '/rapport/type', key, 'origines' ]);
				} else {
					let bcType = [ { key: key, value: value, backUrlTree: [ '/rapport/bytyo/types' ] } ];
					sessionStorage.setItem('breadcrumb', JSON.stringify(bcType));
					this.router.navigate([ '/rapport/type', key, 'years' ]);
				}
				break;
			case 'year':
				let bcYear = JSON.parse(sessionStorage.getItem('breadcrumb'));
				if (this.typeView == 'toy') {
					bcYear.push({
						key: key,
						value: value,
						backUrlTree: [
							'/rapport/type',
							this.preSelectedType,
							'origine',
							this.preSelectedOrigine,
							'years'
						]
					});
					sessionStorage.setItem('breadcrumb', JSON.stringify(bcYear));
					this.router.navigate([
						'/rapport/wines/type',
						this.preSelectedType,
						'origine',
						this.preSelectedOrigine,
						'year',
						key
					]);
				} else {
					bcYear.push({
						key: key,
						value: value,
						backUrlTree: [ '/rapport', 'type', this.preSelectedType, 'years' ]
					});
					sessionStorage.setItem('breadcrumb', JSON.stringify(bcYear));
					this.router.navigate([ '/rapport/type/', this.preSelectedType, 'year', key, 'origines' ]);
				}
				break;
			case 'origine':
				let bcOrigine = JSON.parse(sessionStorage.getItem('breadcrumb'));

				if (this.typeView == 'toy') {
					bcOrigine.push({
						key: key,
						value: value,
						backUrlTree: [ '/rapport', 'type', this.preSelectedType, 'origines' ]
					});
					sessionStorage.setItem('breadcrumb', JSON.stringify(bcOrigine));
					this.router.navigate([ '/rapport/type', this.preSelectedType, 'origine', key, 'years' ]);
				} else {
					bcOrigine.push({
						key: key,
						value: value,
						backUrlTree: [ '/rapport/type', this.preSelectedType, 'year', this.preSelectedYear, 'origines' ]
					});
					sessionStorage.setItem('breadcrumb', JSON.stringify(bcOrigine));
					this.router.navigate([
						'/rapport/wines/type',
						this.preSelectedType,
						'year',
						this.preSelectedYear,
						'origine',
						key
					]);
				}

				break;
		}
	}
}
