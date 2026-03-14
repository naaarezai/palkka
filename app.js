// ==========================================
// Aseta omat Supabase-avaimesi tähän alle:
// ==========================================
const SUPABASE_URL = '';
const SUPABASE_ANON_KEY = '';

// Alustetaan Supabase, jos avaimet on annettu
let supabase = null;
let currentUser = null;
let useCloudStorage = false;

if (SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    useCloudStorage = true;
    console.log("Supabase alustettu!");
} else {
    console.warn("Supabase-avaimia ei löydy. Käytetään paikallista selaimentallennusta (offline-tila).");
}

let savedShifts = []; // Ladataan joko pilvestä tai lokaalisti

document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    initTabs();
    initAuthUI();
    initDatePickers();
    
    // Tarkista kumpaa tallennustilaa käytetään
    updateDbStatusUI();

    if (useCloudStorage) {
        checkSession();
        // Auth tilamuutokset
        supabase.auth.onAuthStateChange((event, session) => {
            if (session) {
                currentUser = session.user;
                document.getElementById('user-info').style.display = 'block';
                document.getElementById('login-actions').style.display = 'none';
                document.getElementById('user-email').innerText = currentUser.email;
                document.getElementById('cloud-sync-info').style.display = 'block';
                loadShiftsFromCloud();
            } else {
                currentUser = null;
                document.getElementById('user-info').style.display = 'none';
                document.getElementById('login-actions').style.display = 'block';
                document.getElementById('cloud-sync-info').style.display = 'none';
                // Tyhjennetään näkymä uloskirjauduttaessa
                savedShifts = [];
                renderSavedShifts();
                calculateBiWeekly();
            }
        });
    } else {
        // Fallback: lataa lokaalit vuorot heti
        savedShifts = JSON.parse(localStorage.getItem('akt_saved_shifts')) || [];
        renderSavedShifts();
    }

    // Event listeners
    const settingInputs = ['base-wage', 'evening-bonus', 'night-bonus', 'sunday-bonus'];
    settingInputs.forEach(id => {
        document.getElementById(id).addEventListener('input', saveSettings);
    });

    document.getElementById('calculate-btn').addEventListener('click', () => {
        calculateSalary(true);
    });

    document.getElementById('save-shift-btn').addEventListener('click', saveCurrentShift);
    document.getElementById('period-start').addEventListener('change', calculateBiWeekly);
});

// --- AUTH UI & LOGIC ---
let isLoginMode = true;

function initAuthUI() {
    const modal = document.getElementById('auth-modal');
    
    document.getElementById('show-login-btn').addEventListener('click', () => {
        modal.style.display = 'block';
    });

    document.getElementById('close-auth-modal').addEventListener('click', () => {
        modal.style.display = 'none';
    });
    
    document.getElementById('auth-switch-link').addEventListener('click', (e) => {
        e.preventDefault();
        isLoginMode = !isLoginMode;
        document.getElementById('auth-title').innerText = isLoginMode ? "Kirjaudu Sisään" : "Luo Tili";
        document.getElementById('auth-submit-btn').innerText = isLoginMode ? "Kirjaudu" : "Rekisteröidy";
        document.getElementById('auth-switch-text').innerHTML = isLoginMode 
            ? 'Etkö omista tiliä? <a href="#" id="auth-switch-link">Rekisteröidy tästä</a>.'
            : 'Onko sinulla jo tili? <a href="#" id="auth-switch-link">Kirjaudu tästä</a>.';
        
        // Re-attach listener dynamically
        document.getElementById('auth-switch-link').addEventListener('click', arguments.callee);
    });

    document.getElementById('auth-submit-btn').addEventListener('click', async () => {
        if (!useCloudStorage) {
            alert("Pilvitallennus ei ole aktivoitu. Lisää avaimet app.js-tiedostoon.");
            return;
        }

        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        const btn = document.getElementById('auth-submit-btn');
        btn.disabled = true;

        if (isLoginMode) {
            // LOGIN
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) alert("Virhe kirjautumisessa: " + error.message);
            else modal.style.display = 'none';
        } else {
            // REGISTER
            const { data, error } = await supabase.auth.signUp({ email, password });
            if (error) alert("Virhe rekisteröitymisessä: " + error.message);
            else {
                alert("Rekisteröityminen onnistui! Voit nyt kirjautua sisään.");
                modal.style.display = 'none';
            }
        }
        btn.disabled = false;
    });

    document.getElementById('logout-btn').addEventListener('click', async () => {
        if (useCloudStorage) {
            await supabase.auth.signOut();
        }
    });
}

// --- DATE & TIME PICKERS ---
function initDatePickers() {
    const commonConfig = {
        time_24hr: true,
        locale: "fi",
        allowInput: false,
        disableMobile: "true"
    };

    flatpickr("#shift-start", {
        ...commonConfig,
        enableTime: true,
        dateFormat: "Y-m-d\\TH:i",
    });

    flatpickr("#shift-end", {
        ...commonConfig,
        enableTime: true,
        dateFormat: "Y-m-d\\TH:i",
    });

    flatpickr("#break-start", {
        ...commonConfig,
        enableTime: true,
        noCalendar: true,
        dateFormat: "H:i",
    });

    flatpickr("#break-end", {
        ...commonConfig,
        enableTime: true,
        noCalendar: true,
        dateFormat: "H:i",
    });

    flatpickr("#period-start", {
        ...commonConfig,
        dateFormat: "Y-m-d",
    });
}

function updateDbStatusUI() {
    const statusEl = document.getElementById('db-status');
    if (useCloudStorage) {
        statusEl.className = 'db-status cloud';
        statusEl.innerText = 'Pilvitallennus aktiivinen (Supabase)';
    } else {
        statusEl.className = 'db-status local';
        statusEl.innerText = 'Paikallinen tallennus (Lisää avaimet käyttääksesi pilveä)';
    }
}

async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        currentUser = session.user;
    }
}

// --- DATABASE CRUD (Pilvi vs Lokaali) ---
async function loadShiftsFromCloud() {
    if (!currentUser) return;
    const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .order('date', { ascending: false });
        
    if (error) {
        console.error("Virhe ladattaessa vuoroja", error);
        return;
    }
    
    // Yhdistetään tietokannan malli lokaaliin malliin
    savedShifts = data.map(dbShift => ({
        id: dbShift.id,
        date: dbShift.date,
        startInput: dbShift.start_input,
        endInput: dbShift.end_input,
        breakStartStr: dbShift.break_start_str,
        breakEndStr: dbShift.break_end_str,
        totalMinutes: dbShift.total_minutes,
        paidMinutes: dbShift.paid_minutes,
        normalMinutes: dbShift.normal_minutes,
        normalPay: parseFloat(dbShift.normal_pay),
        overtime50Minutes: dbShift.overtime50_minutes,
        ot50Pay: parseFloat(dbShift.ot50_pay),
        overtime100Minutes: dbShift.overtime100_minutes,
        ot100Pay: parseFloat(dbShift.ot100_pay),
        eveningMinutes: dbShift.evening_minutes,
        eveningPay: parseFloat(dbShift.evening_pay),
        nightMinutes: dbShift.night_minutes,
        nightPay: parseFloat(dbShift.night_pay),
        sundayMinutes: dbShift.sunday_minutes,
        sundayPay: parseFloat(dbShift.sunday_pay),
        totalPay: parseFloat(dbShift.total_pay),
        eveningBonusPct: parseFloat(dbShift.evening_bonus_pct),
        nightBonusPct: parseFloat(dbShift.night_bonus_pct),
        sundayBonusPct: parseFloat(dbShift.sunday_bonus_pct)
    }));
    
    renderSavedShifts();
    calculateBiWeekly();
}

async function saveCurrentShift() {
    if (useCloudStorage && !currentUser) {
        alert("Sinun täytyy kirjautua sisään tallentaaksesi vuoroja pilveen!");
        document.getElementById('auth-modal').style.display = 'block';
        return;
    }

    const shiftData = calculateSalary(false);
    if (!shiftData) return alert("Vuoron tiedot puutteelliset. Laske ensin.");

    if (useCloudStorage) {
        // Pilvitallennus
        const dbData = {
            user_id: currentUser.id,
            date: shiftData.date,
            start_input: shiftData.startInput,
            end_input: shiftData.endInput,
            break_start_str: shiftData.breakStartStr,
            break_end_str: shiftData.breakEndStr,
            total_minutes: shiftData.totalMinutes,
            paid_minutes: shiftData.paidMinutes,
            normal_minutes: shiftData.normalMinutes,
            normal_pay: shiftData.normalPay,
            overtime50_minutes: shiftData.overtime50Minutes,
            ot50_pay: shiftData.ot50Pay,
            overtime100_minutes: shiftData.overtime100Minutes,
            ot100_pay: shiftData.ot100Pay,
            evening_minutes: shiftData.eveningMinutes,
            evening_pay: shiftData.eveningPay,
            night_minutes: shiftData.nightMinutes,
            night_pay: shiftData.nightPay,
            sunday_minutes: shiftData.sundayMinutes,
            sunday_pay: shiftData.sundayPay,
            total_pay: shiftData.totalPay,
            evening_bonus_pct: shiftData.eveningBonusPct,
            night_bonus_pct: shiftData.nightBonusPct,
            sunday_bonus_pct: shiftData.sundayBonusPct
        };

        // Yksinkertainen tuplien tarkistus startInputin perusteella lokaalisti
        const existingId = savedShifts.find(s => s.startInput === shiftData.startInput)?.id;
        
        if (existingId) {
            if(!confirm("Samankaltainen vuoro on jo tallennettu. Haluatko korvata sen?")) return;
            const { error } = await supabase.from('shifts').update(dbData).eq('id', existingId);
            if(error) return alert("Virhe päivityksessä: " + error.message);
        } else {
            const { error } = await supabase.from('shifts').insert([dbData]);
            if(error) return alert("Virhe tallennuksessa: " + error.message);
        }
        
        await loadShiftsFromCloud();
        alert("Vuoro tallennettu pilveen!");

    } else {
        // Lokaali tallennus (fallback)
        const existingIndex = savedShifts.findIndex(s => s.startInput === shiftData.startInput && s.endInput === shiftData.endInput);
        if (existingIndex >= 0) {
            if(!confirm("Samankaltainen vuoro on jo tallennettu. Haluatko korvata sen?")) return;
            savedShifts[existingIndex] = shiftData;
        } else {
            savedShifts.push(shiftData);
        }
        savedShifts.sort((a, b) => new Date(b.date) - new Date(a.date));
        localStorage.setItem('akt_saved_shifts', JSON.stringify(savedShifts));
        renderSavedShifts();
        calculateBiWeekly();
        alert("Vuoro tallennettu laitteelle!");
    }
    
    switchTab('dashboard-tab');
}

async function deleteShift(id) {
    if(!confirm("Haluatko varmasti poistaa tämän vuoron?")) return;
    
    if (useCloudStorage) {
        const { error } = await supabase.from('shifts').delete().eq('id', id);
        if (error) alert("Virhe poistettaessa: " + error.message);
        else await loadShiftsFromCloud();
    } else {
        savedShifts = savedShifts.filter(s => s.id !== id);
        localStorage.setItem('akt_saved_shifts', JSON.stringify(savedShifts));
        renderSavedShifts();
        calculateBiWeekly();
    }
}

// --- REST OF APP LOGIC (TABS, SETTINGS, CALCULATIONS...) ---

// Tabs
function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.style.display = 'none');
            c.classList.remove('active');

            btn.classList.add('active');
            const targetId = btn.getAttribute('data-tab');
            const targetContent = document.getElementById(targetId);
            targetContent.style.display = 'block';
            setTimeout(() => targetContent.classList.add('active'), 10);
        });
    });
}

function switchTab(tabId) {
    const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if(btn) btn.click();
}

// Settings
function loadSettings() {
    const defaultSettings = {
        'base-wage': 16.50,
        'evening-bonus': 15,
        'night-bonus': 20,
        'sunday-bonus': 100
    };
    for (let key in defaultSettings) {
        const val = localStorage.getItem(key);
        if (val !== null) {
            document.getElementById(key).value = val;
        } else {
            document.getElementById(key).value = defaultSettings[key];
        }
    }
}

function saveSettings() {
    const keys = ['base-wage', 'evening-bonus', 'night-bonus', 'sunday-bonus'];
    keys.forEach(key => {
        localStorage.setItem(key, document.getElementById(key).value);
    });
}

// Logic utils
function getBreakDates(shiftStart, shiftEnd, breakStartTimeStr, breakEndTimeStr) {
    if (!breakStartTimeStr || !breakEndTimeStr) return null;
    let [bH, bM] = breakStartTimeStr.split(':').map(Number);
    let [eH, eM] = breakEndTimeStr.split(':').map(Number);
    let breakStart = new Date(shiftStart);
    breakStart.setHours(bH, bM, 0, 0);
    if (breakStart < shiftStart) breakStart.setDate(breakStart.getDate() + 1);
    let breakEnd = new Date(breakStart);
    breakEnd.setHours(eH, eM, 0, 0);
    if (breakEnd < breakStart) breakEnd.setDate(breakEnd.getDate() + 1);
    return { start: breakStart, end: breakEnd };
}

function formatDuration(minutes) {
    const h = Math.floor(minutes / 60);
    const m = Math.floor(minutes % 60);
    if (h > 0 && m > 0) return `${h} h ${m} min`;
    if (h > 0) return `${h} h`;
    return `${m} min`;
}

function calculateSalary(renderToUI = false) {
    const startInput = document.getElementById('shift-start').value;
    const endInput = document.getElementById('shift-end').value;
    if (!startInput || !endInput) {
        if (renderToUI) alert("Syötä vuoron alku ja loppu!");
        return null;
    }

    const shiftStart = new Date(startInput);
    const shiftEnd = new Date(endInput);
    if (shiftEnd <= shiftStart) {
        if (renderToUI) alert("Vuoron lopun täytyy olla alun jälkeen!");
        return null;
    }

    const breakStartStr = document.getElementById('break-start').value;
    const breakEndStr = document.getElementById('break-end').value;
    const breakTimes = getBreakDates(shiftStart, shiftEnd, breakStartStr, breakEndStr);

    let totalMinutes = 0, paidMinutes = 0, eveningMinutes = 0, nightMinutes = 0, sundayMinutes = 0;

    for (let m = new Date(shiftStart); m < shiftEnd; m.setMinutes(m.getMinutes() + 1)) {
        totalMinutes++;
        let isBreak = breakTimes && m >= breakTimes.start && m < breakTimes.end;
        if (!isBreak) {
            paidMinutes++;
            let hours = m.getHours(), day = m.getDay();
            if (hours >= 18 && hours < 22) eveningMinutes++;
            if (hours >= 22 || hours < 6) nightMinutes++;
            if (day === 0) sundayMinutes++;
        }
    }

    let normalMinutes = Math.min(paidMinutes, 8 * 60);
    let overtimeMinutes = Math.max(0, paidMinutes - 8 * 60);
    let overtime50Minutes = Math.min(overtimeMinutes, 2 * 60);
    let overtime100Minutes = Math.max(0, overtimeMinutes - 2 * 60);

    const baseWage = parseFloat(document.getElementById('base-wage').value) || 0;
    const eveningBonusPct = parseFloat(document.getElementById('evening-bonus').value) || 0;
    const nightBonusPct = parseFloat(document.getElementById('night-bonus').value) || 0;
    const sundayBonusPct = parseFloat(document.getElementById('sunday-bonus').value) || 0;
    const basePerMin = baseWage / 60;
    
    const normalPay = normalMinutes * basePerMin;
    const ot50Pay = overtime50Minutes * (basePerMin * 1.5);
    const ot100Pay = overtime100Minutes * (basePerMin * 2.0);
    const eveningPay = eveningMinutes * basePerMin * (eveningBonusPct / 100);
    const nightPay = nightMinutes * basePerMin * (nightBonusPct / 100);
    const sundayPay = sundayMinutes * basePerMin * (sundayBonusPct / 100);
    const totalPay = normalPay + ot50Pay + ot100Pay + eveningPay + nightPay + sundayPay;

    const resultData = {
        id: useCloudStorage ? undefined : Date.now().toString(),
        date: shiftStart.toISOString(),
        startInput, endInput, breakStartStr, breakEndStr,
        totalMinutes, paidMinutes, normalMinutes, normalPay,
        overtime50Minutes, ot50Pay, overtime100Minutes, ot100Pay,
        eveningMinutes, eveningPay, nightMinutes, nightPay,
        sundayMinutes, sundayPay, totalPay,
        eveningBonusPct, nightBonusPct, sundayBonusPct
    };

    if (renderToUI) renderCalculatorResults(resultData);
    return resultData;
}

function renderCalculatorResults(data) {
    document.getElementById('res-total-time').innerText = formatDuration(data.totalMinutes);
    document.getElementById('res-paid-time').innerText = formatDuration(data.paidMinutes);
    const breakdownList = document.getElementById('res-breakdown');
    breakdownList.innerHTML = '';

    const addRow = (label, mins, amount) => {
        if (mins <= 0) return;
        const li = document.createElement('li');
        li.innerHTML = `<span>${label} (${formatDuration(mins)})</span> <span>${amount.toFixed(2)} €</span>`;
        breakdownList.appendChild(li);
    };

    addRow('Normaali työaika (100 %)', data.normalMinutes, data.normalPay);
    if (data.overtime50Minutes > 0) addRow('Vuorokautinen ylityö (50 % korotettu)', data.overtime50Minutes, data.ot50Pay);
    if (data.overtime100Minutes > 0) addRow('Ylityö (100 % korotettu)', data.overtime100Minutes, data.ot100Pay);
    addRow(`Iltalisä (${data.eveningBonusPct} %)`, data.eveningMinutes, data.eveningPay);
    addRow(`Yölisä (${data.nightBonusPct} %)`, data.nightMinutes, data.nightPay);
    addRow(`Sunnuntaityölisä (${data.sundayBonusPct} %)`, data.sundayMinutes, data.sundayPay);

    const totalLi = document.createElement('li');
    totalLi.style.fontWeight = 'bold';
    totalLi.style.marginTop = '0.5rem';
    totalLi.style.borderTop = '1px solid rgba(255,255,255,0.2)';
    totalLi.style.paddingTop = '1rem';
    totalLi.innerHTML = `<span>Arvioitu palkka yhteensä</span> <span style="color: var(--success-color)">${data.totalPay.toFixed(2)} €</span>`;
    breakdownList.appendChild(totalLi);

    const allowanceRec = document.getElementById('allowance-recommendation');
    if (data.totalMinutes > 10 * 60) allowanceRec.style.display = 'flex';
    else allowanceRec.style.display = 'none';

    document.getElementById('results-section').style.display = 'block';
    document.getElementById('results-section').scrollIntoView({ behavior: 'smooth' });
}

function editShift(id) {
    const shift = savedShifts.find(s => s.id === id);
    if (!shift) return;
    document.getElementById('shift-start').value = shift.startInput || '';
    document.getElementById('shift-end').value = shift.endInput || '';
    document.getElementById('break-start').value = shift.breakStartStr || '';
    document.getElementById('break-end').value = shift.breakEndStr || '';
    switchTab('calculator-tab');
    calculateSalary(true);
}

function formatShortDate(dateStr) {
    const d = new Date(dateStr);
    return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

function formatTimeOnly(dateTimeStr) {
    if(!dateTimeStr) return '';
    const d = new Date(dateTimeStr);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function renderSavedShifts() {
    const container = document.getElementById('saved-shifts-container');
    container.innerHTML = '';
    if (savedShifts.length === 0) {
        container.innerHTML = `<p style="text-align: center; color: var(--text-secondary); padding: 1rem;">Ei tallennettuja vuoroja.</p>`;
        return;
    }

    savedShifts.forEach(shift => {
        const item = document.createElement('div');
        item.className = 'saved-shift-item';
        const dateStr = formatShortDate(shift.startInput);
        const startT = formatTimeOnly(shift.startInput);
        const endT = formatTimeOnly(shift.endInput);

        item.innerHTML = `
            <div class="saved-shift-header">
                <span class="saved-shift-date">${dateStr} (${startT} - ${endT})</span>
                <span class="saved-shift-pay">${shift.totalPay?.toFixed(2) || '0.00'} €</span>
            </div>
            <div class="saved-shift-details">
                Palkallinen aika: ${formatDuration(shift.paidMinutes)} | Ylityö: ${formatDuration(shift.overtime50Minutes + shift.overtime100Minutes)}
            </div>
            <div class="saved-shift-actions">
                <button class="action-btn" onclick="editShift('${shift.id}')">✏️ Muokkaa</button>
                <button class="action-btn delete" onclick="deleteShift('${shift.id}')">🗑️ Poista</button>
            </div>
        `;
        container.appendChild(item);
    });
}

function calculateBiWeekly() {
    const startStr = document.getElementById('period-start').value;
    const periodResultsDiv = document.getElementById('period-results');
    
    if (!startStr) {
        periodResultsDiv.style.display = 'none';
        return;
    }

    const periodStart = new Date(startStr);
    periodStart.setHours(0,0,0,0);
    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodStart.getDate() + 14);

    document.getElementById('period-range-display').innerText = `${formatShortDate(periodStart)} - ${formatShortDate(periodEnd)}`;

    const periodShifts = savedShifts.filter(s => {
        const d = new Date(s.startInput);
        return d >= periodStart && d < periodEnd;
    });

    let aggTotalPay = 0, aggPaidMinutes = 0, aggNormalMinutes = 0, aggNormalPay = 0,
        aggOt50Mins = 0, aggOt50Pay = 0, aggOt100Mins = 0, aggOt100Pay = 0,
        aggEveningMins = 0, aggEveningPay = 0, aggNightMins = 0, aggNightPay = 0,
        aggSundayMins = 0, aggSundayPay = 0;

    periodShifts.forEach(s => {
        aggTotalPay += s.totalPay || 0;
        aggPaidMinutes += s.paidMinutes || 0;
        aggNormalMinutes += s.normalMinutes || 0;
        aggNormalPay += s.normalPay || 0;
        aggOt50Mins += s.overtime50Minutes || 0;
        aggOt50Pay += s.ot50Pay || 0;
        aggOt100Mins += s.overtime100Minutes || 0;
        aggOt100Pay += s.ot100Pay || 0;
        aggEveningMins += s.eveningMinutes || 0;
        aggEveningPay += s.eveningPay || 0;
        aggNightMins += s.nightMinutes || 0;
        aggNightPay += s.nightPay || 0;
        aggSundayMins += s.sundayMinutes || 0;
        aggSundayPay += s.sundayPay || 0;
    });

    document.getElementById('period-total-pay').innerText = `${aggTotalPay.toFixed(2)} €`;
    document.getElementById('period-total-time').innerText = formatDuration(aggPaidMinutes);

    const breakdownList = document.getElementById('period-breakdown');
    breakdownList.innerHTML = '';

    const addRow = (label, mins, amount) => {
        if (mins <= 0) return;
        const li = document.createElement('li');
        li.innerHTML = `<span>${label} (${formatDuration(mins)})</span> <span>${amount.toFixed(2)} €</span>`;
        breakdownList.appendChild(li);
    };

    addRow('Normaali työaika (Yht)', aggNormalMinutes, aggNormalPay);
    if(aggOt50Mins > 0) addRow('Vuorokautinen ylityö (50 % Yht)', aggOt50Mins, aggOt50Pay);
    if(aggOt100Mins > 0) addRow('Vuorokautinen ylityö (100 % Yht)', aggOt100Mins, aggOt100Pay);
    if(aggEveningMins > 0) addRow('Iltalisät (Yht)', aggEveningMins, aggEveningPay);
    if(aggNightMins > 0) addRow('Yölisät (Yht)', aggNightMins, aggNightPay);
    if(aggSundayMins > 0) addRow('Sunnuntaityölisät (Yht)', aggSundayMins, aggSundayPay);

    periodResultsDiv.style.display = 'block';
}
