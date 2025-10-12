// ============================================================================
// CONFIGURACIÓN DE LA API
// ============================================================================

const API_URL = 'https://script.google.com/macros/s/AKfycby5Wgj-0-qMimYZ5ublQ8hhnzooZ8Vv-YonmoiLroMGvOw_G3hRUWHPNMkT80IECx1IOQ/exec';

// ============================================================================
// FUNCIONES DE CONEXIÓN CON API
// ============================================================================

async function apiGet(action, params = {}) {
    try {
        const queryString = new URLSearchParams({
            action,
            ...params
        }).toString();
        
        const response = await fetch(`${API_URL}?${queryString}`, {
            method: 'GET',
            redirect: 'follow'
        });
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Error desconocido');
        }
        
        return result.data;
    } catch (error) {
        console.error(`Error en apiGet(${action}):`, error);
        throw error;
    }
}

async function apiPost(action, data) {
    try {
        const formData = new URLSearchParams();
        formData.append('action', action);
        
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(data),
            headers: {
                'Content-Type': 'application/json'
            },
            redirect: 'follow'
        });
        
        const result = await response.json();
        return result;
    } catch (error) {
        console.error(`Error en apiPost(${action}):`, error);
        throw error;
    }
}

// ============================================================================
// FUNCIONES DE CARGA DE DATOS
// ============================================================================

async function loadEmpresaData() {
    return await apiGet('getEmpresa');
}

async function loadVehicleTypes() {
    return await apiGet('getVehicleTypes');
}

async function loadFeaturedVehicles() {
    return await apiGet('getFeaturedVehicles');
}

async function loadAvailableVehicles(startDate, endDate, types) {
    return await apiGet('getAvailableVehicles', {
        start: startDate,
        end: endDate,
        types: types.join(',')
    });
}

async function loadSoonAvailableVehicles(endDate) {
    return await apiGet('getSoonAvailable', {
        endDate
    });
}

async function loadVehiclePhotos(code) {
    return await apiGet('getVehiclePhotos', {
        code
    });
}

async function saveReservation(formData) {
    return await apiPost('saveReservation', formData);
}

// ============================================================================
// VARIABLES GLOBALES
// ============================================================================

let vehicleTypes = [];
let selectedTypes = ['TODOS'];
let currentVehicle = null;
let currentStartDate = null;
let currentEndDate = null;
let featuredVehicles = [];
let empresaData = {};

// ============================================================================
// INICIALIZACIÓN
// ============================================================================

document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Inicializando aplicación...');
    await initializeApp();
});

async function initializeApp() {
    try {
        empresaData = await loadEmpresaData();
        console.log('✅ Datos de empresa cargados');
        
        renderHeader(empresaData);
        renderFooter(empresaData);
        applyCompanyColors(empresaData['COLOR HEXA'] || '#d15b1a');
        
        const [types, featured] = await Promise.all([
            loadVehicleTypes(),
            loadFeaturedVehicles()
        ]);
        
        vehicleTypes = types;
        featuredVehicles = featured;
        
        console.log('✅ Tipos de vehículos:', vehicleTypes);
        console.log('✅ Vehículos destacados:', featuredVehicles.length);
        
        createVehicleTypeButtons();
        displayFeaturedSlider();
        setupEventListeners();
        setDefaultDates();
        setupDateValidation();
        
        document.getElementById('initial-loading').style.display = 'none';
        
        console.log('✅ Aplicación inicializada correctamente');
        
    } catch (error) {
        console.error('❌ Error inicializando aplicación:', error);
        const loading = document.getElementById('initial-loading');
        loading.innerHTML = `
            <div class="error-icon">
                <i class="fas fa-exclamation-triangle"></i>
            </div>
            <h3>Error cargando la aplicación</h3>
            <p>${error.message}</p>
            <button onclick="location.reload()" class="btn-try-again">
                <i class="fas fa-redo"></i>
                Reintentar
            </button>
        `;
    }
}

// ============================================================================
// RENDERIZADO DE COMPONENTES
// ============================================================================

function renderHeader(empresa) {
    const header = document.getElementById('main-header');
    header.innerHTML = `
        <div class="container">
            <div class="header-content">
                <div class="logo-section">
                    ${empresa.LOGO_BASE64 ? 
                        `<img src="${empresa.LOGO_BASE64}" alt="${empresa.NOMBRE}" class="logo">` :
                        `<i class="fas fa-car logo-icon"></i>`
                    }
                    <div class="company-info">
                        <h1 class="company-name">${empresa.NOMBRE || 'Renta de Vehículos'}</h1>
                        <p class="company-address">${empresa.DIRECCION || 'El Salvador'}</p>
                    </div>
                </div>
                <div class="contact-info">
                    <a href="tel:${empresa.TELEFONO}" class="phone-link">
                        <i class="fas fa-phone"></i>
                        ${empresa.TELEFONO || 'Contacto'}
                    </a>
                </div>
            </div>
        </div>
    `;
}

function renderFooter(empresa) {
    const footer = document.getElementById('main-footer');
    let socialLinks = '';
    
    if (empresa['LINK FACEBOOK']) {
        socialLinks += `
            <a href="${empresa['LINK FACEBOOK']}" target="_blank" class="social-icon" aria-label="Facebook">
                <i class="fab fa-facebook-f"></i>
            </a>
        `;
    }
    
    const instagramLink = empresa['LINK INSTAGRAM'] || empresa['LINK INSTGRAM'];
    if (instagramLink) {
        socialLinks += `
            <a href="${instagramLink}" target="_blank" class="social-icon" aria-label="Instagram">
                <i class="fab fa-instagram"></i>
            </a>
        `;
    }
    
    if (empresa.WHATSAPP) {
        const whatsappNumber = empresa.WHATSAPP.toString().replace(/\D/g, '');
        socialLinks += `
            <a href="https://wa.me/${whatsappNumber}" target="_blank" class="social-icon whatsapp-icon" aria-label="WhatsApp">
                <i class="fab fa-whatsapp"></i>
                ${empresa.WHATSAPP}
            </a>
        `;
    }
    
    footer.innerHTML = `
        <div class="container">
            ${socialLinks ? `<div class="social-links">${socialLinks}</div>` : ''}
            <p class="footer-text">© ${new Date().getFullYear()} ${empresa.NOMBRE || 'Todos los derechos reservados'}</p>
        </div>
    `;
    
    if (empresa['LINK GOOGLE MAPS'] && empresa['LINK GOOGLE MAPS'].trim() !== '') {
        const mapSection = document.createElement('section');
        mapSection.className = 'map-section';
        mapSection.innerHTML = `
            <div class="container">
                <h3 class="section-title">Nuestra Ubicación</h3>
                <div class="map-container">
                    <iframe
                        src="${empresa['LINK GOOGLE MAPS']}"
                        width="600"
                        height="450"
                        style="border:0;"
                        allowfullscreen=""
                        loading="lazy"
                        referrerpolicy="no-referrer-when-downgrade">
                    </iframe>
                </div>
            </div>
        `;
        footer.before(mapSection);
    }
}

function applyCompanyColors(color) {
    document.documentElement.style.setProperty('--primary-color', color);
    document.documentElement.style.setProperty('--primary-dark', color + 'dd');
    document.documentElement.style.setProperty('--primary-light', color + '20');
}

function createVehicleTypeButtons() {
    const container = document.getElementById('vehicle-types-container');
    container.innerHTML = '';
    
    const allButton = document.createElement('button');
    allButton.type = 'button';
    allButton.className = 'type-btn active';
    allButton.dataset.type = 'TODOS';
    allButton.innerHTML = '<i class="fas fa-th-large"></i> Todos';
    allButton.onclick = () => toggleVehicleType('TODOS');
    container.appendChild(allButton);
    
    vehicleTypes.forEach(type => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'type-btn';
        button.dataset.type = type;
        
        let icon = 'fas fa-car';
        switch(type.toLowerCase()) {
            case 'pick up':
            case 'pickup':
                icon = 'fas fa-truck';
                break;
            case 'suv':
                icon = 'fas fa-car-side';
                break;
            case 'sedan':
                icon = 'fas fa-car';
                break;
            case 'motocicleta':
            case 'moto':
                icon = 'fas fa-motorcycle';
                break;
        }
        
        button.innerHTML = `<i class="${icon}"></i> ${type}`;
        button.onclick = () => toggleVehicleType(type);
        container.appendChild(button);
    });
}

function toggleVehicleType(type) {
    if (type === 'TODOS') {
        selectedTypes = ['TODOS'];
        document.querySelectorAll('.type-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === 'TODOS');
        });
    } else {
        if (selectedTypes.includes('TODOS')) {
            selectedTypes = [];
            document.querySelector('.type-btn[data-type="TODOS"]').classList.remove('active');
        }
        
        const button = document.querySelector(`.type-btn[data-type="${type}"]`);
        if (selectedTypes.includes(type)) {
            selectedTypes = selectedTypes.filter(t => t !== type);
            button.classList.remove('active');
        } else {
            selectedTypes.push(type);
            button.classList.add('active');
        }
        
        if (selectedTypes.length === 0) {
            selectedTypes = ['TODOS'];
            document.querySelector('.type-btn[data-type="TODOS"]').classList.add('active');
        }
    }
    
    console.log('Tipos seleccionados:', selectedTypes);
}

let currentSlide = 0;
let autoPlayInterval;

function displayFeaturedSlider() {
    const slider = document.getElementById('featured-slider');
    slider.innerHTML = '';
    
    if (featuredVehicles.length === 0) {
        slider.style.display = 'none';
        return;
    }

    const sliderContainer = document.createElement('div');
    sliderContainer.className = 'slider-container';
    
    const sliderTrack = document.createElement('div');
    sliderTrack.className = 'slider-track';
    sliderTrack.id = 'slider-track';
    
    featuredVehicles.forEach((vehicle, index) => {
        const slide = createFeaturedSlide(vehicle, index === 0);
        sliderTrack.appendChild(slide);
    });
    
    sliderContainer.appendChild(sliderTrack);
    
    if (featuredVehicles.length > 1) {
        const prevBtn = document.createElement('button');
        prevBtn.className = 'slider-btn prev-btn';
        prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
        prevBtn.onclick = () => moveSlider(-1);
        
        const nextBtn = document.createElement('button');
        nextBtn.className = 'slider-btn next-btn';
        nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        nextBtn.onclick = () => moveSlider(1);
        
        sliderContainer.appendChild(prevBtn);
        sliderContainer.appendChild(nextBtn);
        
        const indicators = document.createElement('div');
        indicators.className = 'slider-indicators';
        for (let i = 0; i < featuredVehicles.length; i++) {
            const indicator = document.createElement('button');
            indicator.className = `indicator ${i === 0 ? 'active' : ''}`;
            indicator.onclick = () => goToSlide(i);
            indicators.appendChild(indicator);
        }
        sliderContainer.appendChild(indicators);
        
        startAutoPlay();
    }
    
    slider.appendChild(sliderContainer);
}

function createFeaturedSlide(vehicle, isActive) {
    const slide = document.createElement('div');
    slide.className = `featured-slide ${isActive ? 'active' : ''}`;
    
    const imageUrl = vehicle.IMAGEN_BASE64 || 'https://via.placeholder.com/800x400?text=Sin+Imagen';
    const price = vehicle.TARIFA ? `$${parseFloat(vehicle.TARIFA).toFixed(2)}` : 'Consultar precio';
    const year = vehicle['AÑO'] || vehicle.ANO || '';
    
    slide.innerHTML = `
        <div class="slide-image">
            <img src="${imageUrl}" alt="${vehicle.NOMBRE}" onerror="this.src='https://via.placeholder.com/800x400?text=Sin+Imagen'">
            <div class="slide-overlay"></div>
        </div>
        <div class="slide-content">
            <div class="slide-info">
                <div class="vehicle-badges">
                    <span class="badge featured-badge">Destacado</span>
                    <span class="badge type-badge">${vehicle.TIPO}</span>
                    ${year ? `<span class="badge year-badge">${year}</span>` : ''}
                </div>
                <h3 class="slide-title">${vehicle.NOMBRE}</h3>
                <div class="slide-price">
                    <span class="price-large">${price}</span>
                    <span class="price-period">por día</span>
                </div>
                <button class="btn-slide-reserve" onclick='openVehicleModal(${JSON.stringify(vehicle.COD)}, ${JSON.stringify(vehicle)})'>
                    <i class="fas fa-calendar-check"></i>
                    Reservar Ahora
                </button>
            </div>
        </div>
    `;
    
    return slide;
}

function moveSlider(direction) {
    const track = document.getElementById('slider-track');
    const slides = track.querySelectorAll('.featured-slide');
    const indicators = document.querySelectorAll('.indicator');
    
    slides[currentSlide].classList.remove('active');
    indicators[currentSlide].classList.remove('active');
    
    currentSlide += direction;
    if (currentSlide >= slides.length) currentSlide = 0;
    if (currentSlide < 0) currentSlide = slides.length - 1;
    
    slides[currentSlide].classList.add('active');
    indicators[currentSlide].classList.add('active');
    
    track.style.transform = `translateX(-${currentSlide * 100}%)`;
    
    resetAutoPlay();
}

function goToSlide(index) {
    const track = document.getElementById('slider-track');
    const slides = track.querySelectorAll('.featured-slide');
    const indicators = document.querySelectorAll('.indicator');
    
    slides[currentSlide].classList.remove('active');
    indicators[currentSlide].classList.remove('active');
    
    currentSlide = index;
    slides[currentSlide].classList.add('active');
    indicators[currentSlide].classList.add('active');
    
    track.style.transform = `translateX(-${currentSlide * 100}%)`;
    
    resetAutoPlay();
}

function startAutoPlay() {
    autoPlayInterval = setInterval(() => {
        moveSlider(1);
    }, 5000);
}

function resetAutoPlay() {
    clearInterval(autoPlayInterval);
    startAutoPlay();
}

function setDefaultDates() {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    document.getElementById('fecha-inicio').value = formatDateForInput(today);
    document.getElementById('fecha-fin').value = formatDateForInput(tomorrow);
    
    document.getElementById('fecha-inicio').min = formatDateForInput(today);
    document.getElementById('fecha-fin').min = formatDateForInput(tomorrow);
}

function formatDateForInput(date) {
    return date.toISOString().split('T')[0];
}

function setupDateValidation() {
    const startInput = document.getElementById('fecha-inicio');
    const endInput = document.getElementById('fecha-fin');
    
    startInput.addEventListener('change', function() {
        const startDate = new Date(this.value);
        const endDate = new Date(endInput.value);
        
        if (endDate <= startDate) {
            const newEndDate = new Date(startDate);
            newEndDate.setDate(newEndDate.getDate() + 1);
            endInput.value = formatDateForInput(newEndDate);
        }
        
        const minEndDate = new Date(startDate);
        minEndDate.setDate(minEndDate.getDate() + 1);
        endInput.min = formatDateForInput(minEndDate);
    });
    
    endInput.addEventListener('change', function() {
        const startDate = new Date(startInput.value);
        const endDate = new Date(this.value);
        
        if (endDate <= startDate) {
            showError('La fecha de regreso debe ser posterior a la fecha de inicio');
            const newEndDate = new Date(startDate);
            newEndDate.setDate(newEndDate.getDate() + 1);
            this.value = formatDateForInput(newEndDate);
        }
    });
}

function setupEventListeners() {
    document.getElementById('btn-buscar').addEventListener('click', searchVehicles);
    document.getElementById('modal-close').addEventListener('click', closeVehicleModal);
    document.getElementById('reservation-form').addEventListener('submit', submitReservation);
    document.getElementById('success-close').addEventListener('click', closeSuccessModal);
    document.getElementById('error-close').addEventListener('click', closeErrorModal);
    
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal-backdrop')) {
            closeAllModals();
        }
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeAllModals();
        }
    });
}

async function searchVehicles() {
    document.querySelector('.results-section').scrollIntoView({ behavior: 'smooth', block: 'start' });

    const startDate = document.getElementById('fecha-inicio').value;
    const endDate = document.getElementById('fecha-fin').value;

    if (!startDate || !endDate) {
        showError('Por favor selecciona ambas fechas');
        return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start >= end) {
        showError('La fecha de regreso debe ser posterior a la fecha de inicio');
        return;
    }

    currentStartDate = startDate;
    currentEndDate = endDate;

    console.log('Iniciando búsqueda:', { startDate, endDate, selectedTypes });
    
    showLoading();
    hideResults();

    try {
        const vehicles = await loadAvailableVehicles(startDate, endDate, selectedTypes);
        console.log('Vehículos disponibles recibidos:', vehicles.length);
        displayAvailableVehicles(vehicles);
        
        try {
            const soonVehicles = await loadSoonAvailableVehicles(endDate);
            console.log('Vehículos pronto disponibles:', soonVehicles.length);
            displaySoonAvailableVehicles(soonVehicles);
        } catch (error) {
            console.error('Error buscando vehículos pronto disponibles:', error);
            displaySoonAvailableVehicles([]);
        }
        
        hideLoading();
        
    } catch (error) {
        console.error('Error buscando vehículos:', error);
        showError('Error al buscar vehículos disponibles. Por favor intenta nuevamente.');
        hideLoading();
    }
}

function clearSearch() {
    hideResults();
    setDefaultDates();
    selectedTypes = ['TODOS'];
    createVehicleTypeButtons();
}

function showLoading() {
    document.getElementById('loading').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading').classList.add('hidden');
}

function hideResults() {
    document.getElementById('available-vehicles').classList.add('hidden');
    document.getElementById('soon-available-vehicles').classList.add('hidden');
    document.getElementById('no-results').classList.add('hidden');
}

function displayAvailableVehicles(vehicles) {
    const container = document.getElementById('available-vehicles');
    const grid = document.getElementById('available-grid');
    
    grid.innerHTML = '';
    
    if (vehicles && vehicles.length > 0) {
        vehicles.forEach(vehicle => {
            const card = createVehicleCard(vehicle, false);
            grid.appendChild(card);
        });
        container.classList.remove('hidden');
    }
}

function displaySoonAvailableVehicles(vehicles) {
    const container = document.getElementById('soon-available-vehicles');
    const grid = document.getElementById('soon-available-grid');
    
    grid.innerHTML = '';
    
    if (vehicles && vehicles.length > 0) {
        vehicles.forEach(vehicle => {
            const card = createVehicleCard(vehicle, true);
            grid.appendChild(card);
        });
        container.classList.remove('hidden');
    }

    const hasAvailable = !document.getElementById('available-vehicles').classList.contains('hidden');
    const hasSoon = !container.classList.contains('hidden');
    
    if (!hasAvailable && !hasSoon) {
        document.getElementById('no-results').classList.remove('hidden');
    }
}

function createVehicleCard(vehicle, isSoon = false) {
    const card = document.createElement('div');
    card.className = `vehicle-card-improved ${isSoon ? 'soon-available' : ''}`;

    const imageUrl = vehicle.IMAGEN_BASE64 || 'https://via.placeholder.com/400x250?text=Sin+Imagen';
    const price = vehicle.TARIFA ? `$${parseFloat(vehicle.TARIFA).toFixed(2)}` : 'Consultar';
    const year = vehicle['AÑO'] || vehicle.ANO || '';
    const color = vehicle.COLOR || '';

    card.innerHTML = `
        <div class="card-image-container">
            <img src="${imageUrl}" alt="${vehicle.NOMBRE}" class="card-image" onerror="this.src='https://via.placeholder.com/400x250?text=Sin+Imagen'">
            ${isSoon ? '<div class="soon-badge-improved">Próximamente</div>' : ''}
            ${vehicle.DESTACAR ? '<div class="featured-badge-card">Destacado</div>' : ''}
        </div>
        <div class="card-content">
            <div class="card-header">
                <h4 class="vehicle-title">${vehicle.NOMBRE}</h4>
                <div class="vehicle-badges-card">
                    <span class="badge-small type">${vehicle.TIPO}</span>
                    ${year ? `<span class="badge-small year">${year}</span>` : ''}
                </div>
            </div>
            
            ${color ? `<div class="vehicle-detail-small"><i class="fas fa-palette"></i> ${color}</div>` : ''}
            
            <div class="card-footer">
                <div class="price-section">
                    <span class="price-large">${price}</span>
                    <span class="price-period-small">por día</span>
                </div>
                <button class="btn-card-reserve" onclick='openVehicleModal(${JSON.stringify(vehicle.COD)}, ${JSON.stringify(vehicle)})'>
                    <i class="fas fa-eye"></i>
                    Ver y Reservar
                </button>
            </div>
        </div>
    `;

    return card;
}

function openVehicleModal(cod, vehicleData) {
    console.log('Abriendo modal para vehículo:', cod);
    currentVehicle = vehicleData;
    
    document.getElementById('modal-vehicle-name').textContent = vehicleData.NOMBRE || 'Vehículo';
    document.getElementById('modal-vehicle-type-badge').textContent = vehicleData.TIPO || '';
    document.getElementById('modal-vehicle-year-badge').textContent = vehicleData['AÑO'] || vehicleData.ANO || '';
    document.getElementById('modal-vehicle-type').textContent = vehicleData.TIPO || '-';
    document.getElementById('modal-vehicle-year').textContent = vehicleData['AÑO'] || vehicleData.ANO || '-';
    document.getElementById('modal-vehicle-color').textContent = vehicleData.COLOR || '-';
    document.getElementById('modal-vehicle-marca').textContent = vehicleData.MARCA || '-';
    document.getElementById('modal-vehicle-deducible').textContent = vehicleData.DEDUCIBLE ? `$${vehicleData.DEDUCIBLE}` : '-';
    
    const price = vehicleData.TARIFA ? `$${parseFloat(vehicleData.TARIFA).toFixed(2)}` : 'Consultar precio';
    document.getElementById('modal-vehicle-price').textContent = price;
    
    const mainImage = vehicleData.IMAGEN_BASE64 || 'https://via.placeholder.com/600x400?text=Sin+Imagen';
    document.getElementById('modal-main-image').src = mainImage;
    
    updateReservationSummary();
    loadVehiclePhotosForModal(cod, mainImage);
    
    document.getElementById('vehicle-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

async function loadVehiclePhotosForModal(vehicleCode, mainImage) {
    const thumbsContainer = document.getElementById('gallery-thumbs-improved');
    thumbsContainer.innerHTML = '<div class="gallery-loader"></div>';

    console.log('Cargando fotos para vehículo:', vehicleCode);
    
    try {
        const photos = await loadVehiclePhotos(vehicleCode);
        console.log('Fotos cargadas:', photos.length);
        
        const allPhotos = [mainImage];
        photos.forEach(photo => {
            if (photo && photo !== mainImage) {
                allPhotos.push(photo);
            }
        });
        
        displayVehicleGallery(allPhotos);
    } catch (error) {
        console.error('Error cargando fotos:', error);
        thumbsContainer.innerHTML = '';
        displayVehicleGallery([mainImage]);
    }
}

function displayVehicleGallery(photos) {
    const thumbsContainer = document.getElementById('gallery-thumbs-improved');
    thumbsContainer.innerHTML = '';
    
    if (photos.length > 1) {
        photos.forEach((photo, index) => {
            const thumb = document.createElement('div');
            thumb.className = `gallery-thumb-improved ${index === 0 ? 'active' : ''}`;
            
            const img = document.createElement('img');
            img.src = photo;
            img.onerror = function() {
                this.parentElement.style.display = 'none';
            };
            
            thumb.appendChild(img);
            thumb.addEventListener('click', function() {
                document.getElementById('modal-main-image').src = photo;
                document.querySelectorAll('.gallery-thumb-improved').forEach(t => t.classList.remove('active'));
                thumb.classList.add('active');
            });
            
            thumbsContainer.appendChild(thumb);
        });
    }
}

function updateReservationSummary() {
    if (!currentStartDate || !currentEndDate || !currentVehicle) return;
    
    const startDate = new Date(currentStartDate);
    const endDate = new Date(currentEndDate);
    const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const dailyRate = parseFloat(currentVehicle.TARIFA) || 0;
    const total = days * dailyRate;
    
    document.getElementById('summary-vehicle').textContent = currentVehicle.NOMBRE || 'Vehículo seleccionado';
    document.getElementById('summary-start-date').textContent = formatDateForDisplay(startDate);
    document.getElementById('summary-end-date').textContent = formatDateForDisplay(endDate);
    document.getElementById('summary-days').textContent = days + (days === 1 ? ' día' : ' días');
    document.getElementById('summary-total').textContent = dailyRate > 0 ? `$${total.toFixed(2)}` : 'Por confirmar';
}

function formatDateForDisplay(date) {
    return date.toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function closeVehicleModal() {
    document.getElementById('vehicle-modal').classList.add('hidden');
    document.body.style.overflow = 'auto';
    document.getElementById('reservation-form').reset();
}

async function submitReservation(event) {
    event.preventDefault();
    
    if (!currentVehicle) {
        showError('Error: información del vehículo no disponible');
        return;
    }
    
    const formData = {
        nombre: document.getElementById('cliente-nombre').value.trim(),
        telefono: document.getElementById('cliente-telefono').value.trim(),
        licencia: document.getElementById('cliente-licencia').value.trim(),
        hora: document.getElementById('cliente-hora').value.trim(),
        comentarios: document.getElementById('cliente-comentarios').value.trim(),
        fechaInicio: currentStartDate,
        fechaFin: currentEndDate,
        tipoVehiculo: currentVehicle.TIPO,
        vehiculoCod: currentVehicle.COD
    };
    
    if (!formData.nombre || !formData.telefono || !formData.licencia || !formData.hora) {
        showError('Por favor completa todos los campos requeridos, incluyendo la hora');
        return;
    }
    
    if (formData.telefono.length < 8) {
        showError('Por favor ingresa un número de teléfono válido');
        return;
    }
    
    console.log('Enviando solicitud de reserva:', formData);
    
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalContent = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Enviando...</span>';
    
    try {
        const result = await saveReservation(formData);
        
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalContent;
        
        if (result.success) {
            console.log('Reserva guardada exitosamente:', result.id);
            closeVehicleModal();
            showSuccessModal(result.id);
        } else {
            console.error('Error en respuesta del servidor:', result.error);
            showError('Error guardando la reserva: ' + (result.error || 'Error desconocido'));
        }
    } catch (error) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalContent;
        console.error('Error enviando reserva:', error);
        showError('Error enviando la solicitud. Por favor verifica tu conexión e intenta nuevamente.');
    }
}

function showSuccessModal(reservationId) {
    document.getElementById('reservation-id').textContent = reservationId;
    document.getElementById('success-phone').textContent = empresaData.TELEFONO || '';
    document.getElementById('success-phone-link').href = `tel:${empresaData.TELEFONO}`;
    document.getElementById('success-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeSuccessModal() {
    document.getElementById('success-modal').classList.add('hidden');
    document.body.style.overflow = 'auto';
}

function showError(message) {
    console.error('Error mostrado al usuario:', message);
    document.getElementById('error-message').textContent = message;
    document.getElementById('error-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeErrorModal() {
    document.getElementById('error-modal').classList.add('hidden');
    document.body.style.overflow = 'auto';
}

function closeAllModals() {
    closeVehicleModal();
    closeSuccessModal();
    closeErrorModal();
}

function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text);
    } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
    }
}

document.addEventListener('click', function(e) {
    if (e.target.classList.contains('reservation-id-clickable')) {
        copyToClipboard(e.target.textContent);
        e.target.style.background = '#28a745';
        e.target.style.color = 'white';
        setTimeout(() => {
            e.target.style.background = '';
            e.target.style.color = '';
        }, 1000);
    }
});

console.log('✅ script.js cargado correctamente');