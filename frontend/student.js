document.addEventListener('DOMContentLoaded', () => {
  // 1. Auth Validation
  if (!Auth.isLoggedIn()) {
    showToast('Unauthorized access. Please login.', 'error');
    window.location.href = 'login.html';
    return;
  }

  const user = Auth.getUser();
  if (user.role === 'admin') {
    window.location.href = 'admin-dashboard.html';
    return;
  }

  // Prepopulate sidebar profile
  document.getElementById('student-name').innerText = user.name;
  document.getElementById('student-welcome-name').innerText = user.name;
  updateSidebarAvatar(user);

  // 2. Tab Navigation System
  const sidebarItems = document.querySelectorAll('.sidebar-item');
  const panels = document.querySelectorAll('.dashboard-panel');

  sidebarItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      
      sidebarItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      const target = item.getAttribute('data-target');
      panels.forEach(p => {
        p.classList.remove('active');
        if (p.id === target) {
          p.classList.add('active');
        }
      });
    });
  });

  // Wire Navbar Certificate link to switch directly to Certificate tab
  const navCertLink = document.getElementById('nav-certificate-link');
  const sidebarCertItem = document.getElementById('sidebar-cert-item');
  if (navCertLink && sidebarCertItem) {
    navCertLink.addEventListener('click', (e) => {
      e.preventDefault();
      sidebarCertItem.click();
    });
  }

  // 3. Load Portal Data
  loadDashboardData();

  // 4. Form Submit handlers
  const certForm = document.getElementById('certificate-form');
  if (certForm) {
    certForm.addEventListener('submit', handleCertificatePayment);
  }

  const certCourseSelect = document.getElementById('cert-course');
  if (certCourseSelect) {
    certCourseSelect.addEventListener('change', updateStudentCertPriceAndQR);
  }

  const coursePayForm = document.getElementById('course-payment-form');
  if (coursePayForm) {
    coursePayForm.addEventListener('submit', handleCoursePaymentSubmit);
  }

  // Profile photo input change label update
  const profilePicInput = document.getElementById('profile-pic-input');
  const profilePicFilename = document.getElementById('profile-pic-filename');
  if (profilePicInput && profilePicFilename) {
    profilePicInput.addEventListener('change', () => {
      const file = profilePicInput.files[0];
      profilePicFilename.innerText = file ? file.name : 'No file selected';
    });
  }

  // Profile photo form submission
  const profilePicForm = document.getElementById('profile-pic-form');
  if (profilePicForm) {
    profilePicForm.addEventListener('submit', handleProfilePicSubmit);
  }

  // Profile details form submission
  const profileDetailsForm = document.getElementById('profile-details-form');
  if (profileDetailsForm) {
    profileDetailsForm.addEventListener('submit', handleProfileDetailsSubmit);
  }
});

let dashboardData = {};
let activeCourseIdToPurchase = null;
let activeCoursePriceToPurchase = 0;
let activeCourseTitleToPurchase = '';

async function loadDashboardData() {
  const user = Auth.getUser();
  try {
    const data = await apiCall(`/student/dashboard/${user.id}`, 'GET', null, true);
    dashboardData = data;

    // Save updated user data from backend response
    if (data.user) {
      Auth.saveUser(data.user);
      // Update avatar with latest data
      updateSidebarAvatar(data.user);
      // Populate settings form
      populateProfileForm(data.user);
    }

    // Render student attendance data
    if (data.attendance) {
      renderStudentAttendance(data.attendance);
    }

    // Fetch all courses to show in available programs section
    const allCourses = await apiCall('/courses', 'GET', null, false);

    // A. Update Overview metrics
    document.getElementById('overview-purchased-count').innerText = data.purchasedCourses.length;
    document.getElementById('overview-pending-count').innerText = '0'; // Course purchases are direct now
    document.getElementById('overview-announcements-count').innerText = data.announcements.length;

    // B. Render Available Courses (All courses catalog directly on Overview Dashboard)
    renderAvailableCourses(allCourses, data.purchasedCourses);

    // C. Render Purchased Courses (My Courses Tab)
    renderActiveCourses(data.purchasedCourses);

    // D. Render Live Classes
    renderLiveClasses(data.purchasedCourses);

    // E. Render Notices
    renderNotices(data.notices);

    // F. Render Announcements board
    renderAnnouncements(data.announcements);

    // G. Render Recorded Classes catalog
    renderRecordedClasses(data.recordedClasses, data.purchasedCourses);

    // H. Render Payments History Table
    renderPayments(data.payments);

    // I. Render Certificate status view
    renderCertificateView(data.certificates, data.purchasedCourses);

  } catch (error) {
    console.error('Error fetching dashboard details:', error);
    showToast('Failed to load dashboard information.', 'error');
  }
}

// Render available courses on student dashboard overview
function renderAvailableCourses(courses, purchasedCourses) {
  const grid = document.getElementById('dashboard-available-courses');
  if (!grid) return;

  if (courses.length === 0) {
    grid.innerHTML = `<p style="color: var(--text-muted);">No programs available at the moment.</p>`;
    return;
  }

  const purchasedIds = purchasedCourses.map(c => c.id);

  grid.innerHTML = courses.map(c => {
    const isPurchased = purchasedIds.includes(c.id);
    const discount = (c.id === 'course_1' || c.id === 'course_3' || c.id === 'course_5' || c.id === 'course_7' || c.id === 'course_9') ? '10% OFF' : '5% OFF';
    return `
      <div class="glass-card course-card" style="padding: 20px; display: flex; flex-direction: column; justify-content: space-between; position: relative;">
        <div>
          <span class="course-card-badge" style="top: 12px; left: 12px; right: auto; font-size:10px; background: rgba(16, 185, 129, 0.15); color: var(--success); border: 1px solid var(--success);"><i class="fas fa-tags"></i> ${discount}</span>
          <span class="course-card-badge" style="top: 12px; right: 12px; font-size:10px;">${c.category.toUpperCase()}</span>
          <h4 style="font-size: 16px; margin-top: 16px; margin-bottom: 8px; color: var(--text-primary);">${c.title}</h4>
          <div class="course-meta" style="font-size: 11px; margin-bottom: 12px; gap: 10px;">
            <span><i class="far fa-clock"></i> ${c.duration}</span>
            <span><i class="fas fa-layer-group"></i> ${c.level}</span>
          </div>
          <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px; line-height:1.4;">${c.description}</p>
        </div>
        <div class="course-footer" style="padding-top: 12px; border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; flex-direction: column;">
            <span style="font-size: 18px; font-weight: 800; color: var(--text-primary);">₹${c.price}</span>
            <span style="font-size: 10px; color: var(--warning); font-weight: 700; margin-top: 2px; white-space: nowrap;"><i class="fas fa-fire"></i> First 10 Seats Special Discount</span>
          </div>
          ${isPurchased 
            ? `<button class="btn-secondary" style="padding: 6px 12px; font-size: 12px; border-color: var(--success); color: var(--success); cursor: default;" disabled>
                 Unlocked <i class="fas fa-check-circle"></i>
               </button>`
            : `<button onclick="openCoursePaymentModal('${c.id}', '${c.title.replace(/'/g, "\\'")}', ${c.price})" class="btn-primary" style="padding: 6px 12px; font-size: 12px;">
                 Buy Now <i class="fas fa-shopping-cart"></i>
               </button>`
          }
        </div>
      </div>
    `;
  }).join('');
}

// Render active course grid
function renderActiveCourses(purchasedCourses) {
  const container = document.getElementById('purchased-list-container');
  if (!container) return;

  if (purchasedCourses.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 40px;">
        <i class="fas fa-lock" style="font-size: 40px; color: var(--accent-color); margin-bottom: 12px;"></i>
        <p>No active courses found. Purchase a course from the Dashboard overview tab to unlock learning materials.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = purchasedCourses.map(c => `
    <div class="glass-card course-card">
      <span class="course-card-badge">${c.category.toUpperCase()}</span>
      <h3 class="course-title">${c.title}</h3>
      <div class="course-meta">
        <span><i class="far fa-clock"></i> ${c.duration}</span>
        <span><i class="fas fa-layer-group"></i> ${c.level}</span>
      </div>
      <p class="course-description">${c.description}</p>
      <div class="course-footer" style="justify-content: flex-end;">
        <span class="badge approved" style="padding: 8px 16px; font-size:12px;"><i class="fas fa-graduation-cap"></i> Enrolled & Active</span>
      </div>
    </div>
  `).join('');
}

// Render active live classes
function renderLiveClasses(purchasedCourses) {
  const container = document.getElementById('classes-list-container');
  const overviewLive = document.getElementById('overview-live-class');
  
  if (purchasedCourses.length === 0) {
    const emptyMsg = `
      <div style="text-align: center; color: var(--text-muted); padding: 24px;">
        <p>Please purchase an available program to attend live class sessions.</p>
      </div>
    `;
    if (container) container.innerHTML = emptyMsg;
    if (overviewLive) overviewLive.innerHTML = `<p style="color: var(--text-muted);">Purchase a course to attend live sessions.</p>`;
    return;
  }

  const liveHTML = `
    <div class="class-item" style="border-bottom: 1px solid var(--border-color); padding-bottom: 20px; margin-bottom: 20px;">
      <div class="class-item-header">
        <h3 class="class-title"><i class="fas fa-dot-circle" style="color: var(--danger); animation: glowPulse 1.5s infinite;"></i> DSA & Logic Building Masterclass</h3>
        <span class="badge approved">LIVE NOW</span>
      </div>
      <p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 16px;">Learn recursion and back-tracking optimization live with Ajay Shukla. Interactive code reviews.</p>
      <a href="https://meet.google.com/mock-sukla-meeting" target="_blank" class="btn-primary" style="align-self: flex-start;">
        Join Zoom/Google Meet <i class="fas fa-video"></i>
      </a>
    </div>
  `;

  if (container) {
    container.innerHTML = liveHTML + `
      <div class="class-item">
        <div class="class-item-header">
          <h3 class="class-title"><i class="far fa-clock"></i> React & Node Full Stack Workshop</h3>
          <span class="badge pending" style="background: rgba(59, 130, 246, 0.1); color: #3b82f6; border-color: rgba(59, 130, 246, 0.2);">TOMORROW 06:00 PM</span>
        </div>
        <p style="color: var(--text-secondary); font-size: 14px;">Building RESTful APIs and wiring Redux middleware logic.</p>
      </div>
    `;
  }

  if (overviewLive) {
    overviewLive.innerHTML = `
      <p style="margin-bottom:10px; font-weight:600;"><i class="fas fa-dot-circle" style="color: var(--danger);"></i> DSA & Logic Building Masterclass</p>
      <a href="https://meet.google.com/mock-sukla-meeting" target="_blank" class="btn-primary" style="font-size:11px; padding:6px 12px; display:inline-flex;">Join Live Session <i class="fas fa-external-link-alt"></i></a>
    `;
  }
}

// Render notices
function renderNotices(notices) {
  const container = document.getElementById('notices-list-container');
  if (!container) return;

  if (notices.length === 0) {
    container.innerHTML = `<div class="glass-card" style="padding: 24px; text-align: center; color: var(--text-secondary);">No notice releases posted.</div>`;
    return;
  }

  container.innerHTML = notices.map(n => `
    <div class="glass-card notice-item">
      <div class="notice-item-header">
        <h3 class="notice-title"><i class="fas fa-info-circle" style="color: var(--accent-color);"></i> ${n.title}</h3>
        <span class="notice-date">${n.date}</span>
      </div>
      <div class="notice-body">${n.description}</div>
    </div>
  `).join('');
}

// Render Announcements
function renderAnnouncements(announcements) {
  const container = document.getElementById('announcements-list-container');
  const overviewContainer = document.getElementById('overview-announcements-list');

  if (container) {
    if (announcements.length === 0) {
      container.innerHTML = `<div class="glass-card" style="padding: 24px; text-align: center; color: var(--text-secondary);">No announcements board entries.</div>`;
    } else {
      container.innerHTML = announcements.map(a => `
        <div class="glass-card announcement-item">
          <div class="notice-item-header" style="margin-bottom: 4px;">
            <span class="notice-title" style="font-size: 15px; font-weight: 600;"><i class="fas fa-comment-dots" style="color: #3b82f6;"></i> Announcement</span>
            <span class="announcement-date">${a.date}</span>
          </div>
          <div class="announcement-body">${a.message}</div>
        </div>
      `).join('');
    }
  }

  if (overviewContainer) {
    if (announcements.length === 0) {
      overviewContainer.innerHTML = `<p style="color: var(--text-muted); text-align: center; font-size:13px;">No announcements broadcasts.</p>`;
    } else {
      overviewContainer.innerHTML = announcements.slice(0, 3).map(a => `
        <div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
          <p style="font-size: 13px; color: var(--text-primary);">${a.message}</p>
          <span style="font-size: 11px; color: var(--text-muted);">${a.date}</span>
        </div>
      `).join('');
    }
  }
}

// Render Recorded Classes list
function renderRecordedClasses(recordedClasses, purchasedCourses) {
  const container = document.getElementById('recorded-list-container');
  if (!container) return;

  if (purchasedCourses.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 40px;">
        <i class="fas fa-lock" style="font-size: 40px; color: var(--accent-color); margin-bottom: 12px;"></i>
        <p>Purchase a course first to access the recorded video library.</p>
      </div>
    `;
    return;
  }

  if (recordedClasses.length === 0) {
    container.innerHTML = `<div style="grid-column:1/-1; text-align: center; color: var(--text-secondary); padding: 40px;">No recorded lectures posted yet.</div>`;
    return;
  }

  const activeCourseIds = purchasedCourses.map(c => c.id);
  const accessibleClasses = recordedClasses.filter(c => c.courseId === 'all' || activeCourseIds.includes(c.courseId));

  if (accessibleClasses.length === 0) {
    container.innerHTML = `<div style="grid-column:1/-1; text-align: center; color: var(--text-secondary); padding: 40px;">No lectures available for your enrolled programs.</div>`;
    return;
  }

  container.innerHTML = accessibleClasses.map(c => `
    <div class="glass-card" style="padding: 20px; display: flex; flex-direction: column; justify-content: space-between;">
      <div>
        <h4 style="font-size: 16px; margin-bottom: 8px;"><i class="fas fa-play-circle" style="color: var(--accent-color); margin-right: 6px;"></i> ${c.title}</h4>
        <span style="font-size: 12px; color: var(--text-muted); display: block; margin-bottom: 12px;">Uploaded: ${c.date}</span>
      </div>
      <a href="${c.link}" target="_blank" class="btn-primary" style="font-size: 13px; align-self: flex-start; padding: 8px 16px;">
        Watch Video <i class="fas fa-external-link-alt"></i>
      </a>
    </div>
  `).join('');
}

// Render Payments list
function renderPayments(payments) {
  const logsTbody = document.getElementById('payment-logs-tbody');
  if (!logsTbody) return;

  if (payments.length === 0) {
    logsTbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No transaction records found.</td></tr>`;
    return;
  }

  logsTbody.innerHTML = payments.map(p => `
    <tr>
      <td style="font-family: monospace; font-size: 12px;">${p.paymentId || 'MANUAL'}</td>
      <td style="font-weight: 600; color: var(--text-primary);">${p.courseName}</td>
      <td>₹${p.amount}</td>
      <td>${p.paymentType}</td>
      <td>${new Date(p.date).toLocaleDateString('en-IN')}</td>
      <td><span class="badge ${p.status === 'captured' ? 'approved' : (p.status === 'pending' ? 'pending' : 'failed')}">${p.status === 'captured' ? 'Received' : p.status}</span></td>
    </tr>
  `).join('');
}

// Render certificate display box
function renderCertificateView(certificates, purchasedCourses) {
  const container = document.getElementById('certificate-display-box');
  if (!container) return;

  // Requirement: Show message "You must complete payment for at least 1 course..." if no purchased courses
  if (purchasedCourses.length === 0) {
    container.innerHTML = `
      <div class="certificate-lock-container">
        <i class="fas fa-lock certificate-lock-icon" style="color: var(--text-muted); text-shadow: none; animation: none;"></i>
        <h3 class="certificate-title-locked">Certificate Locked</h3>
        <p class="certificate-text-locked" style="color: var(--danger); font-weight:600;">
          "You must complete payment for at least 1 course to request certificate."
        </p>
        <button class="btn-secondary" style="opacity: 0.5; cursor: not-allowed;" disabled>
          Unlock Certificate <i class="fas fa-key"></i>
        </button>
      </div>
    `;
    return;
  }

  const validCerts = certificates.filter(c => c.status === 'pending' || c.status === 'sent' || c.status === 'completed');

  if (validCerts.length > 0) {
    const isReady = validCerts[0].status === 'sent' || validCerts[0].status === 'completed';
    container.innerHTML = `
      <div class="certificate-unlocked-container">
        <i class="fas fa-check-circle certificate-unlocked-icon" style="${isReady ? 'color: var(--success);' : ''}"></i>
        <h3 class="certificate-title-unlocked">${isReady ? 'Certificate Ready!' : 'Certificate Order Placed!'}</h3>
        <div class="certificate-info-unlocked">
          <p style="font-size: 15px; margin-bottom: 12px; font-weight: 600;">
            ${isReady 
              ? 'Your certificate request is approved and generated. Check your email and WhatsApp!'
              : 'Thanks for payment. Your certificate will be sent on WhatsApp and Email.'
            }
          </p>
          <div style="text-align: left; font-size: 13px; color: var(--text-secondary); margin-top: 20px;">
            <p><strong>Candidate Name:</strong> ${validCerts[0].name}</p>
            <p><strong>Course Program:</strong> ${validCerts[0].courseName}</p>
            <p><strong>Type:</strong> ${validCerts[0].certType}</p>
            <p><strong>Status:</strong> <span class="badge ${isReady ? 'approved' : 'pending'}">${isReady ? 'Completed' : 'Processing'}</span></p>
          </div>
        </div>
      </div>
    `;
    return;
  }

  // Otherwise, unlock certificate request section (student has at least 1 active course)
  container.innerHTML = `
    <div class="certificate-lock-container">
      <i class="fas fa-lock certificate-lock-icon"></i>
      <h3 class="certificate-title-locked">Certificate Unlocked</h3>
      <p class="certificate-text-locked">You qualify for certifications! Fill out your official registry information and pay the standard certificate unlock fee.</p>
      <button onclick="openCertificateModal()" class="btn-primary">
        Unlock Certificate (Pay ₹499) <i class="fas fa-key"></i>
      </button>
    </div>
  `;

  // Prepopulate course options inside modal select
  const select = document.getElementById('cert-course');
  if (select) {
    select.innerHTML = purchasedCourses.map(c => `<option value="${c.title}">${c.title}</option>`).join('');
  }
}

// Course details modals
function openCoursePaymentModal(courseId, title, price) {
  activeCourseIdToPurchase = courseId;
  activeCourseTitleToPurchase = title;
  activeCoursePriceToPurchase = price;

  const modal = document.getElementById('course-payment-modal');
  const user = Auth.getUser();

  document.getElementById('course-pay-fullname').value = user.name;
  document.getElementById('course-pay-email').value = user.email;
  document.getElementById('course-pay-mobile').value = '';
  document.getElementById('course-pay-coursename').value = title;
  document.getElementById('course-pay-amount').value = price;

  // Clear previous screenshot selection
  const screenshotInput = document.getElementById('course-pay-screenshot');
  if (screenshotInput) screenshotInput.value = '';

  // Generate dynamic QR Code for course price
  const qrImg = document.getElementById('course-pay-qr-img');
  if (qrImg) {
    const upiUrl = `upi://pay?pa=7974271675-2@ybl&pn=Ajay%20Shukla&am=${price}&cu=INR&tn=Course%20Enrollment`;
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(upiUrl)}`;
  }

  modal.classList.add('active');
}

function closeCoursePaymentModal() {
  const modal = document.getElementById('course-payment-modal');
  if (modal) {
    modal.classList.remove('active');
  }
}

// Handle course payment form submission and upload screenshot proof
async function handleCoursePaymentSubmit(e) {
  e.preventDefault();

  const fullName = document.getElementById('course-pay-fullname').value.trim();
  const mobile = document.getElementById('course-pay-mobile').value.trim();
  const email = document.getElementById('course-pay-email').value.trim();
  const screenshotInput = document.getElementById('course-pay-screenshot');

  if (!fullName || !mobile || !email) {
    showToast('Please fill out all verification details.', 'error');
    return;
  }

  if (!screenshotInput || screenshotInput.files.length === 0) {
    showToast('Please upload a payment screenshot receipt.', 'error');
    return;
  }

  const file = screenshotInput.files[0];
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalBtnHTML = submitBtn.innerHTML;

  try {
    // Disable submit button & show loading state
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.7';
    submitBtn.innerHTML = 'Submitting Request... <i class="fas fa-spinner fa-spin"></i>';

    const formData = new FormData();
    formData.append('fullName', fullName);
    formData.append('mobile', mobile);
    formData.append('email', email);
    formData.append('courseId', activeCourseIdToPurchase);
    formData.append('courseName', activeCourseTitleToPurchase);
    formData.append('amount', activeCoursePriceToPurchase);
    formData.append('screenshot', file);

    const token = Auth.getToken();
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}/course-manual-request`, {
      method: 'POST',
      headers: headers,
      body: formData
    });

    const res = await response.json();
    if (!response.ok) {
      throw new Error(res.message || 'Submission failed.');
    }

    closeCoursePaymentModal();
    showToast(res.message, 'success');
    
    // Refresh student dashboard data
    await loadDashboardData();

  } catch (error) {
    showToast(error.message || 'Failed to submit course purchase request.', 'error');
  } finally {
    // Reset button state
    submitBtn.disabled = false;
    submitBtn.style.opacity = '1';
    submitBtn.innerHTML = originalBtnHTML;
  }
}

// Price mapping for course certificates
const CERT_PRICES = {
  'C Programming': 499,
  'C++ Programming': 699,
  'Python Programming': 799,
  'Java Core': 799,
  'Java Programming': 799,
  'C++ with DSA': 999,
  'DSA with C++': 999,
  'C with DSA': 899,
  'Web Development': 899,
  'MERN Stack': 999,
  'Web Designer': 1
};

function updateStudentCertPriceAndQR() {
  const courseSelect = document.getElementById('cert-course');
  const priceVal = document.getElementById('student-cert-price-value');
  const qrImg = document.getElementById('student-cert-qr-img');

  if (!courseSelect || !priceVal || !qrImg) return;

  const courseName = courseSelect.value;
  const price = CERT_PRICES[courseName] || 499;

  priceVal.innerText = '₹' + price;

  const upiUrl = `upi://pay?pa=7974271675-2@ybl&pn=Ajay%20Shukla&am=${price}&cu=INR&tn=Certificate%20Request`;
  qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(upiUrl)}`;
}

// Certificate claim modals
function openCertificateModal() {
  if (dashboardData.purchasedCourses.length === 0) {
    showToast('You must complete payment for at least 1 course to request certificate.', 'error');
    return;
  }

  const modal = document.getElementById('certificate-modal');
  const user = Auth.getUser();

  document.getElementById('cert-fullname').value = user.name;
  document.getElementById('cert-email').value = user.email;
  document.getElementById('cert-mobile').value = '';
  document.getElementById('cert-address').value = '';
  document.getElementById('cert-screenshot').value = '';

  modal.classList.add('active');

  // Trigger initial QR and price computation
  updateStudentCertPriceAndQR();
}

function closeCertificateModal() {
  const modal = document.getElementById('certificate-modal');
  if (modal) {
    modal.classList.remove('active');
  }
}

// Manual Certificate Claim payment trigger
async function handleCertificatePayment(e) {
  e.preventDefault();

  const fullName = document.getElementById('cert-fullname').value.trim();
  const mobile = document.getElementById('cert-mobile').value.trim();
  const email = document.getElementById('cert-email').value.trim();
  const courseName = document.getElementById('cert-course').value;
  const certificateType = document.getElementById('cert-type').value;
  const address = document.getElementById('cert-address').value.trim();
  const screenshotInput = document.getElementById('cert-screenshot');

  if (!fullName || !mobile || !email || !courseName || !certificateType || !address || screenshotInput.files.length === 0) {
    showToast('Please fill out all certificate form fields and upload the screenshot.', 'error');
    return;
  }

  // Mobile Validation: 10 digit number starting with 6-9
  const phoneRegex = /^[6-9]\d{9}$/;
  if (!phoneRegex.test(mobile)) {
    showToast('Please enter a valid 10-digit mobile number.', 'error');
    return;
  }

  const price = CERT_PRICES[courseName] || 499;

  const formData = new FormData();
  formData.append('fullName', fullName);
  formData.append('mobile', mobile);
  formData.append('email', email);
  formData.append('courseName', courseName);
  formData.append('certificateType', certificateType);
  formData.append('address', address);
  formData.append('amount', price);
  formData.append('screenshot', screenshotInput.files[0]);

  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalBtnHTML = submitBtn.innerHTML;

  try {
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.7';
    submitBtn.innerHTML = 'Submitting Request... <i class="fas fa-spinner fa-spin"></i>';

    const token = Auth.getToken();
    const response = await fetch(`${API_URL}/certificate-manual-request`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    const res = await response.json();
    if (!response.ok) {
      throw new Error(res.message || 'Submission failed.');
    }

    closeCertificateModal();
    showCertificateSuccessModal(fullName, courseName);
    
    // Refresh and display success view
    await loadDashboardData();

  } catch (error) {
    showToast(error.message || 'Failed to submit certificate request.', 'error');
    submitBtn.disabled = false;
    submitBtn.style.opacity = '1';
    submitBtn.innerHTML = originalBtnHTML;
  }
}

function showCertificateSuccessModal(name, course) {
  let modal = document.getElementById('cert-success-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'cert-success-modal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-content" style="text-align: center; max-width: 450px;">
      <div class="modal-body" style="padding: 40px 24px;">
        <div style="width: 72px; height: 72px; border-radius: 50%; background: rgba(16, 185, 129, 0.1); color: var(--success); display: flex; align-items: center; justify-content: center; margin: 0 auto 24px auto; font-size: 36px;">
          <i class="fas fa-check-circle"></i>
        </div>
        <h3 style="font-size: 22px; margin-bottom: 12px; font-family: var(--font-header);">Submission Successful!</h3>
        <p style="color: var(--text-secondary); font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
          Thank you for your submission! Your certificate request and payment proof have been received. We will verify and process your certificate within 24 hours.
        </p>
        <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color); border-radius: 8px; padding: 16px; margin-bottom: 28px; text-align: left; font-size: 13px;">
          <p style="margin-bottom: 6px;"><strong style="color: var(--text-secondary);">Student:</strong> <span style="color: var(--text-primary); float: right;">${name}</span></p>
          <p><strong style="color: var(--text-secondary);">Course:</strong> <span style="color: var(--text-primary); float: right;">${course}</span></p>
        </div>
        <button onclick="closeCertificateSuccessModal()" class="btn-primary" style="width: 100%; justify-content: center; padding: 12px;">
          Awesome! <i class="fas fa-thumbs-up" style="margin-left: 8px;"></i>
        </button>
      </div>
    </div>
  `;

  modal.classList.add('active');
}

function closeCertificateSuccessModal() {
  const modal = document.getElementById('cert-success-modal');
  if (modal) {
    modal.classList.remove('active');
  }
}

// ==========================================
// PROFILE MANAGEMENT HANDLERS & HELPERS
// ==========================================

function updateSidebarAvatar(user) {
  const avatarEl = document.getElementById('student-avatar');
  const displayEl = document.getElementById('profile-avatar-display');
  if (!avatarEl) return;

  if (user && user.profilePic) {
    const imgHTML = `<img src="${user.profilePic}" alt="${user.name}">`;
    avatarEl.innerHTML = imgHTML;
    if (displayEl) displayEl.innerHTML = imgHTML;
  } else {
    const initial = user && user.name ? user.name.charAt(0).toUpperCase() : 'S';
    avatarEl.innerHTML = initial;
    if (displayEl) displayEl.innerHTML = initial;
  }
}

function populateProfileForm(user) {
  const fullnameInput = document.getElementById('profile-fullname');
  const emailInput = document.getElementById('profile-email');
  const mobileInput = document.getElementById('profile-mobile');
  const githubInput = document.getElementById('profile-github');
  const linkedinInput = document.getElementById('profile-linkedin');
  const portfolioInput = document.getElementById('profile-portfolio');
  const socialBadges = document.getElementById('profile-social-badges');

  if (fullnameInput) fullnameInput.value = user.name || '';
  if (emailInput) emailInput.value = user.email || '';
  if (mobileInput) mobileInput.value = user.mobile || '';
  if (githubInput) githubInput.value = user.github || '';
  if (linkedinInput) linkedinInput.value = user.linkedin || '';
  if (portfolioInput) portfolioInput.value = user.portfolio || '';

  if (socialBadges) {
    socialBadges.innerHTML = `
      <span class="social-badge ${user.github ? 'connected' : 'missing'}">
        <i class="fab fa-github"></i> ${user.github ? 'GitHub Linked' : 'No GitHub'}
      </span>
      <span class="social-badge ${user.linkedin ? 'connected' : 'missing'}">
        <i class="fab fa-linkedin"></i> ${user.linkedin ? 'LinkedIn Linked' : 'No LinkedIn'}
      </span>
      <span class="social-badge ${user.portfolio ? 'connected' : 'missing'}">
        <i class="fas fa-globe"></i> ${user.portfolio ? 'Portfolio Linked' : 'No Portfolio'}
      </span>
    `;
  }
}

async function handleProfilePicSubmit(e) {
  e.preventDefault();
  const fileInput = document.getElementById('profile-pic-input');
  if (!fileInput || fileInput.files.length === 0) {
    showToast('Please select an image file first.', 'error');
    return;
  }

  const submitBtn = document.getElementById('profile-pic-submit-btn');
  const originalBtnHTML = submitBtn.innerHTML;

  const file = fileInput.files[0];
  const formData = new FormData();
  formData.append('profilePic', file);

  try {
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.7';
    submitBtn.innerHTML = 'Uploading... <i class="fas fa-spinner fa-spin"></i>';

    const token = Auth.getToken();
    const response = await fetch(`${API_URL}/student/profile-pic`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    const res = await response.json();
    if (!response.ok) {
      throw new Error(res.message || 'Failed to upload profile picture.');
    }

    showToast(res.message, 'success');
    
    // Update user locally
    Auth.saveUser(res.user);
    updateSidebarAvatar(res.user);
    
    // Reset file input label
    fileInput.value = '';
    document.getElementById('profile-pic-filename').innerText = 'No file selected';

  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.style.opacity = '1';
    submitBtn.innerHTML = originalBtnHTML;
  }
}

async function handleProfileDetailsSubmit(e) {
  e.preventDefault();

  const name = document.getElementById('profile-fullname').value.trim();
  const email = document.getElementById('profile-email').value.trim();
  const mobile = document.getElementById('profile-mobile').value.trim();
  const github = document.getElementById('profile-github').value.trim();
  const linkedin = document.getElementById('profile-linkedin').value.trim();
  const portfolio = document.getElementById('profile-portfolio').value.trim();

  const currentPassword = document.getElementById('profile-curr-pass').value;
  const newPassword = document.getElementById('profile-new-pass').value;
  const confPassword = document.getElementById('profile-conf-pass').value;

  if (!name || !email) {
    showToast('Name and Email are required.', 'error');
    return;
  }

  // Password checks if newPassword entered
  if (newPassword || confPassword) {
    if (!currentPassword) {
      showToast('Please enter your current password to set a new password.', 'error');
      return;
    }
    if (newPassword !== confPassword) {
      showToast('New password and confirm password do not match.', 'error');
      return;
    }
    if (newPassword.length < 6) {
      showToast('New password must be at least 6 characters.', 'error');
      return;
    }
  }

  // Mobile Validation (if not empty)
  if (mobile) {
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(mobile)) {
      showToast('Please enter a valid 10-digit mobile number.', 'error');
      return;
    }
  }

  const submitBtn = document.getElementById('profile-details-submit-btn');
  const originalBtnHTML = submitBtn.innerHTML;

  try {
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.7';
    submitBtn.innerHTML = 'Saving updates... <i class="fas fa-spinner fa-spin"></i>';

    const updateData = {
      name,
      email,
      mobile,
      github,
      linkedin,
      portfolio
    };

    if (newPassword) {
      updateData.currentPassword = currentPassword;
      updateData.newPassword = newPassword;
    }

    const res = await apiCall('/student/profile-update', 'PUT', updateData, true);
    showToast(res.message, 'success');

    // Save updated user locally
    Auth.saveUser(res.user);
    updateSidebarAvatar(res.user);
    populateProfileForm(res.user);

    // Update header displays
    document.getElementById('student-name').innerText = res.user.name;
    document.getElementById('student-welcome-name').innerText = res.user.name;

    // Reset password fields
    document.getElementById('profile-curr-pass').value = '';
    document.getElementById('profile-new-pass').value = '';
    document.getElementById('profile-conf-pass').value = '';

  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.style.opacity = '1';
    submitBtn.innerHTML = originalBtnHTML;
  }
}

function renderStudentAttendance(attendance) {
  const totalEl = document.getElementById('att-stat-total');
  const presentEl = document.getElementById('att-stat-present');
  const absentEl = document.getElementById('att-stat-absent');
  const pctEl = document.getElementById('att-stat-pct');
  const tbody = document.getElementById('student-attendance-tbody');

  if (totalEl) totalEl.innerText = attendance.summary.total;
  if (presentEl) presentEl.innerText = attendance.summary.present + attendance.summary.late;
  if (absentEl) absentEl.innerText = attendance.summary.absent;
  if (pctEl) pctEl.innerText = attendance.summary.percentage + '%';

  if (!tbody) return;

  if (attendance.records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 20px;">No attendance logs recorded yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = attendance.records.map(log => {
    // Determine badge class and display label
    let badgeClass = 'approved';
    let label = 'Present';

    if (log.status === 'absent') {
      badgeClass = 'failed';
      label = 'Absent';
    } else if (log.status === 'late') {
      badgeClass = 'pending';
      label = 'Late';
    }

    return `
      <tr>
        <td>${new Date(log.date).toLocaleDateString('en-IN')}</td>
        <td style="font-weight: 600; color: var(--text-primary);">${log.courseId}</td>
        <td><span class="badge ${badgeClass}">${label}</span></td>
      </tr>
    `;
  }).join('');
}
