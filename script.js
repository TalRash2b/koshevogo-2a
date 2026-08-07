// === НАСТРОЙКА: ID вашей Google Таблицы ===
const SPREADSHEET_ID = '15O63umHMD-ghB3CQ7iPPKKESqkEFLzzy3BgauZQOzMs'; 

let houseDatabase = {};
let isLoading = false;

// 1. Загрузка данных из Google Sheets
async function loadDataFromGoogleSheets() {
    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json`;
    
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

// 2. Парсер ячеек (улучшенный)
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

        // Улучшенный парсинг номера квартиры
        const aptNumMatch = rawApt.replace(/\s/g, '').match(/\d+/);
        if (!aptNumMatch) continue; 
        const aptNum = parseInt(aptNumMatch[0]);
        
        if (aptNum < 1 || aptNum > 88) continue;

        if (!houseDatabase[aptNum]) {
            houseDatabase[aptNum] = [];
        }

        // Разделяем имена (через запятую или "и")
        const namesArray = rawNames.split(/,|\bи\b/).map(n => n.trim()).filter(n => n);
        
        // Разделяем телефоны (по пробелу, запятой или нескольким номерам подряд)
        let phonesArray = extractPhones(rawPhone);
        
        // Если телефонов меньше чем имён — дополняем пустыми
        while (phonesArray.length < namesArray.length) {
            phonesArray.push('');
        }
        // Если телефонов больше чем имён — обрезаем
        if (phonesArray.length > namesArray.length) {
            phonesArray = phonesArray.slice(0, namesArray.length);
        }

        namesArray.forEach((cleanName, index) => {
            if (!cleanName) return;

            let phone = phonesArray[index] || '';
            phone = cleanPhoneFormat(phone);

            houseDatabase[aptNum].push({
                fio: cleanName,
                phone: phone
            });
        });
    }
    
    console.log(`✅ Загружено ${Object.keys(houseDatabase).length} квартир с данными`);
}

// 3. Извлечение телефонов из строки
function extractPhones(phoneStr) {
    if (!phoneStr || !phoneStr.trim()) return [];
    
    // Убираем лишние пробелы
    let str = phoneStr.trim();
    
    // Если есть явные разделители (запятая, точка с запятой, "и")
    if (str.includes(',') || str.includes(';') || str.includes(' и ')) {
        return str.split(/[,;]\s*|\s+и\s+/).map(p => p.trim()).filter(p => p);
    }
    
    // Ищем все номера по паттерну: +375, 8, или просто 9 цифр
    const phoneRegex = /(?:\+375|8|80)?\s*\(?\d{2}\)?\s*\d{3}[\s-]?\d{2}[\s-]?\d{2}/g;
    const matches = str.match(phoneRegex);
    if (matches) {
        return matches.map(p => p.trim());
    }
    
    // Если номер один — возвращаем его
    return [str];
}

// 4. Улучшенная очистка телефона
function cleanPhoneFormat(phoneStr) {
    if (!phoneStr) return '';
    
    // Убираем все пробелы, тире, скобки — оставляем только цифры и плюс
    let cleaned = phoneStr.trim().replace(/[^\d+]/g, '');
    
    // Если есть знак +/- или ± — убираем и ставим +
    if (phoneStr.includes('±') || phoneStr.includes('+/-') || phoneStr.includes('+-')) {
        cleaned = cleaned.replace(/[^0-9]/g, '');
    }
    
    // Если номер начинается с 29, 33, 44 и т.д. — добавляем +375
    if (cleaned.match(/^\d{9}$/)) {
        cleaned = '+375' + cleaned;
    }
    // Если номер начинается с 8 (международный формат) — заменяем на +375
    if (cleaned.match(/^8\d{10}$/)) {
        cleaned = '+375' + cleaned.substring(1);
    }
    // Если номер начинается с 80 (две цифры после 8) — тоже чистим
    if (cleaned.match(/^80\d{9}$/)) {
        cleaned = '+375' + cleaned.substring(2);
    }
    // Если номер начинается с 375 без плюса
    if (cleaned.match(/^375\d{9}$/)) {
        cleaned = '+' + cleaned;
    }
    
    return cleaned;
}

// 5. Демо-данные
function loadDemoData() {
    houseDatabase = {};
    const demo = {
        15: [{ fio: 'Иванов Иван', phone: '+375291234567' }],
        23: [{ fio: 'Петрова Анна', phone: '+375297654321' }],
        34: [{ fio: 'Сидоров Сергей', phone: '+375336789012' }],
        56: [{ fio: 'Козлова Екатерина', phone: '+375447890123' }],
        67: [{ fio: 'Морозов Дмитрий', phone: '+375298901234' }],
    };
    
    Object.assign(houseDatabase, demo);
    initHouse();
    showNotification('ℹ️ Показаны демо-данные (таблица недоступна)', 'info');
}

// 6. Отрисовка дома
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

// 7. Информационная панель (обновлена — каждый телефон отдельно)
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

            // Разбиваем телефон на отдельные номера (если их несколько)
            let phonesHtml = '';
            if (person.phone && person.phone.length > 5) {
                // Если в строке несколько номеров (разделитель — пробел или запятая)
                const phones = person.phone.split(/[,;\s]+/).filter(p => p.trim().length > 5);
                if (phones.length > 1) {
                    phonesHtml = phones.map(p => 
                        `<a href="tel:${p.replace(/\s+/g, '')}" class="res-phone" style="display:block; margin-top:4px;">📞 ${p}</a>`
                    ).join('');
                } else {
                    phonesHtml = `<a href="tel:${person.phone.replace(/\s+/g, '')}" class="res-phone">📞 ${person.phone}</a>`;
                }
            } else {
                phonesHtml = `<span style="color: #64748b; font-size: 0.9rem;">🚫 Нет телефона</span>`;
            }

            card.innerHTML = `
                <div class="res-name">${person.fio}</div>
                ${phonesHtml}
            `;
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

// 8. Переключение подъездов
function switchEntrance(entranceNum) {
    document.querySelectorAll('.entrance').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(`entrance${entranceNum}`).classList.add('active');
    document.getElementById(`tab${entranceNum}`).classList.add('active');
}

// 9. Инициализация дома
function initHouse() {
    buildHouseGrid('entrance1', 1, 1);
    buildHouseGrid('entrance2', 45, 2);
}

// 10. Обработка ресайза
window.addEventListener('resize', () => {
    if (window.innerWidth >= 768) {
        document.getElementById('entrance1').classList.add('active');
        document.getElementById('entrance2').classList.add('active');
    } else {
        const t2Active = document.getElementById('tab2').classList.contains('active');
        switchEntrance(t2Active ? 2 : 1);
    }
});

// 11. Вспомогательные функции
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

// Добавляем стили
const styleSheet = document.createElement('style');
styleSheet.textContent = `
    @keyframes slideUp {
        from { opacity: 0; transform: translateX(-50%) translateY(20px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
`;
document.head.appendChild(styleSheet);

// 12. Кнопка обновления
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

// 13. Запуск!
loadDataFromGoogleSheets();
