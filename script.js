/* =========================================================
   КОНФИГ
   ========================================================= */
const SPREADSHEET_ID  = '15O63umHMD-ghB3CQ7iPPKKESqkEFLzzy3BgauZQOzMs';
const SHEET_RESIDENTS = '';        // Первый лист (Form_Responses)
const SHEET_TSZH      = 'TSZH';    // Лист с голосованием
const TOTAL_APTS      = 88;

let houseDatabase = {};
let votesDatabase = {};

/* =========================================================
   ЗАГРУЗКА
   ========================================================= */
async function loadDataFromGoogleSheets() {
    showLoadingStatus('Загрузка данных...');
    try {
        const [residentsJson, votesJson] = await Promise.all([
            fetchSheet(SHEET_RESIDENTS),
            fetchSheet(SHEET_TSZH),
        ]);
        parseData(residentsJson);
        parseVotes(votesJson);
        renderBuilding();
        hideLoadingStatus();
        updateHeader();
        updateTSZHStats();
        applyMobileFix();
        setTimeout(updateTabSlider, 100);
    } catch (error) {
        console.error(error);
        hideLoadingStatus();
        showErrorState();
    }
}

async function fetchSheet(sheetName) {
    const base = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json`;
    const url = sheetName
        ? `${base}&sheet=${encodeURIComponent(sheetName)}&_=${Date.now()}`
        : `${base}&_=${Date.now()}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Ошибка сети');
    const text = await response.text();
    return JSON.parse(text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1));
}

/* =========================================================
   ПАРСИНГ ЖИЛЬЦОВ
   ========================================================= */
function parseData(jsonData) {
    houseDatabase = {};
    if (!jsonData || !jsonData.table || !jsonData.table.rows) return;
    const rows = jsonData.table.rows;

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row.c) continue;
        const cells = row.c;

        const name     = cells[1] ? String(cells[1].v || cells[1].f || '').trim() : '';
        const aptRaw   = cells[2] ? String(cells[2].v || cells[2].f || '').trim() : '';
        const phoneRaw = cells[3] ? String(cells[3].f || cells[3].v || '').trim() : '';

        if (!name || !aptRaw) continue;
        const aptNum = parseInt(aptRaw, 10);
        if (isNaN(aptNum) || aptNum < 1 || aptNum > TOTAL_APTS) continue;

        if (!houseDatabase[aptNum]) houseDatabase[aptNum] = [];
        const names = name.split(',').map(n => n.trim()).filter(Boolean);

        let phones = [];
        if (phoneRaw) {
            phones = phoneRaw
                .split(/[,;\s]+/)
                .map(p => p.trim())
                .filter(p => p.length > 3)
                .map(formatPhone);
        }

        if (names.length === 1 && phones.length > 1) {
            houseDatabase[aptNum].push({ fio: names[0], phones });
        } else {
            names.forEach((n, index) => {
                const phone = phones[index] || '';
                houseDatabase[aptNum].push({ fio: n, phones: phone ? [phone] : [] });
            });
        }
    }
}

function formatPhone(phone) {
    let cleaned = phone.replace(/[^0-9+]/g, '');
    if (!cleaned.startsWith('+')) {
        if (cleaned.length === 9) cleaned = '+375' + cleaned;
        else if (cleaned.length === 10 && cleaned.startsWith('8')) cleaned = '+375' + cleaned.slice(1);
        else if (cleaned.length === 11 && cleaned.startsWith('80')) cleaned = '+375' + cleaned.slice(2);
        else if (cleaned.length === 12 && cleaned.startsWith('375')) cleaned = '+' + cleaned;
    }
    return cleaned;
}

/* =========================================================
   ПАРСИНГ ГОЛОСОВ
   ========================================================= */
function parseVotes(jsonData) {
    votesDatabase = {};
    if (!jsonData || !jsonData.table || !jsonData.table.rows) return;
    const rows = jsonData.table.rows;

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row.c) continue;

        const timeRaw = row.c[0] ? String(row.c[0].f || row.c[0].v || '').trim() : '';
        const aptRaw  = row.c[1] ? String(row.c[1].v || row.c[1].f || '').trim() : '';
        const forRaw  = row.c[2] ? String(row.c[2].v || row.c[2].f || '').trim() : '';
        const attRaw  = row.c[3] ? String(row.c[3].v || row.c[3].f || '').trim() : '';

        const aptNum = parseInt(aptRaw, 10);
        if (isNaN(aptNum) || aptNum < 1 || aptNum > TOTAL_APTS) continue;

        const vote = {
            forTSZH: parseVoteAnswer(forRaw),
            attend:  parseVoteAnswer(attRaw),
            time:    timeRaw,
        };

        const parsedTime = parseSheetDate(timeRaw);
        const prev = votesDatabase[aptNum];
        const prevParsedTime = prev ? parseSheetDate(prev.time) : 0;

        if (!prev || parsedTime >= prevParsedTime) {
            votesDatabase[aptNum] = vote;
        }
    }
}

function parseVoteAnswer(raw) {
    const s = String(raw).trim().toLowerCase();
    if (/^(да|yes|1|\+)$/.test(s)) return true;
    if (/^(нет|no|0|-)$/.test(s)) return false;
    if (/^(воздержался|пока не знаю|не знаю|maybe|abstain)$/.test(s)) return 'abstain';
    return null;
}

function parseSheetDate(s) {
    if (!s) return 0;
    const m = String(s).match(/(\d{1,4})[.\-/](\d{1,2})[.\-/](\d{1,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (!m) {
        const fallback = new Date(s).getTime();
        return isNaN(fallback) ? 0 : fallback;
    }
    let [, a, b, c, hh, mm, ss] = m;
    let year, month, day;
    if (a.length === 4) { year = +a; month = +b; day = +c; }
    else               { day = +a; month = +b; year = +c; }
    if (year < 100) year += 2000;
    return new Date(year, month - 1, day, +(hh || 0), +(mm || 0), +(ss || 0)).getTime();
}

/* =========================================================
   ПРОГРЕСС / ВКЛАДКИ
   ========================================================= */
function updateHeader() {
    const filled = Object.keys(houseDatabase).length;
    const percent = Math.round((filled / TOTAL_APTS) * 100);
    const label = document.getElementById('progressLabel');
    if (label) label.textContent = `Заполнено ${filled} из ${TOTAL_APTS} квартир (${percent}%)`;
    const fill = document.getElementById('progressFill');
    if (fill) fill.style.width = `${percent}%`;
    updateTabStats();
}

function getEntranceStats() {
    const total1 = 44, total2 = 44;
    let filled1 = 0, filled2 = 0;
    for (const aptNum in houseDatabase) {
        const num = parseInt(aptNum, 10);
        if (num >= 1 && num <= 44) filled1++;
        else if (num >= 45 && num <= 88) filled2++;
    }
    return {
        filled1, total1, percent1: Math.round((filled1 / total1) * 100),
        filled2, total2, percent2: Math.round((filled2 / total2) * 100),
    };
}

function updateTabStats() {
    const stats = getEntranceStats();
    const t1 = document.getElementById('tabStats1');
    const t2 = document.getElementById('tabStats2');
    if (t1) t1.textContent = `${stats.filled1}/${stats.total1} (${stats.percent1}%)`;
    if (t2) t2.textContent = `${stats.filled2}/${stats.total2} (${stats.percent2}%)`;
    updateTabSlider();
}

function updateTabSlider() {
    const activeTab = document.querySelector('.tab-btn.active');
    const slider = document.getElementById('tabSlider');
    const container = document.getElementById('tabsContainer');
    if (!activeTab || !slider || !container) return;
    requestAnimationFrame(() => {
        const cRect = container.getBoundingClientRect();
        const tRect = activeTab.getBoundingClientRect();
        slider.style.left = (tRect.left - cRect.left + 2) + 'px';
        slider.style.width = (tRect.width - 4) + 'px';
    });
}

/* =========================================================
   СТАТИСТИКА ТСЖ
   ========================================================= */
function calculateTSZHStats() {
    let forTSZH = 0, against = 0, abstain = 0, attend = 0, forAndAttend = 0;
    for (const apt in votesDatabase) {
        const v = votesDatabase[apt];
        if (v.forTSZH === true) forTSZH++;
        else if (v.forTSZH === false) against++;
        else if (v.forTSZH === 'abstain') abstain++;

        if (v.attend === true) {
            attend++;
            if (v.forTSZH === true) forAndAttend++;
        }
    }
    const quorumNeeded = Math.ceil(TOTAL_APTS * 2 / 3);
    const decisionNeeded = attend > 0 ? Math.ceil(attend * 2 / 3) : 0;
    return {
        forTSZH, against, abstain, attend, forAndAttend,
        notVoted: TOTAL_APTS - (forTSZH + against + abstain),
        notAttend: TOTAL_APTS - attend,
        quorumNeeded, decisionNeeded,
        hasQuorum: attend >= quorumNeeded,
        hasDecision: attend > 0 && forAndAttend >= decisionNeeded,
        quorumPercent: Math.round(attend / TOTAL_APTS * 100),
        decisionPercent: attend > 0 ? Math.round(forAndAttend / attend * 100) : 0,
    };
}

function updateTSZHStats() {
    const s = calculateTSZHStats();
    
    // === ОБНОВЛЕНИЕ ЛЕГЕНДЫ (безопасное) ===
    const legendFor = document.getElementById('legendVoteFor');
    const legendAgainst = document.getElementById('legendVoteAgainst');
    const legendAbstain = document.getElementById('legendVoteAbstain');
    const legendAttend = document.getElementById('legendAttendYes');

    if (legendFor) legendFor.textContent = `(${s.forTSZH})`;
    if (legendAgainst) legendAgainst.textContent = `(${s.against})`;
    if (legendAbstain) legendAbstain.textContent = `(${s.abstain})`;
    if (legendAttend) legendAttend.textContent = `(${s.attend})`;

    // === ОБНОВЛЕНИЕ ПОЛОС КВОРУМА И РЕШЕНИЯ ===
    const block = document.getElementById('tszhStats');
    if (!block) return;

    const qFill = block.querySelector('#quorumFill');
    const qLabel = block.querySelector('#quorumLabel');
    const qVerdict = block.querySelector('#quorumVerdict');
    if (qFill) qFill.style.width = s.quorumPercent + '%';
    if (qLabel) qLabel.textContent = `${s.attend} / ${TOTAL_APTS} (${s.quorumPercent}%)`;
    if (qVerdict) {
        qVerdict.textContent = s.hasQuorum
            ? `✅ Кворум есть (нужно  ${s.quorumNeeded})`
            : `❌ Кворума нет (нужно  ${s.quorumNeeded}, не хватает ${s.quorumNeeded - s.attend})`;
        qVerdict.className = 'tszh-verdict ' + (s.hasQuorum ? 'ok' : 'fail');
    }

    const dFill = block.querySelector('#decisionFill');
    const dLabel = block.querySelector('#decisionLabel');
    const dVerdict = block.querySelector('#decisionVerdict');
    if (dFill) dFill.style.width = s.decisionPercent + '%';
    if (dLabel) dLabel.textContent = `${s.forAndAttend} / ${s.attend} (${s.decisionPercent}%)`;
    if (dVerdict) {
        dVerdict.textContent = s.hasDecision
            ? `✅ Решение принято (нужно ≥ ${s.decisionNeeded} из ${s.attend})`
            : `❌ Решения нет (нужно ≥ ${s.decisionNeeded} из ${s.attend}, не хватает ${s.decisionNeeded - s.forAndAttend})`;
        dVerdict.className = 'tszh-verdict ' + (s.hasDecision ? 'ok' : 'fail');
    }
}

/* =========================================================
   РЕНДЕР ЗДАНИЯ
   ========================================================= */
function renderBuilding() {
    buildEntrance('entrance1', 1, 1);
    buildEntrance('entrance2', 45, 2);
    setTimeout(applyMobileFix, 50);
}

function buildEntrance(containerId, startApt, entranceNum) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const stats = getEntranceStats();
    const statsText = entranceNum === 1
        ? `${stats.filled1} из ${stats.total1} (${stats.percent1}%)`
        : `${stats.filled2} из ${stats.total2} (${stats.percent2}%)`;
    const isMobile = window.innerWidth < 768;

    container.innerHTML = `<div class="entrance-title" style="${isMobile ? 'display: none;' : ''}">${entranceNum} Подъезд <span class="entrance-stats">${statsText}</span></div>`;

    let floorApt = startApt + 40;
    for (let floor = 11; floor >= 1; floor--) {
        const floorRow = document.createElement('div');
        floorRow.className = 'floor';

        const label = document.createElement('div');
        label.className = 'floor-number';
        label.textContent = floor;
        floorRow.appendChild(label);

        const aptGrid = document.createElement('div');
        aptGrid.className = 'apartments';

        for (let i = 0; i < 4; i++) {
            const aptNum = floorApt + i;
            const residents = houseDatabase[aptNum] || [];
            const empty = residents.length === 0;
            const vote = votesDatabase[aptNum];

            const aptDiv = document.createElement('div');
            let aptClass = 'apartment';
            if (empty) aptClass += ' empty';

            if (!empty && vote) {
                if (vote.forTSZH === true) aptClass += ' vote-for';
                else if (vote.forTSZH === false) aptClass += ' vote-against';
                else if (vote.forTSZH === 'abstain') aptClass += ' vote-abstain';
                if (vote.attend === true) aptClass += ' attend-yes';
            }
            aptDiv.className = aptClass;

            const peopleIcons = empty
                ? ''
                : `<i class="fa-regular fa-user"></i>`.repeat(residents.length);

            aptDiv.innerHTML = `<div class="apt-num">${aptNum}</div><div class="apt-count">${peopleIcons}</div>`;
            aptDiv.addEventListener('click', () => showInfo(aptNum, floor, residents));
            aptGrid.appendChild(aptDiv);
        }

        floorRow.appendChild(aptGrid);
        container.appendChild(floorRow);
        floorApt -= 4;
    }
}

/* =========================================================
   ШТОРКА С ИНФО
   ========================================================= */
function showInfo(aptNum, floor, residents) {
    const entranceNum = aptNum <= 44 ? 1 : 2;
    document.getElementById('panelAptNum').textContent = `Квартира №${aptNum}`;
    document.getElementById('panelAptMeta').textContent = `Этаж ${floor}, Подъезд ${entranceNum}`;

    const container = document.getElementById('residentsContainer');
    container.innerHTML = '';

    if (!residents || residents.length === 0) {
        container.innerHTML = `
            <div style="color:#94a3b8;text-align:center;padding:30px 0;">
                <div style="font-size:3rem;margin-bottom:10px;">🏠</div>
                Жильцы этой квартиры не предоставили свои данные
            </div>`;
    } else {
        residents.forEach(r => {
            const card = document.createElement('div');
            card.className = 'resident-card';

            const nameDiv = document.createElement('div');
            nameDiv.className = 'res-name';
            nameDiv.innerHTML = `<i class="fas fa-user" style="color:#38bdf8;margin-right:8px;width:14px;"></i> ${r.fio}`;
            card.appendChild(nameDiv);

            if (r.phones && r.phones.length > 0) {
                r.phones.forEach(phone => {
                    if (!phone) return;
                    const link = document.createElement('a');
                    link.href = `tel:${phone.replace(/\s+/g, '')}`;
                    link.className = 'res-phone';
                    link.style.display = 'block';
                    link.style.marginTop = '4px';
                    link.innerHTML = `<i class="fas fa-phone" style="color:#38bdf8;margin-right:6px;"></i> ${phone}`;
                    card.appendChild(link);
                });
            } else {
                const noPhone = document.createElement('div');
                noPhone.style.cssText = 'color:#64748b;font-size:0.9rem;margin-top:4px;';
                noPhone.textContent = '🚫 Нет телефона';
                card.appendChild(noPhone);
            }
            container.appendChild(card);
        });
    }

    const vote = votesDatabase[aptNum];
    const voteBlock = document.createElement('div');
    voteBlock.className = 'vote-block';

    if (vote) {
        let pText, pIcon, pClass;
        if (vote.forTSZH === true)          { pText = 'ЗА создание ТСЖ';         pIcon = '✅'; pClass = 'vote-for'; }
        else if (vote.forTSZH === false)    { pText = 'ПРОТИВ создания ТСЖ';     pIcon = '❌'; pClass = 'vote-against'; }
        else if (vote.forTSZH === 'abstain'){ pText = 'ВОЗДЕРЖАЛСЯ';              pIcon = '🟡'; pClass = 'vote-abstain'; }
        else                                { pText = 'Не голосовал по ТСЖ';     pIcon = '⚪'; pClass = 'vote-none'; }

        let aText, aIcon, aClass;
        if (vote.attend === true)           { aText = 'УЧАСТВУЕТ в голосовании (кворум)'; aIcon = '✅'; aClass = 'attend-yes'; }
        else if (vote.attend === false)     { aText = 'НЕ УЧАСТВУЕТ в голосовании';        aIcon = '⚪'; aClass = 'attend-no'; }
        else                                { aText = 'Явка не подтверждена';              aIcon = '⚪'; aClass = 'attend-none'; }

        voteBlock.innerHTML = `
            <div class="vote-title">🗳️ Голосование по ТСЖ</div>
            <div class="vote-line ${pClass}"><span class="vote-icon">${pIcon}</span><span>${pText}</span></div>
            <div class="vote-line ${aClass}"><span class="vote-icon">${aIcon}</span><span>${aText}</span></div>`;
    } else {
        voteBlock.innerHTML = `
            <div class="vote-title">🗳️ Голосование по ТСЖ</div>
            <div class="vote-line vote-none"><span class="vote-icon">⚪</span><span>Жильцы не голосовали</span></div>`;
    }
    container.appendChild(voteBlock);

    document.getElementById('overlay').style.display = 'block';
    setTimeout(() => {
        document.getElementById('overlay').classList.add('active');
        document.getElementById('infoPanel').classList.add('active');
    }, 10);
}

function closeInfo() {
    const panel = document.getElementById('infoPanel');
    const overlay = document.getElementById('overlay');
    panel.classList.remove('active');
    overlay.classList.remove('active');
    panel.style.bottom = '';
    panel.style.opacity = '';
    panel.style.transition = '';
    panel.style.willChange = '';
    overlay.style.display = 'none';
    document.body.style.overflow = '';
    setTimeout(() => applyMobileFix(), 50);
}

/* =========================================================
   ПЕРЕКЛЮЧЕНИЕ ПОДЪЕЗДОВ
   ========================================================= */
function switchEntrance(num, direction) {
    const currentEntrance = document.querySelector('.entrance.active');
    const nextEntrance = document.getElementById(`entrance${num}`);
    if (currentEntrance === nextEntrance) return;
    if (!currentEntrance || !nextEntrance) return;

    if (!direction) {
        const currentNum = currentEntrance.id === 'entrance1' ? 1 : 2;
        direction = num > currentNum ? 'left' : 'right';
    }

    currentEntrance.classList.remove('active');
    currentEntrance.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease';
    currentEntrance.style.transform = direction === 'left' ? 'translateX(-100%)' : 'translateX(100%)';
    currentEntrance.style.opacity = '0';

    nextEntrance.style.display = 'flex';
    nextEntrance.style.position = 'absolute';
    nextEntrance.style.top = '0';
    nextEntrance.style.left = '0';
    nextEntrance.style.width = '100%';
    nextEntrance.style.transform = direction === 'left' ? 'translateX(100%)' : 'translateX(-100%)';
    nextEntrance.style.opacity = '0';
    nextEntrance.style.pointerEvents = 'none';
    nextEntrance.style.transition = 'none';
    void nextEntrance.offsetHeight;

    requestAnimationFrame(() => {
        nextEntrance.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease';
        nextEntrance.style.transform = 'translateX(0)';
        nextEntrance.style.opacity = '1';
    });

    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab${num}`).classList.add('active');
    updateTabSlider();

    setTimeout(() => {
        nextEntrance.classList.add('active');
        nextEntrance.style.position = 'relative';
        nextEntrance.style.pointerEvents = 'auto';
        nextEntrance.style.transition = '';
        nextEntrance.style.transform = '';
        nextEntrance.style.opacity = '';
        currentEntrance.style.display = 'none';
        currentEntrance.style.transform = '';
        currentEntrance.style.opacity = '';
        currentEntrance.style.transition = '';
        applyMobileFix();
    }, 350);
}

function applyMobileFix() {
    const isMobile = window.innerWidth < 768;
    const buildingContainer = document.querySelector('.building-container');

    if (isMobile) {
        const activeTab = document.querySelector('.tab-btn.active');
        const num = activeTab ? (activeTab.id === 'tab1' ? 1 : 2) : 1;
        const activeEntrance = document.getElementById(`entrance${num}`);

        document.querySelectorAll('.entrance').forEach(el => {
            if (el === activeEntrance) {
                el.classList.add('active');
                el.style.display = 'flex';
            } else {
                el.classList.remove('active');
                el.style.display = 'none';
            }
        });

        if (buildingContainer && activeEntrance) {
            buildingContainer.style.minHeight = '';
            const h = activeEntrance.scrollHeight;
            if (h > 0) buildingContainer.style.minHeight = h + 'px';
        }
    } else {
        document.querySelectorAll('.entrance').forEach(el => {
            el.classList.add('active');
            el.style.display = 'flex';
        });
        if (buildingContainer) buildingContainer.style.minHeight = '';
    }
}

window.addEventListener('resize', () => {
    applyMobileFix();
    updateTabSlider();
});

/* =========================================================
   UI-УТИЛИТЫ
   ========================================================= */
function showLoadingStatus(text) {
    let el = document.getElementById('loadingStatus');
    if (!el) {
        el = document.createElement('div');
        el.id = 'loadingStatus';
        el.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#1e293b;color:#f8fafc;padding:12px 24px;border-radius:8px;z-index:1000;border:1px solid #475569;';
        document.body.appendChild(el);
    }
    el.textContent = text;
    el.style.display = 'block';
}

function hideLoadingStatus() {
    const el = document.getElementById('loadingStatus');
    if (el) el.style.display = 'none';
}

function showNotification(text, type) {
    const colors = { success: '#10b981', error: '#ef4444', info: '#38bdf8' };
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#1e293b;color:#f8fafc;padding:12px 24px;border-radius:8px;z-index:1000;border-left:4px solid ${colors[type] || '#38bdf8'};animation:slideUp 0.3s ease;max-width:90%;text-align:center;`;
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => {
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 300);
    }, 3000);
}

function showErrorState() {
    houseDatabase = {};
    renderBuilding();
    updateHeader();
    const header = document.querySelector('header p');
    if (header) {
        header.textContent = 'Данные не загружены. Попробуйте обновить страницу.';
        header.style.color = '#ef4444';
    }
    showNotification('❌ Не удалось загрузить данные', 'error');
}

const style = document.createElement('style');
style.textContent = `@keyframes slideUp { from { opacity:0; transform:translateX(-50%) translateY(20px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }`;
document.head.appendChild(style);

/* =========================================================
   СВАЙПЫ
   ========================================================= */
(function initSimpleSwipe() {
    const THRESHOLD = 50, MAX_TIME = 600, MAX_VERT = 60;
    let startX = 0, startY = 0, startTime = 0, tracking = false;

    document.addEventListener('touchstart', function (e) {
        if (window.innerWidth >= 768) return;
        if (e.touches.length !== 1) return;
        if (e.target.closest('#infoPanel, #overlay, .close-btn, a, button')) return;
        const t = e.touches[0];
        startX = t.clientX; startY = t.clientY; startTime = Date.now(); tracking = true;
    }, { passive: true });

    document.addEventListener('touchend', function (e) {
        if (!tracking) return;
        tracking = false;
        if (window.innerWidth >= 768) return;
        if (!e.changedTouches.length) return;
        const t = e.changedTouches[0];
        const diffX = t.clientX - startX;
        const diffY = t.clientY - startY;
        const duration = Date.now() - startTime;
        if (duration > MAX_TIME) return;
        if (Math.abs(diffY) > MAX_VERT) return;
        if (Math.abs(diffX) < THRESHOLD) return;
        const currentEntrance = document.querySelector('.entrance.active');
        if (!currentEntrance) return;
        const currentNum = currentEntrance.id === 'entrance1' ? 1 : 2;
        if (diffX < 0 && currentNum === 1) switchEntrance(2, 'left');
        else if (diffX > 0 && currentNum === 2) switchEntrance(1, 'right');
    }, { passive: true });
})();

(function initSwipeToClose() {
    let startY = 0, currentY = 0, isDragging = false;
    const panel = document.getElementById('infoPanel');
    function isPanelActive() { return panel.classList.contains('active'); }

    function onStart(e) {
        if (!isPanelActive()) return;
        if (e.target.closest('.close-btn, a, button')) return;
        const touch = e.touches ? e.touches[0] : e;
        startY = touch.clientY; isDragging = true;
        panel.style.transition = 'none';
        if (e.cancelable) e.preventDefault();
    }
    function onMove(e) {
        if (!isDragging || !isPanelActive()) return;
        if (e.cancelable) e.preventDefault();
        const touch = e.touches ? e.touches[0] : e;
        currentY = touch.clientY;
        const diff = currentY - startY;
        if (diff > 0) {
            const progress = Math.min(diff / 300, 1);
            panel.style.bottom = `-${diff}px`;
            panel.style.opacity = 1 - progress * 0.5;
            if (diff > 300) {
                closeInfo();
                isDragging = false;
                document.body.style.overflow = '';
                panel.style.willChange = '';
            }
        }
    }
    function onEnd() {
        if (!isDragging) {
            if (!isPanelActive()) document.body.style.overflow = '';
            return;
        }
        isDragging = false;
        document.body.style.overflow = '';
        panel.style.willChange = '';
        const currentBottom = parseInt(panel.style.bottom) || 0;
        if (currentBottom < -150) {
            closeInfo();
        } else {
            panel.style.transition = 'bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease';
            panel.style.bottom = '0';
            panel.style.opacity = '1';
        }
    }

    panel.addEventListener('touchstart', onStart, { passive: false });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd, { passive: false });
    panel.addEventListener('mousedown', onStart);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);

    const observer = new MutationObserver(() => {
        if (!isPanelActive()) {
            document.body.style.overflow = '';
            panel.style.bottom = '';
            panel.style.opacity = '';
            panel.style.transition = '';
            panel.style.willChange = '';
        }
    });
    observer.observe(panel, { attributes: true, attributeFilter: ['class'] });
})();

document.getElementById('closeBtn').addEventListener('click', closeInfo);
document.getElementById('overlay').addEventListener('click', closeInfo);

/* =========================================================
   СТАРТ
   ========================================================= */
loadDataFromGoogleSheets();
