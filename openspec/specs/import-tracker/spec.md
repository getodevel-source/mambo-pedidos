# import-tracker Specification

## Purpose

Personal lifecycle tracker for in-progress imports: sequential IMP-numbered records, a bounded status machine, isolated persistence, profitability against local prices, a dashboard view, and a wizard bridge that converts a landed-cost result into a tracked import.

## Requirements

### Requirement: Import Record Model

The system MUST represent each import as a record containing an IMP number, supplier/vendor, description, FOB total, freight, insurance, courier, status, dates for ordered/in_transit/in_customs/cleared/delivered, final landed cost, and notes. The tracker MUST NOT read from or write to the quote-history store (`mambo_historial_v2`).

#### Scenario: Record creation

- GIVEN the tracker is empty
- WHEN a record is created with supplier, description, and FOB total
- THEN it receives number IMP-0001 and status `ordered`
- AND missing optional fields default to empty values

#### Scenario: Storage isolation

- GIVEN records exist in the tracker
- WHEN quote history is listed
- THEN no import record appears in quote history, and vice versa

### Requirement: Sequential Numbering

The system MUST assign sequential IMP-xxxx numbers from a persisted counter that MUST NOT reuse a number after deletion.

#### Scenario: Number after deletion

- GIVEN records IMP-0001 and IMP-0002 exist and IMP-0002 is deleted
- WHEN a new record is created
- THEN its number is IMP-0003

### Requirement: Status Machine

Statuses MUST be `ordered`, `in_transit`, `in_customs`, `cleared`, `delivered`, and `cancelled`. Forward transitions MUST follow that order; `cancelled` MUST be reachable from any non-terminal status and MUST be terminal; `delivered` MUST be terminal. Invalid transitions MUST be rejected without mutating the record.

#### Scenario: Valid forward transition

- GIVEN a record in `ordered`
- WHEN it advances to `in_transit`
- THEN the status updates and the in_transit date is set

#### Scenario: Invalid transition rejected

- GIVEN a record in `ordered`
- WHEN it is moved directly to `delivered`
- THEN the transition is rejected and the record is unchanged

#### Scenario: Cancelled is terminal

- GIVEN a record cancelled from `in_customs`
- WHEN it is moved to `cleared`
- THEN the transition is rejected

### Requirement: Persistence

Records MUST persist under a dedicated storage key separate from catalog, quote history, and brands, survive application reloads, and fall back to local browser storage when the native store is unavailable. Loading with no stored data MUST return an empty collection.

#### Scenario: Reload survival

- GIVEN a record was saved
- WHEN the application reloads
- THEN the record loads with all fields intact

#### Scenario: Native store unavailable

- GIVEN the native store cannot initialize
- WHEN a record is saved and the app reloads
- THEN the record is recovered from the fallback storage

#### Scenario: Empty state

- GIVEN no stored data
- WHEN records are loaded
- THEN the result is an empty collection

### Requirement: Profitability

The system MUST compute per-record profit and ROI against a local reference price, and rollups for total invested, total profit, active count, and counts by status.

#### Scenario: Per-record ROI

- GIVEN landed cost 100 and local price 150
- WHEN profitability is computed
- THEN profit is 50 and ROI is 50%

#### Scenario: Rollups

- GIVEN one delivered import (cost 100, local 150) and one active import (cost 80)
- WHEN rollups are computed
- THEN total invested is 180, active count is 1, and by-status counts reflect both records

#### Scenario: Missing local price

- GIVEN a record without a local reference price
- WHEN profitability is computed
- THEN profit/ROI are reported as unavailable, never zero

### Requirement: Dashboard View

The system MUST provide a dashboard listing records grouped by status with dates, courier, final cost, and ROI, reachable from a dedicated navigation item.

#### Scenario: Status board

- GIVEN records in `in_transit` and `delivered`
- WHEN the dashboard opens
- THEN each record appears under its status group with dates and costs

#### Scenario: Empty dashboard

- GIVEN no records
- WHEN the dashboard opens
- THEN an empty-state message is shown

### Requirement: Wizard Save Bridge

The wizard's final step MUST offer saving the current landed-cost result as an import record with a cost snapshot, and MUST NOT alter existing wizard behavior when declined.

#### Scenario: Save as import

- GIVEN a completed wizard result
- WHEN "save as import" is confirmed
- THEN a record is created in `ordered` with the cost snapshot

#### Scenario: Bridge declined

- GIVEN the same wizard result
- WHEN the save is declined
- THEN no record is created and the wizard flow is unchanged
