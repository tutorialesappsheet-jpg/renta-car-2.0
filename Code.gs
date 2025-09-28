// ID de tu Google Sheets (reemplazar con tu ID real)
const SPREADSHEET_ID = '11GGfaORm90GmwcNtc5fj1dVtBNWygkwlXWZep3FuG8I';

// IDs de las carpetas de Google Drive para imágenes (pre-configurados)
const DRIVE_FOLDERS = {
  'empresa_Images': '1w8sq_7NYWObSunIrJUb6hyE_96O2rJvu',
  'VEHICULOS_Images': '1vkZS9OY4JCaeA4c2Vwb_DMSeA10QRr1d',
  'FOTOS_Images': '1SkIJ9st8dbdLPv46g-O-vafnPAW1cZ6t',
  'BACKUP_FOLDER': '1eDejsZJ3gfTAMZ-ljd9e5wg9H10UGVRo'
};

/**
 * Función principal que sirve la aplicación web
 */
function doGet() {
  try {
    const template = HtmlService.createTemplateFromFile('Index');
    
    // Inyectar información de la empresa
    const empresaData = getEmpresaData();
    template.empresa = empresaData;
    
    const htmlOutput = template.evaluate()
      .setTitle('Renta de Vehículos')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    
    return htmlOutput;
  } catch (error) {
    console.error('Error en doGet:', error);
    return HtmlService.createHtmlOutput('<h1>Error cargando la aplicación</h1><p>' + error.toString() + '</p>');
  }
}

/**
 * Incluir archivos CSS y JS en el HTML
 */
function include(filename) {
  try {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  } catch (error) {
    console.error('Error incluyendo archivo:', filename, error);
    return '';
  }
}

/**
 * Obtener información de la empresa
 */
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
    
    // Convertir ruta del logo a URL pública
    if (empresa['LOGO (PEQUEÑO)']) {
      empresa.LOGO_URL = getFileUrl(empresa['LOGO (PEQUEÑO)']);
    }
    
    return empresa;
  } catch (error) {
    console.error('Error obteniendo datos de empresa:', error);
    return {
      NOMBRE: 'Renta de Vehículos',
      DIRECCION: 'Dirección no disponible',
      TELEFONO: 'Teléfono no disponible',
      'COLOR HEXA': '#d15b1a',
      LOGO_URL: ''
    };
  }
}

/**
 * Obtener tipos de vehículos únicos de la hoja VEHICULOS
 */
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
    console.error('Error obteniendo tipos de vehículos:', error);
    return ['SEDAN', 'PICK UP', 'SUV'];
  }
}

/**
 * Obtener vehículos disponibles
 */
function getAvailableVehicles(startDate, endDate, vehicleType) {
  try {
    console.log('Buscando vehículos:', { startDate, endDate, vehicleType });
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    // Obtener todos los vehículos
    const vehiculos = getVehiclesData();
    
    // Filtrar por tipo si se especifica
    let filteredVehicles = vehiculos;
    if (vehicleType && vehicleType !== 'TODOS') {
      filteredVehicles = vehiculos.filter(v => v.TIPO === vehicleType);
    }
    
    // Filtrar por disponibilidad
    const availableVehicles = [];
    const requestStart = new Date(startDate);
    const requestEnd = new Date(endDate);
    
    for (const vehiculo of filteredVehicles) {
      // Saltar vehículos en mantenimiento
      if (vehiculo['En Mantenimiento'] === true || 
          vehiculo['En Mantenimiento'] === 'TRUE' || 
          vehiculo['En Mantenimiento'] === 'true') {
        continue;
      }
      
      if (isVehicleAvailable(vehiculo.COD, requestStart, requestEnd)) {
        // Convertir imagen a URL pública
        vehiculo.IMAGEN_URL = getFileUrl(vehiculo.IMAGEN);
        availableVehicles.push(vehiculo);
      }
    }
    
    console.log('Vehículos disponibles encontrados:', availableVehicles.length);
    return availableVehicles;
    
  } catch (error) {
    console.error('Error obteniendo vehículos disponibles:', error);
    return [];
  }
}

/**
 * Obtener vehículos que se liberan pronto (próximos 5 días)
 */
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
    const vehiculoIndex = headers.indexOf('VEHICULO'); // Columna J
    const regresoIndex = headers.indexOf('REGRESA');   // Columna H
    
    if (vehiculoIndex === -1 || regresoIndex === -1) {
      console.warn('Columnas VEHICULO o REGRESA no encontradas en hoja DATOS');
      return [];
    }
    
    const soonAvailableCodes = new Set();
    
    // Buscar vehículos que regresan en los próximos 5 días
    for (let i = 1; i < data.length; i++) {
      if (data[i][regresoIndex] && data[i][vehiculoIndex]) {
        const regresoDate = new Date(data[i][regresoIndex]);
        if (regresoDate >= requestEnd && regresoDate <= fiveDaysLater) {
          soonAvailableCodes.add(data[i][vehiculoIndex]);
        }
      }
    }
    
    // Obtener detalles de estos vehículos
    const vehiculos = getVehiclesData();
    const soonAvailable = vehiculos.filter(v => 
      soonAvailableCodes.has(v.COD) && 
      (v['En Mantenimiento'] !== true && 
       v['En Mantenimiento'] !== 'TRUE' && 
       v['En Mantenimiento'] !== 'true')
    );
    
    // Convertir imágenes a URLs públicas
    soonAvailable.forEach(v => {
      v.IMAGEN_URL = getFileUrl(v.IMAGEN);
    });
    
    return soonAvailable;
    
  } catch (error) {
    console.error('Error obteniendo vehículos pronto disponibles:', error);
    return [];
  }
}

/**
 * Obtener datos de todos los vehículos de la hoja VEHICULOS
 */
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
      // Solo procesar filas que tengan COD
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
    console.error('Error obteniendo datos de vehículos:', error);
    return [];
  }
}

/**
 * Verificar si un vehículo está disponible en un rango de fechas
 * Revisa la hoja DATOS para conflictos de reserva
 */
function isVehicleAvailable(vehicleCode, startDate, endDate) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const datosSheet = ss.getSheetByName('DATOS');
    
    if (!datosSheet) {
      return true; // Si no hay datos de reservas, asume que está disponible
    }
    
    const data = datosSheet.getDataRange().getValues();
    if (data.length < 2) {
      return true;
    }
    
    const headers = data[0];
    const vehiculoIndex = headers.indexOf('VEHICULO'); // Columna J
    const saleIndex = headers.indexOf('SALE');         // Columna G
    const regresoIndex = headers.indexOf('REGRESA');   // Columna H
    
    if (vehiculoIndex === -1 || saleIndex === -1 || regresoIndex === -1) {
      console.warn('Columnas necesarias no encontradas en DATOS');
      return true;
    }
    
    // Verificar conflictos con reservas existentes
    for (let i = 1; i < data.length; i++) {
      if (data[i][vehiculoIndex] === vehicleCode && 
          data[i][saleIndex] && data[i][regresoIndex]) {
        
        const existingStart = new Date(data[i][saleIndex]);
        const existingEnd = new Date(data[i][regresoIndex]);
        
        // Verificar si hay solapamiento de fechas
        if (startDate < existingEnd && endDate > existingStart) {
          return false;
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error verificando disponibilidad:', error);
    return true; // En caso de error, asumir disponible
  }
}

/**
 * Obtener fotos adicionales de un vehículo desde la hoja FOTOS
 */
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
    const codIndex = headers.indexOf('COD');     // Columna B
    const fotoIndex = headers.indexOf('FOTO');   // Columna D
    
    if (codIndex === -1 || fotoIndex === -1) {
      console.warn('Columnas COD o FOTO no encontradas en hoja FOTOS');
      return [];
    }
    
    const photos = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i][codIndex] === vehicleCode && data[i][fotoIndex]) {
        const photoUrl = getFileUrl(data[i][fotoIndex]);
        if (photoUrl) {
          photos.push(photoUrl);
        }
      }
    }
    
    return photos;
  } catch (error) {
    console.error('Error obteniendo fotos del vehículo:', error);
    return [];
  }
}

/**
 * Guardar solicitud de reserva en la hoja RESERVAS
 */
function saveReservationRequest(formData) {
  try {
    console.log('Guardando reserva:', formData);
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const reservasSheet = ss.getSheetByName('RESERVAS');
    
    if (!reservasSheet) {
      throw new Error('Hoja "RESERVAS" no encontrada');
    }
    
    // Generar ID único para la reserva
    const reservaId = 'SOL-' + new Date().getTime();
    
    // Obtener fecha y hora actual para REGISTRO
    const now = new Date();
    const registro = Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');
    
    // Estructura según tu hoja RESERVAS:
    // ID, NOMBRE, TELEFONO, LICENCIA, SALE, REGRESA, TIPO DE VEHICULO, COD, COMENTARIOS, REGISTRO
    const newRow = [
      reservaId,                    // ID
      formData.nombre,              // NOMBRE
      formData.telefono,            // TELEFONO
      formData.licencia,            // LICENCIA
      formData.fechaInicio,         // SALE
      formData.fechaFin,            // REGRESA
      formData.tipoVehiculo,        // TIPO DE VEHICULO
      formData.vehiculoCod,         // COD
      formData.comentarios || '',   // COMENTARIOS
      registro                      // REGISTRO
    ];
    
    // Agregar nueva fila
    reservasSheet.appendRow(newRow);
    
    console.log('Reserva guardada exitosamente:', reservaId);
    return { success: true, id: reservaId };
    
  } catch (error) {
    console.error('Error guardando reserva:', error);
    return { success: false, error: error.toString() };
  }
}

/**
 * Convertir ruta de AppSheet a URL pública de Google Drive
 * Funciona con las rutas tipo: VEHICULOS_Images/archivo.jpg, FOTOS_Images/archivo.jpg, etc.
 */
function getFileUrl(appSheetPath) {
  try {
    if (!appSheetPath || typeof appSheetPath !== 'string') {
      return '';
    }
    
    // Limpiar la ruta
    const cleanPath = appSheetPath.toString().trim();
    if (!cleanPath) {
      return '';
    }
    
    // Extraer carpeta y nombre de archivo
    const pathParts = cleanPath.split('/');
    if (pathParts.length < 2) {
      console.warn('Formato de ruta inválido:', cleanPath);
      return '';
    }
    
    const folderName = pathParts[0];
    const fileName = pathParts.slice(1).join('/'); // Por si hay subcarpetas
    
    // Obtener ID de carpeta configurado
    const folderId = DRIVE_FOLDERS[folderName];
    if (!folderId) {
      console.warn('Carpeta no configurada:', folderName);
      // Intentar con carpeta backup
      const backupFolderId = DRIVE_FOLDERS['BACKUP_FOLDER'];
      if (backupFolderId) {
        return searchFileInFolder(backupFolderId, fileName);
      }
      return '';
    }
    
    return searchFileInFolder(folderId, fileName);
    
  } catch (error) {
    console.error('Error obteniendo URL de archivo:', appSheetPath, error);
    return '';
  }
}

/**
 * Buscar archivo en carpeta específica de Google Drive
 */
function searchFileInFolder(folderId, fileName) {
  try {
    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFilesByName(fileName);
    
    if (files.hasNext()) {
      const file = files.next();
      
      // Verificar si el archivo ya es público
      try {
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (sharingError) {
        console.warn('No se pudo cambiar permisos del archivo:', fileName, sharingError);
      }
      
      return `https://drive.google.com/uc?id=${file.getId()}`;
    }
    
    console.warn('Archivo no encontrado en carpeta:', fileName, folderId);
    return '';
    
  } catch (error) {
    console.error('Error buscando archivo en carpeta:', fileName, folderId, error);
    return '';
  }
}

/**
 * Función de prueba para verificar configuración
 */
function testConfiguration() {
  console.log('=== PRUEBA DE CONFIGURACIÓN ===');
  
  try {
    // Probar conexión con Sheets
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    console.log('✅ Conexión con Sheets exitosa');
    
    // Probar cada hoja
    const sheets = ['empresa', 'VEHICULOS', 'FOTOS', 'DATOS', 'RESERVAS'];
    sheets.forEach(sheetName => {
      const sheet = ss.getSheetByName(sheetName);
      if (sheet) {
        console.log(`✅ Hoja "${sheetName}" encontrada`);
      } else {
        console.log(`❌ Hoja "${sheetName}" NO encontrada`);
      }
    });
    
    // Probar carpetas de Drive
    Object.keys(DRIVE_FOLDERS).forEach(folderName => {
      try {
        const folder = DriveApp.getFolderById(DRIVE_FOLDERS[folderName]);
        console.log(`✅ Carpeta "${folderName}" accesible: ${folder.getName()}`);
      } catch (error) {
        console.log(`❌ Carpeta "${folderName}" NO accesible:`, error.message);
      }
    });
    
    // Probar funciones principales
    const empresa = getEmpresaData();
    console.log('✅ Datos de empresa:', empresa.NOMBRE);
    
    const tipos = getVehicleTypes();
    console.log('✅ Tipos de vehículos:', tipos);
    
    const vehiculos = getVehiclesData();
    console.log('✅ Vehículos encontrados:', vehiculos.length);
    
  } catch (error) {
    console.error('❌ Error en configuración:', error);
  }
}
