// Константы структуры дома
const APTS_PER_FLOOR = 4;
const FLOORS_ENTRANCE_1 = 11;
const FLOORS_ENTRANCE_2 = 11;
const TOTAL_APTS = (FLOORS_ENTRANCE_1 + FLOORS_ENTRANCE_2) * APTS_PER_FLOOR;

let residentsData = [];

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', async () => {
    await loadResidentsData();
    renderBuilding();
    initMobileSwipe();
    initPanelDrag();
    updateTabSlider();
});

// Загрузка данных жильцов из JSON
async function loadResidentsData() {
    try {
        const response = await fetch('data.json');
        if (!response.ok) throw new Error('Ошибка загрузки данных');
        residentsData = await response.json();
    } catch (error) {
        console.error('Ошибка:', error);
        residentsData = [];
    }
}

// Отрисовка двух подъездов
function renderBuilding() {
    renderEntrance('entrance1', 1, FLOORS_ENTRANCE_1, 1);
    renderEntrance('entrance2', 2, FLOORS_ENTRANCE_2, FLOORS_ENTRANCE_1 * APTS_PER_FLOOR + 1);
    updateProgressAndStats();
}

function renderEntrance(containerId, entranceNum, totalFloors, startAptNum) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Сохраняем заголовок подъезда
    const titleHTML = `<div class="entrance-title">${entranceNum} Подъезд</div>`;
    let floorsHTML = '';

    for (let floor = totalFloors; floor >= 1; floor--) {
        const floorStartApt = startAptNum + (floor - 1) * APTS_PER_FLOOR;
        let aptsHTML = '';

        for (let i = 0; i < APTS_PER_FLOOR; i++) {
            const aptNum = floorStartApt + i;
            const residents = residentsData.filter(r => Number(r.apt) === aptNum);
            const count = residents.length;
            const isEmpty = count === 0;

            let icons = '';
            for (let j = 0; j < count; j++) {
                icons += '<i class="fa-solid fa-user"></i>';
            }

            aptsHTML += `
                <div class="apartment ${isEmpty ? 'empty' : ''}" onclick="openPanel(${aptNum}, ${floor}, ${entranceNum})">
                    <div class="apt-num">${aptNum}</div>
                    <div class="apt-count">${icons}</div>
                </div>
            `;
        }

        floorsHTML += `
            <div class="floor">
                <div class="floor-number">${floor}</div>
                <div class="apartments">${aptsHTML}</div>
            </div>
        `;
    }

    container.innerHTML = titleHTML + floorsHTML;
}

// Расчет прогресса и процентов по подъездам
function updateProgressAndStats() {
    const occupiedSet = new Set(residentsData.map(r => Number(r.apt)));
    const totalOccupied = occupiedSet.size;
    const totalPercent = Math.round((totalOccupied / TOTAL_APTS) * 100);

    const progressFill = document.getElementById('progressFill');
    const progressLabel = document.getElementById('progressLabel');
    if (progressFill) progressFill.style.width = `${totalPercent}%`;
    if (progressLabel) progressLabel.innerText = `Заполнено ${totalOccupied} из ${TOTAL_APTS} квартир (${totalPercent}%)`;

    // Подъезд 1 (1 - 44)
    const ent1Occupied = [...occupiedSet].filter(apt => apt >= 1 && apt <= 44).length;
    const ent1Percent = Math.round((ent1Occupied / 44) * 100);
    const tabStats1 = document.getElementById('tabStats1');
    if (tabStats1) tabStats1.innerText = `${ent1Percent}%`;

    // Подъезд 2 (45 - 88)
    const ent2Occupied = [...occupiedSet].filter(apt => apt >= 45 && apt <= 88).length;
    const ent2Percent = Math.round((ent2Occupied / 44) * 100);
    const tabStats2 = document.getElementById('tabStats2');
    if (tabStats2) tabStats2.innerText = `${ent2Percent}%`;
}

/* ===== ШАГ 3: Переключение подъездов по клику на таб ===== */
function switchEntrance(entranceNum) {
    const container = document.querySelector('.building-container');
    const targetEntrance = document.getElementById(`entrance${entranceNum}`);

    // Подсвечиваем активную кнопку
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    const activeTab = document.getElementById(`tab${entranceNum}`);
    if (activeTab) {
        activeTab.classList.add('active');
    }

    // Двигаем синий подсвечивающий ползунок под табом
    updateTabSlider();

    // Плавно скроллим горизонтальный контейнер на мобильных
    if (container && targetEntrance) {
        const scrollTarget = targetEntrance.offsetLeft - container.offsetLeft;
        container.scrollTo({
            left: scrollTarget,
            behavior: 'smooth'
        });
    }
}

/* ===== Отслеживание свайпа пальцем (нативный scroll) ===== */
function initMobileSwipe() {
    const container = document.querySelector('.building-container');
    if (!container) return;

    let scrollTimer = null;

    container.addEventListener('scroll', () => {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
            const width = container.clientWidth;
            if (width === 0) return;

            // Определяем, какой подъезд сейчас ближе всего к левому краю
            const activeIndex = Math.round(container.scrollLeft / width) + 1;

            const currentActiveTab = document.querySelector('.tab-btn.active');
            const targetTab = document.getElementById(`tab${activeIndex}`);

            if (targetTab && currentActiveTab !== targetTab) {
                document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
                targetTab.classList.add('active');
                updateTabSlider();
            }
        }, 50);
    }, { passive: true });
}

// Анимация плавающего фона табов (.tab-slider)
function updateTabSlider() {
    const activeTab = document.querySelector('.tab-btn.active');
    const slider = document.getElementById('tabSlider');
    const container = document.getElementById('tabsContainer');

    if (activeTab && slider && container) {
        const activeRect = activeTab.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        slider.style.width = `${activeRect.width}px`;
        slider.style.left = `${activeRect.left - containerRect.left}px`;
    }
}

window.addEventListener('resize', updateTabSlider);

/* ===== Боковая / нижняя панель с жильцами ===== */
function openPanel(aptNum, floorNum, entranceNum) {
    const panel = document.getElementById('infoPanel');
    const overlay = document.getElementById('overlay');
    const aptTitle = document.getElementById('panelAptNum');
    const aptMeta = document.getElementById('panelAptMeta');
    const container = document.getElementById('residentsContainer');

    if (!panel || !container) return;

    aptTitle.innerText = `Квартира №${aptNum}`;
    aptMeta.innerText = `Этаж ${floorNum}, Подъезд ${entranceNum}`;

    const residents = residentsData.filter(r => Number(r.apt) === aptNum);

    if (residents.length === 0) {
        container.innerHTML = `
            <div class="resident-card no-name">
                <div class="res-name" style="color: var(--text-muted); font-weight: normal;">
                    В этой квартире пока нет зарегистрированных жильцов.
                </div>
            </div>
        `;
    } else {
        container.innerHTML = residents.map(r => {
            const phoneClean = r.phone ? r.phone.replace(/[^0-9+]/g, '') : '';
            return `
                <div class="resident-card">
                    <div class="res-name">${r.name || 'Жилец'}</div>
                    ${r.phone ? `<a href="tel:${phoneClean}" class="res-phone"><i class="fa-solid fa-phone"></i> ${r.phone}</a>` : ''}
                    ${r.note ? `<div class="res-meta">${r.note}</div>` : ''}
                </div>
            `;
        }).join('');
    }

    panel.classList.add('active');
    if (overlay) overlay.classList.add('active');
}

function closePanel() {
    const panel = document.getElementById('infoPanel');
    const overlay = document.getElementById('overlay');

    if (panel) {
        panel.classList.remove('active');
        panel.style.transform = ''; // Сбрасываем сдвиг от драга
    }
    if (overlay) overlay.classList.remove('active');
}

// Привязка закрытия панели
document.addEventListener('click', (e) => {
    if (e.target && (e.target.id === 'closeBtn' || e.target.id === 'overlay')) {
        closePanel();
    }
});

/* ===== Свайп вниз для закрытия шторки на мобильных ===== */
function initPanelDrag() {
    const panel = document.getElementById('infoPanel');
    const handle = document.querySelector('.panel-drag-handle');
    if (!panel || !handle) return;

    let startY = 0;
    let currentY = 0;
    let isDragging = false;

    handle.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY;
        isDragging = true;
        panel.style.transition = 'none';
    }, { passive: true });

    handle.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        currentY = e.touches[0].clientY - startY;
        if (currentY > 0) {
            panel.style.transform = `translateY(${currentY}px)`;
        }
    }, { passive: true });

    handle.addEventListener('touchend', () => {
        if (!isDragging) return;
        isDragging = false;
        panel.style.transition = '';

        if (currentY > 100) {
            closePanel();
        } else {
            panel.style.transform = '';
        }
        currentY = 0;
    });
}
