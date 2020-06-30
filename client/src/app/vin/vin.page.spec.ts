import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { VinPage } from './vin.page';

describe('VinPage', () => {
  let component: VinPage;
  let fixture: ComponentFixture<VinPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ VinPage ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(VinPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
