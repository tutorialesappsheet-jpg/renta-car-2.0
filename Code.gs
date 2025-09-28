// =============================================================
// VERSIÓN DE DEPURACIÓN DE CODE.GS
// =============================================================

function doGet() {
  try {
    let template = HtmlService.createTemplateFromFile('Index');
    template.companyInfo = getCompanyInfo_DEBUG(); // Usamos una función de prueba
    return template.evaluate()
      .setTitle(template.companyInfo.name || 'Renta de Vehículos')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (e) {
    // Si algo falla, esta vez veremos el error en la pantalla.
    return ContentService.createTextOutput(
      `Ocurrió un error al cargar la aplicación:\n\n` +
      `Mensaje: ${e.message}\n` +
      `Línea: ${e.lineNumber}\n` +
      `Archivo: ${e.fileName}\n\n` +
      `Stack Trace:\n${e.stack}`
    );
  }
}

// --- VERSIÓN DE PRUEBA DE getCompanyInfo ---
// Devuelve datos fijos para evitar leer el Google Sheet al inicio.
function getCompanyInfo_DEBUG() {
  return {
    name: "Empresa de Prueba",
    address: "Mi Dirección",
    phone: "555-1234",
    email: "test@test.com",
    logoUrl: 'https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_92x30dp.png', // Un logo de Google como prueba
    notes: "",
    primaryColor: "#FF5733" // Un color de prueba
  };
}

// =============================================================
// El resto de tu código original se mantiene igual abajo.
// No es necesario cambiarlo por ahora.
// =============================================================

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getInitialData() { return { vehicleTypes: getUniqueVehicleTypes() }; }

const SHEETS = { COMPANY: "empresa", VEHICLES: "VEHICULOS", RESERVATIONS: "DATOS", PHOTOS: "FOTOS", REQUESTS: "RESERVAS" };

function getFileUrl(appSheetPath) {
  if (!appSheetPath || typeof appSheetPath !== 'string') return 'https://via.placeholder.com/300x200?text=No+Imagen';
  const FOLDER_IDS = { empresa: '1w8sq_7NYWObSunIrJUb6hyE_96O2rJvu', vehiculos_main: '1vkZS9OY4JCaeA4c2Vwb_DMSeA10QRr1d', vehiculos_extras: '1SkIJ9st8dbdLPv46g-O-vafnPAW1cZ6t' };
  try {
    const parts = appSheetPath.split('/');
    const fileName = parts.pop();
    const folderPath = parts.join('/');
    let targetFolderId;
    if (folderPath.startsWith('empresa_Images')) targetFolderId = FOLDER_IDS.empresa;
    else if (folderPath.startsWith('VEHICULOS_Images')) targetFolderId = FOLDER_IDS.vehiculos_main;
    else if (folderPath.startsWith('FOTOS_Image')) targetFolderId = FOLDER_IDS.vehiculos_extras;
    else targetFolderId = '1eDejsZJ3gfTAMZ-ljd9e5wg9H10UGVRo';
    if (!targetFolderId) throw new Error(`Carpeta no determinada para: ${appSheetPath}`);
    const folder = DriveApp.getFolderById(targetFolderId);
    const files = folder.getFilesByName(fileName);
    if (files.hasNext()) return 'https://drive.google.com/uc?id=' + files.next().getId();
    else throw new Error(`Archivo no encontrado: ${fileName}`);
  } catch (e) { Logger.log(`Error en getFileUrl para: ${appSheetPath}. Detalle: ${e.message}`); return `https://via.placeholder.com/300x200?text=Error+Img`; }
}

function getAvailableVehicles(startDate, endDate, vehicleType) {
  const allVehicles = getSheetData(SHEETS.VEHICLES);
  const reservations = getSheetData(SHEETS.RESERVATIONS);
  const requestedStart = new Date(startDate);
  const requestedEnd = new Date(endDate);
  const reservedVehicleIds = new Set();
  reservations.forEach(res => {
    const rentalStart = new Date(res[6]);
    const rentalEnd = new Date(res[7]);
    if (requestedStart < rentalEnd && requestedEnd > rentalStart) reservedVehicleIds.add(res[9]);
  });
  return allVehicles.filter(vehicle => {
    const cod = vehicle[0], type = vehicle[2], inMaintenance = vehicle[9], isReserved = reservedVehicleIds.has(cod), matchesType = (vehicleType === 'TODOS' || type === vehicleType);
    return !isReserved && !inMaintenance && matchesType;
  }).map(formatVehicleData);
}

function getSoonToBeAvailableVehicles(endDate) {
  const allVehicles = getSheetData(SHEETS.VEHICLES);
  const reservations = getSheetData(SHEETS.RESERVATIONS);
  const clientEndDate = new Date(endDate);
  const limitDate = new Date(clientEndDate);
  limitDate.setDate(limitDate.getDate() + 5);
  const soonAvailableIds = new Map();
  reservations.forEach(res => {
    const returnDate = new Date(res[7]), vehicleCod = res[9];
    if (returnDate > clientEndDate && returnDate <= limitDate) {
      if (!soonAvailableIds.has(vehicleCod) || returnDate < soonAvailableIds.get(vehicleCod)) soonAvailableIds.set(vehicleCod, returnDate.toISOString().split('T')[0]);
    }
  });
  return allVehicles.filter(vehicle => soonAvailableIds.has(vehicle[0])).map(vehicle => {
    const formattedVehicle = formatVehicleData(vehicle);
    formattedVehicle.availableFrom = soonAvailableIds.get(formattedVehicle.cod);
    return formattedVehicle;
  });
}

function getVehiclePhotos(vehicleCod) { return getSheetData(SHEETS.PHOTOS).filter(photoRow => photoRow[1] === vehicleCod).map(photoRow => getFileUrl(photoRow[3])); }

function saveReservationRequest(formData) {
  try {
    const requestsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.REQUESTS);
    if (!requestsSheet) throw new Error(`La hoja "${SHEETS.REQUESTS}" no fue encontrada.`);
    const newRow = [new Date(), formData.name, formData.phone, formData.license, formData.startDate, formData.endDate, formData.vehicleType, formData.vehicleCod, "PENDIENTE"];
    requestsSheet.appendRow(newRow);
    return { success: true, message: "¡Éxito! Tu solicitud ha sido enviada." };
  } catch (error) { Logger.log(error); return { success: false, message: "Hubo un error al procesar tu solicitud." }; }
}

function getUniqueVehicleTypes() { const vehicles = getSheetData(SHEETS.VEHICLES); const types = vehicles.map(vehicle => vehicle[2]); return [...new Set(types)]; }

function formatVehicleData(vehicleRow) { return { cod: vehicleRow[0], name: vehicleRow[1], type: vehicleRow[2], year: vehicleRow[3], color: vehicleRow[4], brand: vehicleRow[5], plate: vehicleRow[6], imageUrl: getFileUrl(vehicleRow[7]), rate: vehicleRow[8], deductible: vehicleRow[10] }; }

function getSheetData(sheetName) { const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName); if (!sheet || sheet.getLastRow() <= 1) return []; return sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues(); }
