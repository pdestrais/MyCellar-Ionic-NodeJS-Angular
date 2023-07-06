import { PreferencesPage } from "./preferences/preferences.page";
import { MenuService } from "./services/menu.service";
import { PouchdbService } from "./services/pouchdb.service";
import { Component } from "@angular/core";

import { Platform, MenuController } from "@ionic/angular";
import { SwUpdate, VersionReadyEvent } from "@angular/service-worker";
import { filter, map } from "rxjs/operators";
import { Router } from "@angular/router";
import { TranslateService } from "@ngx-translate/core";
import { timeout } from "q";

import { SideMenuSettings } from "./multi-level-side-menu/models/side-menu-settings";
import { SideMenuOption } from "./multi-level-side-menu/models/side-menu-option";
import { MultiLevelSideMenuComponent } from "./multi-level-side-menu/multi-level-side-menu.component";

import { AuthenticationService } from "./services/auth.service";
import { UserModel } from "./models/cellar.model";

import * as Debugger from "debug";
const debug = Debugger("app:root");

@Component({
  selector: "app-root",
  templateUrl: "app.component.html",
  styleUrls: ["./app.component.scss"],
})
export class AppComponent {
  public appMenuItems: Array<any>;

  // Options to show in the SideMenuContentComponent
  public options: Array<SideMenuOption>;

  // Settings for the SideMenuContentComponent
  public sideMenuSettings: SideMenuSettings = {
    accordionMode: true,
    showSelectedOption: true,
    selectedOptionClass: "active-side-menu-option",
  };
  public currentUser: UserModel;

  constructor(
    private platform: Platform,
    private translate: TranslateService,
    private router: Router,
    private menuCtrl: MenuController,
    private authenticationService: AuthenticationService,
    private translateService: TranslateService,
    private menuService: MenuService,
    private swUpdate: SwUpdate
  ) {
    console.log("Detecting application updates");
    swUpdate.versionUpdates
      .pipe(
        filter((evt): evt is VersionReadyEvent => evt.type === "VERSION_READY")
      )
      .subscribe((evt) => {
        if (confirm("A new version is available. Would you like to update?")) {
          // Reload the page to update to the latest version.
          console.log("reloading application");
          document.location.reload();
        }
      });
    this.initializeApp();
    this.authenticationService.currentUser.subscribe((x) => {
      this.currentUser = x;
      if (x == null) {
        debug("[login / logout subscriber]user just logged out");
        this.router.navigate(["/login"]);
      } else {
        this.options = this.menuService.initializeOptions();
      }
    });
    this.translateService.onLangChange.subscribe((event) => {
      debug("[preference changes]regenerating menu");
      this.options = this.menuService.initializeOptions();
    });
  }

  initializeApp() {
    this.platform.ready().then(() => {
      let lang = window.localStorage.getItem("myCellar.language");
      if (lang) this.translate.setDefaultLang(lang);
      else {
        this.translate.setDefaultLang("en");
        window.localStorage.setItem("myCellar.language", "en");
      }
      window.setTimeout(() => {
        this.options = this.menuService.initializeOptions();
      }, 500);
    });
  }

  public onOptionSelected(option: SideMenuOption): void {
    if (option.custom == "logout") this.authenticationService.logout();
    else
      this.menuCtrl
        .close()
        .then((result) => this.router.navigate(option.route));

    /* 		this.menuCtrl.close().then(() => {
			if (option.custom && option.custom.isLogin) {
				this.presentAlert('You\'ve clicked the login option!');
			} else if (option.custom && option.custom.isLogout) {
				this.presentAlert('You\'ve clicked the logout option!');
			} else if (option.custom && option.custom.isExternalLink) {
				let url = option.custom.externalUrl;
				window.open(url, '_blank');
			} else {
				// Get the params if any
				const params = option.custom && option.custom.param;

				// Redirect to the selected page
				this.navCtrl.setRoot(option.component, params);
			}
		});
 */
  }
}
