// === НАСТРОЙКА: ID вашей Google Таблицы ===
const SPREADSHEET_ID = '15O63umHMD-ghB3CQ7iPPKKESqkEFLzzy3BgauZQOzMs';

let houseDatabase = {};

// 1. Загрузка данных
async function loadDataFromGoogleSheets() {
    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json`;
    
    showLoadingStatus('Загрузка данных...');
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Ошибка сети');
        
        const text = await response.text();
        const jsonData = JSON.parse(text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1));
        
        parseData(jsonData);
        renderBuilding();
        hideLoadingStatus();
        updateHeader();
        
        applyMobileFix();
        setTimeout(updateTabSlider, 100);
    } catch (error) {
        console.error(error);
        hideLoadingStatus();
        showErrorState();
    }
}

// 2. Парсер данных
function parseData(jsonData) {
    houseDatabase = {};
    
    const rows = jsonData.table.rows;
    
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row.c) continue;
        
        const cells = row.c;
        
        const name = cells[1] ? String(cells[1].v || cells[1].f || '').trim() : '';
        const aptRaw = cells[2] ? String(cells[2].v || cells[2].f || '').trim() : '';
        const phoneRaw = cells[3] ? String(cells[3].v || cells[3].f || '').trim() : '';
        
        if (!name || !aptRaw) continue;
        
        const aptNum = parseInt(aptRaw);
        if (isNaN(aptNum) || aptNum < 1 || aptNum > 88) continue;
        
        if (!houseDatabase[aptNum]) {
            houseDatabase[aptNum] = [];
        }
        
        const names = name.split(',').map(n => n.trim()).filter(n => n);
        
        let phones = [];
        if (phoneRaw) {
            phones = phoneRaw.split(/[,;\s]+/).map(p => p.trim()).filter(p => p.length > 3);
            phones = phones.map(p => formatPhone(p));
        }
        
        if (names.length === 1 && phones.length > 1) {
            houseDatabase[aptNum].push({
                fio: names[0],
                phones: phones
            });
        } else {
            names.forEach((n, index) => {
                const phone = phones[index] || '';
                houseDatabase[aptNum].push({
                    fio: n,
                    phones: phone ? [phone] : []
                });
            });
        }
    }
}

// 3. Форматирование телефона
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

// 4. Обновление прогресс-бара
function updateHeader() {
    const filled = Object.keys(houseDatabase).length;
    const total = 88;
    const percent = Math.round((filled / total) * 100);
    
    const label = document.getElementById('progressLabel');
    if (label) {
        label.textContent = `Заполнено ${filled} из ${total} квартир (${percent}%)`;
    }
    
    const fill = document.getElementById('progressFill');
    if (fill) {
        fill.style.width = `${percent}%`;
    }
    updateTabStats();
}

// 4.5. Подсчёт статистики по подъездам
function getEntranceStats() {
    const total1 = 44;
    const total2 = 44;
    
    let filled1 = 0;
    let filled2 = 0;
    
    for (const aptNum in houseDatabase) {
        const num = parseInt(aptNum);
        if (num >= 1 && num <= 44) filled1++;
        else if (num >= 45 && num <= 88) filled2++;
    }
    
    const percent1 = Math.round((filled1 / total1) * 100);
    const percent2 = Math.round((filled2 / total2) * 100);
    
    return { filled1, total1, percent1, filled2, total2, percent2 };
}

// 4.6. Обновление статистики в табах
function updateTabStats() {
    const stats = getEntranceStats();
    
    const tab1 = document.getElementById('tabStats1');
    const tab2 = document.getElementById('tabStats2');
    
    if (tab1) tab1.textContent = `${stats.filled1} из ${stats.total1} (${stats.percent1}%)`;
    if (tab2) tab2.textContent = `${stats.filled2} из ${stats.total2} (${stats.percent2}%)`;
}

// 5. Состояние ошибки
function showErrorState() {
    houseDatabase = {};
    renderBuilding();
    updateHeader();
    
    const header = document.querySelector('header p');
    if (header) {
        header.textContent = 'Данные не загружены. Попробуйте обновить страницу.';
        header.style.color = '#ef4444';
        header.style.fontSize = '1.2rem';
        header.style.fontWeight = 'bold';
    }
    
    showNotification('❌ Не удалось загрузить данные', 'error');
}

// 6. Отрисовка дома
function renderBuilding() {
    buildEntrance('entrance1', 1, 1);
    buildEntrance('entrance2', 45, 2);
    setTimeout(applyMobileFix, 50);
}

function buildEntrance(containerId, startApt, entranceNum) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const stats = getEntranceStats();
    let statsText = '';
    if (entranceNum === 1) {
        statsText = `${stats.filled1} из ${stats.total1} (${stats.percent1}%)`;
    } else {
        statsText = `${stats.filled2} из ${stats.total2} (${stats.percent2}%)`;
    }
    
    const isMobile = window.innerWidth < 768;
    container.innerHTML = `
        <div class="entrance-title" style="${isMobile ? 'display: none;' : ''}">
            ${entranceNum} Подъезд
            <span class="entrance-stats">${statsText}</span>
        </div>
    `;
    
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
            
            const aptDiv = document.createElement('div');
            aptDiv.className = `apartment ${empty ? 'empty' : ''}`;
            
            const peopleIcons = empty ? '' : `<i class="fa-regular fa-user"></i>`.repeat(residents.length);
            
            aptDiv.innerHTML = `
                <div class="apt-num">${aptNum}</div>
                <div class="apt-count">${peopleIcons}</div>
            `;
            aptDiv.addEventListener('click', () => showInfo(aptNum, floor, residents));
            aptGrid.appendChild(aptDiv);
        }
        
        floorRow.appendChild(aptGrid);
        container.appendChild(floorRow);
        floorApt -= 4;
    }
}

// 7. Информационная панель
function showInfo(aptNum, floor, residents) {
    document.getElementById('panelAptNum').textContent = `Квартира №${aptNum}`;
    document.getElementById('panelAptMeta').textContent = `Этаж ${floor}`;
    
    const container = document.getElementById('residentsContainer');
    container.innerHTML = '';
    
    if (!residents || residents.length === 0) {
        container.innerHTML = `
            <div style="color:#94a3b8;text-align:center;padding:30px 0;">
                <div style="font-size:3rem;margin-bottom:10px;">🏠</div>
                Жильцы этой квартиры не предоставили свои данные
            </div>
        `;
    } else {
        residents.forEach(r => {
            const card = document.createElement('div');
            card.className = 'resident-card';
            
            const nameDiv = document.createElement('div');
            nameDiv.className = 'res-name';
            nameDiv.innerHTML = `<i class="fas fa-user" style="color: #38bdf8; margin-right: 8px; width: 14px;"></i> ${r.fio}`;
            card.appendChild(nameDiv);
            
            if (r.phones && r.phones.length > 0) {
                r.phones.forEach(phone => {
                    if (phone) {
                        const link = document.createElement('a');
                        link.href = `tel:${phone.replace(/\s+/g, '')}`;
                        link.className = 'res-phone';
                        link.style.display = 'block';
                        link.style.marginTop = '4px';
                        link.innerHTML = `<i class="fas fa-phone" style="color:#38bdf8;margin-right:6px;"></i> ${phone}`;
                        card.appendChild(link);
                    }
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
    
    document.getElementById('overlay').style.display = 'block';
    setTimeout(() => {
        document.getElementById('overlay').classList.add('active');
        document.getElementById('infoPanel').classList.add('active');
    }, 10);
}

// 8. Закрытие панели
function closeInfo() {
    document.getElementById('overlay').classList.remove('active');
    document.getElementById('infoPanel').classList.remove('active');
    setTimeout(() => {
        document.getElementById('overlay').style.display = 'none';
    }, 200);
}

document.getElementById('closeBtn').addEventListener('click', closeInfo);
document.getElementById('overlay').addEventListener('click', closeInfo);

// 9. Переключение подъездов С АНИМАЦИЕЙ И ОБНОВЛЕНИЕМ ПОЛЗУНКА
function switchEntrance(num, direction) {
    const currentEntrance = document.querySelector('.entrance.active');
    const nextEntrance = document.getElementById(`entrance${num}`);
    
    if (currentEntrance === nextEntrance) return;
    if (!currentEntrance || !nextEntrance) return;
    
    if (!direction) {
        const currentNum = currentEntrance.id === 'entrance1' ? 1 : 2;
        direction = num > currentNum ? 'left' : 'right';
    }
    
    // Анимация текущего
    currentEntrance.classList.remove('active');
    currentEntrance.classList.add(direction === 'left' ? 'exit-left' : 'exit-right');
    
    // Подготовка следующего
    nextEntrance.style.display = 'flex';
    nextEntrance.style.position = 'absolute';
    nextEntrance.style.top = '0';
    nextEntrance.style.left = '0';
    nextEntrance.style.width = '100%';
    nextEntrance.style.transform = direction === 'left' ? 'translateX(100%)' : 'translateX(-100%)';
    nextEntrance.style.opacity = '0';
    nextEntrance.style.pointerEvents = 'none';
    nextEntrance.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s ease';
    
    void nextEntrance.offsetHeight;
    
    requestAnimationFrame(() => {
        nextEntrance.style.transform = 'translateX(0)';
        nextEntrance.style.opacity = '1';
    });
    
    // Обновляем табы И ползунок
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab${num}`).classList.add('active');
    updateTabSlider();
    
    setTimeout(() => {
        nextEntrance.classList.add('active');
        nextEntrance.style.position = 'relative';
        nextEntrance.style.pointerEvents = 'auto';
        nextEntrance.style.transform = '';
        nextEntrance.style.opacity = '';
        nextEntrance.style.transition = '';
        
        currentEntrance.classList.remove('exit-left', 'exit-right');
        currentEntrance.style.display = 'none';
        
        applyMobileFix();
    }, 450);
}

// 10. Мобильный фикс
function applyMobileFix() {
    const isMobile = window.innerWidth < 768;
    
    if (isMobile) {
        const activeTab = document.querySelector('.tab-btn.active');
        if (activeTab) {
            const num = activeTab.id === 'tab1' ? 1 : 2;
            document.querySelectorAll('.entrance').forEach(el => {
                el.classList.remove('active');
                el.style.display = 'none';
            });
            const activeEntrance = document.getElementById(`entrance${num}`);
            if (activeEntrance) {
                activeEntrance.classList.add('active');
                activeEntrance.style.display = 'flex';
                activeEntrance.style.position = 'relative';
                activeEntrance.style.transform = '';
                activeEntrance.style.opacity = '';
                activeEntrance.style.pointerEvents = 'auto';
            }
        }
    } else {
        document.querySelectorAll('.entrance').forEach(el => {
            el.classList.add('active');
            el.style.display = 'flex';
            el.style.position = 'relative';
            el.style.transform = '';
            el.style.opacity = '';
            el.style.pointerEvents = 'auto';
        });
    }
}

// 11. ПЛАВНЫЙ ПЕРЕЕЗД ПОДСВЕТКИ ТАБА (ПОЛЗУНОК)
function updateTabSlider() {
    const activeTab = document.querySelector('.tab-btn.active');
    const slider = document.getElementById('tabSlider');
    const container = document.getElementById('tabsContainer');
    
    if (!activeTab || !slider || !container) return;
    
    requestAnimationFrame(() => {
        const containerRect = container.getBoundingClientRect();
        const tabRect = activeTab.getBoundingClientRect();
        
        const left = tabRect.left - containerRect.left + 5;
        const width = tabRect.width - 10;
        
        slider.style.left = left + 'px';
        slider.style.width = width + 'px';
    });
}

// 12. Ресайз
window.addEventListener('resize', () => {
    applyMobileFix();
    updateTabSlider();
});

// 13. Убираем "Интерактивная модель дома"
function removeSubtitle() {
    const header = document.querySelector('header');
    if (header) {
        const p = header.querySelector('p');
        if (p && !p.textContent.includes('Заполнено')) {
            if (p.textContent === 'Интерактивная модель дома' || p.textContent === '') {
                p.remove();
            }
        }
    }
}

// 14. UI-функции
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
        el.style.transition = 'opacity 0.3s';
        setTimeout(() => el.remove(), 300);
    }, 3000);
}

// Добавляем анимацию
const style = document.createElement('style');
style.textContent = `
    @keyframes slideUp {
        from { opacity:0; transform:translateX(-50%) translateY(20px); }
        to { opacity:1; transform:translateX(-50%) translateY(0); }
    }
`;
document.head.appendChild(style);

// 15. СВАЙП ДЛЯ МОБИЛОК
(function initSwipe() {
    let touchStartX = 0;
    let touchEndX = 0;
    let isSwiping = false;

    document.addEventListener('touchstart', function(e) {
        touchStartX = e.changedTouches[0].screenX;
        isSwiping = true;
    }, { passive: true });

    document.addEventListener('touchmove', function(e) {
        if (!isSwiping) return;
        const target = e.target.closest('.tabs-container');
        if (target) {
            e.preventDefault();
        }
    }, { passive: false });

    document.addEventListener('touchend', function(e) {
        if (!isSwiping) return;
        isSwiping = false;
        
        touchEndX = e.changedTouches[0].screenX;
        const swipeThreshold = 40;
        const diff = touchStartX - touchEndX;
        
        if (window.innerWidth >= 768) return;
        
        const activeTab = document.querySelector('.tab-btn.active');
        if (!activeTab) return;
        
        const currentNum = activeTab.id === 'tab1' ? 1 : 2;
        let newNum = currentNum;
        
        if (diff > swipeThreshold) {
            newNum = currentNum === 1 ? 2 : 2;
        } else if (diff < -swipeThreshold) {
            newNum = currentNum === 2 ? 1 : 1;
        }
        
        if (newNum !== currentNum) {
            const direction = diff > 0 ? 'left' : 'right';
            switchEntrance(newNum, direction);
            if (navigator.vibrate) navigator.vibrate(10);
        }
    }, { passive: true });
})();

// 16. Запуск!
removeSubtitle();
loadDataFromGoogleSheets();
