// ============================================
//  Mambo Pedidos - Import Tracker Core Logic
//  Pure object literal: CRUD, IMP-xxxx numbering,
//  status machine, profitability, rollups.
//  Counter lives inside the {records, counter} payload.
// ============================================

const ImportsTracker = {

  STATUS_MACHINE: {
    ordered: ['in_transit', 'cancelled'],
    in_transit: ['in_customs', 'cancelled'],
    in_customs: ['cleared', 'cancelled'],
    cleared: ['delivered', 'cancelled'],
    delivered: [],
    cancelled: []
  },

  TERMINAL_STATUSES: ['delivered', 'cancelled'],

  /**
   * Create a new import record with sequential IMP-xxxx numbering.
   * Counter is read from and written back to the payload — never reused after deletion.
   * @param {{ records: Array, counter: number }} payload
   * @param {{ supplier: string, description: string, fobTotalUsd: number }} fields
   * @returns {{ record: Object, payload: { records: Array, counter: number } }}
   */
  createRecord(payload, fields) {
    const counter = (payload.counter || 0) + 1;
    const number = 'IMP-' + String(counter).padStart(4, '0');
    const id = 'imp_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);

    const record = {
      id,
      number,
      supplier: fields.supplier || '',
      description: fields.description || '',
      fobTotalUsd: typeof fields.fobTotalUsd === 'number' ? fields.fobTotalUsd : 0,
      freightUsd: 0,
      insuranceUsd: 0,
      courier: '',
      status: 'ordered',
      dates: {
        ordered: new Date().toISOString(),
        in_transit: null,
        in_customs: null,
        cleared: null,
        delivered: null
      },
      finalLandedCostUsd: 0,
      localPriceUsd: null,
      tipoCambio: 0,
      notes: ''
    };

    const records = [...payload.records, record];

    return {
      record,
      payload: { records, counter }
    };
  },

  /**
   * Advance a record's status through the state machine.
   * Invalid transitions are rejected without mutating the record.
   * @param {Object} record - The import record
   * @param {string} targetStatus - The target status
   * @returns {{ ok: boolean, record: Object }}
   */
  advanceStatus(record, targetStatus) {
    const allowed = this.STATUS_MACHINE[record.status];
    if (!allowed || !allowed.includes(targetStatus)) {
      return { ok: false, record };
    }

    const updated = Object.assign({}, record);
    updated.status = targetStatus;
    updated.dates = Object.assign({}, record.dates);
    updated.dates[targetStatus] = new Date().toISOString();

    return { ok: true, record: updated };
  },

  /**
   * Compute per-record profitability against a local reference price.
   * Missing local price → { available: false }, never zero.
   * @param {Object} record - Record with finalLandedCostUsd, localPriceUsd, tipoCambio
   * @returns {{ available: boolean, profitUsd?: number, roiPct?: number, profitArs?: number, landedCostUsd?: number, localPriceUsd?: number }}
   */
  computeProfitability(record) {
    const landed = record.finalLandedCostUsd || 0;
    const local = record.localPriceUsd;

    if (local === null || local === undefined || typeof local !== 'number' || !Number.isFinite(local)) {
      return { available: false };
    }

    const profitUsd = local - landed;
    const roiPct = landed !== 0 ? ((profitUsd / landed) * 100) : 0;
    const tipoCambio = record.tipoCambio || 0;
    const profitArs = profitUsd * tipoCambio;

    return {
      available: true,
      profitUsd,
      roiPct,
      profitArs,
      landedCostUsd: landed,
      localPriceUsd: local
    };
  },

  /**
   * Compute rollups across a collection of import records.
   * @param {Array} records - Array of import records
   * @returns {{ totalInvestedUsd: number, totalProfitUsd: number, activeCount: number, byStatus: Object }}
   */
  computeRollups(records) {
    const rollups = {
      totalInvestedUsd: 0,
      totalProfitUsd: 0,
      activeCount: 0,
      byStatus: {
        ordered: 0,
        in_transit: 0,
        in_customs: 0,
        cleared: 0,
        delivered: 0,
        cancelled: 0
      }
    };

    for (const r of records) {
      rollups.totalInvestedUsd += r.finalLandedCostUsd || 0;

      if (r.localPriceUsd !== null && r.localPriceUsd !== undefined) {
        const profit = (r.localPriceUsd || 0) - (r.finalLandedCostUsd || 0);
        rollups.totalProfitUsd += profit;
      }

      if (!this.TERMINAL_STATUSES.includes(r.status)) {
        rollups.activeCount++;
      }

      if (rollups.byStatus.hasOwnProperty(r.status)) {
        rollups.byStatus[r.status]++;
      }
    }

    return rollups;
  }
};

if (typeof window !== 'undefined') window.ImportsTracker = ImportsTracker;
if (typeof module !== 'undefined') module.exports = ImportsTracker;