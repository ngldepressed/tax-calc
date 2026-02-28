function calculateAdvancedTax() {



    // ================================



    // 1. SAFE NUMBER PARSER



    // ================================



    function getNumber(id) {



        const el = document.getElementById(id);



        if (!el) return 0;



        let raw = el.value.trim();



        if (raw === "") return 0;



        raw = raw.replace(/,/g, '').replace(/^0+(?=\d)/, '');



        const num = Number(raw);



        return isNaN(num) ? 0 : num;



    }







    function roundIRS(num) {



        return Math.round(num);



    }







    // ================================



    // 2. INPUTS + GUARDRAILS



    // ================================



    const salary = Math.max(0, getNumber('income'));



    const overtime = Math.max(0, getNumber('overtime'));



    const tips = Math.max(0, getNumber('tips'));



    const capitalGains = Math.max(0, getNumber('capitalGains'));



    const withholding = Math.max(0, getNumber('withholding'));



   



    const age = Math.max(0, getNumber('age')); // affects childless EIC eligibility



    const numChildrenRaw = parseInt(document.getElementById('children')?.value) || 0;



    const numChildren = Math.min(Math.max(0, numChildrenRaw), 10);







    const numOtherDependentsRaw = parseInt(document.getElementById('otherDependents')?.value) || 0;



    const numOtherDependents = Math.min(Math.max(0, numOtherDependentsRaw), 10);







    const statusRaw = document.getElementById('status')?.value || 'single';



    const validStatuses = ['single', 'married', 'hoh'];



    const status = validStatuses.includes(statusRaw) ? statusRaw : 'single';







    const earnedIncome = salary + overtime + tips;



    const agi = earnedIncome + capitalGains;







    // ================================



    // 3. STANDARD DEDUCTION



    // ================================



    const standardDeduction = { single: 14800, married: 29600, hoh: 22200 };



    const stdDed = standardDeduction[status];



    const taxableIncome = Math.max(0, roundIRS(agi - stdDed));







    // ================================



    // 4. ORDINARY TAX BRACKETS



    // ================================



    const brackets = {



        single: [[11600, 0.10],[47150,0.12],[100525,0.22],[191950,0.24],[243725,0.32],[609350,0.35],[Infinity,0.37]],



        married:[[23200,0.10],[94300,0.12],[201050,0.22],[383900,0.24],[487450,0.32],[731200,0.35],[Infinity,0.37]],



        hoh:[[16550,0.10],[63100,0.12],[100500,0.22],[191950,0.24],[243700,0.32],[609350,0.35],[Infinity,0.37]]



    };







    function calculateOrdinaryTax(income, filingStatus) {



        let tax = 0, prev = 0;



        for (let [limit, rate] of brackets[filingStatus]) {



            if (income <= prev) break;



            const taxableAtBracket = Math.min(income, limit) - prev;



            tax += taxableAtBracket * rate;



            prev = limit;



        }



        return roundIRS(tax);



    }







    const ordinaryIncome = Math.max(0, taxableIncome - capitalGains);



    const ordinaryTax = calculateOrdinaryTax(ordinaryIncome, status);







    // ================================



    // 5. CAPITAL GAINS STACKING



    // ================================



    function calculateCapitalGainsTax() {



        if (capitalGains <= 0) return 0;



        const thresholds = { single:{zero:47000,fifteen:518900}, married:{zero:94000,fifteen:583750}, hoh:{zero:63000,fifteen:551350}};



        const {zero,fifteen} = thresholds[status];



        let remaining = capitalGains, tax = 0;



        const zeroSpace = Math.max(0, zero - ordinaryIncome);



        const zeroPortion = Math.min(remaining, zeroSpace); remaining -= zeroPortion;



        const fifteenSpace = Math.max(0, fifteen - Math.max(ordinaryIncome, zero));



        const fifteenPortion = Math.min(remaining, fifteenSpace);



        tax += fifteenPortion * 0.15; remaining -= fifteenPortion;



        if (remaining > 0) tax += remaining * 0.20;



        return roundIRS(tax);



    }







    const capitalGainsTax = calculateCapitalGainsTax();



    const totalTaxBeforeCredits = ordinaryTax + capitalGainsTax;







    // ================================



    // 6. CHILD TAX CREDIT + OTHER DEPENDENTS



    // ================================



    const CTC_PER_CHILD = 2000;



    const ACTC_MAX = 1600;



    const PHASEOUT_SINGLE = 200000;



    const PHASEOUT_MARRIED = 400000;







    const baseCTC = numChildren * CTC_PER_CHILD;



    const phaseoutThreshold = status === 'married' ? PHASEOUT_MARRIED : PHASEOUT_SINGLE;



    let phaseoutReduction = 0;



    if (agi > phaseoutThreshold) {



        const excess = agi - phaseoutThreshold;



        phaseoutReduction = Math.ceil(excess/1000)*50;



    }



    const allowedCTC = Math.max(0, baseCTC - phaseoutReduction);



    const nonRefundableCTC = Math.min(allowedCTC, totalTaxBeforeCredits);







    // Refundable portion (ACTC)



    const earnedExcess = Math.max(0, earnedIncome - 2500);



    const refundableLimit = numChildren * ACTC_MAX;



    const refundableCTC = Math.min(refundableLimit, roundIRS(earnedExcess * 0.15), allowedCTC - nonRefundableCTC);







    // Other Dependent Credit (non-refundable, $500 per dependent)



    const OTHER_DEP_CREDIT = 500;



    const nonRefundableODC = Math.min(numOtherDependents*OTHER_DEP_CREDIT, Math.max(0,totalTaxBeforeCredits - nonRefundableCTC));







    // ================================



    // 7. PROFESSIONAL EIC ENGINE



    // ================================



    function calculateEIC() {







    const INVESTMENT_LIMIT = 11000;



    if (capitalGains > INVESTMENT_LIMIT) return 0;







    if (numChildren === 0 && (age < 25 || age > 64)) return 0;







    const isMarried = status === 'married';



    const key = numChildren >= 3 ? 3 : numChildren;







    const table = {



        0:{phaseIn:0.0765,max:650,phaseOut:0.0765,phaseOutStart:9800},



        1:{phaseIn:0.34,max:4600,phaseOut:0.1598,phaseOutStart:23500},



        2:{phaseIn:0.40,max:7600,phaseOut:0.2106,phaseOutStart:23500},



        3:{phaseIn:0.45,max:8600,phaseOut:0.2106,phaseOutStart:23500}



    };







    const data = table[key];







    const phaseOutStart = isMarried



        ? data.phaseOutStart + 6000



        : data.phaseOutStart;







    // IRS uses lesser of earned income or AGI



    const incomeBase = Math.min(earnedIncome, agi);







    // 🔥 IRS TABLE BEHAVIOR:



    // Round income DOWN to nearest $50



    const lookupIncome = Math.floor(incomeBase / 50) * 50;







    // Phase-in (truncate, do not round normally)



    let credit = lookupIncome * data.phaseIn;







    // Cap at maximum



    credit = Math.min(credit, data.max);







    // Phase-out



    if (lookupIncome > phaseOutStart) {



        const reduction = (lookupIncome - phaseOutStart) * data.phaseOut;



        credit -= reduction;



    }







    // IRS worksheet truncates final credit



    return Math.max(0, Math.floor(credit));



}



    const eic = calculateEIC();







    // ================================



    // 8. OPTIONAL STATE TAX (example: CA, NY, TX)



    // ================================



    function calculateStateTax() {



        const state = document.getElementById('state')?.value || 'none';



        let rate = 0;



        switch(state) {



            case 'CA': rate=0.09; break;



            case 'NY': rate=0.065; break;



            case 'TX': rate=0; break;



            default: rate=0;



        }



        return roundIRS(taxableIncome*rate);



    }



    const stateTax = calculateStateTax();







    // ================================



    // 9. FINAL CALCULATION



    // ================================



    const taxAfterCredits = totalTaxBeforeCredits - nonRefundableCTC - nonRefundableODC;



    const totalPayments = refundableCTC + eic + withholding;



    const finalBalance = totalPayments - taxAfterCredits - stateTax;



    const refund = finalBalance>0 ? finalBalance : 0;



    const amountOwed = finalBalance<0 ? Math.abs(finalBalance) : 0;







    // ================================



    // 10. DISPLAY



    // ================================



    function format(num){return roundIRS(num).toLocaleString();}







   const explanation = `



<hr>



<h3>Why Is My Refund This High?</h3>







<div style="background:#f5f7fa;padding:15px;border-radius:8px;margin-top:10px;line-height:1.6;">







    <p><strong>Your federal tax was reduced to $0.</strong><br>



    Total tax before credits: <strong>$${format(totalTaxBeforeCredits)}</strong>.</p>







    <p><strong>Refundable Credits Included in This Refund:</strong></p>



    <ul>



        <li>Refundable Child Tax Credit (ACTC): <strong>$${format(refundableCTC)}</strong></li>



        <li>Earned Income Credit (EIC): <strong>$${format(eic)}</strong></li>



        ${numOtherDependents>0



            ? `<li>Other Dependent Credit Applied: $${format(nonRefundableODC)} ${nonRefundableODC===0 ? '(No remaining tax liability to offset)' : ''}</li>`



            : ''}



    </ul>







    <p style="font-size:0.9em;color:#555;">



    ACTC is limited to remaining unused Child Tax Credit.<br>



    Total CTC allowed: $${format(allowedCTC)}<br>



    Used to offset tax: $${format(nonRefundableCTC)}<br>



    Remaining eligible for refund:



    <strong>$${format(allowedCTC - nonRefundableCTC)}</strong>



    </p>







    ${eic > 0 ? `



    <p style="font-size:0.9em;color:#555;">



    EIC calculated using IRS phase-in and phase-out formulas.<br>



    Income used for calculation (lesser of earned income or AGI):



    $${format(Math.min(earnedIncome, agi))}



    </p>



    ` : ''}







    <hr>







    <h4 style="margin-top:15px;">Important Eligibility Requirements</h4>



    <div style="font-size:0.9em;color:#444;line-height:1.6;">



        <p><strong>This estimate is accurate only if:</strong></p>



        <ul>



            <li>All qualifying children lived with you more than half the year</li>



            <li>All qualifying children are under age 17 with valid Social Security Numbers</li>



            <li>You are not claimed as someone else’s dependent</li>



            <li>Your income is earned income (W-2 wages or self-employment)</li>



            <li>You qualify for your selected filing status (${status.charAt(0).toUpperCase() + status.slice(1)})</li>



        </ul>







        <p style="margin-top:10px;">



        The Earned Income Credit and Child Tax Credit are frequently reviewed by the IRS.



        Ensure eligibility requirements are fully met.



        </p>



    </div>







    <hr>







    <p style="font-size:0.8em;color:#777;">



    This calculator is an estimate based on current federal tax law.



    2026 tax law is subject to legislative change.



    </p>







    <p style="font-size:0.85em;">



    IRS References:



<a href="https://www.irs.gov/credits-deductions/individuals/child-tax-credit" target="_blank">Child Tax Credit (IRS)</a>,



<a href="https://www.irs.gov/credits-deductions/individuals/earned-income-tax-credit-eitc" target="_blank">Earned Income Credit (IRS)</a>



    </p>







</div>



`;



    const debugPanel = `



<div style="margin-top:20px;">



    <button onclick="document.getElementById('debugBox').style.display =



        document.getElementById('debugBox').style.display==='none'?'block':'none';"



        style="padding:6px 10px;font-size:12px;">Toggle Debug Details</button>



    <div id="debugBox" style="display:none;margin-top:10px;background:#111;color:#0f0;padding:15px;font-family:monospace;font-size:12px;">



Earned Income: ${earnedIncome}<br>



AGI: ${agi}<br>



Base CTC: ${baseCTC}<br>



Allowed CTC After Phaseout: ${allowedCTC}<br>



Non-Refundable CTC Used: ${nonRefundableCTC}<br>



Unused CTC Remaining: ${allowedCTC - nonRefundableCTC}<br>



ACTC Limit (Per Child): ${numChildren*ACTC_MAX}<br>



Other Dependent Credit: ${numOtherDependents*OTHER_DEP_CREDIT}<br>



Final EIC: ${eic}<br>



State Tax: ${stateTax}



    </div>



</div>



`;







    const resultDiv = document.getElementById('result');



    resultDiv.style.display = 'block';



    resultDiv.innerHTML = `



<h3>2026 Advanced Federal Estimate</h3>



<div>AGI: $${format(agi)}</div>



<div>Taxable Income: $${format(taxableIncome)}</div>



<div>Ordinary Tax: $${format(ordinaryTax)}</div>



<div>Capital Gains Tax: $${format(capitalGainsTax)}</div>



<div>Total Tax Before Credits: $${format(totalTaxBeforeCredits)}</div>



<hr>



<div>Non-Refundable CTC: -$${format(nonRefundableCTC)}</div>



<div>Other Dependent Credit (Non-refundable): -$${format(nonRefundableODC)}</div>



<div>Refundable CTC: +$${format(refundableCTC)}</div>



<div>EIC: +$${format(eic)}</div>



<div>Withholding: +$${format(withholding)}</div>



<div>State Tax: +$${format(stateTax)}</div>



<hr>



${refund>0?`<h2 style="color:green;">Estimated Refund (Includes Refundable Credits): $${format(refund)}</h2>`:`<h2 style="color:red;">Amount Owed: $${format(amountOwed)}</h2>`}



${refund>0?explanation:''}



${debugPanel}



`;



}

document.addEventListener('DOMContentLoaded', function() {
    const obbbLink = document.getElementById('obbbLink');
    const modal = document.getElementById('articleModal');
    const closeBtn = document.getElementById('closeArticle');

    // Open article
    obbbLink.addEventListener('click', function(e) {
        e.preventDefault();
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    });

    // Close article
    closeBtn.addEventListener('click', function() {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    });

    // Close if user clicks background
    window.addEventListener('click', function(e) {
        if (e.target == modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    });
});