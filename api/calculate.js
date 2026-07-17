const { parse } = require('url');

// --- 1. Default Instrument Assumptions & Constants ---
const _DEFAULT_INSTRUMENT_PARAMS = {
    core_corpus: { returnRate: 0.12, stcg_tax: 0.20, ltcg_tax: 0.125 },
    equity:      { returnRate: 0.12, stcg_tax: 0.20, ltcg_tax: 0.125 },
    debt:        { returnRate: 0.06, stcg_tax: 0.20, ltcg_tax: 0.125 },
    hybrid:      { returnRate: 0.10, stcg_tax: 0.20, ltcg_tax: 0.125 },
    cash:        { returnRate: 0.04, stcg_tax: 0.20, ltcg_tax: 0.125 }
};

const _GLIDE_PATHS_RAW = {
    "Non-Negotiable": [
        { id: 1, place: "hybrid", years_in: 5, years_out: 2, inflow_from: "core corpus", outflow_to: 2, pct: 25 },
        { id: 2, place: "debt", years_in: 2, years_out: 0, inflow_from: 1, outflow_to: 3, pct: 25 },
        { id: 3, place: "goal", years_in: 0, years_out: null, inflow_from: 2, outflow_to: null, pct: 25 },
        { id: 4, place: "debt", years_in: 4, years_out: 0, inflow_from: "core corpus", outflow_to: 5, pct: 25 },
        { id: 5, place: "goal", years_in: 0, years_out: null, inflow_from: 4, outflow_to: null, pct: 25 },
        { id: 6, place: "debt", years_in: 3, years_out: 0, inflow_from: "core corpus", outflow_to: 7, pct: 25 },
        { id: 7, place: "goal", years_in: 0, years_out: null, inflow_from: 6, outflow_to: null, pct: 25 },
        { id: 8, place: "debt", years_in: 2, years_out: 0, inflow_from: "core corpus", outflow_to: 9, pct: 25 },
        { id: 9, place: "goal", years_in: 0, years_out: null, inflow_from: 8, outflow_to: null, pct: 25 }
    ],
    "Semi-Negotiable": [
        { id: 1, place: "hybrid", years_in: 4, years_out: 0, inflow_from: "core corpus", outflow_to: 2, pct: 25 },
        { id: 2, place: "goal", years_in: 0, years_out: null, inflow_from: 1, outflow_to: null, pct: 25 },
        { id: 3, place: "debt", years_in: 3, years_out: 0, inflow_from: "core corpus", outflow_to: 4, pct: 25 },
        { id: 4, place: "goal", years_in: 0, years_out: null, inflow_from: 3, outflow_to: null, pct: 25 },
        { id: 5, place: "debt", years_in: 2, years_out: 0, inflow_from: "core corpus", outflow_to: 6, pct: 25 },
        { id: 6, place: "goal", years_in: 0, years_out: null, inflow_from: 5, outflow_to: null, pct: 25 },
        { id: 7, place: "debt", years_in: 1, years_out: 0, inflow_from: "core corpus", outflow_to: 8, pct: 25 },
        { id: 8, place: "goal", years_in: 0, years_out: null, inflow_from: 7, outflow_to: null, pct: 25 }
    ],
    "Negotiable": [
        { id: 1, place: "hybrid", years_in: 3, years_out: 0, inflow_from: "core corpus", outflow_to: 2, pct: 30 },
        { id: 2, place: "goal", years_in: 0, years_out: null, inflow_from: 1, outflow_to: null, pct: 30 },
        { id: 3, place: "hybrid", years_in: 2, years_out: 0, inflow_from: "core corpus", outflow_to: 4, pct: 10 },
        { id: 4, place: "goal", years_in: 0, years_out: null, inflow_from: 3, outflow_to: null, pct: 10 },
        { id: 5, place: "hybrid", years_in: 1, years_out: 0, inflow_from: "core corpus", outflow_to: 6, pct: 10 },
        { id: 6, place: "goal", years_in: 0, years_out: null, inflow_from: 5, outflow_to: null, pct: 10 },
        { id: 7, place: "debt", years_in: 2, years_out: 0, inflow_from: "core corpus", outflow_to: 8, pct: 30 },
        { id: 8, place: "goal", years_in: 0, years_out: null, inflow_from: 7, outflow_to: null, pct: 30 },
        { id: 9, place: "debt", years_in: 1, years_out: 0, inflow_from: "core corpus", outflow_to: 10, pct: 20 },
        { id: 10, place: "goal", years_in: 0, years_out: null, inflow_from: 9, outflow_to: null, pct: 20 }
    ]
};

const _FREQ_TO_MONTHS = { 'Annual': 12, 'Quarterly': 3, 'Half-Yearly': 6, 'Monthly': 1 };
const _MAX_SAFE_DATE = parseDate("2260-01-01");

// --- 2. Timezone-Safe Date Utilities ---
function parseDate(val) {
    if (!val) return null;
    if (val instanceof Date) {
        return new Date(Date.UTC(val.getUTCFullYear(), val.getUTCMonth(), 1));
    }
    if (typeof val === 'string') {
        const m = val.match(/^(\d{4})[-/](\d{1,2})([-/](\d{1,2}))?/);
        if (m) {
            return new Date(Date.UTC(parseInt(m[1]), parseInt(m[2]) - 1, 1));
        }
    }
    const d = new Date(val);
    if (isNaN(d.getTime())) return null;
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function addMonths(date, months) {
    const d = new Date(date.getTime());
    d.setUTCMonth(d.getUTCMonth() + months);
    return d;
}

function diffMonths(d1, d2) {
    return (d2.getUTCFullYear() - d1.getUTCFullYear()) * 12 + (d2.getUTCMonth() - d1.getUTCMonth());
}

function diffYears(d1, d2) {
    const ms = d2.getTime() - d1.getTime();
    const days = Math.round(ms / 86400000);
    return days / 365.25;
}

function formatISO(date) {
    if (!date) return null;
    return date.toISOString().slice(0, 10);
}

// --- 3. FIFO Tax-Lot classes ---
class TaxLot {
    constructor(date, units, purchasePrice) {
        this.date = parseDate(date);
        this.units = parseFloat(units);
        this.purchasePrice = parseFloat(purchasePrice);
        this.purchaseVal = this.units * this.purchasePrice;
    }
    currentValue(currentNav) {
        return this.units * currentNav;
    }
}

class InvestmentPool {
    constructor(name, stcgTax, ltcgTax) {
        this.name = name;
        this.stcgTax = parseFloat(stcgTax);
        this.ltcgTax = parseFloat(ltcgTax);
        this.lots = [];
    }

    _getTaxRate(lotDate, redemptionDate) {
        const ms = redemptionDate.getTime() - lotDate.getTime();
        const days = Math.round(ms / 86400000);
        return days <= 365 ? this.stcgTax : this.ltcgTax;
    }

    invest(date, amount, nav, description = "Investment") {
        if (amount <= 0) return null;
        const units = amount / nav;
        const newLot = new TaxLot(date, units, nav);
        this.lots.push(newLot);
        return {
            Date: date, Amount: amount, NAV: nav, units: units,
            Description: description, tax: 0, fully_funded: true, shortfall: 0, source: 'Investment',
            Pool: this.name
        };
    }

    getMarketValue(nav) {
        return this.lots.reduce((sum, lot) => sum + lot.units, 0) * nav;
    }

    getUnrealizedTax(nav, asOfDate = null) {
        let totalTax = 0;
        for (const lot of this.lots) {
            const gainPerUnit = nav - lot.purchasePrice;
            if (gainPerUnit > 0) {
                const rate = asOfDate ? this._getTaxRate(lot.date, asOfDate) : this.ltcgTax;
                totalTax += gainPerUnit * lot.units * rate;
            }
        }
        return totalTax;
    }

    redeemNetAmount(date, targetNet, nav, description = "Withdrawal") {
        let neededNet = targetNet;
        let totalGrossWithdrawn = 0;
        let totalTax = 0;
        let totalUnits = 0;

        const lotsToRemove = [];
        const lotsUpdated = {};

        for (let i = 0; i < this.lots.length; i++) {
            if (neededNet <= 1e-4) break;

            const lot = this.lots[i];
            const currVal = lot.currentValue(nav);
            const gainPerUnit = nav - lot.purchasePrice;
            const taxPerUnit = Math.max(0, gainPerUnit * this._getTaxRate(lot.date, date));
            const netPerUnit = nav - taxPerUnit;

            const maxNetFromLot = lot.units * netPerUnit;

            if (maxNetFromLot <= neededNet) {
                const unitsToSell = lot.units;
                const grossAmt = currVal;
                const taxAmt = unitsToSell * taxPerUnit;

                neededNet -= (grossAmt - taxAmt);
                totalGrossWithdrawn += grossAmt;
                totalTax += taxAmt;
                totalUnits += unitsToSell;
                lotsToRemove.push(i);
            } else {
                const unitsToSell = neededNet / netPerUnit;
                const grossAmt = unitsToSell * nav;
                const taxAmt = unitsToSell * taxPerUnit;

                neededNet = 0;
                totalGrossWithdrawn += grossAmt;
                totalTax += taxAmt;
                totalUnits += unitsToSell;
                lotsUpdated[i] = lot.units - unitsToSell;
            }
        }

        for (const [i, newUnits] of Object.entries(lotsUpdated)) {
            this.lots[i].units = newUnits;
        }

        lotsToRemove.sort((a, b) => b - a);
        for (const idx of lotsToRemove) {
            this.lots.splice(idx, 1);
        }

        const fullyFunded = (neededNet <= 1.0);

        return {
            Date: date, Amount: -totalGrossWithdrawn, NAV: nav,
            units: -totalUnits, Description: description,
            tax: totalTax, fully_funded: fullyFunded,
            shortfall: neededNet,
            net_received: totalGrossWithdrawn - totalTax,
            Pool: this.name
        };
    }

    redeemGrossAmount(date, targetGross, nav, description = "Withdrawal Gross") {
        let neededGross = targetGross;
        let totalGrossWithdrawn = 0;
        let totalTax = 0;
        let totalUnits = 0;

        const lotsToRemove = [];
        const lotsUpdated = {};

        for (let i = 0; i < this.lots.length; i++) {
            if (neededGross <= 1e-4) break;

            const lot = this.lots[i];
            const currVal = lot.currentValue(nav);

            if (currVal <= neededGross) {
                const unitsToSell = lot.units;
                const grossAmt = currVal;
                const gain = grossAmt - lot.purchaseVal;
                const tax = Math.max(0, gain * this._getTaxRate(lot.date, date));

                neededGross -= grossAmt;
                totalGrossWithdrawn += grossAmt;
                totalTax += tax;
                totalUnits += unitsToSell;
                lotsToRemove.push(i);
            } else {
                const fraction = neededGross / currVal;
                const unitsToSell = lot.units * fraction;
                const grossAmt = neededGross;

                const purchaseCostForPart = lot.purchaseVal * fraction;
                const gain = grossAmt - purchaseCostForPart;
                const tax = Math.max(0, gain * this._getTaxRate(lot.date, date));

                neededGross = 0;
                totalGrossWithdrawn += grossAmt;
                totalTax += tax;
                totalUnits += unitsToSell;
                lotsUpdated[i] = lot.units - unitsToSell;
            }
        }

        for (const [i, newUnits] of Object.entries(lotsUpdated)) {
            this.lots[i].units = newUnits;
        }

        lotsToRemove.sort((a, b) => b - a);
        for (const idx of lotsToRemove) {
            this.lots.splice(idx, 1);
        }

        const fullyFunded = (neededGross <= 1.0);

        return {
            Date: date, Amount: -totalGrossWithdrawn, NAV: nav,
            units: -totalUnits, Description: description,
            tax: totalTax, fully_funded: fullyFunded,
            shortfall: neededGross,
            net_received: totalGrossWithdrawn - totalTax,
            Pool: this.name
        };
    }
}

// --- 4. NAV & Step-Up Compounding Engines ---
function getNav(date, startDate, rateOfReturn) {
    const ms = date.getTime() - startDate.getTime();
    const days = Math.round(ms / 86400000);
    const dailyRate = Math.pow(1 + rateOfReturn, 1 / 365) - 1;
    return 100 * Math.pow(1 + dailyRate, days);
}

function countStepupEvents(startDate, endDate, anchorDate, frequency) {
    const stepMonths = _FREQ_TO_MONTHS[frequency];
    if (stepMonths === undefined || !anchorDate) return 0;
    
    startDate = parseDate(startDate);
    endDate = parseDate(endDate);
    anchorDate = parseDate(anchorDate);
    
    if (endDate.getTime() <= startDate.getTime()) return 0;

    let cur = new Date(anchorDate.getTime());
    while (addMonths(cur, stepMonths).getTime() <= startDate.getTime()) {
        cur = addMonths(cur, stepMonths);
    }
    cur = addMonths(cur, stepMonths);
    let count = 0;
    while (cur.getTime() <= endDate.getTime()) {
        if (cur.getTime() > startDate.getTime()) {
            count += 1;
        }
        cur = addMonths(cur, stepMonths);
    }
    return count;
}

function amountAtDateWithStepup(pvAmount, growthPercent, growthFrequency, growthAnchor, currentDate, targetDate) {
    targetDate = parseDate(targetDate);
    currentDate = parseDate(currentDate);
    if (targetDate.getTime() <= currentDate.getTime()) {
        return parseFloat(pvAmount);
    }
    const n = countStepupEvents(currentDate, targetDate, growthAnchor, growthFrequency);
    return parseFloat(pvAmount) * Math.pow(1 + parseFloat(growthPercent) / 100.0, n);
}

// --- 5. Glide Paths & Cashflow Evaluators ---
function resolveRecurringOccurrences(goal, deathDate) {
    if (goal.structure !== 'Recurring') {
        return parseInt(goal.occurrences ?? 1) || 0;
    }
    const endMode = goal.end_mode || 'Occurrences';
    if (endMode === 'Occurrences') {
        return parseInt(goal.occurrences ?? 1) || 0;
    }
    const freqMonths = _FREQ_TO_MONTHS[goal.frequency];
    if (freqMonths === undefined) {
        return parseInt(goal.occurrences ?? 1) || 0;
    }
    const start = parseDate(goal.start_date);
    let end;
    if (endMode === 'Lifetime') {
        end = deathDate ? parseDate(deathDate) : start;
    } else if (endMode === 'Fixed date') {
        end = goal.end_date ? parseDate(goal.end_date) : start;
    } else {
        return parseInt(goal.occurrences ?? 1) || 0;
    }
    if (end.getTime() < start.getTime()) return 0;
    const monthsSpan = diffMonths(start, end);
    return Math.floor(monthsSpan / freqMonths) + 1;
}

function expandRecurringGoalToTranches(goal, currentDate) {
    const structure = goal.structure || 'Lumpsum';
    const pv = parseFloat(goal.amount);
    const inflation = parseFloat(goal.inflation_percent ?? 0.0) / 100.0;
    const start = parseDate(goal.start_date);
    currentDate = parseDate(currentDate);

    if (structure === 'Lumpsum') {
        const yearsTo = Math.max(0.0, diffYears(currentDate, start));
        return [{ date: start, amount: pv * Math.pow(1 + inflation, yearsTo) }];
    }

    const freqMonths = _FREQ_TO_MONTHS[goal.frequency || 'Monthly'];
    if (freqMonths === undefined) {
        return [{ date: start, amount: pv }];
    }
    const occurrences = parseInt(goal.occurrences ?? 1) || 0;
    const tranches = [];
    for (let k = 0; k < occurrences; k++) {
        const occDate = addMonths(start, k * freqMonths);
        if (occDate.getTime() > _MAX_SAFE_DATE.getTime()) break;
        const yearsTo = Math.max(0.0, diffYears(currentDate, occDate));
        tranches.push({ date: occDate, amount: pv * Math.pow(1 + inflation, yearsTo) });
    }
    return tranches;
}

function calculateGoalCashflows(type, endDate, goalValuePostTax, instrumentParams, currentDate) {
    currentDate = parseDate(currentDate);
    endDate = parseDate(endDate);
    
    const rawRows = _GLIDE_PATHS_RAW[type];
    if (!rawRows) throw new Error("Unknown glide path: " + type);

    const df = rawRows.map(r => ({
        id: r.id,
        place: r.place.toLowerCase(),
        years_in: r.years_in,
        years_out: r.years_out,
        inflow_from: r.inflow_from,
        outflow_to: r.outflow_to,
        pct: r.pct,
        inflow_date: null,
        outflow_date: null,
        goal_value_post_tax: goalValuePostTax,
        inflow_amount: 0.0,
        total_outflow_amount: null,
        tax_out_of_outflow: null
    }));

    for (const row of df) {
        let infDate = new Date(endDate.getTime());
        infDate.setUTCFullYear(infDate.getUTCFullYear() - row.years_in);
        if (infDate.getTime() < currentDate.getTime()) {
            infDate = new Date(currentDate.getTime());
        }
        row.inflow_date = infDate;

        if (row.years_out !== null && row.years_out !== undefined) {
            let outDate = new Date(endDate.getTime());
            outDate.setUTCFullYear(outDate.getUTCFullYear() - row.years_out);
            if (outDate.getTime() < currentDate.getTime()) {
                outDate = new Date(currentDate.getTime());
            }
            row.outflow_date = outDate;
        } else {
            row.outflow_date = null;
        }
    }

    const idToRow = {};
    for (const row of df) {
        idToRow[row.id] = row;
    }

    function calculateRequiredInflow(targetPostTax, annualReturn, taxRate, years) {
        if (years === 0) return targetPostTax;
        const growthFactor = Math.pow(1 + annualReturn, years);
        const multiplier = growthFactor * (1 - taxRate) + taxRate;
        return targetPostTax / multiplier;
    }

    function processChain(goalRowId) {
        let currentId = goalRowId;
        let currentRow = idToRow[currentId];

        const targetAmount = currentRow.goal_value_post_tax * (currentRow.pct / 100);
        currentRow.inflow_amount = targetAmount;

        while (true) {
            currentRow = idToRow[currentId];
            const inflowFrom = currentRow.inflow_from;

            if (inflowFrom === 'core corpus') {
                break;
            }

            const sourceRow = idToRow[inflowFrom];
            const inflowDate = sourceRow.inflow_date;
            const outflowDate = currentRow.inflow_date;
            const years = diffYears(inflowDate, outflowDate);

            const place = sourceRow.place;
            const params = instrumentParams[place] || { returnRate: 0.0, stcg_tax: 0.0, ltcg_tax: 0.0 };
            const taxRate = years <= 1 ? params.stcg_tax : params.ltcg_tax;

            const targetForSource = currentRow.inflow_amount;
            const requiredInflow = calculateRequiredInflow(
                targetForSource, params.returnRate, taxRate, years
            );

            sourceRow.inflow_amount = requiredInflow;
            currentId = inflowFrom;
        }
    }

    for (const row of df) {
        if (row.place === 'goal') {
            processChain(row.id);
        }
    }

    for (const row of df) {
        row.inflow_amount = Math.round(row.inflow_amount * 100) / 100;
        if (row.place === 'goal') {
            row.total_outflow_amount = null;
            row.tax_out_of_outflow = null;
            continue;
        }

        const place = row.place;
        const params = instrumentParams[place] || { returnRate: 0.0, stcg_tax: 0.0, ltcg_tax: 0.0 };

        if (row.outflow_date !== null) {
            const years = diffYears(row.inflow_date, row.outflow_date);
            const principal = row.inflow_amount;
            const totalOutflow = principal * Math.pow(1 + params.returnRate, years);
            const gains = totalOutflow - principal;
            const taxRate = years <= 1 ? params.stcg_tax : params.ltcg_tax;
            const tax = Math.max(0, gains * taxRate);

            row.total_outflow_amount = Math.round(totalOutflow * 100) / 100;
            row.tax_out_of_outflow = Math.round(tax * 100) / 100;
        } else {
            row.total_outflow_amount = null;
            row.tax_out_of_outflow = null;
        }
    }

    return df;
}

// --- 6. Core Cashflow Netting ---
function netInvestmentAgainstPayouts(investmentList, payoutsList) {
    const investmentByMonth = {};
    for (const inv of investmentList) {
        const ym = inv.date.toISOString().slice(0, 7);
        investmentByMonth[ym] = (investmentByMonth[ym] || 0) + inv.investment;
    }

    const remaining = { ...investmentByMonth };
    const netPayouts = [];

    const sortedPayouts = [...payoutsList].sort((a, b) => a.date.getTime() - b.date.getTime());
    for (const pay of sortedPayouts) {
        const ym = pay.date.toISOString().slice(0, 7);
        const avail = remaining[ym] || 0;
        const gross = pay.amount;
        const used = Math.min(avail, gross);
        remaining[ym] = avail - used;
        const net = gross - used;
        if (net > 1e-6) {
            netPayouts.push({ date: pay.date, amount: net });
        }
    }

    const surplusInvestments = [];
    for (const inv of investmentList) {
        const ym = inv.date.toISOString().slice(0, 7);
        const left = remaining[ym] ?? inv.investment;
        surplusInvestments.push({ date: inv.date, investment: Math.max(0, left) });
    }

    return { netPayouts, surplusInvestments };
}

// --- 7. Debt & Hybrid Pool Simulator ---
function calculateDebtInjectionNeed(expensesList, injectionDate, poolParams) {
    let totalPv = 0;
    const rate = poolParams.returnRate;
    const stcgTax = poolParams.stcg_tax;
    const ltcgTax = poolParams.ltcg_tax;

    for (const exp of expensesList) {
        const yearsToExpense = Math.max(0.0, diffYears(injectionDate, exp.date));
        const taxRate = yearsToExpense <= 1 ? stcgTax : ltcgTax;
        
        const growthFactor = Math.pow(1 + rate, yearsToExpense);
        const denominator = growthFactor * (1 - taxRate) + taxRate;
        const needed = exp.amount / denominator;
        totalPv += needed;
    }
    return totalPv;
}

function simulatePool(payoutsList, currentDate, finalDate, debtParams, hybridParams, poolStart) {
    const debtPool = new InvestmentPool('Debt', debtParams.stcg_tax, debtParams.ltcg_tax);
    const hybridPool = new InvestmentPool('Hybrid', hybridParams.stcg_tax, hybridParams.ltcg_tax);

    const poolTransactions = [];
    const coreReplenishments = [];
    const poolMovements = [];

    if (!payoutsList || payoutsList.length === 0) {
        return { poolTransactions, coreReplenishments, failureDate: null, failureReason: null, poolMovements };
    }

    function logMovement(date, debtIn = 0, debtOut = 0, hybridIn = 0, hybridOut = 0) {
        const dNav = getNav(date, currentDate, debtParams.returnRate);
        const hNav = getNav(date, currentDate, hybridParams.returnRate);
        poolMovements.push({
            Date: date,
            DebtPoolValue: debtPool.getMarketValue(dNav),
            InflowToDebt: debtIn, OutflowFromDebt: debtOut,
            HybridPoolValue: hybridPool.getMarketValue(hNav),
            InflowToHybrid: hybridIn, OutflowFromHybrid: hybridOut,
        });
    }

    const payoutLastDate = new Date(Math.max(...payoutsList.map(p => p.date.getTime())));

    let simDate = new Date(poolStart.getTime());
    const finalDateTs = finalDate.getTime();
    const payoutLastDateTs = payoutLastDate.getTime();

    while (simDate.getTime() <= finalDateTs && simDate.getTime() <= payoutLastDateTs) {
        const debtNav = getNav(simDate, currentDate, debtParams.returnRate);
        const hybridNav = getNav(simDate, currentDate, hybridParams.returnRate);

        const debtDeadline = addMonths(simDate, 24);
        const hybridEnd = addMonths(simDate, 48);
        const windowStart = new Date(Date.UTC(simDate.getUTCFullYear(), simDate.getUTCMonth(), 1));

        const debtDue = payoutsList.filter(p => p.date.getTime() >= windowStart.getTime() && p.date.getTime() < debtDeadline.getTime());
        const hybridDue = payoutsList.filter(p => p.date.getTime() >= debtDeadline.getTime() && p.date.getTime() < hybridEnd.getTime());

        const targetDebtVal = calculateDebtInjectionNeed(debtDue, simDate, debtParams);
        const targetHybridVal = calculateDebtInjectionNeed(hybridDue, simDate, hybridParams);

        let currentHybridVal = hybridPool.getMarketValue(hybridNav);
        let hybridLatentTax = hybridPool.getUnrealizedTax(hybridNav, simDate);
        let hybridSurplus = Math.max(0.0, currentHybridVal - (targetHybridVal + hybridLatentTax));

        let currentDebtVal = debtPool.getMarketValue(debtNav);
        let debtLatentTax = debtPool.getUnrealizedTax(debtNav, simDate);
        let debtShortfall = Math.max(0.0, (targetDebtVal + debtLatentTax) - currentDebtVal);

        if (debtShortfall > 0 && hybridSurplus > 0) {
            const transferGross = Math.min(hybridSurplus, debtShortfall);
            const wdRes = hybridPool.redeemGrossAmount(simDate, transferGross, hybridNav, "Transfer to Debt (Surplus)");
            poolTransactions.push(wdRes);
            const netProceeds = wdRes.net_received;
            const invRes = debtPool.invest(simDate, netProceeds, debtNav, "Transfer from Hybrid");
            if (invRes) poolTransactions.push(invRes);
            logMovement(simDate, netProceeds, 0, 0, transferGross);

            currentDebtVal = debtPool.getMarketValue(debtNav);
            debtLatentTax = debtPool.getUnrealizedTax(debtNav, simDate);
            debtShortfall = Math.max(0.0, (targetDebtVal + debtLatentTax) - currentDebtVal);
        }

        if (debtShortfall > 0.01) {
            coreReplenishments.push({ Date: simDate, Amount: debtShortfall, Description: 'Replenishment: Debt Pool' });
            const invRes = debtPool.invest(simDate, debtShortfall, debtNav, "Replenishment from Core");
            if (invRes) poolTransactions.push(invRes);
            logMovement(simDate, debtShortfall, 0, 0, 0);
        }

        currentHybridVal = hybridPool.getMarketValue(hybridNav);
        hybridLatentTax = hybridPool.getUnrealizedTax(hybridNav, simDate);
        const hybridShortfall = Math.max(0.0, (targetHybridVal + hybridLatentTax) - currentHybridVal);
        if (hybridShortfall > 0.01) {
            coreReplenishments.push({ Date: simDate, Amount: hybridShortfall, Description: 'Replenishment: Hybrid Pool' });
            const invRes = hybridPool.invest(simDate, hybridShortfall, hybridNav, "Replenishment from Core");
            if (invRes) poolTransactions.push(invRes);
            logMovement(simDate, 0, 0, hybridShortfall, 0);
        }

        const nextYear = addMonths(simDate, 12);
        let mDate = new Date(simDate.getTime());
        const nextYearTs = nextYear.getTime();

        while (mDate.getTime() < nextYearTs && mDate.getTime() <= finalDateTs) {
            const monthPayouts = payoutsList.filter(p => p.date.getUTCFullYear() === mDate.getUTCFullYear() && p.date.getUTCMonth() === mDate.getUTCMonth());
            if (monthPayouts.length === 0) {
                logMovement(mDate, 0, 0, 0, 0);
                mDate = addMonths(mDate, 1);
                continue;
            }

            const netWithdrawal = monthPayouts.reduce((sum, p) => sum + p.amount, 0);
            if (netWithdrawal > 0) {
                const currNav = getNav(mDate, currentDate, debtParams.returnRate);
                const wdRes = debtPool.redeemNetAmount(mDate, netWithdrawal, currNav, "Goal Payout");
                poolTransactions.push(wdRes);
                logMovement(mDate, 0, netWithdrawal, 0, 0);
                if (!wdRes.fully_funded) {
                    return { poolTransactions, coreReplenishments, failureDate: mDate, failureReason: "Debt Pool Depleted", poolMovements };
                }
            } else {
                logMovement(mDate, 0, 0, 0, 0);
            }

            mDate = addMonths(mDate, 1);
        }

        simDate = nextYear;
    }

    return { poolTransactions, coreReplenishments, failureDate: null, failureReason: null, poolMovements };
}

// --- 8. Core Cashflow Execution (Simulation) ---
function runSimulation(config, retirementDate, instrumentParams) {
    const currentDate = parseDate(config.current_date);
    retirementDate = parseDate(retirementDate);
    const targetLifetime = parseFloat(config.target_lifetime ?? 90);
    const currentAge = parseFloat(config.current_age ?? 30);
    const deathDate = addMonths(currentDate, Math.round((targetLifetime - currentAge) * 12));

    // Dynamically build investment streams based on the candidate retirementDate!
    const investmentStreams = [];
    const totalYears = diffYears(currentDate, retirementDate);
    const totalMonthsAccumulation = Math.round(totalYears * 12);
    
    // Identification of Sabbaticals pausing
    const activeMonths = new Array(totalMonthsAccumulation).fill(true);
    for (const s of config.rawSabbaticals || []) {
        const startMonth = Math.round(s.start * 12);
        const endMonth = Math.round((s.start + s.duration) * 12);
        for (let m = startMonth; m < endMonth; m++) {
            if (m >= 0 && m < totalMonthsAccumulation) {
                activeMonths[m] = false;
            }
        }
    }

    // Contiguous active intervals for Primary SIP
    let streamIndex = 1;
    let currentStart = null;
    for (let m = 0; m <= totalMonthsAccumulation; m++) {
        const isActive = m < totalMonthsAccumulation ? activeMonths[m] : false;
        if (isActive && currentStart === null) {
            currentStart = m;
        } else if (!isActive && currentStart !== null) {
            const sStart = addMonths(currentDate, currentStart);
            const sEnd = addMonths(currentDate, m - 1);
            const stepUpYears = Math.floor(currentStart / 12);
            const steppedAmount = config.rawSip * Math.pow(1 + config.rawStepUp, stepUpYears);

            investmentStreams.push({
                name: `Primary SIP Segment ${streamIndex++}`,
                amount: steppedAmount,
                start_date: formatISO(sStart),
                end_date_mode: "Fixed",
                end_date: formatISO(sEnd),
                step_up_percent: config.rawStepUp * 100,
                step_up_frequency: "Annual",
                step_up_date: formatISO(currentDate)
            });
            currentStart = null;
        }
    }
    
    // Last stream end_date_mode "At retirement"
    const lastStream = investmentStreams[investmentStreams.length - 1];
    if (lastStream) {
        const expectedEnd = addMonths(currentDate, totalMonthsAccumulation - 1);
        if (lastStream.end_date === formatISO(expectedEnd)) {
            lastStream.end_date_mode = "At retirement";
            delete lastStream.end_date;
        }
    }

    // Redirected EMIs
    for (const l of config.rawLoans || []) {
        if (l.redirect) {
            const startM = Math.round(l.years * 12);
            let currentRedStart = null;
            let redStreamIndex = 1;
            
            for (let m = startM; m <= totalMonthsAccumulation; m++) {
                const isActive = m < totalMonthsAccumulation ? activeMonths[m] : false;
                if (isActive && currentRedStart === null) {
                    currentRedStart = m;
                } else if (!isActive && currentRedStart !== null) {
                    const rStart = addMonths(currentDate, currentRedStart);
                    const rEnd = addMonths(currentDate, m - 1);
                    
                    investmentStreams.push({
                        name: `Redirect SIP: ${l.name} Seg ${redStreamIndex++}`,
                        amount: l.emi,
                        start_date: formatISO(rStart),
                        end_date_mode: "Fixed",
                        end_date: formatISO(rEnd),
                        step_up_percent: config.rawStepUp * 100,
                        step_up_frequency: "Annual",
                        step_up_date: formatISO(currentDate)
                    });
                    currentRedStart = null;
                }
            }
            const lastRed = investmentStreams[investmentStreams.length - 1];
            if (lastRed && lastRed.name.startsWith(`Redirect SIP: ${l.name}`)) {
                const expectedEnd = addMonths(currentDate, totalMonthsAccumulation - 1);
                if (lastRed.end_date === formatISO(expectedEnd)) {
                    lastRed.end_date_mode = "At retirement";
                    delete lastRed.end_date;
                }
            }
        }
    }

    // Side Incomes
    for (const s of config.rawSideIncomes || []) {
        investmentStreams.push({
            name: `Side Income: ${s.name}`,
            amount: s.inflatedValue, // Pre-inflated value passed
            start_date_mode: "At retirement",
            step_up_percent: s.growthRate * 100,
            step_up_frequency: "Annual",
            step_up_date: formatISO(retirementDate)
        });
    }

    // Resolve Goals
    const resolvedGoals = (config.goals || []).map(goal => {
        const g = { ...goal };
        if (String(g.start_date_mode).toLowerCase() === 'at retirement') {
            g.start_date = retirementDate;
        } else {
            g.start_date = parseDate(g.start_date);
        }
        if (g.structure === 'Recurring') {
            g.occurrences = resolveRecurringOccurrences(g, deathDate);
        }
        return g;
    });

    // Expand non-replenishing goals
    const goalDfs = {};
    let lastGoalDate = new Date(currentDate.getTime());
    for (const goal of resolvedGoals) {
        if (String(goal.nature).toLowerCase() === 'replenishing') continue;
        const tranches = expandRecurringGoalToTranches(goal, currentDate);
        for (let i = 0; i < tranches.length; i++) {
            const { date: trancheDate, amount: trancheFv } = tranches[i];
            if (trancheDate.getTime() > lastGoalDate.getTime()) {
                lastGoalDate = trancheDate;
            }
            const label = tranches.length === 1 ? goal.name : `${goal.name} (${i + 1}/${tranches.length})`;
            goalDfs[label] = calculateGoalCashflows(
                goal.type, trancheDate, trancheFv, instrumentParams, currentDate
            );
        }
    }

    const finalDate = new Date(Math.min(Math.max(lastGoalDate.getTime(), deathDate.getTime()), _MAX_SAFE_DATE.getTime()));

    // Generate Investment Cashflows
    const investmentList = [];
    const dateRange = [];
    let dIter = new Date(currentDate.getTime());
    while (dIter.getTime() <= finalDate.getTime()) {
        dateRange.push(new Date(dIter.getTime()));
        dIter = addMonths(dIter, 1);
    }

    for (const d of dateRange) {
        let monthInvestment = 0;
        for (const stream of investmentStreams) {
            const streamStart = parseDate(stream.start_date);
            const sStart = new Date(Math.max(streamStart.getTime(), currentDate.getTime()));
            const endMode = stream.end_date_mode || 'Fixed';
            let sEnd;
            let mask = false;

            if (endMode === 'At retirement') {
                sEnd = retirementDate;
                mask = (d.getTime() >= sStart.getTime() && d.getTime() < sEnd.getTime());
            } else {
                sEnd = new Date(Math.min(parseDate(stream.end_date).getTime(), finalDate.getTime()));
                mask = (d.getTime() >= sStart.getTime() && d.getTime() <= sEnd.getTime());
            }

            if (sEnd.getTime() < sStart.getTime()) continue;

            if (mask) {
                const amountBase = parseFloat(stream.amount);
                const stepPct = parseFloat(stream.step_up_percent ?? 0.0);
                const stepFreq = stream.step_up_frequency || 'Annual';
                const stepAnchor = parseDate(stream.step_up_date ?? currentDate);
                monthInvestment += amountAtDateWithStepup(amountBase, stepPct, stepFreq, stepAnchor, streamStart, d);
            }
        }
        investmentList.push({ date: d, investment: monthInvestment });
    }

    // Compute replenishing payouts
    const payoutsListRaw = [];
    for (const goal of resolvedGoals) {
        if (String(goal.nature).toLowerCase() !== 'replenishing') continue;
        const tranches = expandRecurringGoalToTranches(goal, currentDate);
        for (const tr of tranches) {
            payoutsListRaw.push({ date: tr.date, amount: tr.amount });
        }
    }

    // Group payouts by Date
    const payoutsMap = {};
    for (const p of payoutsListRaw) {
        const k = p.date.getTime();
        payoutsMap[k] = (payoutsMap[k] || 0) + p.amount;
    }
    const payoutsList = Object.entries(payoutsMap).map(([k, amt]) => ({ date: new Date(parseInt(k)), amount: amt })).sort((a, b) => a.date.getTime() - b.date.getTime());

    // Net investments against payouts
    const { netPayouts, surplusInvestments } = netInvestmentAgainstPayouts(investmentList, payoutsList);

    // Pool simulation
    let poolTransList = [];
    let coreReplenishments = [];
    let poolMovements = [];
    if (netPayouts.length > 0) {
        const poolStart = new Date(Math.min(Math.min(...netPayouts.map(p => p.date.getTime())), retirementDate.getTime()));
        const poolRes = simulatePool(netPayouts, currentDate, finalDate, instrumentParams.debt, instrumentParams.hybrid, poolStart);
        if (poolRes.failureDate) {
            return {
                success: false,
                failureDetails: { date: poolRes.failureDate, amount: 0, description: poolRes.failureReason },
                comprehensiveLog: [], goalDfs
            };
        }
        poolTransList = poolRes.poolTransactions;
        coreReplenishments = poolRes.coreReplenishments;
        poolMovements = poolRes.poolMovements;
    }

    // Build Core Corpus transitions
    const coreTransactions = [];
    const coreNavStart = getNav(currentDate, currentDate, instrumentParams.core_corpus.returnRate);
    coreTransactions.push({
        Date: currentDate, Amount: parseFloat(config.current_corpus), NAV: coreNavStart,
        units: parseFloat(config.current_corpus) / coreNavStart, Description: 'Current Corpus'
    });

    for (const surplus of surplusInvestments) {
        if (surplus.investment <= 0) continue;
        const nav = getNav(surplus.date, currentDate, instrumentParams.core_corpus.returnRate);
        coreTransactions.push({
            Date: surplus.date, Amount: surplus.investment, NAV: nav,
            units: surplus.investment / nav, Description: 'Investment'
        });
    }

    // One-time investments
    for (const w of config.one_time_investments || []) {
        const wdate = parseDate(w.date);
        const wamount = parseFloat(w.amount ?? 0);
        if (wamount === 0 || wdate.getTime() < currentDate.getTime() || wdate.getTime() > finalDate.getTime()) continue;
        const nav = getNav(wdate, currentDate, instrumentParams.core_corpus.returnRate);
        coreTransactions.push({
            Date: wdate, Amount: wamount, NAV: nav,
            units: wamount / nav, Description: `One-time Investment: ${w.name || ''}`.trim()
        });
    }

    coreTransactions.sort((a, b) => a.Date.getTime() - b.Date.getTime());

    // Gather core corpus withdrawals
    const withdrawals = [];
    // 1. Goal withdrawals
    for (const [name, df] of Object.entries(goalDfs)) {
        for (const row of df) {
            if (row.inflow_from === 'core corpus') {
                withdrawals.push({
                    Date: row.inflow_date,
                    Amount: row.inflow_amount,
                    Description: `Moving to ${row.place} for ${name} goal.`
                });
            }
        }
    }
    // 2. Pool refills
    for (const ref of coreReplenishments) {
        withdrawals.push({
            Date: ref.Date,
            Amount: ref.Amount,
            Description: ref.Description
        });
    }

    withdrawals.sort((a, b) => a.Date.getTime() - b.Date.getTime());

    // Execute FIFO core liquidations
    const cc_stcg = instrumentParams.core_corpus.stcg_tax;
    const cc_ltcg = instrumentParams.core_corpus.ltcg_tax;
    const corePool = new InvestmentPool('Core', cc_stcg, cc_ltcg);

    // Initialize core pool with the transactions
    const finalTransList = [];
    const activeLots = []; // We redeem FIFO from here

    for (const tx of coreTransactions) {
        const lot = new TaxLot(tx.Date, tx.units, tx.NAV);
        activeLots.push(lot);
    }

    let success = true;
    let failureDetails = null;

    for (const wd of withdrawals) {
        const wdDate = wd.Date;
        const wdAmount = wd.Amount;
        const wdNav = getNav(wdDate, currentDate, instrumentParams.core_corpus.returnRate);

        // Filter lots available before/on withdrawal date
        const availableIdxs = [];
        for (let i = 0; i < activeLots.length; i++) {
            if (activeLots[i].date.getTime() <= wdDate.getTime()) {
                availableIdxs.push(i);
            }
        }

        if (availableIdxs.length === 0) {
            success = false;
            failureDetails = { date: wdDate, amount: wdAmount, description: wd.Description };
            break;
        }

        let remainingAmount = wdAmount;
        let totalUnitsWithdrawn = 0;
        let totalPretaxAmount = 0;
        let totalTaxPaid = 0;

        const lotsToRemove = [];
        const lotsUpdated = {};

        for (const idx of availableIdxs) {
            if (remainingAmount <= 0) break;

            const lot = activeLots[idx];
            const currVal = lot.currentValue(wdNav);
            const gains = currVal - lot.purchaseVal;
            const msHeld = wdDate.getTime() - lot.date.getTime();
            const daysHeld = Math.round(msHeld / 86400000);
            const rate = daysHeld <= 365 ? cc_stcg : cc_ltcg;
            const tax = Math.max(0, gains * rate);
            const postTaxVal = currVal - tax;

            if (postTaxVal <= remainingAmount) {
                remainingAmount -= postTaxVal;
                lotsToRemove.push(idx);
                totalUnitsWithdrawn += lot.units;
                totalPretaxAmount += currVal;
                totalTaxPaid += tax;
            } else {
                const fraction = remainingAmount / postTaxVal;
                const unitsWd = lot.units * fraction;
                const pretaxWd = currVal * fraction;
                const taxWd = tax * fraction;

                totalUnitsWithdrawn += unitsWd;
                totalPretaxAmount += pretaxWd;
                totalTaxPaid += taxWd;

                lotsUpdated[idx] = {
                    units: lot.units - unitsWd,
                    purchaseVal: lot.purchaseVal * (1 - fraction)
                };
                remainingAmount = 0;
            }
        }

        if (remainingAmount > 1e-6) {
            success = false;
            failureDetails = { date: wdDate, amount: remainingAmount, description: wd.Description };
            break;
        }

        // Apply updates & removals
        for (const [idx, up] of Object.entries(lotsUpdated)) {
            activeLots[idx].units = up.units;
            activeLots[idx].purchaseVal = up.purchaseVal;
        }
        lotsToRemove.sort((a, b) => b - a);
        for (const idx of lotsToRemove) {
            activeLots.splice(idx, 1);
        }

        finalTransList.push({
            Date: wdDate, Amount: -totalPretaxAmount, NAV: wdNav,
            units: -totalUnitsWithdrawn, Description: wd.Description,
            tax: totalTaxPaid, fully_funded: true, shortfall: 0
        });
    }

    if (!success) {
        return { success: false, failureDetails, comprehensiveLog: [], goalDfs };
    }

    // Build the master monthly timeline to generate final metrics
    const masterLog = [];
    const dLimit = new Date(finalDate.getTime());
    let mIter = new Date(currentDate.getTime());

    // Complete transaction list for Core
    const allCoreTrans = [...coreTransactions];
    for (const wd of finalTransList) {
        allCoreTrans.push({
            Date: wd.Date, Amount: wd.Amount, NAV: wd.NAV, units: wd.units, Description: wd.Description
        });
    }

    while (mIter.getTime() <= dLimit.getTime()) {
        const monthEnd = new Date(Date.UTC(mIter.getUTCFullYear(), mIter.getUTCMonth() + 1, 0)); // last day of month

        // Core units summation up to monthEnd
        let coreUnits = 0;
        for (const tx of allCoreTrans) {
            if (tx.Date.getTime() <= monthEnd.getTime()) {
                coreUnits += tx.units;
            }
        }
        const coreNav = getNav(monthEnd, currentDate, instrumentParams.core_corpus.returnRate);
        const coreVal = Math.max(0, coreUnits * coreNav);

        // Debt & Hybrid Pool values
        let debtVal = 0.0;
        let hybridVal = 0.0;
        if (netPayouts.length > 0) {
            // Build temporary pool states up to monthEnd
            const tPoolD = new InvestmentPool('Debt', instrumentParams.debt.stcg_tax, instrumentParams.debt.ltcg_tax);
            const tPoolH = new InvestmentPool('Hybrid', instrumentParams.hybrid.stcg_tax, instrumentParams.hybrid.ltcg_tax);
            
            for (const tx of poolTransList) {
                if (tx.Date.getTime() <= monthEnd.getTime()) {
                    const pool = tx.Pool === 'Debt' ? tPoolD : tPoolH;
                    if (tx.Amount > 0) {
                        pool.invest(tx.Date, tx.Amount, tx.NAV, tx.Description);
                    } else {
                        if (tx.Description === "Transfer to Debt (Surplus)" || tx.Description === "Goal Payout") {
                            pool.redeemGrossAmount(tx.Date, Math.abs(tx.Amount), tx.NAV, tx.Description);
                        } else {
                            pool.redeemNetAmount(tx.Date, Math.abs(tx.Amount), tx.NAV, tx.Description);
                        }
                    }
                }
            }
            const dNav = getNav(monthEnd, currentDate, instrumentParams.debt.returnRate);
            const hNav = getNav(monthEnd, currentDate, instrumentParams.hybrid.returnRate);
            debtVal = tPoolD.getMarketValue(dNav);
            hybridVal = tPoolH.getMarketValue(hNav);
        }

        // Goal specific pools
        let goalDebtTotal = 0;
        let goalHybridTotal = 0;
        for (const [goalName, df] of Object.entries(goalDfs)) {
            for (const row of df) {
                const place = row.place;
                if (place !== 'debt' && place !== 'hybrid') continue;
                
                const startD = row.inflow_date;
                const endD = row.outflow_date ? row.outflow_date : finalDate;

                if (monthEnd.getTime() >= startD.getTime() && monthEnd.getTime() <= endD.getTime()) {
                    const params = instrumentParams[place];
                    const startNav = getNav(startD, currentDate, params.returnRate);
                    const units = row.inflow_amount / startNav;
                    const currNav = getNav(monthEnd, currentDate, params.returnRate);
                    const val = units * currNav;
                    if (place === 'debt') {
                        goalDebtTotal += val;
                    } else {
                        goalHybridTotal += val;
                    }
                }
            }
        }

        const totalNetWorth = coreVal + debtVal + hybridVal + goalDebtTotal + goalHybridTotal;

        // Cashflow values
        const investmentRow = investmentList.find(inv => inv.date.getUTCFullYear() === monthEnd.getUTCFullYear() && inv.date.getUTCMonth() === monthEnd.getUTCMonth());
        const payoutsRow = payoutsList.find(p => p.date.getUTCFullYear() === monthEnd.getUTCFullYear() && p.date.getUTCMonth() === monthEnd.getUTCMonth());

        masterLog.push({
            date: formatISO(monthEnd),
            core: Math.round(coreVal * 100) / 100,
            debt: Math.round((debtVal + goalDebtTotal) * 100) / 100,
            hybrid: Math.round((hybridVal + goalHybridTotal) * 100) / 100,
            total: Math.round(totalNetWorth * 100) / 100,
            investment: investmentRow ? investmentRow.investment : 0,
            payouts: payoutsRow ? payoutsRow.amount : 0
        });

        mIter = addMonths(mIter, 1);
    }

    return {
        success: true,
        failureDetails: null,
        comprehensiveLog: masterLog,
        goalDfs
    };
}

// --- 9. The Solvers (Capped at 60 Iterations) ---
function runSolverSearch(config, instrumentParams) {
    const currentDate = parseDate(config.current_date);
    const targetLifetime = parseFloat(config.target_lifetime ?? 90);
    const currentAge = parseFloat(config.current_age ?? 30);
    const deathDate = addMonths(currentDate, Math.round((targetLifetime - currentAge) * 12));

    const hiCap = deathDate;
    let low = currentDate.getUTCFullYear() * 12 + currentDate.getUTCMonth();
    let high = hiCap.getUTCFullYear() * 12 + hiCap.getUTCMonth();
    let result = null;

    let iterations = 0;
    while (low <= high && iterations < 60) {
        iterations++;
        const mid = Math.floor((low + high) / 2);
        const year = Math.floor(mid / 12);
        const month = mid % 12;
        const cand = new Date(Date.UTC(year, month, 1));
        const res = runSimulation(config, cand, instrumentParams);
        if (res.success) {
            result = cand;
            high = mid - 1; // Try earlier
        } else {
            low = mid + 1; // Must retire later
        }
    }

    return result;
}

// Solver for Minimum SIP required at target retirement age
function solveRequiredSip(config, targetRetirementDate, instrumentParams) {
    let low = 0;
    let high = 20000000; // 2 Crore/month max
    let requiredSip = high;

    let iterations = 0;
    while (low <= high && iterations < 60) {
        iterations++;
        const mid = (low + high) / 2;
        const testConfig = { ...config, rawSip: mid };
        const res = runSimulation(testConfig, targetRetirementDate, instrumentParams);
        if (res.success) {
            requiredSip = mid;
            high = mid - 1e-2;
        } else {
            low = mid + 1e-2;
        }
    }
    return requiredSip;
}

// Solver for Lumpsum top-up required today
function solveRequiredLumpsum(config, targetRetirementDate, instrumentParams) {
    let low = 0;
    let high = 1e11; // 10,000 Crores max
    let requiredLump = high;

    let iterations = 0;
    while (low <= high && iterations < 60) {
        iterations++;
        const mid = (low + high) / 2;
        const testConfig = { ...config, current_corpus: parseFloat(config.current_corpus) + mid };
        const res = runSimulation(testConfig, targetRetirementDate, instrumentParams);
        if (res.success) {
            requiredLump = mid;
            high = mid - 1e-2;
        } else {
            low = mid + 1e-2;
        }
    }
    return requiredLump;
}

// Solver for Target Corpus sustaining lifestyle post-retirement
function solveTargetCorpus(monthlyExpense, sideIncomes, inflation, equityRate, postRetYears) {
    let low = 0;
    let high = 1e11; // 10,000 Crores
    let requiredCorpus = high;

    function runPostRetSim(startCorpus) {
        const BUFFER_YEARS = 4;
        let activeSideIncomes = sideIncomes.map(si => ({ monthly: si.inflatedValue, growth: si.growthRate || 0 }));
        const initialNetExpense = Math.max(0, monthlyExpense * 12 - activeSideIncomes.reduce((s, si) => s + si.monthly * 12, 0));
        const bufferNeeded = initialNetExpense * BUFFER_YEARS;
        let hybrid = bufferNeeded / 2;
        let debt   = bufferNeeded / 2;
        let equity = Math.max(0, startCorpus - bufferNeeded);
        let curGrossExpense = monthlyExpense * 12;
        
        for (let y = 1; y <= postRetYears; y++) {
            equity *= (1 + equityRate);
            hybrid *= 1.10;
            debt   *= 1.08;

            const totalSideIncome = activeSideIncomes.reduce((s, si) => s + si.monthly * 12, 0);
            const netDeficit = Math.max(0, curGrossExpense - totalSideIncome);

            let draw = netDeficit;
            if (debt >= draw) { debt -= draw; draw = 0; }
            else { draw -= debt; debt = 0; }
            if (draw > 0) { if (hybrid >= draw) { hybrid -= draw; draw = 0; } else { draw -= hybrid; hybrid = 0; } }
            if (draw > 0) { equity -= draw; }

            curGrossExpense *= (1 + inflation);
            activeSideIncomes.forEach(si => { si.monthly *= (1 + si.growth); });

            const nextSideIncome = activeSideIncomes.reduce((s, si) => s + si.monthly * 12, 0);
            const nextNetDeficit = Math.max(0, curGrossExpense - nextSideIncome);
            const targetBuf = nextNetDeficit * BUFFER_YEARS;
            const curBuf = hybrid + debt;
            if (curBuf < targetBuf && equity > 0) {
                const topup = Math.min(targetBuf - curBuf, equity);
                equity -= topup;
                hybrid += topup / 2;
                debt   += topup / 2;
            }

            if (equity + hybrid + debt <= 0) {
                return false;
            }
        }
        return true;
    }

    let iterations = 0;
    while (low <= high && iterations < 60) {
        iterations++;
        const mid = (low + high) / 2;
        if (runPostRetSim(mid)) {
            requiredCorpus = mid;
            high = mid - 1e-2;
        } else {
            low = mid + 1e-2;
        }
    }
    return requiredCorpus;
}

// --- 10. Server-Side Input Validator ---
function validatePlanConfig(config) {
    const errors = [];
    if (!config || typeof config !== 'object') {
        return ["config must be a dict"];
    }

    const corpus = config.current_corpus;
    if (corpus === undefined || corpus === null) {
        errors.push("current_corpus is required");
    } else {
        if (parseFloat(corpus) < 0 || isNaN(parseFloat(corpus))) {
            errors.push("current_corpus must be >= 0");
        }
    }

    const currentAge = parseFloat(config.current_age ?? 30);
    const targetLifetime = parseFloat(config.target_lifetime ?? 90);
    if (isNaN(currentAge) || isNaN(targetLifetime)) {
        errors.push("current_age and target_lifetime must be numbers");
    } else if (targetLifetime <= currentAge) {
        errors.push("target_lifetime must be greater than current_age");
    }

    for (let i = 0; i < (config.goals || []).length; i++) {
        const goal = config.goals[i];
        const label = goal.name || `goal #${i + 1}`;
        const amount = parseFloat(goal.amount);
        if (isNaN(amount) || amount < 0) {
            errors.push(`${label}: amount must be >= 0`);
        }

        if (goal.structure === "Recurring") {
            if (!_FREQ_TO_MONTHS[goal.frequency]) {
                errors.push(`${label}: recurring goal needs a valid frequency (Annual, Half-Yearly, Quarterly, Monthly)`);
            }
            if (goal.end_mode === "Occurrences") {
                const occ = parseInt(goal.occurrences);
                if (isNaN(occ) || occ < 1) {
                    errors.push(`${label}: occurrences must be >= 1`);
                }
            } else if (goal.end_mode === "Fixed date") {
                if (!goal.end_date) {
                    errors.push(`${label}: Fixed-date end_mode requires an end_date`);
                } else {
                    const s = parseDate(goal.start_date);
                    const e = parseDate(goal.end_date);
                    if (s && e && e.getTime() < s.getTime()) {
                        errors.push(`${label}: end_date must be on or after start_date`);
                    }
                }
            }

            // Span cap for non-replenishing recurring goal
            if (String(goal.nature).toLowerCase() !== 'replenishing') {
                let spanMonths = 0;
                let isLifetime = (goal.end_mode === 'Lifetime');
                if (isLifetime) {
                    errors.push(`${label}: non-replenishing recurring goal with Lifetime end_mode spans more than 4 years; shorten it or model it as a Replenishing goal.`);
                } else {
                    const freqMonths = _FREQ_TO_MONTHS[goal.frequency];
                    if (freqMonths !== undefined) {
                        if (goal.end_mode === "Occurrences") {
                            const occ = parseInt(goal.occurrences ?? 1) || 1;
                            spanMonths = Math.max(0, (occ - 1) * freqMonths);
                        } else if (goal.end_mode === "Fixed date") {
                            const start = parseDate(goal.start_date);
                            const end = parseDate(goal.end_date);
                            if (start && end && end.getTime() >= start.getTime()) {
                                spanMonths = diffMonths(start, end);
                            }
                        }
                        if (spanMonths > 48) {
                            errors.push(`${label}: non-replenishing recurring goal spans ${spanMonths} months — more than 4 years; shorten it or model it as a Replenishing goal.`);
                        }
                    }
                }
            }
        }
    }

    for (let i = 0; i < (config.one_time_investments || []).length; i++) {
        const o = config.one_time_investments[i];
        const label = o.name || `one-time investment #${i + 1}`;
        const amount = parseFloat(o.amount);
        if (isNaN(amount) || amount < 0) {
            errors.push(`${label}: amount must be >= 0`);
        }
    }

    return errors;
}

// --- 11. Request Handler Entrypoint ---
module.exports = async (req, res) => {
    // Set headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ success: false, errors: ["Method Not Allowed"] });
        return;
    }

    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', async () => {
        try {
            const payload = JSON.parse(body);

            // 1. Gather & format inputs
            const clientName = payload.clientName || "Rahul Sharma";
            const currentAge = parseInt(payload.currentAge) || 32;
            const retirementAge = parseInt(payload.retirementAge) || 55;
            const monthlyExpense = parseFloat(payload.monthlyExpense) || 0;
            const inflation = (parseFloat(payload.inflation) || 6) / 100;
            const stepUp = (parseFloat(payload.stepUp) || 10) / 100;
            const initialCorpus = parseFloat(payload.currentCorpus) || 0;
            const existingSip = parseFloat(payload.currentSip) || 0;
            const riskReturn = (parseFloat(payload.riskAppetite) || 12) / 100;

            const currentDate = parseDate("2026-06-01");
            const targetLifetime = 100;

            // Resolve instrument parameters dynamically with selected risk appetite return
            const instrumentParams = {
                core_corpus: { returnRate: riskReturn, stcg_tax: 0.20, ltcg_tax: 0.125 },
                equity:      { returnRate: 0.12, stcg_tax: 0.20, ltcg_tax: 0.125 },
                debt:        { returnRate: 0.06, stcg_tax: 0.20, ltcg_tax: 0.125 },
                hybrid:      { returnRate: 0.10, stcg_tax: 0.20, ltcg_tax: 0.125 },
                cash:        { returnRate: 0.04, stcg_tax: 0.20, ltcg_tax: 0.125 }
            };

            // Build raw inputs structure inside config so runSimulation can access them
            const config = {
                current_date: formatISO(currentDate),
                current_age: currentAge,
                target_lifetime: targetLifetime,
                current_corpus: initialCorpus,
                risk_profile: "Balanced",
                goals: [],
                one_time_investments: [],
                
                // Raw properties for dynamic stream building
                rawSip: existingSip,
                rawStepUp: stepUp,
                rawSabbaticals: (payload.sabbaticals || []).map(s => ({
                    name: s.name || "Sabbatical",
                    start: parseFloat(s.start) || 0,
                    duration: parseFloat(s.duration) || 0,
                    cost: parseFloat(s.cost) || 0
                })),
                rawLoans: (payload.loans || []).map(l => ({
                    name: l.name,
                    emi: parseFloat(l.emi) || 0,
                    years: parseFloat(l.years) || 0,
                    redirect: l.redirect !== false
                })),
                rawSideIncomes: (payload.sideIncomes || []).map(s => ({
                    name: s.name,
                    val: parseFloat(s.val) || 0,
                    growth: parseFloat(s.growth) || 0,
                    growthRate: (parseFloat(s.growth) || 0) / 100,
                    inflatedValue: (parseFloat(s.val) || 0) * Math.pow(1 + (parseFloat(s.growth) || 0) / 100, retirementAge - currentAge)
                }))
            };

            // Sabbatical Draws as Goals
            for (const s of config.rawSabbaticals) {
                config.goals.push({
                    name: s.name,
                    type: "Non-Negotiable",
                    nature: "Non-replenishing",
                    structure: "Recurring",
                    start_date_mode: "Fixed",
                    start_date: formatISO(addMonths(currentDate, Math.round(s.start * 12))),
                    amount: s.cost,
                    frequency: "Monthly",
                    end_mode: "Occurrences",
                    occurrences: Math.round(s.duration * 12),
                    inflation_percent: inflation * 100
                });
            }

            // Financial Goals
            for (const g of payload.goals || []) {
                const cost = parseFloat(g.cost) || 0;
                const years = parseFloat(g.years) || 0;
                const duration = parseInt(g.duration) || 1;
                const inf = (parseFloat(g.inflation) || 6) / 100;
                const downPercent = g.hasLoan ? (parseFloat(g.down) || 100) / 100 : 1.0;
                const tenure = g.hasLoan ? parseInt(g.tenure) || 0 : 0;
                const rate = g.hasLoan ? (parseFloat(g.rate) || 0) / 100 : 0.0;

                const goalStart = addMonths(currentDate, years * 12);
                
                config.goals.push({
                    name: g.name,
                    type: "Non-Negotiable",
                    nature: "Non-replenishing",
                    structure: g.type === "Lumpsum" ? "Lumpsum" : "Recurring",
                    start_date_mode: "Fixed",
                    start_date: formatISO(goalStart),
                    amount: cost * downPercent,
                    frequency: g.type === "Recurring" ? "Annual" : undefined,
                    end_mode: g.type === "Recurring" ? "Occurrences" : undefined,
                    occurrences: g.type === "Recurring" ? duration : undefined,
                    inflation_percent: inf * 100
                });

                if (g.hasLoan && tenure > 0 && rate > 0 && downPercent < 1.0) {
                    if (g.type === "Lumpsum") {
                        const futureCost = cost * Math.pow(1 + inf, years);
                        const loanAmt = futureCost * (1.0 - downPercent);
                        const r = rate / 12, n = tenure * 12;
                        const emi = (loanAmt * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
                        config.goals.push({
                            name: `${g.name} (Mortgage)`,
                            type: "Non-Negotiable",
                            nature: "Non-replenishing",
                            structure: "Recurring",
                            start_date_mode: "Fixed",
                            start_date: formatISO(addMonths(goalStart, 1)),
                            amount: emi,
                            frequency: "Monthly",
                            end_mode: "Occurrences",
                            occurrences: tenure * 12,
                            inflation_percent: 0.0
                        });
                    } else {
                        for (let d = 0; d < duration; d++) {
                            const occStart = addMonths(goalStart, d * 12);
                            const futureCost = cost * Math.pow(1 + inf, years + d);
                            const loanAmt = futureCost * (1.0 - downPercent);
                            const r = rate / 12, n = tenure * 12;
                            const emi = (loanAmt * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
                            config.goals.push({
                                name: `${g.name} (Mortgage Yr ${d + 1})`,
                                type: "Non-Negotiable",
                                nature: "Non-replenishing",
                                structure: "Recurring",
                                start_date_mode: "Fixed",
                                start_date: formatISO(addMonths(occStart, 1)),
                                amount: emi,
                                frequency: "Monthly",
                                end_mode: "Occurrences",
                                occurrences: tenure * 12,
                                inflation_percent: 0.0
                            });
                        }
                    }
                }
            }

            // Existing Loans as Goals
            for (const l of config.rawLoans) {
                config.goals.push({
                    name: l.name,
                    type: "Non-Negotiable",
                    nature: "Non-replenishing",
                    structure: "Recurring",
                    start_date_mode: "Fixed",
                    start_date: formatISO(currentDate),
                    amount: l.emi,
                    frequency: "Monthly",
                    end_mode: "Occurrences",
                    occurrences: Math.round(l.years * 12),
                    inflation_percent: 0.0
                });
            }

            // One-time Windfall inflows
            for (const w of payload.windfalls || []) {
                config.one_time_investments.push({
                    name: w.name,
                    date: formatISO(addMonths(currentDate, Math.round(parseFloat(w.year) * 12))),
                    amount: parseFloat(w.amount) || 0
                });
            }

            // Bonuses
            for (const b of payload.bonuses || []) {
                const amount = parseFloat(b.amount) || 0;
                const freq = b.freq || "Annual";
                const bStep = (parseFloat(b.step) || 0) / 100;
                
                const stepMonths = freq === "Annual" ? 12 : (freq === "Semi-Annual" ? 6 : 3);
                const count = (retirementAge - currentAge) * 12 / stepMonths;
                
                for (let k = 0; k < count; k++) {
                    const occDate = addMonths(currentDate, k * stepMonths);
                    const yearsPassed = Math.floor((k * stepMonths) / 12);
                    const bAmount = amount * Math.pow(1 + bStep, yearsPassed);
                    config.one_time_investments.push({
                        name: `${b.name} (Occ ${k + 1})`,
                        date: formatISO(occDate),
                        amount: bAmount
                    });
                }
            }

            // Post-retirement living expense goal
            config.goals.push({
                name: "Post-retirement living expense",
                type: "Non-Negotiable",
                nature: "Replenishing",
                structure: "Recurring",
                start_date_mode: "At retirement",
                amount: monthlyExpense,
                frequency: "Monthly",
                end_mode: "Lifetime",
                inflation_percent: inflation * 100
            });

            // 2. Server-side validation
            const validationErrors = validatePlanConfig(config);
            if (validationErrors.length > 0) {
                res.status(400).json({ success: false, errors: validationErrors });
                return;
            }

            // 3. Solve earliest retirement date dynamically
            const solvedDate = runSolverSearch(config, instrumentParams);
            const isFeasible = (solvedDate !== null);
            
            // If feasible, run at solvedDate. If not, run at the target retirementAge.
            const totalYears = retirementAge - currentAge;
            const targetRetirementDate = addMonths(currentDate, totalYears * 12);
            const retirementDate = isFeasible ? solvedDate : targetRetirementDate;

            const baselineSim = runSimulation(config, retirementDate, instrumentParams);

            // Solve target retirement corpus
            const solvedAge = isFeasible ? currentAge + diffYears(currentDate, solvedDate) : retirementAge;
            const postRetYears = Math.max(0, 100 - solvedAge);
            
            // Re-grown side incomes based on actual solved age
            const actualSideIncomes = config.rawSideIncomes.map(si => ({
                inflatedValue: si.val * Math.pow(1 + si.growthRate, solvedAge - currentAge),
                growthRate: si.growthRate
            }));

            const targetRetirementCorpus = solveTargetCorpus(monthlyExpense, actualSideIncomes, inflation, 0.10, postRetYears);

            // Compute diagnostic variables
            let resultData = {};

            const _buildGoalResults = (goalsList, rDate, cDate) => {
                return (goalsList || []).filter(g => String(g.nature).toLowerCase() !== 'replenishing').map(g => {
                    let start;
                    if (String(g.start_date_mode).toLowerCase() === 'at retirement' && rDate) {
                        start = rDate;
                    } else if (g.start_date) {
                        start = parseDate(g.start_date);
                    } else {
                        start = cDate;
                    }
                    const years = Math.max(0.0, diffYears(cDate, start));
                    const pv = parseFloat(g.amount) || 0;
                    const inflation = parseFloat(g.inflation_percent ?? 0.0);
                    const fv = pv * Math.pow(1 + inflation / 100.0, years);
                    return {
                        name: g.name,
                        pv: Math.round(pv * 100) / 100,
                        fv_at_start: Math.round(fv * 100) / 100,
                        start_date: formatISO(start),
                        nature: g.nature,
                        structure: g.structure
                    };
                });
            };

            if (isFeasible) {
                // Solver for exact required SIP to make it feasible
                const minSip = solveRequiredSip(config, retirementDate, instrumentParams);

                resultData = {
                    success: true,
                    targetRetirementCorpus,
                    mathematicallyRequiredSip: minSip,
                    baselineSip: existingSip,
                    baselineSimLog: baselineSim.comprehensiveLog,
                    goals: _buildGoalResults(config.goals, retirementDate, currentDate)
                };
            } else {
                // Plan is infeasible: compute diagnostics
                const sipFix = solveRequiredSip(config, retirementDate, instrumentParams);
                const lumpsumFix = solveRequiredLumpsum(config, retirementDate, instrumentParams);
                const viableRetirementDate = solvedDate; // which is null
                const viableRetirementAge = solvedDate ? solvedAge : 100;

                // Identify failure month details
                const failDetails = baselineSim.failureDetails;

                resultData = {
                    success: false,
                    targetRetirementCorpus,
                    mathematicallyRequiredSip: sipFix,
                    sipFix,
                    lumpsumFix,
                    viableRetirementAge: Math.round(viableRetirementAge * 10) / 10,
                    baselineSip: existingSip,
                    failureInfo: failDetails ? {
                        year: Math.floor(diffMonths(currentDate, failDetails.date) / 12),
                        cause: failDetails.description.includes('Goal') ? 'goal' : 'sabbatical',
                        goalName: failDetails.description,
                        netWorthAtFailure: -failDetails.amount,
                        requiredAmount: failDetails.amount
                    } : null,
                    baselineSimLog: baselineSim.comprehensiveLog,
                    goals: _buildGoalResults(config.goals, null, currentDate)
                };
            }

            // Split monthly log into years for display
            const displaySimLog = [];
            const postRetLog = [];

            const activeLog = baselineSim.comprehensiveLog;
            const solvedTotalYears = Math.round(diffYears(currentDate, retirementDate));
            const totalTimelineYears = 100 - currentAge;

            for (let y = 1; y <= totalTimelineYears; y++) {
                const age = currentAge + y;
                const mEndIdx = y * 12 - 1;
                const monthEndData = activeLog[mEndIdx];

                if (!monthEndData && y <= solvedTotalYears) {
                    displaySimLog.push({
                        year: y,
                        baseSip: 0,
                        totalEmiOut: 0,
                        totalWithdrawalOut: 0,
                        netInvestedIntoEquity: 0,
                        equity: 0,
                        hybrid: 0,
                        debt: 0,
                        totalNetWorth: -1,
                        isSabbaticalActive: false,
                        isFailureYear: true
                    });
                    break;
                }

                if (y <= solvedTotalYears) {
                    const months = activeLog.slice((y - 1) * 12, y * 12);
                    const totalSip = months.reduce((s, m) => s + m.investment, 0);
                    const totalWithdrawals = months.reduce((s, m) => s + m.payouts, 0);
                    
                    const isSab = config.rawSabbaticals.some(s => (y - 1 < s.start + s.duration && y > s.start));

                    let emiOut = 0;
                    config.rawLoans.forEach(loan => { if (y <= Math.ceil(loan.years)) { emiOut += (loan.emi * 12); } });

                    displaySimLog.push({
                        year: y,
                        baseSip: isSab ? 0 : totalSip / 12,
                        totalEmiOut: emiOut,
                        totalWithdrawalOut: totalWithdrawals,
                        netInvestedIntoEquity: totalSip,
                        equity: monthEndData.core,
                        hybrid: monthEndData.hybrid,
                        debt: monthEndData.debt,
                        totalNetWorth: monthEndData.total,
                        isSabbaticalActive: isSab,
                        isFailureYear: false
                    });
                } else {
                    if (!monthEndData) {
                        postRetLog.push({
                            equity: 0,
                            hybrid: 0,
                            debt: 0,
                            totalNetWorth: 0,
                            annualDraw: 0
                        });
                        continue;
                    }
                    const months = activeLog.slice((y - 1) * 12, y * 12);
                    const annualDraw = months.reduce((s, m) => s + m.payouts, 0);

                    postRetLog.push({
                        equity: monthEndData.core,
                        hybrid: monthEndData.hybrid,
                        debt: monthEndData.debt,
                        totalNetWorth: monthEndData.total,
                        annualDraw: annualDraw
                    });
                }
            }

            res.status(200).json({
                success: resultData.success,
                targetRetirementCorpus: Math.round(resultData.targetRetirementCorpus * 100) / 100,
                mathematicallyRequiredSip: Math.round(resultData.mathematicallyRequiredSip * 100) / 100,
                sipFix: resultData.sipFix ? Math.round(resultData.sipFix * 100) / 100 : undefined,
                lumpsumFix: resultData.lumpsumFix ? Math.round(resultData.lumpsumFix * 100) / 100 : undefined,
                viableRetirementAge: isFeasible ? Math.round(solvedAge * 10) / 10 : resultData.viableRetirementAge,
                baselineSip: resultData.baselineSip,
                failureInfo: resultData.failureInfo,
                accumulationLog: displaySimLog,
                postRetirementLog: postRetLog,
                goals: resultData.goals
            });

        } catch (err) {
            res.status(500).json({ success: false, errors: [err.message] });
        }
    });
};
