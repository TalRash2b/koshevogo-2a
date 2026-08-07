// === НАСТРОЙКА: ID вашей Google Таблицы ===
const SPREADSHEET_ID = '15O63umHMD-ghB3CQ7iPPKKESqkEFLzzy3BgauZQOzMs'; 

let houseDatabase = {};
let isLoading = false;

// 1. Загрузка данных
async function loadDataFromGoogleSheets() {
    const url = `https://docs.google.comspreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json`;
    
    showLoadingStatus('Загрузка данных из таблицы...');
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Сбой сети: ' + response.status);
        
        const text = await response.text();
        
        const jsonStart = text.indexOf("{");
        const jsonEnd = text.lastIndexOf("}") + 1;
        if (jsonStart === -1 || jsonEnd === 0) throw new Error('Не найден JSON в ответе');
        
        const jsonString = text.substring(jsonStart, jsonEnd);
        const jsonData = JSON.parse(jsonString);
        
        parseGoogleJson(jsonData);
        initHouse();
        hideLoadingStatus();
        showNotification('✅ Данные обновлены!', 'success');
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        hideLoadingStatus();
        showNotification('❌ Ошибка загрузки: ' + error.message, 'error');
        loadDemoData();
    }
}

// 2. Главный парсер
function parseGoogleJson(jsonData) {
    houseDatabase = {}; 
    
    if (!jsonData || !jsonData.table || !jsonData.table.rows) {
        console.warn('Нет данных в таблице');
        return;
    }
    
    const rows = jsonData.table.rows;

    for (let i = 1; i < rows.length; i++) {
        const rowData = rows[i];
        if (!rowData || !rowData.c) continue;
        const c = rowData.c;

        const getVal = (cell) => {
            if (!cell) return '';
            if (cell.f !== undefined && cell.f !== null) return String(cell.f);
            if (cell.v !== undefined && cell.v !== null) return String(cell.v);
            return '';
        };

        const rawNames = getVal(c[1]);  // Колонка B: ФИО
        const rawApt = getVal(c[2]);    // Колонка C: № квартиры
        const rawPhone = getVal(c[3]);  // Колонка D: Телефон

        if (!rawNames.trim() || !rawApt.trim()) continue;

        // ===== ВЫТЯГИВАЕМ ТОЛЬКО НОМЕР КВАРТИРЫ (убираем этаж и подъезд) =====
        // Ищем ЧИСЛО от 1 до 88 (квартира) — первое подходящее число
        const aptMatch = rawApt.match(/\b([1-9]|[1-7][0-9]|8[0-8])\b/);
        if (!aptMatch) continue;
        const aptNum = parseInt(aptMatch[0]);
        
        if (aptNum < 1 || aptNum > 88) continue;

        if (!houseDatabase[aptNum]) {
            houseDatabase[aptNum] = [];
        }

        // ===== РАЗБИВАЕМ ИМЕНА =====
        const namesArray = rawNames.split(/,|\bи\b/).map(n => n.trim()).filter(n => n);

        // ===== ВЫТЯГИВАЕМ ВСЕ ТЕЛЕФОНЫ ИЗ СТРОКИ =====
        const allPhones = extractAllPhones(rawPhone);

        // Сопоставляем имена и телефоны
        if (namesArray.length === 1 && allPhones.length > 1) {
            // Один человек — несколько телефонов
            houseDatabase[aptNum].push({
                fio: namesArray[0],
                phones: allPhones
            });
        } else {
            // Несколько человек
            namesArray.forEach((name, index) => {
                const phone = allPhones[index] || '';
                houseDatabase[aptNum].push({
                    fio: name,
                    phones: phone ? [phone] : []
                });
            });
        }
    }
    
    console.log(`✅ Загружено ${Object.keys(houseDatabase).length} квартир с данными`);
}

// 3. ВЫТЯГИВАЕМ ВСЕ ТЕЛЕФОНЫ ИЗ ЛЮБОЙ СТРОКИ
function extractAllPhones(phoneStr) {
    if (!phoneStr || !phoneStr.trim()) return [];
    
    let str = phoneStr.trim();
    
    // 1. Сначала пробуем разделить по явным разделителям
    if (str.includes(',') || str.includes(';') || str.includes(' и ')) {
        const parts = str.split(/[,;]\s*|\s+и\s+/).map(p => p.trim()).filter(p => p);
        const result = [];
        parts.forEach(part => {
            // Из каждой части вытягиваем все номера
            const phones = extractPhonesFromText(part);
            result.push(...phones);
        });
        return result;
    }
    
    // 2. Ищем все номера в тексте
    return extractPhonesFromText(str);
}

// 4. Ищем номера в тексте (регулярка)
function extractPhonesFromText(text) {
    // Ищем номера: +375, 8, 80, или просто 9 цифр
    const patterns = [
        // +375XXXXXXXXX
        /\+\s*375\s*\(?\d{2}\)?\s*\d{3}[\s-]?\d{2}[\s-]?\d{2}/g,
        // 8XXXXXXXXXX (11 цифр после 8)
        /8\s*\(?\d{2}\)?\s*\d{3}[\s-]?\d{2}[\s-]?\d{2}/g,
        // 80XXXXXXXXX (10 цифр после 80)
        /80\s*\(?\d{2}\)?\s*\d{3}[\s-]?\d{2}[\s-]?\d{2}/g,
        // 375XXXXXXXXX (без плюса)
        /375\s*\(?\d{2}\)?\s*\d{3}[\s-]?\d{2}[\s-]?\d{2}/g,
        // Просто 9 цифр подряд (29, 33, 44 и т.д.)
        /\b[0-9]{9}\b/g,
        // Номера с пробелами: 29 123 45 67
        /\b\d{2}\s+\d{3}\s+\d{2}\s+\d{2}\b/g,
        /\b\d{2}\s+\d{3}\s+\d{2}\s+\d{2}\b/g,
    ];
    
    let allMatches = [];
    patterns.forEach(pattern => {
        const matches = text.match(pattern);
        if (matches) {
            allMatches.push(...matches);
        }
    });
    
    // Если ничего не нашли — пытаемся разбить по пробелам
    if (allMatches.length === 0) {
        const parts = text.split(/\s+/).filter(p => p.length > 5);
        if (parts.length > 0) {
            return parts.map(p => cleanPhoneFormat(p)).filter(p => p);
        }
        return [];
    }
    
    // Чистим и форматируем каждый номер
    const unique = [...new Set(allMatches)];
    return unique.map(p => cleanPhoneFormat(p)).filter(p => p);
}

// 5. ОЧИСТКА И ФОРМАТИРОВАНИЕ ТЕЛЕФОНА
function cleanPhoneFormat(phoneStr) {
    if (!phoneStr) return '';
    
    // Убираем всё кроме цифр (плюс пока оставляем)
    let cleaned = phoneStr.trim().replace(/[^\d+]/g, '');
    
    // Если есть +/- или ± — заменяем на +
    if (phoneStr.includes('±') || phoneStr.includes('+/-') || phoneStr.includes('+-')) {
        cleaned = '+' + cleaned.replace(/[^0-9]/g, '');
    }
    
    // Если номер без плюса
    if (!cleaned.startsWith('+')) {
        // Если 9 цифр — +375
        if (cleaned.length === 9) {
            cleaned = '+375' + cleaned;
        }
        // Если 10 цифр и начинается с 8
        else if (cleaned.length === 10 && cleaned.startsWith('8')) {
            cleaned = '+375' + cleaned.substring(1);
        }
        // Если 11 цифр и начинается с 80
        else if (cleaned.length === 11 && cleaned.startsWith('80')) {
            cleaned = '+375' + cleaned.substring(2);
        }
        // Если 12 цифр и начинается с 375
        else if (cleaned.length === 12 && cleaned.startsWith('375')) {
            cleaned = '+' + cleaned;
        }
        // Если 12 цифр и начинается с 8
        else if (cleaned.length === 12 && cleaned.startsWith('8')) {
            cleaned = '+375' + cleaned.substring(1);
        }
    }
    
    // Проверяем формат +375XXXXXXXXX
    if (cleaned.match(/^\+375\d{9}$/)) {
        return cleaned;
    }
    
    // Если не похоже на телефон — возвращаем как есть
    return phoneStr.trim();
}

// 6. Демо-данные
function loadDemoData() {
    houseDatabase = {};
    const demo = {
        15: [{ fio: 'Иванов Иван', phones: ['+375291234567'] }],
        23: [{ fio: 'Петрова Анна', phones: ['+375297654321'] }],
        34: [{ fio: 'Сидоров Сергей', phones: ['+375336789012'] }],
        56: [{ fio: 'Козлова Екатерина', phones: ['+375447890123'] }],
        67: [{ fio: 'Морозов Дмитрий', phones: ['+375298901234'] }],
    };
    
    Object.assign(houseDatabase, demo);
    initHouse();
    showNotification('ℹ️ Показаны демо-данные (таблица недоступна)', 'info');
}

// 7. Отрисовка дома
function buildHouseGrid(containerId, startingApt, entranceId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = `<div class="entrance-title">${entranceId} Подъезд</div>`; 
    let floorStartApt = startingApt + 40; 

    for (let currentFloor = 11; currentFloor >= 1; currentFloor--) {
        const floorRow = document.createElement('div');
        floorRow.className = 'floor';
        
        const label = document.createElement('div');
        label.className = 'floor-number';
        label.innerText = currentFloor;
        floorRow.appendChild(label);

        const aptGrid = document.createElement('div');
        aptGrid.className = 'apartments';

        for (let i = 0; i < 4; i++) {
            const aptNumber = floorStartApt + i;
            const aptDiv = document.createElement('div');
            const residents = houseDatabase[aptNumber] || [];
            const isEmpty = residents.length === 0;

            aptDiv.className = `apartment ${isEmpty ? 'empty' : ''}`;
            
            const labelText = isEmpty ? '' : `${residents.length} чел.`;
            
            aptDiv.innerHTML = `
                <div class="apt-num">${aptNumber}</div>
                <div class="apt-count">${labelText}</div>
            `;

            aptDiv.addEventListener('click', () => openInfoPanel(aptNumber, currentFloor, entranceId, residents));
            aptGrid.appendChild(aptDiv);
        }
        floorRow.appendChild(aptGrid);
        container.appendChild(floorRow);
        floorStartApt -= 4; 
    }
}

// 8. Информационная панель
const infoPanel = document.getElementById('infoPanel');
const darkOverlay = document.getElementById('overlay');

function openInfoPanel(aptNum, floor, entrance, residents) {
    document.getElementById('panelAptNum').innerText = `Квартира №${aptNum}`;
    document.getElementById('panelAptMeta').innerText = `Подъезд ${entrance}, Этаж ${floor}`;
    const container = document.getElementById('residentsContainer');
    container.innerHTML = '';

    if (!residents || residents.length === 0) {
        container.innerHTML = `
            <div style="color: #94a3b8; text-align:center; padding-top:30px;">
                <div style="font-size: 3rem; margin-bottom: 10px;">🏠</div>
                Жильцы этой квартиры не предоставили свои данные
            </div>
        `;
    } else {
        residents.forEach(person => {
            const card = document.createElement('div');
            const isShortName = person.fio.trim().split(/\s+/).length === 1;
            card.className = `resident-card ${isShortName ? 'no-name' : ''}`;

            const nameDiv = document.createElement('div');
            nameDiv.className = 'res-name';
            nameDiv.innerText = person.fio;
            card.appendChild(nameDiv);

            // Отображаем телефоны
            const phones = person.phones || [];
            if (phones.length === 0) {
                const noPhone = document.createElement('div');
                noPhone.style.cssText = 'color: #64748b; font-size: 0.9rem; margin-top: 4px;';
                noPhone.innerText = '🚫 Нет телефона';
                card.appendChild(noPhone);
            } else {
                phones.forEach(phone => {
                    const link = document.createElement('a');
                    link.href = `tel:${phone.replace(/\s+/g, '')}`;
                    link.className = 'res-phone';
                    link.style.cssText = 'display: block; margin-top: 4px;';
                    link.innerText = `📞 ${phone}`;
                    card.appendChild(link);
                });
            }

            container.appendChild(card);
        });
    }
    
    darkOverlay.style.display = 'block';
    setTimeout(() => {
        darkOverlay.classList.add('active');
        infoPanel.classList.add('active');
    }, 10);
}

function closeInfoPanel() {
    darkOverlay.classList.remove('active');
    infoPanel.classList.remove('active');
    setTimeout(() => { darkOverlay.style.display = 'none'; }, 200);
}

document.getElementById('closeBtn').addEventListener('click', closeInfoPanel);
darkOverlay.addEventListener('click', closeInfoPanel);

// 9. Переключение подъездов
function switchEntrance(entranceNum) {
    document.querySelectorAll('.entrance').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(`entrance${entranceNum}`).classList.add('active');
    document.getElementById(`tab${entranceNum}`).classList.add('active');
}

// 10. Инициализация
function initHouse() {
    buildHouseGrid('entrance1', 1, 1);
    buildHouseGrid('entrance2', 45, 2);
}

// 11. Ресайз
window.addEventListener('resize', () => {
    if (window.innerWidth >= 768) {
        document.getElementById('entrance1').classList.add('active');
        document.getElementById('entrance2').classList.add('active');
    } else {
        const t2Active = document.getElementById('tab2').classList.contains('active');
        switchEntrance(t2Active ? 2 : 1);
    }
});

// 12. UI-функции
function showLoadingStatus(text) {
    let status = document.getElementById('loadingStatus');
    if (!status) {
        status = document.createElement('div');
        status.id = 'loadingStatus';
        status.style.cssText = `
            position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
            background: #1e293b; color: #f8fafc; padding: 12px 24px;
            border-radius: 8px; z-index: 1000; border: 1px solid #475569;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            transition: all 0.3s ease;
        `;
        document.body.appendChild(status);
    }
    status.textContent = text;
    status.style.display = 'block';
}

function hideLoadingStatus() {
    const status = document.getElementById('loadingStatus');
    if (status) status.style.display = 'none';
}

function showNotification(text, type = 'info') {
    const colors = {
        success: '#10b981',
        error: '#ef4444',
        info: '#38bdf8'
    };
    
    const notif = document.createElement('div');
    notif.style.cssText = `
        position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
        background: #1e293b; color: #f8fafc; padding: 12px 24px;
        border-radius: 8px; z-index: 1000; 
        border-left: 4px solid ${colors[type] || '#38bdf8'};
        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        animation: slideUp 0.3s ease;
        max-width: 90%;
        text-align: center;
    `;
    notif.textContent = text;
    document.body.appendChild(notif);
    
    setTimeout(() => {
        notif.style.opacity = '0';
        notif.style.transition = 'opacity 0.3s ease';
        setTimeout(() => notif.remove(), 300);
    }, 4000);
}

const styleSheet = document.createElement('style');
styleSheet.textContent = `
    @keyframes slideUp {
        from { opacity: 0; transform: translateX(-50%) translateY(20px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
`;
document.head.appendChild(styleSheet);

// 13. Кнопка обновления
const refreshBtn = document.createElement('button');
refreshBtn.innerHTML = '🔄';
refreshBtn.style.cssText = `
    position: fixed; bottom: 20px; right: 20px;
    width: 50px; height: 50px; border-radius: 50%;
    background: #38bdf8; color: #0f172a; border: none;
    font-size: 1.5rem; cursor: pointer; z-index: 50;
    box-shadow: 0 4px 12px rgba(56, 189, 248, 0.4);
    transition: transform 0.2s ease;
`;
refreshBtn.onmouseover = () => refreshBtn.style.transform = 'scale(1.1)';
refreshBtn.onmouseout = () => refreshBtn.style.transform = 'scale(1)';
refreshBtn.onclick = () => loadDataFromGoogleSheets();
document.body.appendChild(refreshBtn);

// 14. Запуск!
loadDataFromGoogleSheets();
