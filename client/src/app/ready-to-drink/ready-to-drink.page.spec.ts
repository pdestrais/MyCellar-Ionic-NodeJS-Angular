import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ReadyToDrinkPage } from './ready-to-drink.page';

describe('ReadyToDrinkPage', () => {
  let component: ReadyToDrinkPage;
  let fixture: ComponentFixture<ReadyToDrinkPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ReadyToDrinkPage ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ReadyToDrinkPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
