// === НАСТРОЙКА: Ссылка на опубликованную Google Таблицу ===
const PUBLISHED_URL = 'https://google.com';

let houseDatabase = {};

// 1. Загрузка данных из опубликованного CSV фида
async function loadDataFromGoogleSheets() {
    try {
        const response = await fetch(PUBLISHED_URL);
        if (!response.ok) throw new Error('Сбой сети при запросе к Google');
        const csvText = await response.text();
        parseFormCSV(csvText);
        initHouse();
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при чтении таблицы. Пожалуйста, обновите страницу.');
    }
}

// 2. Универсальный парсер CSV ответов формы
function parseFormCSV(csvText) {
    const lines = csvText.split(/\r?\n/);
    houseDatabase = {}; 

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Разбиваем строку по запятым, игнорируя запятые внутри кавычек
        const row = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(val => val.replace(/^"|"$/g, '').trim());
        
        if (row.length < 4) continue; // Защита от коротких строк

        const rawNames = row[1]; // Колонка B: ФИО
        const rawApt = row[2];   // Колонка C: № квартиры
        const rawPhone = row[3]; // Колонка D: Телефон

        // Достаем из текста колонки квартиры только цифры
        const aptNumMatch = rawApt.match(/\d+/);
        if (!aptNumMatch) continue; 
        const aptNum = parseInt(aptNumMatch);

        if (!houseDatabase[aptNum]) {
            houseDatabase[aptNum] = [];
        }

        // Разделяем имена, если в строку записали несколько человек через запятую или "и"
        const namesArray = rawNames.split(/,|\bи\b/);
        const phonesArray = rawPhone.split(/,|\s+/).filter(p => p.trim().length > 3);

        namesArray.forEach((name, index) => {
            const cleanName = name.trim();
            if (!cleanName) return;

            let phone = phonesArray[index] || phonesArray[0] || "";
            phone = cleanPhoneFormat(phone);

            houseDatabase[aptNum].push({
                fio: cleanName,
                phone: phone,
                meta: `Запись от: ${row[0]}` // Добавляем дату заполнения формы
            });
        });
    }
}

// Форматирование номера телефона под единый стандарт
function cleanPhoneFormat(phoneStr) {
    let cleaned = phoneStr.trim().replace(/[^\d+]/g, '');
    if (cleaned.length === 9 && !cleaned.startsWith('+')) {
        cleaned = '+375' + cleaned; // Дефолтный код для Беларуси
    }
    return cleaned;
}

// 3. Умный интерактивный поиск жильцов
function handleSearch() {
    const query = document.getElementById('searchInput').value.toLowerCase().trim();
    const apartments = document.querySelectorAll('.apartment');

    if (!query) {
        apartments.forEach(apt => apt.classList.remove('highlight', 'fade'));
        return;
    }

    apartments.forEach(apt => {
        const aptNum = parseInt(apt.querySelector('.apt-num').innerText);
        const residents = houseDatabase[aptNum] || [];
        
        const matchesApt = aptNum.toString().includes(query);
        const matchesName = residents.some(r => r.fio.toLowerCase().includes(query));

        if (matchesApt || matchesName) {
            apt.classList.add('highlight');
            apt.classList.remove('fade');
            if (window.innerWidth < 768) {
                if (aptNum <= 44) switchEntrance(1);
                else switchEntrance(2);
            }
        } else {
            apt.classList.remove('highlight');
            apt.classList.add('fade');
        }
    });
}

// 4. Отрисовка дома (11 -> 1 этаж, по 4 квартиры)
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
    setTimeout(() => { darkOverlay.style.display = 'none'; }, 200);
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

// СТАРТ
loadDataFromGoogleSheets();
