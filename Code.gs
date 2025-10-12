// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const SPREADSHEET_ID = '11GGfaORm90GmwcNtc5fj1dVtBNWygkwlXWZep3FuG8I';

const DRIVE_FOLDERS = {
  'empresa_Images': '1w8sq_7NYWObSunIrJUb6hyE_96O2rJvu',
  'VEHICULOS_Images': '1vkZS9OY4JCaeA4c2Vwb_DMSeA10QRr1d',
  'FOTOS_Images': '1SkIJ9st8dbdLPv46g-O-vafnPAW1cZ6t',
  'BACKUP_FOLDER': '1eDejsZJ3gfTAMZ-ljd9e5wg9H10UGVRo'
};

// ============================================================================
// API REST - ENDPOINTS
// ============================================================================

/**
 * Maneja peticiones GET (lectura de datos)
 */
function doGet(e) {
  try {
    const output = ContentService.createTextOutput();
    output.setMimeType(ContentService.MimeType.JSON);
    
    const action = e.parameter.action;
    let result;
    
    switch(action) {
      case 'getEmpresa':
        result = getEmpresaData();
        break;
        
      case 'getVehicleTypes':
        result = getVehicleTypes();
        break;
        
      case 'getFeaturedVehicles':
        result = getFeaturedVehicles();
        break;
        
      case 'getAvailableVehicles':
        const startDate = e.parameter.start;
        const endDate = e.parameter.end;
        const types = e.parameter.types ? e.parameter.types.split(',') : ['TODOS'];
        result = getAvailableVehicles(startDate, endDate, types);
        break;
        
      case 'getSoonAvailable':
        const end = e.parameter.endDate;
        result = getSoonToBeAvailableVehicles(end);
        break;
        
      case 'getVehiclePhotos':
        const code = e.parameter.code;
        result = getVehiclePhotos(code);
        break;
        
      default:
        result = { 
          error: 'Acción no válida', 
          availableActions: [
            'getEmpresa', 'getVehicleTypes', 'getFeaturedVehicles', 
            'getAvailableVehicles', 'getSoonAvailable', 'getVehiclePhotos'
          ]
        };
    }
    
    output.setContent(JSON.stringify({ success: true, data: result }));
    return output;
    
  } catch (error) {
    Logger.log('Error en doGet: ' + error.toString());
    const output = ContentService.createTextOutput();
    output.setMimeType(ContentService.MimeType.JSON);
    output.setContent(JSON.stringify({ 
      success: false, 
      error: error.toString() 
    }));
    return output;
  }
}

/**
 * Maneja peticiones POST (guardar reservas)
 */
function doPost(e) {
  try {
    const output = ContentService.createTextOutput();
    output.setMimeType(ContentService.MimeType.JSON);
    
    const action = e.parameter.action;
    
    if (action === 'saveReservation') {
      const formData = JSON.parse(e.postData.contents);
      const result = saveReservationRequest(formData);
      output.setContent(JSON.stringify(result));
    } else {
      output.setContent(JSON.stringify({ 
        success: false, 
        error: 'Acción no válida para POST' 
      }));
    }
    
    return output;
    
  } catch (error) {
    Logger.log('Error en doPost: ' + error.toString());
    const output = ContentService.createTextOutput();
    output.setMimeType(ContentService.MimeType.JSON);
    output.setContent(JSON.stringify({ 
      success: false, 
      error: error.toString() 
    }));
    return output;
  }
}

// ============================================================================
// FUNCIONES DE DATOS (Mantener igual que antes)
// ============================================================================

function getEmpresaData() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const empresaSheet = ss.getSheetByName('empresa');
    
    if (!empresaSheet) {
      throw new Error('Hoja "empresa" no encontrada');
    }
    
    const data = empresaSheet.getDataRange().getValues();
    if (data.length < 2) {
      throw new Error('No hay datos en la hoja empresa');
    }
    
    const headers = data[0];
    const values = data[1];
    
    const empresa = {};
    headers.forEach((header, index) => {
      empresa[header] = values[index];
    });
    
    if (empresa['LOGO (PEQUEÑO)']) {
      const logoPath = 'empresa_Images/' + empresa['LOGO (PEQUEÑO)'];
      empresa.LOGO_BASE64 = getImageAsBase64(logoPath);
    }
    
    return empresa;
  } catch (error) {
    Logger.log('Error obteniendo datos de empresa: ' + error);
    return {
      NOMBRE: 'Renta de Vehículos',
      DIRECCION: 'Dirección no disponible',
      TELEFONO: 'Teléfono no disponible',
      'COLOR HEXA': '#d15b1a',
      LOGO_BASE64: ''
    };
  }
}

function getVehicleTypes() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const vehiculosSheet = ss.getSheetByName('VEHICULOS');
    
    if (!vehiculosSheet) {
      throw new Error('Hoja "VEHICULOS" no encontrada');
    }
    
    const data = vehiculosSheet.getDataRange().getValues();
    if (data.length < 2) {
      return [];
    }
    
    const headers = data[0];
    const tipoIndex = headers.indexOf('TIPO');
    
    if (tipoIndex === -1) {
      throw new Error('Columna "TIPO" no encontrada en hoja VEHICULOS');
    }
    
    const tipos = new Set();
    for (let i = 1; i < data.length; i++) {
      if (data[i][tipoIndex] && data[i][tipoIndex].toString().trim() !== '') {
        tipos.add(data[i][tipoIndex].toString().trim());
      }
    }
    
    return Array.from(tipos).sort();
  } catch (error) {
    Logger.log('Error obteniendo tipos de vehículos: ' + error);
    return ['SEDAN', 'PICK UP', 'SUV'];
  }
}

function getAvailableVehicles(startDate, endDate, vehicleTypes) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const vehiculos = getVehiclesData();
    
    let filteredVehicles = vehiculos;
    if (vehicleTypes && vehicleTypes.length > 0 && !vehicleTypes.includes('TODOS')) {
      filteredVehicles = vehiculos.filter(v => vehicleTypes.includes(v.TIPO));
    }
    
    const availableVehicles = [];
    const requestStart = new Date(startDate);
    const requestEnd = new Date(endDate);
    
    for (const vehiculo of filteredVehicles) {
      if (vehiculo['En Mantenimiento'] === true || 
          vehiculo['En Mantenimiento'] === 'TRUE' || 
          vehiculo['En Mantenimiento'] === 'true') {
        continue;
      }
      
      if (isVehicleAvailable(vehiculo.COD, requestStart, requestEnd)) {
        vehiculo.IMAGEN_BASE64 = getImageAsBase64(vehiculo.IMAGEN);
        delete vehiculo['N. DE PLACA'];
        availableVehicles.push(vehiculo);
      }
    }
    
    return availableVehicles;
    
  } catch (error) {
    Logger.log('Error obteniendo vehículos disponibles: ' + error);
    return [];
  }
}

function getFeaturedVehicles() {
  try {
    const vehiculos = getVehiclesData();
    
    const featuredVehicles = vehiculos.filter(v => {
      return (v.DESTACAR === true || 
              v.DESTACAR === 'TRUE' || 
              v.DESTACAR === 'true') &&
             (v['En Mantenimiento'] !== true && 
              v['En Mantenimiento'] !== 'TRUE' && 
              v['En Mantenimiento'] !== 'true');
    });
    
    featuredVehicles.forEach(v => {
      v.IMAGEN_BASE64 = getImageAsBase64(v.IMAGEN);
      delete v['N. DE PLACA'];
    });
    
    return featuredVehicles;
    
  } catch (error) {
    Logger.log('Error obteniendo vehículos destacados: ' + error);
    return [];
  }
}

function getSoonToBeAvailableVehicles(endDate) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const datosSheet = ss.getSheetByName('DATOS');
    
    if (!datosSheet) {
      return [];
    }
    
    const requestEnd = new Date(endDate);
    const fiveDaysLater = new Date(requestEnd);
    fiveDaysLater.setDate(fiveDaysLater.getDate() + 5);
    
    const data = datosSheet.getDataRange().getValues();
    if (data.length < 2) {
      return [];
    }
    
    const headers = data[0];
    const vehiculoIndex = headers.indexOf('VEHICULO');
    const regresoIndex = headers.indexOf('REGRESA');
    
    if (vehiculoIndex === -1 || regresoIndex === -1) {
      return [];
    }
    
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
    const soonAvailable = vehiculos.filter(v => 
      soonAvailableCodes.has(v.COD) && 
      (v['En Mantenimiento'] !== true && 
       v['En Mantenimiento'] !== 'TRUE' && 
       v['En Mantenimiento'] !== 'true')
    );
    
    soonAvailable.forEach(v => {
      v.IMAGEN_BASE64 = getImageAsBase64(v.IMAGEN);
      delete v['N. DE PLACA'];
    });
    
    return soonAvailable;
    
  } catch (error) {
    Logger.log('Error obteniendo vehículos pronto disponibles: ' + error);
    return [];
  }
}

function getVehiclesData() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const vehiculosSheet = ss.getSheetByName('VEHICULOS');
    
    if (!vehiculosSheet) {
      throw new Error('Hoja "VEHICULOS" no encontrada');
    }
    
    const data = vehiculosSheet.getDataRange().getValues();
    if (data.length < 2) {
      return [];
    }
    
    const headers = data[0];
    const vehiculos = [];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString().trim() !== '') {
        const vehiculo = {};
        headers.forEach((header, index) => {
          vehiculo[header] = data[i][index];
        });
        vehiculos.push(vehiculo);
      }
    }
    
    return vehiculos;
  } catch (error) {
    Logger.log('Error obteniendo datos de vehículos: ' + error);
    return [];
  }
}

function isVehicleAvailable(vehicleCode, startDate, endDate) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const datosSheet = ss.getSheetByName('DATOS');
    
    if (!datosSheet) {
      return true;
    }
    
    const data = datosSheet.getDataRange().getValues();
    if (data.length < 2) {
      return true;
    }
    
    const headers = data[0];
    const vehiculoIndex = headers.indexOf('VEHICULO');
    const saleIndex = headers.indexOf('SALE');
    const regresoIndex = headers.indexOf('REGRESA');
    
    if (vehiculoIndex === -1 || saleIndex === -1 || regresoIndex === -1) {
      return true;
    }
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][vehiculoIndex] === vehicleCode && 
          data[i][saleIndex] && data[i][regresoIndex]) {
        
        const existingStart = new Date(data[i][saleIndex]);
        const existingEnd = new Date(data[i][regresoIndex]);
        
        if (startDate < existingEnd && endDate > existingStart) {
          return false;
        }
      }
    }
    
    return true;
  } catch (error) {
    Logger.log('Error verificando disponibilidad: ' + error);
    return true;
  }
}

function getVehiclePhotos(vehicleCode) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const fotosSheet = ss.getSheetByName('FOTOS');
    
    if (!fotosSheet) {
      return [];
    }
    
    const data = fotosSheet.getDataRange().getValues();
    if (data.length < 2) {
      return [];
    }
    
    const headers = data[0];
    const codIndex = headers.indexOf('COD');
    const fotoIndex = headers.indexOf('FOTO');
    
    if (codIndex === -1 || fotoIndex === -1) {
      return [];
    }
    
    const photos = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i][codIndex] === vehicleCode && data[i][fotoIndex]) {
        const photoBase64 = getImageAsBase64(data[i][fotoIndex]);
        if (photoBase64) {
          photos.push(photoBase64);
        }
      }
    }
    
    return photos;
  } catch (error) {
    Logger.log('Error obteniendo fotos del vehículo: ' + error);
    return [];
  }
}

function saveReservationRequest(formData) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const reservasSheet = ss.getSheetByName('RESERVAS');
    
    if (!reservasSheet) {
      throw new Error('Hoja "RESERVAS" no encontrada');
    }
    
    const reservaId = 'SOL-' + new Date().getTime();
    const now = new Date();
    const registro = Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');
    
    const newRow = [
      reservaId,
      formData.nombre,
      formData.telefono,
      formData.licencia,
      formData.fechaInicio,
      formData.fechaFin,
      formData.hora,
      formData.tipoVehiculo,
      formData.vehiculoCod,
      formData.comentarios || '',
      registro
    ];
    
    reservasSheet.appendRow(newRow);
    
    return { success: true, id: reservaId };
    
  } catch (error) {
    Logger.log('Error guardando reserva: ' + error);
    return { success: false, error: error.toString() };
  }
}

function getImageAsBase64(appSheetPath) {
  try {
    if (!appSheetPath || typeof appSheetPath !== 'string') {
      return '';
    }
    
    const cleanPath = appSheetPath.trim();
    if (!cleanPath) {
      return '';
    }
    
    const pathParts = cleanPath.split('/');
    if (pathParts.length < 2) {
      return '';
    }
    
    const folderName = pathParts[0];
    const fileName = pathParts.slice(1).join('/');
    
    const folderId = DRIVE_FOLDERS[folderName];
    if (!folderId) {
      const backupFolderId = DRIVE_FOLDERS['BACKUP_FOLDER'];
      if (backupFolderId) {
        return searchAndEncodeFile(backupFolderId, fileName);
      }
      return '';
    }
    
    return searchAndEncodeFile(folderId, fileName);
    
  } catch (error) {
    Logger.log('Error convirtiendo imagen a Base64: ' + error);
    return '';
  }
}

function searchAndEncodeFile(folderId, fileName) {
  try {
    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFilesByName(fileName);
    
    if (files.hasNext()) {
      const file = files.next();
      const blob = file.getBlob();
      const contentType = blob.getContentType();
      const base64Data = Utilities.base64Encode(blob.getBytes());
      return `data:${contentType};base64,${base64Data}`;
    } else {
      return '';
    }
  } catch (error) {
    Logger.log('Error buscando y codificando archivo: ' + error);
    return '';
  }
}
