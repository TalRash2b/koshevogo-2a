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

// 4. Подсчёт заполненных квартир и обновление шапки
function updateHeader() {
    const filled = Object.keys(houseDatabase).length;
    const total = 88;
    const header = document.querySelector('header p');
    if (header) {
        header.textContent = `📊 Заполнено ${filled} из ${total} квартир`;
    }
}

// 5. Состояние ошибки (без демо-данных)
function showErrorState() {
    // Показываем все окна пустыми
    houseDatabase = {};
    renderBuilding();
    updateHeader();
    
    // Показываем сообщение в шапке
    const header = document.querySelector('header p');
    if (header) {
        header.textContent = '❌ Данные не загружены. Попробуйте обновить страницу.';
        header.style.color = '#ef4444';
    }
    
    showNotification('❌ Не удалось загрузить данные', 'error');
}

// 6. Отрисовка дома
function renderBuilding() {
    buildEntrance('entrance1', 1, 1);
    buildEntrance('entrance2', 45, 2);
}

function buildEntrance(containerId, startApt, entranceNum) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = `<div class="entrance-title">${entranceNum} Подъезд</div>`;
    
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
            aptDiv.innerHTML = `
                <div class="apt-num">${aptNum}</div>
                <div class="apt-count">${empty ? '' : residents.length + ' чел.'}</div>
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
            nameDiv.textContent = r.fio;
            card.appendChild(nameDiv);
            
            if (r.phones && r.phones.length > 0) {
                r.phones.forEach(phone => {
                    if (phone) {
                        const link = document.createElement('a');
                        link.href = `tel:${phone.replace(/\s+/g, '')}`;
                        link.className = 'res-phone';
                        link.style.display = 'block';
                        link.style.marginTop = '4px';
                        link.textContent = `📞 ${phone}`;
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

// 9. Переключение подъездов (исправлено для мобильных)
function switchEntrance(num) {
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab${num}`).classList.add('active');
    
    // Показываем только выбранный подъезд
    document.querySelectorAll('.entrance').forEach(el => el.classList.remove('active'));
    document.getElementById(`entrance${num}`).classList.add('active');
}

// 10. Ресайз (ПК — два подъезда, мобильные — один)
window.addEventListener('resize', () => {
    const isMobile = window.innerWidth < 768;
    
    if (!isMobile) {
        // На ПК показываем оба подъезда
        document.querySelectorAll('.entrance').forEach(el => el.classList.add('active'));
        // Скрываем табы на ПК
        document.querySelector('.tabs-container').style.display = 'flex';
    } else {
        // На мобильных — только активный таб
        const activeTab = document.querySelector('.tab-btn.active');
        if (activeTab) {
            const num = activeTab.id === 'tab1' ? 1 : 2;
            document.querySelectorAll('.entrance').forEach(el => el.classList.remove('active'));
            document.getElementById(`entrance${num}`).classList.add('active');
        }
    }
});

// 11. UI-функции
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

// 12. Запуск!
loadDataFromGoogleSheets();
