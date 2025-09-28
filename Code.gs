// ID de tu Google Sheets
const SPREADSHEET_ID = '11GGfaORm90GmwcNtc5fj1dVtBNWygkwlXWZep3FuG8I';
// IDs de las carpetas de Google Drive para imágenes
const DRIVE_FOLDERS = {
  'empresa_Images': '1w8sq_7NYWObSunIrJUb6hyE_96O2rJvu',
  'VEHICULOS_Images': '1vkZS9OY4JCaeA4c2Vwb_DMSeA10QRr1d',
  'FOTOS_Images': '1SkIJ9st8dbdLPv46g-O-vafnPAW1cZ6t',
  'BACKUP_FOLDER': '1eDejsZJ3gfTAMZ-ljd9e5wg9H10UGVRo'
};

function doGet() {
  try {
    const template = HtmlService.createTemplateFromFile('Index');
    const empresaData = getEmpresaData();
    template.empresa = empresaData;
    return template.evaluate().setTitle('Renta de Vehículos').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (error) {
    console.error('Error en doGet:', error);
    return HtmlService.createHtmlOutput('<h1>Error cargando la aplicación</h1><p>' + error.toString() + '</p>');
  }
}

function include(filename) { return HtmlService.createHtmlOutputFromFile(filename).getContent(); }

/**
 * NUEVA FUNCIÓN para obtener los datos iniciales (tipos y destacados)
 */
function getInitialData() {
  return {
    vehicleTypes: getVehicleTypes(),
    featuredVehicles: getFeaturedVehicles()
  };
}

function getEmpresaData() {
  try {
    const empresaSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('empresa');
    if (!empresaSheet) throw new Error('Hoja "empresa" no encontrada');
    const data = empresaSheet.getDataRange().getValues();
    if (data.length < 2) throw new Error('No hay datos en la hoja empresa');
    const headers = data[0], values = data[1], empresa = {};
    headers.forEach((header, index) => { empresa[header] = values[index]; });
    if (empresa['CAMPO 1']) { empresa.LOGO_URL = getImageAsBase64(empresa['CAMPO 1']); }
    else { empresa.LOGO_URL = ''; }
    return empresa;
  } catch (error) {
    console.error('Error obteniendo datos de empresa:', error);
    return { NOMBRE: 'Renta de Vehículos', DIRECCION: 'Dirección no disponible', TELEFONO: 'Teléfono no disponible', 'COLOR HEXA': '#d15b1a', LOGO_URL: '' };
  }
}

function getImageAsBase64(appSheetPath) {
  try {
    if (!appSheetPath || typeof appSheetPath !== 'string') return '';
    const cleanPath = appSheetPath.toString().trim();
    if (!cleanPath) return '';
    const pathParts = cleanPath.split('/');
    if (pathParts.length < 2) { return ''; }
    const folderName = pathParts[0], fileName = pathParts.slice(1).join('/');
    const folderId = DRIVE_FOLDERS[folderName] || DRIVE_FOLDERS['BACKUP_FOLDER'];
    if (!folderId) { return ''; }
    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFilesByName(fileName);
    if (files.hasNext()) {
      const file = files.next();
      const blob = file.getBlob();
      const contentType = blob.getContentType();
      const base64Data = Utilities.base64Encode(blob.getBytes());
      return `data:${contentType};base64,${base64Data}`;
    } else { return ''; }
  } catch (error) { console.error('Error en getImageAsBase64:', appSheetPath, error); return ''; }
}

/**
 * NUEVA FUNCIÓN para obtener solo los vehículos destacados.
 */
function getFeaturedVehicles() {
  try {
    const allVehicles = getVehiclesData();
    const featured = allVehicles.filter(v => v.DESTACAR === true || v.DESTACAR === 'TRUE');
    
    featured.forEach(v => {
      v.IMAGEN_URL = getImageAsBase64(v.IMAGEN);
    });
    return featured;
  } catch (error) {
    console.error('Error en getFeaturedVehicles:', error);
    return [];
  }
}

function getAvailableVehicles(startDate, endDate, vehicleType) {
  try {
    let filteredVehicles = getVehiclesData();
    if (vehicleType && vehicleType !== 'TODOS') {
      filteredVehicles = filteredVehicles.filter(v => v.TIPO === vehicleType);
    }
    const availableVehicles = [];
    const requestStart = new Date(startDate), requestEnd = new Date(endDate);
    for (const vehiculo of filteredVehicles) {
      if (vehiculo['En Mantenimiento'] === true || vehiculo['En Mantenimiento'] === 'TRUE') continue;
      if (isVehicleAvailable(vehiculo.COD, requestStart, requestEnd)) {
        vehiculo.IMAGEN_URL = getImageAsBase64(vehiculo.IMAGEN);
        availableVehicles.push(vehiculo);
      }
    }
    return availableVehicles;
  } catch (error) { console.error('Error en getAvailableVehicles:', error); return []; }
}

function getSoonToBeAvailableVehicles(endDate) {
  try {
    const datosSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('DATOS');
    if (!datosSheet) return [];
    const requestEnd = new Date(endDate);
    const fiveDaysLater = new Date(requestEnd);
    fiveDaysLater.setDate(fiveDaysLater.getDate() + 5);
    const data = datosSheet.getDataRange().getValues();
    if (data.length < 2) return [];
    const headers = data[0];
    const vehiculoIndex = headers.indexOf('VEHICULO'), regresoIndex = headers.indexOf('REGRESA');
    if (vehiculoIndex === -1 || regresoIndex === -1) return [];
    const soonAvailableCodes = new Set();
    for (let i = 1; i < data.length; i++) {
      if (data[i][regresoIndex] && data[i][vehiculoIndex]) {
        const regresoDate = new Date(data[i][regresoIndex]);
        if (regresoDate >= requestEnd && regresoDate <= fiveDaysLater) {
          soonAvailableCodes.add(data[i][vehiculoIndex]);
        }
      }
    }
    const vehiculos = getVehiclesData();
    const soonAvailable = vehiculos.filter(v => soonAvailableCodes.has(v.COD) && (v['En Mantenimiento'] !== true && v['En Mantenimiento'] !== 'TRUE'));
    soonAvailable.forEach(v => { v.IMAGEN_URL = getImageAsBase64(v.IMAGEN); });
    return soonAvailable;
  } catch (error) { console.error('Error en getSoonToBeAvailableVehicles:', error); return []; }
}

function getVehiclePhotos(vehicleCode) {
  try {
    const fotosSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('FOTOS');
    if (!fotosSheet) return [];
    const data = fotosSheet.getDataRange().getValues();
    if (data.length < 2) return [];
    const headers = data[0];
    const codIndex = headers.indexOf('COD'), fotoIndex = headers.indexOf('FOTO');
    if (codIndex === -1 || fotoIndex === -1) return [];
    const photos = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i][codIndex] === vehicleCode && data[i][fotoIndex]) {
        const photoUrl = getImageAsBase64(data[i][fotoIndex]);
        if (photoUrl) photos.push(photoUrl);
      }
    }
    return photos;
  } catch (error) { console.error('Error en getVehiclePhotos:', error); return []; }
}

function getVehicleTypes() {
  try {
    const vehiculosSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('VEHICULOS');
    if (!vehiculosSheet) throw new Error('Hoja "VEHICULOS" no encontrada');
    const data = vehiculosSheet.getDataRange().getValues();
    if (data.length < 2) return [];
    const headers = data[0];
    const tipoIndex = headers.indexOf('TIPO');
    if (tipoIndex === -1) throw new Error('Columna "TIPO" no encontrada');
    const tipos = new Set();
    for (let i = 1; i < data.length; i++) {
      if (data[i][tipoIndex] && data[i][tipoIndex].toString().trim() !== '') {
        tipos.add(data[i][tipoIndex].toString().trim());
      }
    }
    return Array.from(tipos).sort();
  } catch (error) { console.error('Error obteniendo tipos:', error); return ['SEDAN', 'PICK UP', 'SUV']; }
}

function getVehiclesData() {
  try {
    const vehiculosSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('VEHICULOS');
    if (!vehiculosSheet) throw new Error('Hoja "VEHICULOS" no encontrada');
    const data = vehiculosSheet.getDataRange().getValues();
    if (data.length < 2) return [];
    const headers = data[0];
    const vehiculos = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString().trim() !== '') {
        const vehiculo = {};
        headers.forEach((header, index) => {
          // EXCLUIR N. DE PLACA
          if (header !== 'N. DE PLACA') {
            vehiculo[header] = data[i][index];
          }
        });
        vehiculos.push(vehiculo);
      }
    }
    return vehiculos;
  } catch (error) { console.error('Error en getVehiclesData:', error); return []; }
}

function isVehicleAvailable(vehicleCode, startDate, endDate) {
  try {
    const datosSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('DATOS');
    if (!datosSheet) return true;
    const data = datosSheet.getDataRange().getValues();
    if (data.length < 2) return true;
    const headers = data[0];
    const vehiculoIndex = headers.indexOf('VEHICULO'), saleIndex = headers.indexOf('SALE'), regresoIndex = headers.indexOf('REGRESA');
    if (vehiculoIndex === -1 || saleIndex === -1 || regresoIndex === -1) return true;
    for (let i = 1; i < data.length; i++) {
      if (data[i][vehiculoIndex] === vehicleCode && data[i][saleIndex] && data[i][regresoIndex]) {
        const existingStart = new Date(data[i][saleIndex]), existingEnd = new Date(data[i][regresoIndex]);
        if (startDate < existingEnd && endDate > existingStart) return false;
      }
    }
    return true;
  } catch (error) { console.error('Error en isVehicleAvailable:', error); return true; }
}

function saveReservationRequest(formData) {
  try {
    const reservasSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('RESERVAS');
    if (!reservasSheet) throw new Error('Hoja "RESERVAS" no encontrada');
    const reservaId = 'SOL-' + new Date().getTime();
    const now = new Date();
    const registro = Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');
    const newRow = [reservaId, formData.nombre, formData.telefono, formData.licencia, formData.fechaInicio, formData.fechaFin, formData.tipoVehiculo, formData.vehiculoCod, formData.comentarios || '', registro];
    reservasSheet.appendRow(newRow);
    return { success: true, id: reservaId };
  } catch (error) { console.error('Error en saveReservationRequest:', error); return { success: false, error: error.toString() }; }
}
