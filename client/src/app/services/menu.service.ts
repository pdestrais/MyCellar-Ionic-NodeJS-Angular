import { UserModel } from './../models/cellar.model';
import { SideMenuOption } from './../multi-level-side-menu/models/side-menu-option';
import { AuthenticationService } from './auth.service';
import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Injectable({ providedIn: 'root' })
export class MenuService {
	private currentUser: UserModel;
	private options: Array<SideMenuOption>;

	constructor(private authenticationService: AuthenticationService, private translate: TranslateService) {
		this.authenticationService.currentUser.subscribe((x) => {
			this.currentUser = x;
		});
	}
	public initializeOptions(): Array<SideMenuOption> {
		this.options = new Array<SideMenuOption>();
		let username = '';
		if (this.currentUser) {
			username = this.currentUser.username;
		}
		this.options = [
			{
				displayText: this.translate.instant('page.search'),
				route: [ '' ],
				iconSrc: './assets/imgs/search.svg'
			},
			{
				displayText: this.translate.instant('page.wine'),
				route: [ '/vin' ],
				iconSrc: './assets/imgs/vin_verre.svg'
			},
			{
				displayText: this.translate.instant('page.region'),
				route: [ '/regions' ],
				iconSrc: './assets/imgs/region.svg'
			},
			{
				displayText: this.translate.instant('page.appellation'),
				route: [ '/appellations' ],
				iconSrc: './assets/imgs/appellation.svg'
			},
			{
				displayText: this.translate.instant('page.type'),
				route: [ '/types' ],
				iconSrc: './assets/imgs/wine_type.svg'
			},
			{
				displayText: this.translate.instant('page.report'),
				suboptions: [
					{
						displayText: this.translate.instant('report.yearlyReport'),
						route: [ '/rapport/bytyo/types' ],
						iconSrc: './assets/imgs/rapport.svg'
					},
					{
						displayText: this.translate.instant('report.typeReport'),
						route: [ '/rapport/bytoy/types' ],
						iconSrc: './assets/imgs/rapport.svg'
					},
					{
						displayText: this.translate.instant('report.readyToDrink'),
						route: [ '/readytodrink' ],
						iconSrc: './assets/imgs/rapport.svg'
					},
					{
						displayText: this.translate.instant('page.report') + 'PDF',
						route: [ '/rapport/pdf' ],
						iconSrc: './assets/imgs/rapportpdf.svg'
					}
				]
			},
			{
				displayText: this.translate.instant('page.stats'),
				route: [ '/stats' ],
				iconSrc: './assets/imgs/statistics.svg'
			},
			{
				displayText: this.translate.instant('page.config'),
				route: [ '/preferences' ],
				iconSrc: './assets/imgs/settings.svg'
			},
			{
				displayText: this.translate.instant('page.profile'),
				route: [ '/user-management' ],
				iconSrc: './assets/imgs/user.svg'
			},
			{
				displayText: this.translate.instant('page.about'),
				route: [ '/about' ],
				iconSrc: './assets/imgs/about.svg'
			},
			{
				displayText:
					/* 					this.translate.instant('page.logout') + ' (' + this.currentUser
						? this.currentUser.username
						: 'undefined' + ')',
 */
					this.translate.instant('page.logout') + ' (' + username + ')',
				custom: 'logout',
				iconSrc: './assets/imgs/logout.svg'
			}
		];
		if (this.currentUser && this.currentUser != null && this.currentUser.admin)
			this.options.splice(this.options.length - 2, 0, {
				displayText: this.translate.instant('page.register'),
				route: [ '/register' ],
				iconSrc: './assets/imgs/sign-in.svg'
			});
		return this.options;
	}
}
