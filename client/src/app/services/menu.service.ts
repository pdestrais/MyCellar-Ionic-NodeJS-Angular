import { UserModel } from "./../models/cellar.model";
import { SideMenuOption } from "./../multi-level-side-menu/models/side-menu-option";
import { AuthenticationService } from "./auth.service";
import { Injectable } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";

@Injectable({ providedIn: "root" })
export class MenuService {
  private currentUser!: UserModel | null;
  private options: Array<SideMenuOption> = [];

  constructor(
    private authenticationService: AuthenticationService,
    private translate: TranslateService
  ) {
    // read current user via signal when needed; avoid manual subscription here
  }
  public initializeOptions(): Array<SideMenuOption> {
    this.options = new Array<SideMenuOption>();
    const user = this.authenticationService.currentUserSignal();
    let username = "";
    if (user) {
      username = user.username;
    }
    this.options = [
      {
        displayText: this.translate.instant("page.search"),
        route: [""],
        iconSrc: "./assets/icons/search.svg",
      },
      {
        displayText: this.translate.instant("page.wine"),
        route: ["/vin"],
        iconSrc: "./assets/icons/vin_verre.svg",
      },
      {
        displayText: this.translate.instant("page.region"),
        route: ["/regions"],
        iconSrc: "./assets/icons/region.svg",
      },
      {
        displayText: this.translate.instant("page.appellation"),
        route: ["/appellations"],
        iconSrc: "./assets/icons/appellation.svg",
      },
      {
        displayText: this.translate.instant("page.type"),
        route: ["/types"],
        iconSrc: "./assets/icons/wine_type.svg",
      },
      {
        displayText: this.translate.instant("page.report"),
        suboptions: [
          {
            displayText: this.translate.instant("report.yearlyReport"),
            route: ["/rapport/bytyo/types"],
            iconSrc: "./assets/icons/rapport.svg",
          },
          {
            displayText: this.translate.instant("report.typeReport"),
            route: ["/rapport/bytoy/types"],
            iconSrc: "./assets/icons/rapport.svg",
          },
          {
            displayText: this.translate.instant(
              "report.readyForDrinkingHeader"
            ),
            route: ["/readytodrink"],
            iconSrc: "./assets/icons/rapport.svg",
          },
          {
            displayText: this.translate.instant("page.report") + " (PDF)",
            route: ["/rapport/pdf"],
            iconSrc: "./assets/icons/rapportpdf.svg",
          },
        ],
      },
      {
        displayText: this.translate.instant("page.stats"),
        route: ["/stats"],
        iconSrc: "./assets/icons/statistics.svg",
      },
      {
        displayText: this.translate.instant("page.vintage"),
        route: ["/vintage"],
        iconSrc: "./assets/icons/vintage.svg",
      },
      {
        displayText: this.translate.instant("page.config"),
        route: ["/preferences"],
        iconSrc: "./assets/icons/settings.svg",
      },
      {
        displayText: this.translate.instant("page.profile"),
        route: ["/user-management"],
        iconSrc: "./assets/icons/user.svg",
      },
      {
        displayText: this.translate.instant("page.about"),
        route: ["/about"],
        iconSrc: "./assets/icons/about.svg",
      },
      {
        displayText:
          /* 					this.translate.instant('page.logout') + ' (' + this.currentUser
						? this.currentUser.username
						: 'undefined' + ')',
 */
          this.translate.instant("page.logout") + " (" + username + ")",
        custom: "logout",
        iconSrc: "./assets/icons/logout.svg",
      },
    ];
    if (user && user.admin)
      this.options.splice(this.options.length - 2, 0, {
        displayText: this.translate.instant("page.register"),
        route: ["/register"],
        iconSrc: "./assets/icons/sign-in.svg",
      });
    return this.options;
  }
}
