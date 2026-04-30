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

  // Save spreadsheet ID to Firestore so dashboard can use the same sheet
  saveSheetIdToFirestore(ss.getId());

  Logger.log('Backup completed at ' + new Date().toISOString());
}

function saveSheetIdToFirestore(sheetId) {
  try {
    const token = ScriptApp.getOAuthToken();
    const docPath = 'projects/' + PROJECT_ID + '/databases/(default)/documents/' + BASE_PATH + '/settings/backup';
    const url = 'https://firestore.googleapis.com/v1/' + docPath + '?updateMask.fieldPaths=spreadsheetId&updateMask.fieldPaths=lastAutoBackup';
    UrlFetchApp.fetch(url, {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      payload: JSON.stringify({
        fields: {
          spreadsheetId: { stringValue: sheetId },
          lastAutoBackup: { timestampValue: new Date().toISOString() }
        }
      }),
      muteHttpExceptions: true
    });
  } catch(e) { Logger.log('Save sheet ID to Firestore: ' + e.message); }
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

// Color definitions
const CLR = {
  customer: '#D6EAF8', // light blue
  event:    '#D5F5E3', // light green
  pricing:  '#FEF5E7', // light gold
  payment:  '#F5EEF8', // light purple
  status:   '#F2F3F4', // light gray
  meta:     '#F2F3F4', // light gray
  desc:     '#E6F0FA', // light sky
  tag:      '#FFF3CD', // yellow
};

// Status cell colors
const STATUS_CLR = {
  // Workshop CRM categories (match dashboard column colors)
  'טיוטה — טרם הועברה מקדמה':'#FCE7F3', // pink-50
  'סדנה אושרה':'#D1FAE5',                // emerald-100
  'בוצעה וממתינה לתשלום':'#FEE2E2',      // red-100
  'ארכיון':'#E5E7EB',                    // gray-200
  // Legacy / other sheets
  'טיוטה':'#FFF3CD', 'מאושרת':'#D4EDDA', 'בארכיון':'#E2E3E5',
  'ממתין לתשלום':'#FFF3CD', 'בטיפול':'#D6EAF8', 'נשלח':'#FFE8CC', 'נמסר':'#D4EDDA', 'בוטל':'#F5D5D5',
  'חדשה':'#FFF3CD', 'טופל':'#D4EDDA',
  'published':'#D4EDDA', 'draft':'#FFF3CD',
};

// Column color groups per sheet
const SHEET_COLORS = {
  'סדנאות': [
    {s:1,e:4,c:CLR.customer}, {s:5,e:10,c:CLR.event}, {s:11,e:17,c:CLR.pricing},
    {s:18,e:18,c:CLR.status}, {s:19,e:28,c:CLR.payment}, {s:29,e:32,c:CLR.meta}
  ],
  'הזמנות': [
    {s:1,e:2,c:CLR.meta}, {s:3,e:8,c:CLR.customer}, {s:9,e:9,c:CLR.event},
    {s:10,e:12,c:CLR.pricing}, {s:13,e:17,c:CLR.payment}, {s:18,e:18,c:CLR.status}
  ],
  'הוצאות': [
    {s:1,e:1,c:CLR.meta}, {s:2,e:2,c:CLR.event}, {s:3,e:4,c:CLR.pricing}, {s:5,e:6,c:CLR.payment}
  ],
  'פניות': [
    {s:1,e:1,c:CLR.meta}, {s:2,e:2,c:CLR.event}, {s:3,e:5,c:CLR.customer},
    {s:6,e:9,c:CLR.pricing}, {s:10,e:10,c:CLR.status}
  ],
  'מוצרים': [
    {s:1,e:3,c:CLR.customer}, {s:4,e:7,c:CLR.event}, {s:8,e:11,c:CLR.pricing},
    {s:12,e:12,c:CLR.tag}, {s:13,e:13,c:CLR.status}, {s:14,e:15,c:CLR.payment},
    {s:16,e:17,c:CLR.desc}, {s:18,e:19,c:CLR.meta}, {s:20,e:21,c:CLR.meta}
  ],
  'קופונים': [
    {s:1,e:1,c:CLR.customer}, {s:2,e:3,c:CLR.pricing}, {s:4,e:5,c:CLR.event}, {s:6,e:7,c:CLR.meta}, {s:8,e:9,c:CLR.meta}
  ],
};

function writeSheet(ss, sheetName, headers, rows) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  sheet.clear();
  sheet.clearFormats();

  if (rows.length === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    const data = [headers, ...rows];
    sheet.getRange(1, 1, data.length, headers.length).setValues(data);
  }

  // Bold + freeze + center header
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setHorizontalAlignment('center');
  sheet.setFrozenRows(1);
  sheet.setRightToLeft(true);

  // Apply header color groups
  const groups = SHEET_COLORS[sheetName];
  if (groups && groups.length > 0) {
    headerRange.setBackground('#FFFFFF'); // reset to white first
    for (const g of groups) {
      if (g.s >= 1 && g.e >= g.s && g.e <= headers.length) {
        sheet.getRange(1, g.s, 1, g.e - g.s + 1).setBackground(g.c);
      }
    }
  } else {
    headerRange.setBackground('#FDF5ED');
  }

  // Apply status cell colors
  const statusCol = headers.indexOf('סטטוס הזמנה') !== -1
    ? headers.indexOf('סטטוס הזמנה') + 1
    : headers.indexOf('סטטוס') !== -1
      ? headers.indexOf('סטטוס') + 1
      : -1;
  if (statusCol > 0 && rows.length > 0) {
    for (let r = 0; r < rows.length; r++) {
      const val = rows[r][statusCol - 1];
      const bg = STATUS_CLR[val];
      if (bg) {
        sheet.getRange(r + 2, statusCol).setBackground(bg).setFontWeight('bold');
      }
    }
  }
}

// ══════════════════════════════════════════════════════════════
//  COLLECTION DEFINITIONS — headers + row mappers
// ══════════════════════════════════════════════════════════════

const PAY_METHOD = { paybox:'PayBox', bit:'Bit', cash:'מזומן', transfer:'העברה בנקאית' };
// Computed CRM categories (match dashboard logic in mgmt-7k9x.html → renderCrmBoard)
const WS_CAT_DRAFT     = 'טיוטה — טרם הועברה מקדמה';
const WS_CAT_CONFIRMED = 'סדנה אושרה';
const WS_CAT_PENDING   = 'בוצעה וממתינה לתשלום';
const WS_CAT_ARCHIVE   = 'ארכיון';
function computeWsCategory(bookingStatus, eventDate, balancePaid, archivedFlag) {
  if (archivedFlag === true) return WS_CAT_ARCHIVE;
  const status = bookingStatus || 'confirmed';
  const now = new Date(); now.setHours(0,0,0,0);
  const d = (eventDate instanceof Date) ? eventDate : null;
  const isPast = d && d < now;
  if (status === 'draft' && !isPast)     return WS_CAT_DRAFT;
  if (status === 'confirmed' && !isPast) return WS_CAT_CONFIRMED;
  if (isPast && !balancePaid)            return WS_CAT_PENDING;
  if (isPast && balancePaid)             return WS_CAT_ARCHIVE;
  return status;
}
const ORD_STATUS = { pending_payment:'ממתין לתשלום', processing:'בטיפול', shipped:'נשלח', delivered:'נמסר', cancelled:'בוטל' };
const EXP_CAT   = { materials:'חומרי גלם', staff:'תשלום לעובדת', fuel:'דלק / נסיעות', marketing:'שיווק ממומן', other:'אחר' };
const INQ_STATUS = { new:'חדשה', handled:'טופל', archived:'בארכיון' };

// ── Workshops ──
const workshopHeaders = [
  'שם מלא איש קשר','טלפון','שם החוגג/ת','לכבוד מה האירוע',
  'עיר','רחוב ומספר','תאריך אירוע','שעת התחלה','מספר משתתפות','מסלול',
  'מחיר בסיס (₪)','מצב תמחור','תוספת מותאמת (₪)','הערת תוספת','הנחה (%)','עלות הגעה (₪)','סה"כ לתשלום (₪)',
  'סטטוס הזמנה',
  'מקדמה שולמה','סכום מקדמה (₪)','אמצעי תשלום מקדמה','תאריך תשלום מקדמה',
  'יתרה שולמה','סכום יתרה (₪)','אמצעי תשלום יתרה','תאריך תשלום יתרה','פיצול תשלומי יתרה',
  'נותר לתשלום (₪)','בארכיון','הערות','מזהה אירוע ביומן','תאריך יצירת הזמנה'
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
  const eventDate = gf(doc, 'eventDate');
  const archivedFlag = gf(doc, 'archived') === true;
  const wsCategory = computeWsCategory(status, eventDate, balPaid, archivedFlag);

  const customExtra = gf(doc, 'customExtra') || {};
  const extraAmt = gmf(customExtra, 'amount') || '';
  const extraNote = gmf(customExtra, 'note') || '';
  const pricingMode = gf(doc, 'pricingMode') || '';
  const pricingModeLabel = pricingMode === 'extra' ? 'תוספת מותאמת' : pricingMode === 'tier' ? 'מסלול' : pricingMode;

  // Format split balance payments: "120₪ PayBox | 80₪ Bit"
  const balPayments = gmf(pay, 'balancePayments');
  let balPaymentsStr = '';
  if (Array.isArray(balPayments) && balPayments.length > 0) {
    balPaymentsStr = balPayments.map(p => {
      const fields = (p && p.mapValue && p.mapValue.fields) ? p.mapValue.fields : (p && p.fields ? p.fields : null);
      if (!fields) return '';
      const amt = gmf(fields, 'amount') || '';
      const m = gmf(fields, 'method') || '';
      return amt + '₪ ' + (PAY_METHOD[m] || m);
    }).filter(Boolean).join(' | ');
  }

  return [
    gf(doc, 'customerName'), gf(doc, 'phone'), gf(doc, 'celebrant'), gf(doc, 'occasion'),
    gf(doc, 'city'), gf(doc, 'street') || '', fd(gf(doc, 'eventDate')), gf(doc, 'time'), gf(doc, 'participantCount'), gf(doc, 'route'),
    gf(doc, 'basePrice') || 0, pricingModeLabel, extraAmt, extraNote, gf(doc, 'discount') || 0, gf(doc, 'arrivalFee') || 0, total,
    wsCategory,
    advPaid ? 'כן' : 'לא', advPaid ? advAmt : '', advPaid ? (PAY_METHOD[gmf(pay,'advanceMethod')] || gmf(pay,'advanceMethod') || '') : '', advPaid ? fd(gmf(pay,'advancePaidDate')) : '',
    balPaid ? 'כן' : 'לא', balPaid ? balAmt : '', balPaid ? (PAY_METHOD[gmf(pay,'balanceMethod')] || gmf(pay,'balanceMethod') || '') : '', balPaid ? fd(gmf(pay,'balancePaidDate')) : '', balPaymentsStr,
    remaining, gf(doc, 'archived') === true ? 'כן' : 'לא', gf(doc, 'notes') || '', gf(doc, 'calendarEventId') || '', fdt(gf(doc, 'createdAt'))
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
const customerHeaders = ['שם','אימייל','טלפון','יום הולדת','עיר','רחוב','קומה','דירה','מיקוד','הערות'];

function customerRow(doc) {
  const bd = gf(doc, 'birthDate');
  return [
    gf(doc, 'displayName') || gf(doc, 'fullName') || gf(doc, 'name') || '',
    gf(doc, 'email') || '', gf(doc, 'phone') || '',
    (bd instanceof Date ? fd(bd) : (bd || gf(doc, 'birthday') || '')),
    gf(doc, 'city') || '', gf(doc, 'street') || '', gf(doc, 'floor') || '',
    gf(doc, 'apt') || '', gf(doc, 'zip') || '', gf(doc, 'notes') || ''
  ];
}

// ── Coupons ──
const couponHeaders = ['קוד','סוג','ערך','מגבלת שימוש','מקסימום למשתמש','שימושים','תוקף','נוצר','עודכן'];

function couponRow(doc) {
  return [
    gf(doc, 'code') || '', gf(doc, 'type') === 'percent' ? 'אחוז' : 'סכום קבוע',
    gf(doc, 'value') || 0, gf(doc, 'usageLimit') || 'ללא הגבלה',
    gf(doc, 'maxPerUser') || 'ללא הגבלה',
    gf(doc, 'usedCount') || 0, fd(gf(doc, 'expiryDate')), fdt(gf(doc, 'createdAt')), fdt(gf(doc, 'updatedAt'))
  ];
}

// ── Setup trigger (run once) ──
function setupAutoBackup() {
  // Remove old triggers
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  // Run at 00:00, 06:00, 12:00, 18:00
  [0, 6, 12, 18].forEach(hour => {
    ScriptApp.newTrigger('doBackup')
      .timeBased()
      .atHour(hour)
      .everyDays(1)
      .create();
  });
  Logger.log('Auto-backup triggers set: 00:00, 06:00, 12:00, 18:00');
}
