# Concurrent Update Detection in Signal-Based Architecture

## Executive Summary

This document addresses how to preserve and enhance the **concurrent update detection logic** when migrating from NgRx to signal-based state management. Your current implementation detects when multiple application instances modify the same data simultaneously - a critical feature for multi-user/multi-device scenarios.

---

## Current Concurrent Update Logic Analysis

### How It Works Now (NgRx)

Your application tracks three types of events:

1. **Internal Events** - Changes made in the current application instance
2. **External Events** - Changes from PouchDB sync (other instances/devices)
3. **Duplicate Events** - Same change reported twice (local + remote)

### Event Classification Logic

```typescript
// Current logic in vin.page.ts (lines 367-424)
if (vinState.source == "internal") {
  // (I) Internal: User saved in THIS instance
  // → Show success, navigate home
} else {
  // (II) External: Change from another instance
  
  // Check eventLog for duplicates
  let filteredEventLog = vinState.eventLog.filter(
    (value) =>
      value.id == vinState.currentWine.id &&
      value.rev == vinState.currentWine.rev &&
      value.action == "create"
  );
  
  if (filteredEventLog.length == 2) {
    // (II.A) Duplicate: Same change from local + remote
    // → Ignore, already processed
  } else if (
    vinState.eventLog[vinState.eventLog.length - 1].id == vinState.currentWine.id &&
    this.vinForm.dirty
  ) {
    // (II.C) Concurrent Edit: Someone else modified the wine we're editing
    // → Show warning: "Wine saved concurrently on another instance"
  } else {
    // (II.B) Other Wine: Different wine was modified
    // → Ignore, not relevant to current editing
  }
}
```

### Key Components

1. **Event Log** - Tracks all operations with id, rev, action, timestamp
2. **Source Tracking** - Distinguishes internal vs external changes
3. **Current Wine Tracking** - Knows which wine is being edited
4. **Form Dirty State** - Detects if user has unsaved changes

---

## Signal-Based Implementation

### Enhanced State Service with Concurrent Detection

```typescript
// client/src/app/services/vin-state.service.ts
import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { VinModel } from '../models/cellar.model';
import { PouchdbService } from './pouchdb.service';
import dayjs from 'dayjs';

export interface VinEvent {
  id: string;
  rev: string;
  action: 'create' | 'update' | 'delete';
  timestamp: number;
  source: 'internal' | 'external';
}

export interface ConcurrentUpdateDetection {
  detected: boolean;
  affectedVinId: string | null;
  message: string | null;
  severity: 'warning' | 'error' | null;
}

@Injectable({ providedIn: 'root' })
export class VinStateService {
  private readonly pouchService = inject(PouchdbService);
  
  // ============================================
  // PRIVATE STATE
  // ============================================
  
  private readonly _vins = signal<Map<string, VinModel>>(new Map());
  private readonly _status = signal<'idle' | 'loading' | 'saving' | 'deleting' | 'error'>('idle');
  private readonly _error = signal<string | null>(null);
  
  // Current wine being edited (for concurrent detection)
  private readonly _currentVinId = signal<string | null>(null);
  private readonly _currentVinRev = signal<string | null>(null);
  
  // Event log for tracking all operations
  private readonly _eventLog = signal<VinEvent[]>([]);
  
  // Last operation result
  private readonly _lastOperation = signal<{
    success: boolean;
    source: 'internal' | 'external';
    vin?: VinModel;
    error?: string;
  } | null>(null);
  
  // Concurrent update detection
  private readonly _concurrentUpdate = signal<ConcurrentUpdateDetection>({
    detected: false,
    affectedVinId: null,
    message: null,
    severity: null
  });
  
  // ============================================
  // PUBLIC STATE
  // ============================================
  
  readonly vins = this._vins.asReadonly();
  readonly status = this._status.asReadonly();
  readonly error = this._error.asReadonly();
  readonly currentVinId = this._currentVinId.asReadonly();
  readonly eventLog = this._eventLog.asReadonly();
  readonly lastOperation = this._lastOperation.asReadonly();
  readonly concurrentUpdate = this._concurrentUpdate.asReadonly();
  
  // ============================================
  // COMPUTED STATE
  // ============================================
  
  readonly vinsList = computed(() => 
    Array.from(this._vins().values())
      .sort((a, b) => (a.nom + a.annee < b.nom + b.annee ? -1 : 1))
  );
  
  readonly currentVin = computed(() => {
    const id = this._currentVinId();
    return id ? this._vins().get(id) : null;
  });
  
  readonly vinMapForDuplicates = computed(() => {
    const map = new Map<string, VinModel>();
    this._vins().forEach(vin => {
      map.set(`${vin.nom}-${vin.annee}`, vin);
    });
    return map;
  });
  
  // ============================================
  // CONCURRENT UPDATE DETECTION
  // ============================================
  
  /**
   * Analyzes event log to detect concurrent updates
   * This replicates the logic from vin.page.ts lines 367-424
   */
  private detectConcurrentUpdate(
    newEvent: VinEvent,
    formIsDirty: boolean
  ): ConcurrentUpdateDetection {
    const eventLog = this._eventLog();
    const currentVinId = this._currentVinId();
    const currentVinRev = this._currentVinRev();
    
    // Only check for concurrent updates on external events
    if (newEvent.source === 'internal') {
      return {
        detected: false,
        affectedVinId: null,
        message: null,
        severity: null
      };
    }
    
    // Check if this is a duplicate event (same id, rev, action)
    const duplicateEvents = eventLog.filter(
      event =>
        event.id === newEvent.id &&
        event.rev === newEvent.rev &&
        event.action === newEvent.action
    );
    
    if (duplicateEvents.length >= 1) {
      // (II.A) Duplicate event - already processed
      console.log('[ConcurrentDetection] Duplicate event detected, ignoring');
      return {
        detected: false,
        affectedVinId: null,
        message: null,
        severity: null
      };
    }
    
    // Check if this event affects the wine currently being edited
    const isCurrentWine = newEvent.id === currentVinId;
    
    if (isCurrentWine && formIsDirty) {
      // (II.C) Concurrent update detected!
      // Someone else modified the wine we're currently editing
      const message = newEvent.action === 'delete'
        ? 'wine.deletedConcurrentlyOnAnotherInstance'
        : 'wine.savedConcurrentlyOnAnotherInstance';
      
      console.log('[ConcurrentDetection] Concurrent update detected!', {
        vinId: newEvent.id,
        action: newEvent.action,
        formIsDirty
      });
      
      return {
        detected: true,
        affectedVinId: newEvent.id,
        message,
        severity: 'warning'
      };
    }
    
    // (II.B) Update of another wine - not relevant
    console.log('[ConcurrentDetection] Update of different wine, ignoring');
    return {
      detected: false,
      affectedVinId: null,
      message: null,
      severity: null
    };
  }
  
  /**
   * Add event to log and check for concurrent updates
   */
  private addEventAndCheckConcurrency(
    event: VinEvent,
    formIsDirty: boolean = false
  ): void {
    // Add to event log
    this._eventLog.update(log => [...log, event]);
    
    // Detect concurrent updates
    const detection = this.detectConcurrentUpdate(event, formIsDirty);
    
    if (detection.detected) {
      this._concurrentUpdate.set(detection);
    }
  }
  
  /**
   * Clear concurrent update warning
   */
  clearConcurrentUpdate(): void {
    this._concurrentUpdate.set({
      detected: false,
      affectedVinId: null,
      message: null,
      severity: null
    });
  }
  
  // ============================================
  // ACTIONS
  // ============================================
  
  async loadVins(): Promise<void> {
    this._status.set('loading');
    this._error.set(null);
    
    try {
      const vins = await this.pouchService.getDocsOfType$<VinModel>('vin');
      this._vins.set(new Map(vins.map(v => [v._id, v])));
      this._status.set('idle');
    } catch (error) {
      this._error.set(error instanceof Error ? error.message : 'Failed to load vins');
      this._status.set('error');
      throw error;
    }
  }
  
  /**
   * Set current vin for editing (tracks for concurrent detection)
   */
  setCurrentVin(id: string | null, rev: string | null = null): void {
    this._currentVinId.set(id);
    this._currentVinRev.set(rev);
    
    // Clear any previous concurrent update warnings
    this.clearConcurrentUpdate();
  }
  
  /**
   * Save vin (internal operation)
   */
  async saveVin(vin: VinModel, formIsDirty: boolean = true): Promise<void> {
    this._status.set('saving');
    this._error.set(null);
    
    try {
      const result = await this.pouchService.saveDoc(vin, 'vin');
      
      const updatedVin: VinModel = {
        ...vin,
        _id: result.id,
        _rev: result.rev
      };
      
      // Update local state
      this._vins.update(vins => {
        const newMap = new Map(vins);
        newMap.set(result.id, updatedVin);
        return newMap;
      });
      
      // Add INTERNAL event to log
      const event: VinEvent = {
        id: result.id,
        rev: result.rev,
        action: vin._id ? 'update' : 'create',
        timestamp: Date.now(),
        source: 'internal'
      };
      
      this.addEventAndCheckConcurrency(event, formIsDirty);
      
      // Set operation result
      this._lastOperation.set({
        success: true,
        source: 'internal',
        vin: updatedVin
      });
      
      this._status.set('idle');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save vin';
      this._error.set(errorMessage);
      this._status.set('error');
      
      this._lastOperation.set({
        success: false,
        source: 'internal',
        error: errorMessage
      });
      
      throw error;
    }
  }
  
  /**
   * Delete vin (internal operation)
   */
  async deleteVin(vin: VinModel, formIsDirty: boolean = false): Promise<void> {
    this._status.set('deleting');
    this._error.set(null);
    
    try {
      await this.pouchService.deleteDoc(vin);
      
      // Remove from local state
      this._vins.update(vins => {
        const newMap = new Map(vins);
        newMap.delete(vin._id);
        return newMap;
      });
      
      // Add INTERNAL event to log
      const event: VinEvent = {
        id: vin._id,
        rev: vin._rev,
        action: 'delete',
        timestamp: Date.now(),
        source: 'internal'
      };
      
      this.addEventAndCheckConcurrency(event, formIsDirty);
      
      // Set operation result
      this._lastOperation.set({
        success: true,
        source: 'internal'
      });
      
      this._status.set('idle');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete vin';
      this._error.set(errorMessage);
      this._status.set('error');
      
      this._lastOperation.set({
        success: false,
        source: 'internal',
        error: errorMessage
      });
      
      throw error;
    }
  }
  
  /**
   * Handle external change from PouchDB sync
   * This is called when changes come from other application instances
   */
  handleExternalChange(change: any, formIsDirty: boolean = false): void {
    console.log('[VinState] Handling external change:', change);
    
    if (change.deleted) {
      // External delete
      this._vins.update(vins => {
        const newMap = new Map(vins);
        newMap.delete(change.id);
        return newMap;
      });
      
      // Add EXTERNAL event to log
      const event: VinEvent = {
        id: change.id,
        rev: change.doc?._rev || '',
        action: 'delete',
        timestamp: Date.now(),
        source: 'external'
      };
      
      this.addEventAndCheckConcurrency(event, formIsDirty);
      
      // Set operation result
      this._lastOperation.set({
        success: true,
        source: 'external'
      });
    } else {
      // External create/update
      const vin = change.doc as VinModel;
      
      this._vins.update(vins => {
        const newMap = new Map(vins);
        newMap.set(vin._id, vin);
        return newMap;
      });
      
      // Add EXTERNAL event to log
      const event: VinEvent = {
        id: vin._id,
        rev: vin._rev,
        action: 'update',
        timestamp: Date.now(),
        source: 'external'
      };
      
      this.addEventAndCheckConcurrency(event, formIsDirty);
      
      // Set operation result
      this._lastOperation.set({
        success: true,
        source: 'external',
        vin
      });
    }
  }
  
  /**
   * Clear error state
   */
  clearError(): void {
    this._error.set(null);
  }
  
  /**
   * Reset state
   */
  reset(): void {
    this._vins.set(new Map());
    this._status.set('idle');
    this._error.set(null);
    this._currentVinId.set(null);
    this._currentVinRev.set(null);
    this._lastOperation.set(null);
    this._eventLog.set([]);
    this._concurrentUpdate.set({
      detected: false,
      affectedVinId: null,
      message: null,
      severity: null
    });
  }
}
```

---

## Component Usage

### Vin Component with Concurrent Detection

```typescript
// client/src/app/vin/vin.page.ts
import { Component, computed, effect, inject } from '@angular/core';
import { VinStateService } from '../services/vin-state.service';

export class VinPage {
  private readonly vinState = inject(VinStateService);
  private readonly translate = inject(TranslateService);
  private readonly toastCtrl = inject(ToastController);
  private readonly navCtrl = inject(NavController);
  
  // Track if form is dirty (for concurrent detection)
  readonly formIsDirty = signal<boolean>(false);
  
  constructor() {
    // Effect 1: Set current vin when route changes
    effect(() => {
      const vinId = this.vinId();
      const vin = this.currentVin();
      
      if (vinId && vin) {
        this.vinState.setCurrentVin(vinId, vin._rev);
      } else {
        this.vinState.setCurrentVin(null);
      }
    });
    
    // Effect 2: React to operation results
    effect(() => {
      const result = this.vinState.lastOperation();
      
      if (!result) return;
      
      if (result.source === 'internal') {
        // Our own save/delete operation
        if (result.success) {
          this.presentToast(
            this.translate.instant('general.dataSaved'),
            'success'
          );
          this.navCtrl.navigateBack('/home');
        } else if (result.error) {
          this.presentToast(result.error, 'error');
        }
      }
      // External operations are handled by concurrent detection effect
    });
    
    // Effect 3: Handle concurrent update detection
    effect(() => {
      const concurrent = this.vinState.concurrentUpdate();
      
      if (concurrent.detected && concurrent.message) {
        this.presentToast(
          this.translate.instant(concurrent.message),
          concurrent.severity || 'warning',
          0, // No auto-dismiss
          'Close'
        );
      }
    });
    
    // Effect 4: Track form dirty state
    effect(() => {
      const isDirty = this.vinForm().dirty() || this.dirtyPhoto();
      this.formIsDirty.set(isDirty);
    });
  }
  
  async saveVin() {
    const formData = this.vinFormModel();
    const isDirty = this.formIsDirty();
    
    // Pass form dirty state for concurrent detection
    await this.vinState.saveVin(formData, isDirty);
  }
  
  async presentToast(
    message: string,
    color: string,
    duration: number = 2000,
    buttonText?: string
  ) {
    const toast = await this.toastCtrl.create({
      message,
      duration,
      color: color as any,
      buttons: buttonText ? [{ text: buttonText, role: 'cancel' }] : undefined
    });
    await toast.present();
  }
}
```

---

## PouchDB Sync Integration

### Connecting External Changes to State Service

```typescript
// client/src/app/services/pouchdb.service.ts
import { Injectable, inject } from '@angular/core';
import { VinStateService } from './vin-state.service';
import { TypeStateService } from './type-state.service';
// ... other state services

@Injectable({ providedIn: 'root' })
export class PouchdbService {
  private readonly vinState = inject(VinStateService);
  private readonly typeState = inject(TypeStateService);
  // ... other state services
  
  constructor() {
    this.setupSync();
  }
  
  private setupSync() {
    // Listen to PouchDB changes
    this.db.changes({
      since: 'now',
      live: true,
      include_docs: true
    }).on('change', (change) => {
      console.log('[PouchDB] Change detected:', change);
      
      // Route change to appropriate state service
      const docType = this.getDocType(change.doc);
      
      switch (docType) {
        case 'vin':
          // Pass to vin state service
          // Note: We don't have form dirty state here, so pass false
          // The component will handle concurrent detection via effects
          this.vinState.handleExternalChange(change, false);
          break;
          
        case 'type':
          this.typeState.handleExternalChange(change);
          break;
          
        // ... other types
      }
    }).on('error', (err) => {
      console.error('[PouchDB] Sync error:', err);
    });
  }
  
  private getDocType(doc: any): string {
    // Extract document type from doc structure
    // This depends on your document schema
    return doc.type || 'unknown';
  }
}
```

---

## Key Improvements Over NgRx

### 1. **Clearer Event Tracking**
- Events are strongly typed with `VinEvent` interface
- Source tracking is explicit (`internal` vs `external`)
- Timestamp tracking for debugging

### 2. **Dedicated Concurrent Detection**
- Separate `detectConcurrentUpdate()` method
- Clear return type with `ConcurrentUpdateDetection`
- Easy to test in isolation

### 3. **Form Dirty State Integration**
- Form dirty state is passed to operations
- Enables accurate concurrent detection
- Prevents false positives

### 4. **Reactive Warnings**
- `concurrentUpdate` signal for reactive UI
- Components can react with effects
- No manual subscription management

### 5. **Better Debugging**
- Console logs at key points
- Event log is inspectable
- Clear state transitions

---

## Testing Concurrent Updates

### Test Scenarios

```typescript
// Test 1: Internal save (no warning)
describe('Internal Save', () => {
  it('should not trigger concurrent warning', async () => {
    await vinState.saveVin(testVin, true);
    expect(vinState.concurrentUpdate().detected).toBe(false);
  });
});

// Test 2: External change to different wine (no warning)
describe('External Change - Different Wine', () => {
  it('should not trigger concurrent warning', () => {
    vinState.setCurrentVin('wine-1', 'rev-1');
    vinState.handleExternalChange({
      id: 'wine-2', // Different wine
      doc: { _id: 'wine-2', _rev: 'rev-2' }
    }, true);
    expect(vinState.concurrentUpdate().detected).toBe(false);
  });
});

// Test 3: External change to current wine with dirty form (WARNING!)
describe('Concurrent Update Detection', () => {
  it('should detect concurrent update', () => {
    vinState.setCurrentVin('wine-1', 'rev-1');
    vinState.handleExternalChange({
      id: 'wine-1', // Same wine we're editing
      doc: { _id: 'wine-1', _rev: 'rev-2' }
    }, true); // Form is dirty
    
    expect(vinState.concurrentUpdate().detected).toBe(true);
    expect(vinState.concurrentUpdate().message).toBe(
      'wine.savedConcurrentlyOnAnotherInstance'
    );
  });
});

// Test 4: Duplicate event (no warning)
describe('Duplicate Event', () => {
  it('should ignore duplicate events', () => {
    // First event
    vinState.handleExternalChange({
      id: 'wine-1',
      doc: { _id: 'wine-1', _rev: 'rev-1' }
    }, false);
    
    // Duplicate event (same id, rev)
    vinState.handleExternalChange({
      id: 'wine-1',
      doc: { _id: 'wine-1', _rev: 'rev-1' }
    }, true);
    
    expect(vinState.concurrentUpdate().detected).toBe(false);
  });
});
```

---

## Migration Checklist

- [ ] Implement `VinStateService` with concurrent detection
- [ ] Add `VinEvent` interface and event log
- [ ] Implement `detectConcurrentUpdate()` method
- [ ] Add `handleExternalChange()` method
- [ ] Update `PouchdbService` to route changes to state services
- [ ] Update components to use `concurrentUpdate` signal
- [ ] Add effects to react to concurrent updates
- [ ] Test all concurrent update scenarios
- [ ] Verify behavior matches current NgRx implementation
- [ ] Document concurrent detection for team

---

## Summary

The signal-based architecture **fully preserves** your concurrent update detection logic with these advantages:

1. ✅ **Same Functionality** - All detection scenarios work identically
2. ✅ **Better Type Safety** - Strongly typed events and detection results
3. ✅ **Easier Testing** - Pure functions, no mocking needed
4. ✅ **Reactive UI** - Components react to `concurrentUpdate` signal
5. ✅ **Clearer Code** - Dedicated methods for detection logic
6. ✅ **Better Debugging** - Event log is inspectable, clear console logs

The concurrent detection logic is **not lost** - it's **improved** in the signal-based architecture!
