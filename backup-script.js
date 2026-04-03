// ╔══════════════════════════════════════════════════════════════╗
// ║  Charming by Vik — גיבוי אוטומטי ל-Google Sheets          ║
// ║  רץ כל 6 שעות דרך Google Apps Script                       ║
// ╚══════════════════════════════════════════════════════════════╝

const PROJECT_ID = 'charming-3dd6f';
const BASE_PATH  = 'artifacts/charming-3dd6f/public/data';
const USERS_PATH = 'artifacts/charming-3dd6f/users';

// ── Main backup function ──
function doBackup() {
  const ss = getOrCreateSheet();

  const collections = [
    { path: BASE_PATH + '/workshops',   sheet: 'סדנאות',   headers: workshopHeaders,  mapRow: workshopRow },
    { path: BASE_PATH + '/orders',      sheet: 'הזמנות',   headers: orderHeaders,     mapRow: orderRow },
    { path: BASE_PATH + '/expenses',    sheet: 'הוצאות',   headers: expenseHeaders,   mapRow: expenseRow },
    { path: BASE_PATH + '/inquiries',   sheet: 'פניות',    headers: inquiryHeaders,   mapRow: inquiryRow },
    { path: BASE_PATH + '/products',    sheet: 'מוצרים',   headers: productHeaders,   mapRow: productRow },
    { path: USERS_PATH,                 sheet: 'לקוחות',   headers: customerHeaders,  mapRow: customerRow },
    { path: BASE_PATH + '/coupons',     sheet: 'קופונים',  headers: couponHeaders,    mapRow: couponRow },
  ];

  for (const col of collections) {
    try {
      const docs = fetchCollection(col.path);
      writeSheet(ss, col.sheet, col.headers, docs.map(d => col.mapRow(d)));
    } catch (e) {
      Logger.log('Error backing up ' + col.sheet + ': ' + e.message);
    }
  }

  // Log timestamp
  const logSheet = ss.getSheetByName('יומן גיבוי') || ss.insertSheet('יומן גיבוי');
  logSheet.appendRow([new Date(), 'גיבוי הושלם בהצלחה']);

  Logger.log('Backup completed at ' + new Date().toISOString());
}

// ── Firestore REST API ──
function fetchCollection(collectionPath) {
  const token = ScriptApp.getOAuthToken();
  const baseUrl = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents/' + collectionPath;

  let allDocs = [];
  let pageToken = '';

  do {
    const url = baseUrl + '?pageSize=300' + (pageToken ? '&pageToken=' + pageToken : '');
    const resp = UrlFetchApp.fetch(url, {
      headers: { 'Authorization': 'Bearer ' + token },
      muteHttpExceptions: true
    });

    if (resp.getResponseCode() !== 200) {
      throw new Error('Firestore API error ' + resp.getResponseCode() + ': ' + resp.getContentText().substring(0, 200));
    }

    const json = JSON.parse(resp.getContentText());
    if (json.documents) allDocs = allDocs.concat(json.documents);
    pageToken = json.nextPageToken || '';
  } while (pageToken);

  return allDocs;
}

// ── Parse Firestore field types ──
function pf(field) {
  if (!field) return '';
  if (field.stringValue !== undefined) return field.stringValue;
  if (field.integerValue !== undefined) return Number(field.integerValue);
  if (field.doubleValue !== undefined) return Number(field.doubleValue);
  if (field.booleanValue !== undefined) return field.booleanValue;
  if (field.timestampValue) return new Date(field.timestampValue);
  if (field.nullValue !== undefined) return '';
  if (field.mapValue && field.mapValue.fields) return field.mapValue.fields;
  if (field.arrayValue && field.arrayValue.values) return field.arrayValue.values.map(pf);
  return '';
}

// shorthand: get field value from doc
function gf(doc, fieldName) {
  return doc.fields && doc.fields[fieldName] ? pf(doc.fields[fieldName]) : '';
}

// get nested map field
function gmf(mapFields, fieldName) {
  return mapFields && mapFields[fieldName] ? pf(mapFields[fieldName]) : '';
}

// format date
function fd(val) {
  if (!val) return '';
  if (val instanceof Date) return Utilities.formatDate(val, 'Asia/Jerusalem', 'dd/MM/yyyy');
  return '';
}

function fdt(val) {
  if (!val) return '';
  if (val instanceof Date) return Utilities.formatDate(val, 'Asia/Jerusalem', 'dd/MM/yyyy HH:mm');
  return '';
}

// ── Sheet helpers ──
function getOrCreateSheet() {
  const props = PropertiesService.getScriptProperties();
  let ssId = props.getProperty('SHEET_ID');
  let ss;

  if (ssId) {
    try { ss = SpreadsheetApp.openById(ssId); } catch(e) { ssId = null; }
  }

  if (!ssId) {
    ss = SpreadsheetApp.create('Charming by Vik — גיבוי אוטומטי');
    ssId = ss.getId();
    props.setProperty('SHEET_ID', ssId);
    Logger.log('Created new spreadsheet: ' + ss.getUrl());
  }

  return ss;
}

function writeSheet(ss, sheetName, headers, rows) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  sheet.clear();

  if (rows.length === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    const data = [headers, ...rows];
    sheet.getRange(1, 1, data.length, headers.length).setValues(data);
  }

  // Bold + freeze header
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.setRightToLeft(true);
}

// ══════════════════════════════════════════════════════════════
//  COLLECTION DEFINITIONS — headers + row mappers
// ══════════════════════════════════════════════════════════════

const PAY_METHOD = { paybox:'PayBox', bit:'Bit', cash:'מזומן', transfer:'העברה בנקאית' };
const WS_STATUS  = { draft:'טיוטה', confirmed:'מאושרת', archived:'בארכיון' };
const ORD_STATUS = { pending_payment:'ממתין לתשלום', processing:'בטיפול', shipped:'נשלח', delivered:'נמסר', cancelled:'בוטל' };
const EXP_CAT   = { materials:'חומרי גלם', staff:'תשלום לעובדת', fuel:'דלק / נסיעות', marketing:'שיווק ממומן', other:'אחר' };
const INQ_STATUS = { new:'חדשה', handled:'טופל', archived:'בארכיון' };

// ── Workshops ──
const workshopHeaders = [
  'שם מלא איש קשר','טלפון','שם החוגג/ת','לכבוד מה האירוע',
  'עיר','תאריך אירוע','שעת התחלה','מספר משתתפות','מסלול',
  'מחיר בסיס (₪)','הנחה (%)','עלות הגעה (₪)','סה"כ לתשלום (₪)',
  'סטטוס הזמנה',
  'מקדמה שולמה','סכום מקדמה (₪)','אמצעי תשלום מקדמה','תאריך תשלום מקדמה',
  'יתרה שולמה','סכום יתרה (₪)','אמצעי תשלום יתרה','תאריך תשלום יתרה',
  'נותר לתשלום (₪)','בארכיון','הערות','תאריך יצירת הזמנה'
];

function workshopRow(doc) {
  const pay = gf(doc, 'payment') || {};
  const advPaid = gmf(pay, 'advancePaid') === true;
  const balPaid = gmf(pay, 'balancePaid') === true;
  const total = gf(doc, 'total') || 0;
  const advAmt = advPaid ? (gmf(pay, 'advanceAmount') || 500) : 0;
  const balAmt = balPaid ? (gmf(pay, 'balanceAmount') || 0) : 0;
  const remaining = Math.max(0, total - advAmt - balAmt);
  const status = gf(doc, 'bookingStatus') || '';

  return [
    gf(doc, 'customerName'), gf(doc, 'phone'), gf(doc, 'celebrant'), gf(doc, 'occasion'),
    gf(doc, 'city'), fd(gf(doc, 'eventDate')), gf(doc, 'time'), gf(doc, 'participantCount'), gf(doc, 'route'),
    gf(doc, 'basePrice') || 0, gf(doc, 'discount') || 0, gf(doc, 'arrivalFee') || 0, total,
    WS_STATUS[status] || status,
    advPaid ? 'כן' : 'לא', advPaid ? advAmt : '', advPaid ? (PAY_METHOD[gmf(pay,'advanceMethod')] || gmf(pay,'advanceMethod') || '') : '', advPaid ? fd(gmf(pay,'advancePaidDate')) : '',
    balPaid ? 'כן' : 'לא', balPaid ? balAmt : '', balPaid ? (PAY_METHOD[gmf(pay,'balanceMethod')] || gmf(pay,'balanceMethod') || '') : '', balPaid ? fd(gmf(pay,'balancePaidDate')) : '',
    remaining, gf(doc, 'archived') === true ? 'כן' : 'לא', gf(doc, 'notes') || '', fdt(gf(doc, 'createdAt'))
  ];
}

// ── Orders ──
const orderHeaders = [
  'תאריך','מס. הזמנה','שם לקוח','טלפון','אימייל','עיר','רחוב','דירה',
  'אופן קבלה','מוצרים','פרטי מוצרים','כמות פריטים',
  'סכום ביניים','משלוח','קוד קופון','הנחה','סה"כ','סטטוס'
];

function orderRow(doc) {
  const customer = gf(doc, 'customer') || {};
  const address = gmf(customer, 'address') || {};
  const summary = gf(doc, 'summary') || {};
  const items = gf(doc, 'items') || [];
  const coupon = gf(doc, 'coupon') || {};

  const productNames = Array.isArray(items) ? items.map(it => (typeof it === 'object' && it.fields ? pf(it.fields.name) : (it.name || ''))).join(' | ') : '';
  const productDetails = Array.isArray(items) ? items.map(it => {
    if (typeof it === 'object' && it.fields) {
      const name = pf(it.fields.name) || '';
      const qty = pf(it.fields.qty) || 1;
      const price = pf(it.fields.price) || 0;
      const note = pf(it.fields.customizationNote) || '';
      return name + ' x' + qty + ' (' + price + '₪)' + (note ? ' — ' + note : '');
    }
    return '';
  }).join(' | ') : '';
  const totalQty = Array.isArray(items) ? items.reduce((sum, it) => {
    const q = (typeof it === 'object' && it.fields) ? (pf(it.fields.qty) || 1) : 1;
    return sum + q;
  }, 0) : 0;

  const status = gf(doc, 'status') || '';
  const shipping = gmf(customer, 'shippingMethod') || '';

  return [
    fdt(gf(doc, 'timestamp')), gf(doc, 'orderId') || '',
    gmf(customer, 'name'), gmf(customer, 'phone'), gmf(customer, 'email'),
    gmf(address, 'city'), gmf(address, 'street') ? (gmf(address, 'street') + ' ' + (gmf(address, 'house') || '')) : '', gmf(address, 'apt') || '',
    shipping === 'pickup' ? 'איסוף עצמי' : 'משלוח',
    productNames, productDetails, totalQty,
    gmf(summary, 'subtotal') || 0, gmf(summary, 'shipping') || 0,
    gmf(coupon, 'code') || '', gmf(summary, 'discount') || 0, gmf(summary, 'total') || 0,
    ORD_STATUS[status] || status
  ];
}

// ── Expenses ──
const expenseHeaders = ['תאריך','קטגוריה','תיאור','סכום','אמצעי תשלום','סדנא קשורה'];

function expenseRow(doc) {
  const cat = gf(doc, 'category') || '';
  return [
    gf(doc, 'date'), EXP_CAT[cat] || cat, gf(doc, 'notes') || '',
    gf(doc, 'amount') || 0, gf(doc, 'method') || '', gf(doc, 'workshopName') || ''
  ];
}

// ── Inquiries ──
const inquiryHeaders = ['תאריך','סוג פנייה','שם','טלפון','אימייל','הודעה','סוג סדנא','משתתפות','תאריך מבוקש','סטטוס'];

function inquiryRow(doc) {
  const status = gf(doc, 'status') || '';
  return [
    fdt(gf(doc, 'createdAt')), gf(doc, 'inquiryType') || '',
    gf(doc, 'name'), gf(doc, 'phone'), gf(doc, 'email'),
    gf(doc, 'message') || gf(doc, 'notes') || '', gf(doc, 'workshopType') || '',
    gf(doc, 'participants') || '', gf(doc, 'date') || '',
    INQ_STATUS[status] || status
  ];
}

// ── Products ──
const productHeaders = [
  'שם','שם באנגלית','מק"ט','קטגוריה','קולקציה','חומר','צבע',
  'מחיר מלא','מחיר מבצע','עלות','מלאי','תג','סטטוס',
  'מותאם אישית','מוצר מובלט','תיאור בעברית','תיאור באנגלית',
  'תמונה ראשית','כל התמונות','תאריך יצירה','תאריך עדכון'
];

function productRow(doc) {
  const imgs = gf(doc, 'images');
  const imgsStr = Array.isArray(imgs) ? imgs.join(' | ') : '';
  return [
    gf(doc, 'name'), gf(doc, 'nameEn') || '', gf(doc, 'sku') || '',
    gf(doc, 'category') || '', gf(doc, 'collection') || '',
    gf(doc, 'material') || '', gf(doc, 'color') || '',
    gf(doc, 'priceOriginal') || gf(doc, 'price') || 0,
    gf(doc, 'priceSale') || gf(doc, 'salePrice') || '',
    gf(doc, 'costPrice') || '', gf(doc, 'stockCount') || gf(doc, 'stock') || '',
    gf(doc, 'badge') || '', gf(doc, 'status') || '',
    gf(doc, 'isCustomizable') === true ? 'כן' : 'לא',
    gf(doc, 'isFeatured') === true ? 'כן' : 'לא',
    gf(doc, 'description') || '', gf(doc, 'descriptionEn') || '',
    gf(doc, 'imageUrl') || '', imgsStr,
    fdt(gf(doc, 'createdAt')), fdt(gf(doc, 'updatedAt'))
  ];
}

// ── Customers ──
const customerHeaders = ['שם','אימייל','טלפון','יום הולדת','עיר','הערות'];

function customerRow(doc) {
  return [
    gf(doc, 'displayName') || gf(doc, 'fullName') || gf(doc, 'name') || '',
    gf(doc, 'email') || '', gf(doc, 'phone') || '',
    fd(gf(doc, 'birthDate')) || gf(doc, 'birthday') || '',
    gf(doc, 'city') || '', gf(doc, 'notes') || ''
  ];
}

// ── Coupons ──
const couponHeaders = ['קוד','סוג','ערך','מגבלת שימוש','שימושים','תוקף','נוצר'];

function couponRow(doc) {
  return [
    gf(doc, 'code') || '', gf(doc, 'type') === 'percent' ? 'אחוז' : 'סכום קבוע',
    gf(doc, 'value') || 0, gf(doc, 'usageLimit') || 'ללא הגבלה',
    gf(doc, 'usedCount') || 0, fd(gf(doc, 'expiryDate')), fdt(gf(doc, 'createdAt'))
  ];
}

// ── Setup trigger (run once) ──
function setupAutoBackup() {
  // Remove old triggers
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  // Every 6 hours
  ScriptApp.newTrigger('doBackup')
    .timeBased()
    .everyHours(6)
    .create();
  Logger.log('Auto-backup trigger set: every 6 hours');
}
