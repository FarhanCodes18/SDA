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
  document.getElementById('student-avatar').innerText = user.name.charAt(0).toUpperCase();

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

  const coursePayForm = document.getElementById('course-payment-form');
  if (coursePayForm) {
    coursePayForm.addEventListener('submit', handleCoursePaymentSubmit);
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
    return `
      <div class="glass-card course-card" style="padding: 20px; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <span class="course-card-badge" style="top: 12px; right: 12px; font-size:10px;">${c.category.toUpperCase()}</span>
          <h4 style="font-size: 16px; margin-bottom: 8px; color: var(--text-primary);">${c.title}</h4>
          <div class="course-meta" style="font-size: 11px; margin-bottom: 12px; gap: 10px;">
            <span><i class="far fa-clock"></i> ${c.duration}</span>
            <span><i class="fas fa-layer-group"></i> ${c.level}</span>
          </div>
          <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px; line-height:1.4;">${c.description}</p>
        </div>
        <div class="course-footer" style="padding-top: 12px; border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 18px; font-weight: 800; color: var(--text-primary);">₹${c.price}</span>
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
      <p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 16px;">Learn recursion and back-tracking optimization live with Farhan Khan. Interactive code reviews.</p>
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
      <td><span class="badge ${p.status === 'captured' ? 'approved' : 'failed'}">${p.status}</span></td>
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

  const validCerts = certificates.filter(c => c.status === 'pending' || c.status === 'sent');

  if (validCerts.length > 0) {
    container.innerHTML = `
      <div class="certificate-unlocked-container">
        <i class="fas fa-check-circle certificate-unlocked-icon"></i>
        <h3 class="certificate-title-unlocked">Certificate Order Placed!</h3>
        <div class="certificate-info-unlocked">
          <p style="font-size: 15px; margin-bottom: 12px; font-weight: 600;">"Thanks for payment. Your certificate will be sent on WhatsApp and Email."</p>
          <div style="text-align: left; font-size: 13px; color: var(--text-secondary); margin-top: 20px;">
            <p><strong>Candidate Name:</strong> ${validCerts[0].name}</p>
            <p><strong>Course Program:</strong> ${validCerts[0].courseName}</p>
            <p><strong>Type:</strong> ${validCerts[0].certType}</p>
            <p><strong>Status:</strong> <span class="badge ${validCerts[0].status === 'sent' ? 'approved' : 'pending'}">${validCerts[0].status === 'sent' ? 'Sent' : 'Processing'}</span></p>
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

  modal.classList.add('active');
}

function closeCoursePaymentModal() {
  const modal = document.getElementById('course-payment-modal');
  if (modal) {
    modal.classList.remove('active');
  }
}

// Handle course payment form submission and launch Razorpay immediately
async function handleCoursePaymentSubmit(e) {
  e.preventDefault();

  const fullName = document.getElementById('course-pay-fullname').value.trim();
  const mobile = document.getElementById('course-pay-mobile').value.trim();
  const email = document.getElementById('course-pay-email').value.trim();

  if (!fullName || !mobile || !email) {
    showToast('Please fill out all verification details.', 'error');
    return;
  }

  try {
    closeCoursePaymentModal();
    showToast('Initializing payment checkout...', 'info');

    // 1. Create order on backend
    const orderData = await apiCall('/create-order', 'POST', {
      amount: activeCoursePriceToPurchase,
      currency: 'INR'
    }, true);

    // 2. Open Razorpay Checkout gateway immediately
    const options = {
      key: RAZORPAY_KEY_ID,
      amount: orderData.amount,
      currency: orderData.currency,
      name: 'Sukla Digital Academy',
      description: `Purchase Course: ${activeCourseTitleToPurchase}`,
      order_id: orderData.orderId,
      handler: async (response) => {
        try {
          // 3. Verify payment signature on backend
          await apiCall('/verify-payment', 'POST', {
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_signature: response.razorpay_signature,
            paymentType: 'Course Payment',
            courseId: activeCourseIdToPurchase,
            studentName: fullName,
            studentEmail: email,
            studentMobile: mobile,
            amount: activeCoursePriceToPurchase
          }, true);

          showToast('Payment successful. Your course has been unlocked.', 'success');
          
          // Reload dashboard data
          await loadDashboardData();

        } catch (err) {
          showToast(err.message || 'Payment signature verification failed.', 'error');
        }
      },
      prefill: {
        name: fullName,
        email: email,
        contact: mobile
      },
      theme: {
        color: '#ff4b2b'
      }
    };

    const rzp = new Razorpay(options);
    rzp.open();

  } catch (error) {
    showToast(error.message || 'Failed to initialize Razorpay checkout.', 'error');
  }
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

  modal.classList.add('active');
}

function closeCertificateModal() {
  const modal = document.getElementById('certificate-modal');
  if (modal) {
    modal.classList.remove('active');
  }
}

// Razorpay Certificate Claim payment trigger
async function handleCertificatePayment(e) {
  e.preventDefault();

  const fullName = document.getElementById('cert-fullname').value.trim();
  const mobile = document.getElementById('cert-mobile').value.trim();
  const email = document.getElementById('cert-email').value.trim();
  const courseName = document.getElementById('cert-course').value;
  const certificateType = document.getElementById('cert-type').value;
  const address = document.getElementById('cert-address').value.trim();

  if (!fullName || !mobile || !email || !courseName || !certificateType || !address) {
    showToast('Please fill out all certificate form fields.', 'error');
    return;
  }

  try {
    closeCertificateModal();
    showToast('Initializing certificate token payment...', 'info');

    // 1. Generate Order for Certificate (₹499)
    const orderData = await apiCall('/certificate-request', 'POST', {
      fullName, mobile, email, courseName, certificateType, address
    }, true);

    // 2. Launch Razorpay Checkout
    const options = {
      key: RAZORPAY_KEY_ID,
      amount: orderData.amount,
      currency: orderData.currency,
      name: 'Sukla Digital Academy',
      description: `Certificate Claim Payment`,
      order_id: orderData.orderId,
      handler: async (response) => {
        try {
          // 3. Confirm Payment and record Certificate details
          await apiCall('/verify-payment', 'POST', {
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_signature: response.razorpay_signature,
            paymentType: 'Certificate Payment',
            amount: 499,
            certificateDetails: {
              fullName,
              mobile,
              email,
              courseName,
              certificateType,
              address
            }
          }, true);

          showToast('Payment verified successfully!', 'success');
          
          // Refresh and display success view
          await loadDashboardData();

        } catch (err) {
          showToast(err.message || 'Verification failed. Contact support.', 'error');
        }
      },
      prefill: {
        name: fullName,
        email: email,
        contact: mobile
      },
      theme: {
        color: '#ff4b2b'
      }
    };

    const rzp = new Razorpay(options);
    rzp.open();

  } catch (error) {
    showToast(error.message || 'Failed to submit certificate request.', 'error');
  }
}
