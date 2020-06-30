import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { MultiLevelSideMenuComponent } from './multi-level-side-menu.component';

describe('MultiLevelSideMenuComponent', () => {
  let component: MultiLevelSideMenuComponent;
  let fixture: ComponentFixture<MultiLevelSideMenuComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ MultiLevelSideMenuComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(MultiLevelSideMenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
