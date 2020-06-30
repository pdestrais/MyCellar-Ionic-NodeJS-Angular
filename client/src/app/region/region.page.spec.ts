import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { RegionPage } from './region.page';

describe('RegionPage', () => {
  let component: RegionPage;
  let fixture: ComponentFixture<RegionPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ RegionPage ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(RegionPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
