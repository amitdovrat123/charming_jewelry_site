import { db } from './firebase-config.js';
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const INQUIRIES_COL = 'artifacts/charming-3dd6f/public/data/inquiries';
const form = document.querySelector('.signup-section form');
if (form) {
  // Inquiry type toggle
  let selectedType = '';
  const typeBtns = form.querySelectorAll('.inquiry-type-btn');
  const workshopFields = document.getElementById('workshop-fields');
  typeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      typeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedType = btn.dataset.type;
      workshopFields.style.display = selectedType === 'workshop' ? '' : 'none';
      document.getElementById('err-inquiry-type').textContent = '';
    });
  });

  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    const name  = form.querySelector('#name').value.trim();
    const phone = form.querySelector('#phone').value.trim();
    const email = form.querySelector('#email').value.trim();

    const btn = form.querySelector('button[type="submit"]');
    const originalBtnText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'שולח...';

    // Validate
    ['err-name','err-phone','err-email','err-inquiry-type'].forEach(id => document.getElementById(id).textContent = '');
    let valid = true;
    function showErr(id, msg) { document.getElementById(id).textContent = msg; valid = false; }

    if (!selectedType) showErr('err-inquiry-type', 'יש לבחור סוג פנייה');
    if (!name || name.length < 2) showErr('err-name', 'יש להזין שם מלא');
    const cleanPhone = phone.replace(/[-\s]/g, '');
    if (!/^0\d{9}$/.test(cleanPhone)) showErr('err-phone', 'מספר טלפון חייב להתחיל ב-0 ולהכיל 10 ספרות');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) showErr('err-email', 'כתובת אימייל לא תקינה');
    if (!valid) { btn.disabled = false; btn.textContent = originalBtnText; return; }

    const data = {
      name, phone, email,
      message: form.querySelector('#message')?.value?.trim() || '',
      inquiryType: selectedType,
      source: 'workshops-contact-form',
      status: 'new',
      createdAt: serverTimestamp()
    };
    if (selectedType === 'workshop') {
      data.participants = form.querySelector('#participants')?.value || '';
      data.workshopType = form.querySelector('#workshop-type')?.value || '';
      data.date = form.querySelector('#date')?.value || '';
    }

    let success = false;
    try {
      await addDoc(collection(db, INQUIRIES_COL), data);
      success = true;
    } catch (ex) {
      console.error('Inquiry submit error:', ex);
    }

    btn.disabled = false;
    btn.textContent = originalBtnText;

    if (success) {
      form.reset();
      typeBtns.forEach(b => b.classList.remove('active'));
      selectedType = '';
      workshopFields.style.display = 'none';
      // Show success popup
      const overlay = document.createElement('div');
      overlay.className = 'inquiry-success-overlay';
      overlay.innerHTML = `
        <div class="inquiry-success-card">
          <button class="inquiry-success-close" aria-label="סגירה">&times;</button>
          <div class="inquiry-success-icon">&#10003;</div>
          <h3>תודה רבה שפנית אלינו</h3>
          <p>קיבלנו את פנייתך ונדאג לחזור אלייך בהקדם האפשרי.</p>
          <button class="btn inquiry-success-btn">סגירה</button>
        </div>`;
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('visible'));
      const closePopup = () => { overlay.classList.remove('visible'); setTimeout(() => overlay.remove(), 300); };
      overlay.querySelector('.inquiry-success-close').addEventListener('click', closePopup);
      overlay.querySelector('.inquiry-success-btn').addEventListener('click', closePopup);
      overlay.addEventListener('click', (ev) => { if (ev.target === overlay) closePopup(); });
    } else {
      // Show inline error if Firestore write failed
      const errDiv = document.createElement('div');
      errDiv.style.cssText = 'padding:12px 18px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;color:#b91c1c;font-size:0.9rem;text-align:center;margin-top:12px;';
      errDiv.textContent = 'אירעה שגיאה בשליחת הפנייה. נסי שוב או פני אלינו בוואצאפ.';
      form.appendChild(errDiv);
      setTimeout(() => errDiv.remove(), 6000);
    }
  });

  // Clear errors on typing
  [['name','err-name'],['phone','err-phone'],['email','err-email']].forEach(([fld,errId])=>{
    const input = form.querySelector('#'+fld);
    if (input) input.addEventListener('input', ()=>{ document.getElementById(errId).textContent=''; });
  });
}
