import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { AppellationPage } from './appellation.page';

describe('AppellationPage', () => {
  let component: AppellationPage;
  let fixture: ComponentFixture<AppellationPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ AppellationPage ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AppellationPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
