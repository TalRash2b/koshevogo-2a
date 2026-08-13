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
    
    const tab1 = document.getElementById('tab1');
    const tab2 = document.getElementById('tab2');
    
    // Обновляем текст внутри табов
    if (tab1) tab1.innerHTML = `1 Подъезд <small style="opacity:0.7; font-size:0.8em;">(${stats.filled1}/${stats.total1})</small>`;
    if (tab2) tab2.innerHTML = `2 Подъезд <small style="opacity:0.7; font-size:0.8em;">(${stats.filled2}/${stats.total2})</small>`;
    
    // Обновляем ползунок под активным табом, так как ширина кнопок могла измениться
    updateTabSlider();
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
    const panel = document.getElementById('infoPanel');
    const overlay = document.getElementById('overlay');

    panel.classList.remove('active');
    overlay.classList.remove('active');

    panel.style.bottom = '';
    panel.style.opacity = '';
    panel.style.transition = '';
    panel.style.willChange = '';
    panel.style.transform = '';
    panel.style.display = '';
    panel.style.position = '';
    panel.style.top = '';
    panel.style.left = '';
    panel.style.right = '';
    panel.style.width = '';
    panel.style.height = '';

    overlay.style.display = 'none';
    document.body.style.overflow = '';
    setTimeout(() => {
    applyMobileFix();
}, 50);
}

// 9. Переключение подъездов
function switchEntrance(entranceNum) {
    const container = document.querySelector('.building-container');
    const entrance = document.getElementById(`entrance${entranceNum}`);

    // На мобильных устройствах плавно скроллим контейнер к выбранному подъезду
    if (window.innerWidth < 768 && container && entrance) {
        container.scrollTo({
            left: entrance.offsetLeft,
            behavior: 'smooth'
        });
    }

    // Подсвечиваем активный таб
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    const activeTab = document.getElementById(`tab${entranceNum}`);
    if (activeTab) {
        activeTab.classList.add('active');
    }

    if (typeof updateTabSlider === 'function') {
        updateTabSlider();
    }
}

// 10. Мобильный фикс
function applyMobileFix() {
    const isMobile = window.innerWidth < 768;

    if (isMobile) {
        const activeTab = document.querySelector('.tab-btn.active');

        if (activeTab) {
            const num = activeTab.id === 'tab1' ? 1 : 2;
            const activeEntrance = document.getElementById(`entrance${num}`);

            if (activeEntrance) {
                if (
                    activeEntrance.classList.contains('active') &&
                    activeEntrance.style.display === 'flex' &&
                    activeEntrance.style.position === 'relative' &&
                    activeEntrance.style.transform === '' &&
                    activeEntrance.style.opacity === '' &&
                    activeEntrance.style.pointerEvents === 'auto'
                ) {
                    return;
                }
                document.querySelectorAll('.entrance').forEach(el => {
                    if (el !== activeEntrance) {
                        el.classList.remove('active');
                        el.style.display = 'none';
                    }
                });

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

// 11. Ползунок
function updateTabSlider() {
    const activeTab = document.querySelector('.tab-btn.active');
    const slider = document.getElementById('tabSlider');
    const container = document.getElementById('tabsContainer');
    
    if (!activeTab || !slider || !container) return;
    
    requestAnimationFrame(() => {
        const containerRect = container.getBoundingClientRect();
        const tabRect = activeTab.getBoundingClientRect();
        
        const left = tabRect.left - containerRect.left + 2;
        const width = tabRect.width - 4;
        
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

const style = document.createElement('style');
style.textContent = `
    @keyframes slideUp {
        from { opacity:0; transform:translateX(-50%) translateY(20px); }
        to { opacity:1; transform:translateX(-50%) translateY(0); }
    }
`;
document.head.appendChild(style);

// Нативный скролл и отслеживание свайпа
(function initNativeSwipe() {
    const container = document.querySelector('.building-container');
    if (!container) return;

    let isScrollingTimer = null;

    container.addEventListener('scroll', () => {
        clearTimeout(isScrollingTimer);
        isScrollingTimer = setTimeout(() => {
            const width = container.clientWidth;
            if (width === 0) return;

            const activeIndex = Math.round(container.scrollLeft / width) + 1;

            const currentActiveTab = document.querySelector('.tab-btn.active');
            const targetTab = document.getElementById(`tab${activeIndex}`);

            if (targetTab && currentActiveTab !== targetTab) {
                document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
                targetTab.classList.add('active');

                if (typeof updateTabSlider === 'function') {
                    updateTabSlider();
                }
            }
        }, 50);
    }, { passive: true });
})();

// ===== СВАЙП ДЛЯ ЗАКРЫТИЯ ШТОРКИ =====
(function initSwipeToClose() {
    let startY = 0;
    let currentY = 0;
    let isDragging = false;
    const panel = document.getElementById('infoPanel');
    
    function isPanelActive() {
        return panel.classList.contains('active');
    }
    
function onStart(e) {
    if (!isPanelActive()) return;

    // Не запускаем свайп, если нажали на интерактивный элемент
    if (e.target.closest('.close-btn, a, button')) {
        return;
    }

    const touch = e.touches ? e.touches[0] : e;
    startY = touch.clientY;
    isDragging = true;

    panel.style.transition = 'none';
    e.preventDefault();
}
    
    function onMove(e) {
        if (!isDragging || !isPanelActive()) return;
        e.preventDefault();
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
            if (!isPanelActive()) {
                document.body.style.overflow = '';
            }
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
    
    // Тач-события
    panel.addEventListener('touchstart', onStart, { passive: false });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd, { passive: false });
    
    // Мышь (для ПК)
    panel.addEventListener('mousedown', onStart);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    
    // Следим за состоянием шторки
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

// Привязываем обработчики
document.getElementById('closeBtn').addEventListener('click', closeInfo);
document.getElementById('overlay').addEventListener('click', closeInfo);

// 16. Запуск!
removeSubtitle();
loadDataFromGoogleSheets();
