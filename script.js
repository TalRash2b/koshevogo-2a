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
        showNotification('✅ Данные обновлены', 'success');
    } catch (error) {
        console.error(error);
        hideLoadingStatus();
        showNotification('❌ Ошибка загрузки', 'error');
        loadDemoData();
    }
}

// 2. Парсер данных (ИСПРАВЛЕН)
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
        
        // Разбиваем имена
        const names = name.split(',').map(n => n.trim()).filter(n => n);
        
        // Разбиваем телефоны
        let phones = [];
        if (phoneRaw) {
            phones = phoneRaw.split(/[,;\s]+/).map(p => p.trim()).filter(p => p.length > 3);
            phones = phones.map(p => formatPhone(p));
        }
        
        // === НОВАЯ ЛОГИКА ===
        if (names.length === 1 && phones.length > 1) {
            // Если имя одно, а телефонов несколько — отдаем все телефоны этому одному человеку
            houseDatabase[aptNum].push({
                fio: names[0],
                phones: phones // Все телефоны
            });
        } else {
            // Если имен несколько — сопоставляем по порядку
            names.forEach((n, index) => {
                const phone = phones[index] || '';
                houseDatabase[aptNum].push({
                    fio: n,
                    phones: phone ? [phone] : []
                });
            });
        }
    }
    
    console.log(`✅ Загружено ${Object.keys(houseDatabase).length} квартир`);
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

// 4. Демо-данные
function loadDemoData() {
    houseDatabase = {
        15: [{ fio: 'Иванов Иван', phones: ['+375291234567'] }],
        23: [{ fio: 'Петрова Анна', phones: ['+375297654321'] }],
        34: [{ fio: 'Сидоров Сергей', phones: ['+375336789012'] }],
        56: [{ fio: 'Козлова Екатерина', phones: ['+375447890123'] }],
        67: [{ fio: 'Морозов Дмитрий', phones: ['+375298901234'] }],
    };
    renderBuilding();
    showNotification('ℹ️ Показаны демо-данные', 'info');
}

// 5. Отрисовка дома
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

// 6. Информационная панель
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

// 7. Закрытие панели
function closeInfo() {
    document.getElementById('overlay').classList.remove('active');
    document.getElementById('infoPanel').classList.remove('active');
    setTimeout(() => {
        document.getElementById('overlay').style.display = 'none';
    }, 200);
}

document.getElementById('closeBtn').addEventListener('click', closeInfo);
document.getElementById('overlay').addEventListener('click', closeInfo);

// 8. Переключение подъездов
function switchEntrance(num) {
    document.querySelectorAll('.entrance').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(`entrance${num}`).classList.add('active');
    document.getElementById(`tab${num}`).classList.add('active');
}

// 9. Ресайз
window.addEventListener('resize', () => {
    if (window.innerWidth >= 768) {
        document.getElementById('entrance1').classList.add('active');
        document.getElementById('entrance2').classList.add('active');
    } else {
        const activeTab = document.querySelector('.tab-btn.active');
        if (activeTab) {
            const num = activeTab.id === 'tab1' ? 1 : 2;
            switchEntrance(num);
        }
    }
});

// 10. UI-функции
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
style.textContent = `@keyframes slideUp { from { opacity:0; transform:translateX(-50%) translateY(20px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }`;
document.head.appendChild(style);

// 11. Кнопка обновления
const refreshBtn = document.createElement('button');
refreshBtn.innerHTML = '🔄';
refreshBtn.style.cssText = 'position:fixed;bottom:20px;right:20px;width:50px;height:50px;border-radius:50%;background:#38bdf8;color:#0f172a;border:none;font-size:1.5rem;cursor:pointer;z-index:50;box-shadow:0 4px 12px rgba(56,189,248,0.4);transition:transform 0.2s;';
refreshBtn.onmouseover = () => refreshBtn.style.transform = 'scale(1.1)';
refreshBtn.onmouseout = () => refreshBtn.style.transform = 'scale(1)';
refreshBtn.onclick = loadDataFromGoogleSheets;
document.body.appendChild(refreshBtn);

// 12. Запуск!
loadDataFromGoogleSheets();
