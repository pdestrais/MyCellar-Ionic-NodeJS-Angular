// Angular
import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  inject,
} from "@angular/core"; // tslint:disable-line
import { CommonModule } from "@angular/common";
// RxJS
import { Observable } from "rxjs";

// Ionic
import { IonList, IonBadge, IonIcon, Platform /* , Events */ } from "@ionic/angular/standalone";

// Models
import { SideMenuOption } from "./models/side-menu-option";
import { SideMenuSettings } from "./models/side-menu-settings";
import {
  SideMenuOptionSelect,
  SideMenuOptionSelectData,
} from "./models/side-menu-option-select-event";
import { addIcons } from "ionicons";
import { chevronDownOutline } from "ionicons/icons";

// This class is defined in this file because
// we don't want to make it exportable
class InnerMenuOptionModel {
  public id!: number;
  public iconName!: string;
  public iconSrc!: string;
  public displayText!: string;
  public badge?: Observable<any>;
  public targetOption!: SideMenuOption;
  public parent: InnerMenuOptionModel | null = null;
  public selected!: boolean;
  public expanded!: boolean;
  public suboptionsCount!: number;
  public subOptions!: Array<InnerMenuOptionModel>;
  private static counter = 1;
  public static fromMenuOptionModel(
    option: SideMenuOption,
    parent?: InnerMenuOptionModel
  ): InnerMenuOptionModel {
    let innerMenuOptionModel = new InnerMenuOptionModel();

    innerMenuOptionModel.id = this.counter++;
    innerMenuOptionModel.iconName = option.iconName!;
    innerMenuOptionModel.iconSrc = option.iconSrc!;
    innerMenuOptionModel.displayText = option.displayText;
    innerMenuOptionModel.badge = option.badge;
    innerMenuOptionModel.targetOption = option;
    innerMenuOptionModel.parent = parent || null;

    innerMenuOptionModel.selected = option.selected!;

    if (option.suboptions) {
      innerMenuOptionModel.expanded = false;
      innerMenuOptionModel.suboptionsCount = option.suboptions.length;
      innerMenuOptionModel.subOptions = [];

      option.suboptions.forEach((subItem) => {
        let innerSubItem = InnerMenuOptionModel.fromMenuOptionModel(
          subItem,
          innerMenuOptionModel
        );
        innerMenuOptionModel.subOptions.push(innerSubItem);

        // Select the parent if any
        // child option is selected
        if (subItem.selected && innerSubItem.parent) {
          innerSubItem.parent.selected = true;
          innerSubItem.parent.expanded = true;
        }
      });
    }

    return innerMenuOptionModel;
  }
}

@Component({
  selector: "app-multi-level-side-menu",
  templateUrl: "./multi-level-side-menu.component.html",
  styleUrls: ["./multi-level-side-menu.component.scss"],
  standalone: true,
  imports: [CommonModule, IonList, IonBadge, IonIcon]
})
export class MultiLevelSideMenuComponent {
  private readonly platform = inject(Platform);

  // Convert to signals for reactive state management
  readonly menuSettings = signal<SideMenuSettings | undefined>(undefined);
  readonly menuOptions = signal<Array<SideMenuOption>>([]);
  private readonly selectedOption = signal<InnerMenuOptionModel | null>(null);
  readonly collapsableItems = signal<Array<InnerMenuOptionModel>>([]);

  // Computed signals for platform-specific values
  readonly subOptionIndentation = computed(() => {
    const settings = this.menuSettings();
    if (!settings?.subOptionIndentation) return 0;
    
    if (this.platform.is("ios") && settings.subOptionIndentation.ios)
      return settings.subOptionIndentation.ios;
    if (this.platform.is("android") && settings.subOptionIndentation.wp)
      return settings.subOptionIndentation.wp;
    if (settings.subOptionIndentation.md)
      return settings.subOptionIndentation.md;
    return 0;
  });

  readonly optionHeight = computed(() => {
    const settings = this.menuSettings();
    if (!settings?.optionHeight) return 0;
    
    if (this.platform.is("ios") && settings.optionHeight.ios)
      return settings.optionHeight.ios;
    if (this.platform.is("android") && settings.optionHeight.wp)
      return settings.optionHeight.wp;
    if (settings.optionHeight.md)
      return settings.optionHeight.md;
    return 0;
  });

  @Input("options")
  set options(value: Array<SideMenuOption>) {
    if (value) {
      // Keep a reference to the options sent to this component
      this.menuOptions.set(value);
      const collapsableArray = new Array<InnerMenuOptionModel>();
      let selected: InnerMenuOptionModel | null = null;

      // Map the options to our internal models
      value.forEach((option) => {
        let innerMenuOption = InnerMenuOptionModel.fromMenuOptionModel(option);
        collapsableArray.push(innerMenuOption);

        // Check if there's any option marked as selected
        if (option.selected) {
          selected = innerMenuOption;
        } else if (innerMenuOption.suboptionsCount) {
          innerMenuOption.subOptions.forEach((subItem) => {
            if (subItem.selected) {
              selected = subItem;
            }
          });
        }
      });

      this.collapsableItems.set(collapsableArray);
      this.selectedOption.set(selected);
    }
  }

  @Input("settings")
  set settings(value: SideMenuSettings) {
    if (value) {
      this.mergeSettings(value);
    }
  }

  // Outputs: return the selected option to the caller
  @Output() change = new EventEmitter<any>();

  constructor() {
    addIcons({ chevronDownOutline });
  }

  // ---------------------------------------------------
  // PUBLIC methods
  // ---------------------------------------------------

  // Send the selected option to the caller component
  public select(option: InnerMenuOptionModel): void {
    const settings = this.menuSettings();
    if (settings?.showSelectedOption) {
      this.setSelectedOption(option);
    }

    // Return the selected option (not our inner option)
    this.change.emit(option.targetOption);
  }

  // Toggle the sub options of the selected item
  public toggleItemOptions(targetOption: InnerMenuOptionModel): void {
    if (!targetOption) return;

    const settings = this.menuSettings();
    const items = this.collapsableItems();

    // If the accordion mode is set to true, we need
    // to collapse all the other menu options
    if (settings?.accordionMode) {
      items.forEach((option) => {
        if (option.id !== targetOption.id) {
          option.expanded = false;
        }
      });
    }

    // Toggle the selected option
    targetOption.expanded = !targetOption.expanded;
    
    // Update signal to trigger change detection
    this.collapsableItems.set([...items]);
  }

  // Reset the entire menu
  public collapseAllOptions(): void {
    const items = this.collapsableItems();
    
    items.forEach((option) => {
      if (!option.selected) {
        option.expanded = false;
      }

      if (option.suboptionsCount) {
        option.subOptions.forEach((subItem) => {
          if (subItem.selected && subItem.parent) {
            // Expand the parent if any of
            // its childs is selected
            subItem.parent.expanded = true;
          }
        });
      }
    });

    // Update signal to trigger change detection
    this.collapsableItems.set([...items]);
  }

  // ---------------------------------------------------
  // PRIVATE methods
  // ---------------------------------------------------

  // Method that set the selected option and its parent
  private setSelectedOption(option: InnerMenuOptionModel) {
    if (!option.targetOption.component) return;

    const currentSelected = this.selectedOption();
    const items = this.collapsableItems();

    // Clean the current selected option if any
    if (currentSelected) {
      currentSelected.selected = false;
      currentSelected.targetOption.selected = false;

      if (currentSelected.parent) {
        currentSelected.parent.selected = false;
        currentSelected.parent.expanded = false;
      }
    }

    // Set this option to be the selected
    option.selected = true;
    option.targetOption.selected = true;

    if (option.parent) {
      option.parent.selected = true;
      option.parent.expanded = true;
    }

    // Keep a reference to the selected option
    this.selectedOption.set(option);
    
    // Update signal to trigger change detection
    this.collapsableItems.set([...items]);
  }

  // Merge the settings received with the default settings
  private mergeSettings(value: SideMenuSettings): void {
    const defaultSettings: SideMenuSettings = {
      accordionMode: false,
      optionHeight: {
        ios: 50,
        md: 50,
        wp: 50,
      },
      arrowIcon: "chevron-down-outline",
      showSelectedOption: false,
      selectedOptionClass: "selected-option",
      indentSubOptionsWithoutIcons: false,
      subOptionIndentation: {
        ios: 16,
        md: 16,
        wp: 16,
      },
    };

    const mergedSettings = { ...defaultSettings, ...value };

    if (!value.optionHeight) {
      mergedSettings.optionHeight = defaultSettings.optionHeight;
    } else {
      mergedSettings.optionHeight = {
        ios: this.isDefinedAndPositive(value.optionHeight.ios)
          ? value.optionHeight.ios!
          : defaultSettings.optionHeight!.ios,
        md: this.isDefinedAndPositive(value.optionHeight.md)
          ? value.optionHeight.md!
          : defaultSettings.optionHeight!.md,
        wp: this.isDefinedAndPositive(value.optionHeight.wp)
          ? value.optionHeight.wp!
          : defaultSettings.optionHeight!.wp,
      };
    }

    if (!value.subOptionIndentation) {
      mergedSettings.subOptionIndentation = defaultSettings.subOptionIndentation;
    } else {
      mergedSettings.subOptionIndentation = {
        ios: this.isDefinedAndPositive(value.subOptionIndentation.ios)
          ? value.subOptionIndentation.ios!
          : defaultSettings.subOptionIndentation!.ios,
        md: this.isDefinedAndPositive(value.subOptionIndentation.md)
          ? value.subOptionIndentation.md!
          : defaultSettings.subOptionIndentation!.md,
        wp: this.isDefinedAndPositive(value.subOptionIndentation.wp)
          ? value.subOptionIndentation.wp!
          : defaultSettings.subOptionIndentation!.wp,
      };
    }

    this.menuSettings.set(mergedSettings);
  }

  private isDefined(property: any): boolean {
    return property !== null && property !== undefined;
  }

  private isDefinedAndPositive(property: any): boolean {
    return this.isDefined(property) && !isNaN(property) && property > 0;
  }

  private compareOptionsName(name1: string, name2: string): boolean {
    return (
      name1.replace(/\s/g, "").toLowerCase() ===
      name2.replace(/\s/g, "").toLowerCase()
    );
  }
}
