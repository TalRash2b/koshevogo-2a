// === НАСТРОЙКА: ID вашей новой Google Таблицы ===
const SPREADSHEET_ID = '15O63umHMD-ghB3CQ7iPPKKESqkEFLzzy3BgauZQOzMs'; 
const SHEET_NAME = 'Ответы на форму (1)'; // Имя вкладки из формы

// Сюда загружаются обработанные данные
let houseDatabase = {};

// 1. Загрузка данных напрямую из Google Sheets (Формат CSV)
async function loadDataFromGoogleSheets() {
    const url = `https://google.com{SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Сбой при загрузке таблицы');
        
        const csvText = await response.text();
        parseFormCSV(csvText);
        
        // Строим интерактивный дом
        initHouse();
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        alert('Не удалось загрузить данные. Проверьте, что в таблице открыт доступ по ссылке ("Все, у кого есть ссылка — Читатель").');
    }
}

// 2. Парсер ответов Google Формы
function parseFormCSV(csvText) {
    const lines = csvText.split(/\r?\n/);
    houseDatabase = {}; // Сброс базы данных

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        // Корректное разделение CSV строки с учетом кавычек
        const matches = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[i].split(',');
        const row = matches.map(val => val.replace(/^"|"$/g, '').trim());

        if (row.length < 4) continue; // Пропускаем битые строки

        const rawNames = row[1];       // Колонка B: ФИО (может быть несколько имен)
        const rawApt = row[2];         // Колонка C: Номер квартиры (текст или число)
        const rawPhones = row[3];      // Колонка D: Телефоны

        // Извлекаем только цифры номера квартиры (например, из "45кв, 1 этаж" вытащит 45)
        const aptNumMatch = rawApt.match(/\d+/);
        if (!aptNumMatch) continue; // Если номер квартиры не найден, пропускаем строку
        const aptNum = parseInt(aptNumMatch[0]);

        // Если в одну ячейку записали несколько человек (через запятую или союз "и")
        const namesArray = rawNames.split(/,|\bи\b/);
        // Если номеров тоже несколько
        const phonesArray = rawPhones.split(/,|\s+/).filter(p => p.trim().length > 3);

        if (!houseDatabase[aptNum]) {
            houseDatabase[aptNum] = [];
        }

        // Распределяем людей и телефоны по карточкам
        namesArray.forEach((name, index) => {
            const cleanName = name.trim();
            if (!cleanName) return;

            // Пробуем сопоставить телефон каждому человеку, либо отдаем первый доступный
            let phone = phonesArray[index] || phonesArray[0] || "";
            phone = cleanPhoneFormat(phone);

            houseDatabase[aptNum].push({
                fio: cleanName,
                phone: phone,
                meta: `Запись от: ${row[0]}` // Добавляем отметку времени в карточку жильца
            });
        });
    }
}

// Вспомогательная функция для чистки формата телефона
function cleanPhoneFormat(phoneStr) {
    let cleaned = phoneStr.trim().replace(/[^\d+]/g, ''); // убираем лишние символы кроме цифр и плюса
    if (cleaned.length === 9 && !cleaned.startsWith('+')) {
        cleaned = '+375' + cleaned; // добавляем код страны, если жильцы написали просто "29XXXXXXX"
    }
    return cleaned;
}

// 3. Функция построения сетки квартир сверху вниз (11 -> 1 этаж)
function buildHouseGrid(containerId, startingApt, entranceId) {
    const container = document.getElementById(containerId);
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
            let labelText = isEmpty ? 'пусто' : `${residents.length} чел.`;
            
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

const infoPanel = document.getElementById('infoPanel');
const darkOverlay = document.getElementById('overlay');

function openInfoPanel(aptNum, floor, entrance, residents) {
    document.getElementById('panelAptNum').innerText = `Квартира №${aptNum}`;
    document.getElementById('panelAptMeta').innerText = `Подъезд ${entrance}, Этаж ${floor}`;
    
    const container = document.getElementById('residentsContainer');
    container.innerHTML = '';

    if (residents.length === 0) {
        container.innerHTML = '<div style="color: #94a3b8; text-align:center; padding-top:30px;">Нет ответов от жильцов этой квартиры.</div>';
    } else {
        residents.forEach(person => {
            const card = document.createElement('div');
            const isShortName = person.fio.trim().split(/\s+/).length === 1;
            card.className = `resident-card ${isShortName ? 'no-name' : ''}`;

            let phoneField = person.phone 
                ? `<a href="tel:${person.phone.replace(/\s+/g, '')}" class="res-phone">📞 ${person.phone}</a>` 
                : `<span style="color: #64748b; font-size: 0.9rem;">🚫 Нет телефона</span>`;

            card.innerHTML = `
                <div class="res-name">${person.fio}</div>
                ${phoneField}
                <div class="res-meta">ℹ️ ${person.meta}</div>
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
    setTimeout(() => {
        darkOverlay.style.display = 'none';
    }, 200);
}

document.getElementById('closeBtn').addEventListener('click', closeInfoPanel);
darkOverlay.addEventListener('click', closeInfoPanel);

function switchEntrance(entranceNum) {
    document.querySelectorAll('.entrance').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    document.getElementById(`entrance${entranceNum}`).classList.add('active');
    document.getElementById(`tab${entranceNum}`).classList.add('active');
}

function initHouse() {
    buildHouseGrid('entrance1', 1, 1);
    buildHouseGrid('entrance2', 45, 2);
}

window.addEventListener('resize', () => {
    if (window.innerWidth >= 768) {
        document.getElementById('entrance1').classList.add('active');
        document.getElementById('entrance2').classList.add('active');
    } else {
        const t2Active = document.getElementById('tab2').classList.contains('active');
        switchEntrance(t2Active ? 2 : 1);
    }
});

// ТОЧКА ВХОДА: загрузка из сети
loadDataFromGoogleSheets();
