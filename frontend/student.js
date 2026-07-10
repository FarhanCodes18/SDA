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

  // Quiz navigation listeners
  const quizPrevBtn = document.getElementById('quiz-prev-btn');
  if (quizPrevBtn) {
    quizPrevBtn.addEventListener('click', quizPrev);
  }

  const quizNextBtn = document.getElementById('quiz-next-btn');
  if (quizNextBtn) {
    quizNextBtn.addEventListener('click', quizNext);
  }

  const quizSubmitBtn = document.getElementById('quiz-submit-btn');
  if (quizSubmitBtn) {
    quizSubmitBtn.addEventListener('click', submitQuiz);
  }

  // Assignment submit form listener
  const assignSubmitForm = document.getElementById('assignment-submit-form');
  if (assignSubmitForm) {
    assignSubmitForm.addEventListener('submit', handleAssignmentSubmit);
  }
});

let dashboardData = {};
let activeCourseIdToPurchase = null;
let activeCoursePriceToPurchase = 0;
let activeCourseTitleToPurchase = '';

// Quiz system state variables
let studentQuizzesList = [];
let studentQuizResultsList = [];
let activeQuizData = null;
let currentQuestionIndex = 0;
let studentAnswers = [];

// Assignment state
let activeAssignmentData = null;

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
    renderAvailableCourses(allCourses, data.purchasedCourses, data.enrolledCourses);

    // C. Render Purchased Courses (My Courses Tab) — show all enrolled including pending
    renderActiveCourses(data.purchasedCourses, data.enrolledCourses);

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

    // J. Render Quizzes & MCQs
    studentQuizzesList = data.quizzes || [];
    studentQuizResultsList = data.quizResults || [];
    renderStudentQuizzesList();

    // K. Render Assignments
    renderAssignments(data.assignments || [], data.submissions || []);

    // L. Render Streak Tracker
    if (data.streak) {
      renderStreakTracker(data.streak);
    }

  } catch (error) {
    console.error('Error fetching dashboard details:', error);
    showToast('Failed to load dashboard information.', 'error');
  }
}

// Render available courses on student dashboard overview
function renderAvailableCourses(courses, purchasedCourses, enrolledCourses) {
  const grid = document.getElementById('dashboard-available-courses');
  if (!grid) return;

  if (courses.length === 0) {
    grid.innerHTML = `<p style="color: var(--text-muted);">No programs available at the moment.</p>`;
    return;
  }

  const purchasedIds = purchasedCourses.map(c => c.id);
  const enrolledIds = (enrolledCourses || []).map(c => c.id); // includes pending + approved

  grid.innerHTML = courses.map(c => {
    const isPurchased = purchasedIds.includes(c.id);
    const isPending = !isPurchased && enrolledIds.includes(c.id);
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
            : isPending
            ? `<button class="btn-secondary" style="padding: 6px 12px; font-size: 12px; border-color: var(--warning); color: var(--warning); cursor: not-allowed;" disabled>
                 <i class="fas fa-hourglass-half"></i> Awaiting Approval
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

// Render active course grid (with Progress Bars)
function renderActiveCourses(purchasedCourses, enrolledCourses) {
  const container = document.getElementById('purchased-list-container');
  if (!container) return;

  // Show all enrollments (approved + pending), fall back to purchasedCourses only
  const allEnrolled = (enrolledCourses && enrolledCourses.length > 0) ? enrolledCourses : purchasedCourses;

  if (allEnrolled.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 40px;">
        <i class="fas fa-lock" style="font-size: 40px; color: var(--accent-color); margin-bottom: 12px;"></i>
        <p>No active courses found. Purchase a course from the Dashboard overview tab to unlock learning materials.</p>
      </div>
    `;
    return;
  }

  const purchasedIds = purchasedCourses.map(c => c.id);

  container.innerHTML = allEnrolled.map(c => {
    const isApproved = purchasedIds.includes(c.id) || c.enrollmentStatus === 'approved';
    const progress = c.progress !== undefined ? c.progress : 0;

    // Determine progress milestone label
    let milestoneClass = 'not-started';
    let milestoneLabel = '🔒 Not Started';
    if (progress >= 100) { milestoneClass = 'completed'; milestoneLabel = '✅ Completed'; }
    else if (progress >= 75) { milestoneClass = 'almost'; milestoneLabel = '🏁 Almost Done'; }
    else if (progress > 0) { milestoneClass = 'in-progress'; milestoneLabel = '⚡ In Progress'; }

    const progressHTML = isApproved ? `
      <div class="course-progress-wrapper">
        <div class="course-progress-header">
          <span class="course-progress-label"><i class="fas fa-chart-line" style="color: var(--accent-color);"></i> Course Progress</span>
          <span class="course-progress-pct">${progress}%</span>
        </div>
        <div class="course-progress-bar-track">
          <div class="course-progress-bar-fill" style="width: 0%" data-target-width="${progress}%"></div>
        </div>
        <span class="progress-milestone ${milestoneClass}">${milestoneLabel}</span>
      </div>
    ` : '';

    return `
    <div class="glass-card course-card" style="${!isApproved ? 'opacity:0.88;' : ''}">
      <span class="course-card-badge">${c.category.toUpperCase()}</span>
      <h3 class="course-title">${c.title}</h3>
      <div class="course-meta">
        <span><i class="far fa-clock"></i> ${c.duration}</span>
        <span><i class="fas fa-layer-group"></i> ${c.level}</span>
      </div>
      <p class="course-description">${c.description}</p>
      <div class="course-footer" style="justify-content: flex-end;">
        ${isApproved
          ? `<span class="badge approved" style="padding: 8px 16px; font-size:12px;"><i class="fas fa-graduation-cap"></i> Enrolled &amp; Active</span>`
          : `<span class="badge pending" style="padding: 8px 16px; font-size:12px; background: rgba(234,179,8,0.1); color: var(--warning); border-color: rgba(234,179,8,0.3);">
               <i class="fas fa-hourglass-half"></i> Payment Under Review
             </span>`
        }
      </div>
      ${progressHTML}
      ${!isApproved ? `
      <div style="margin-top: 12px; padding: 12px; background: rgba(234,179,8,0.06); border: 1px solid rgba(234,179,8,0.2); border-radius: 8px; font-size: 12px; color: var(--warning); line-height:1.5;">
        <i class="fas fa-info-circle"></i> Your payment screenshot has been submitted. Once the admin approves it, full course access will be unlocked automatically.
      </div>` : ''}
    </div>
  `;
  }).join('');

  // Animate progress bars after render
  setTimeout(() => {
    document.querySelectorAll('.course-progress-bar-fill').forEach(bar => {
      const target = bar.getAttribute('data-target-width');
      if (target) bar.style.width = target;
    });
  }, 100);
}


// Render active live classes
function renderLiveClasses(purchasedCourses) {
  const container = document.getElementById('classes-list-container');
  const overviewLive = document.getElementById('overview-live-class');
  
  if (purchasedCourses.length === 0) {
    const emptyMsg = `
      <div style="text-align: center; color: var(--text-muted); padding: 32px;">
        <i class="fas fa-lock" style="font-size: 36px; color: var(--warning); margin-bottom: 12px; display:block;"></i>
        <p style="font-weight: 600; margin-bottom: 6px; color: var(--text-secondary);">Live Class Access Locked</p>
        <p style="font-size: 13px;">Purchase a course and wait for admin payment approval to join live sessions.</p>
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

  // Leave name, mobile, email BLANK — student must fill manually
  document.getElementById('course-pay-fullname').value = '';
  document.getElementById('course-pay-email').value = '';
  document.getElementById('course-pay-mobile').value = '';
  document.getElementById('course-pay-coursename').value = title;
  document.getElementById('course-pay-amount').value = price;

  // Clear previous screenshot selection
  const screenshotInput = document.getElementById('course-pay-screenshot');
  if (screenshotInput) screenshotInput.value = '';

  // Generate dynamic QR Code for course price
  const qrImg = document.getElementById('course-pay-qr-img');
  if (qrImg) {
    const upiUrl = `upi://pay?pa=9302677702@ybl&pn=Ajay%20Shukla&am=${price}&cu=INR&tn=Course%20Enrollment`;
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

  const upiUrl = `upi://pay?pa=9302677702@ybl&pn=Ajay%20Shukla&am=${price}&cu=INR&tn=Certificate%20Request`;
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

// ==========================================
// QUIZ PORTAL RENDERING & LOGIC
// ==========================================

function renderStudentQuizzesList() {
  const container = document.getElementById('quizzes-grid-container');
  if (!container) return;

  if (studentQuizzesList.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 40px;">
        <i class="fas fa-question-circle" style="font-size: 40px; color: var(--accent-color); margin-bottom: 12px;"></i>
        <p>No active quizzes available for your unlocked programs.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = studentQuizzesList.map(quiz => {
    const attempts = studentQuizResultsList.filter(r => r.quizId === quiz.id);
    attempts.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const latestAttempt = attempts[0];
    let attemptHTML = '';
    let btnText = 'Start Quiz';
    let btnIcon = 'fa-play';
    let btnClass = 'btn-primary';

    if (latestAttempt) {
      const isPass = latestAttempt.percentage >= 60;
      attemptHTML = `
        <div style="margin-top: 12px; font-size: 13px; color: var(--text-secondary);">
          <span>Last Score: <strong style="color: ${isPass ? 'var(--success)' : 'var(--danger)'};">${latestAttempt.score}/${latestAttempt.total} (${latestAttempt.percentage}%)</strong></span>
          <span class="badge ${isPass ? 'approved' : 'failed'}" style="margin-left: 8px; font-size: 10px; padding: 2px 6px;">${isPass ? 'Passed' : 'Failed'}</span>
        </div>
      `;
      btnText = 'Retake Quiz';
      btnIcon = 'fa-redo';
      btnClass = 'btn-secondary';
    }

    return `
      <div class="glass-card course-card" style="padding: 20px; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <span class="course-card-badge" style="background: rgba(255, 75, 43, 0.1); border-color: rgba(255,75,43,0.25); color: var(--accent-color); font-size:10px;">${quiz.courseId.toUpperCase()}</span>
          <h4 style="font-size: 16px; margin-top: 16px; margin-bottom: 8px; color: var(--text-primary);">${quiz.title}</h4>
          <div class="course-meta" style="font-size: 11px; margin-bottom: 12px; gap: 10px;">
            <span><i class="far fa-question-circle"></i> ${quiz.questions.length} MCQ Questions</span>
            <span><i class="fas fa-percentage"></i> Passing: 60%</span>
          </div>
          ${attemptHTML}
        </div>
        <div class="course-footer" style="padding-top: 12px; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end;">
          <button onclick="startQuiz('${quiz.id}')" class="${btnClass}" style="padding: 6px 12px; font-size: 12px;">
            ${btnText} <i class="fas ${btnIcon}" style="margin-left: 4px;"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function startQuiz(quizId) {
  const quiz = studentQuizzesList.find(q => q.id === quizId);
  if (!quiz) return;

  activeQuizData = quiz;
  currentQuestionIndex = 0;
  studentAnswers = new Array(quiz.questions.length).fill(null);

  document.getElementById('quiz-list-view').style.display = 'none';
  document.getElementById('quiz-result-view').style.display = 'none';
  document.getElementById('quiz-active-view').style.display = 'block';

  renderQuizQuestion();
}

function renderQuizQuestion() {
  if (!activeQuizData) return;

  const quest = activeQuizData.questions[currentQuestionIndex];
  
  document.getElementById('active-quiz-title').innerText = activeQuizData.title;
  document.getElementById('active-quiz-progress').innerText = `Question ${currentQuestionIndex + 1} of ${activeQuizData.questions.length}`;
  document.getElementById('quiz-question-text').innerText = `${currentQuestionIndex + 1}. ${quest.questionText}`;

  const wrapper = document.getElementById('quiz-options-wrapper');
  wrapper.innerHTML = quest.options.map((opt, idx) => {
    const isSelected = studentAnswers[currentQuestionIndex] === idx;
    const letter = String.fromCharCode(65 + idx);
    return `
      <div class="quiz-option-item ${isSelected ? 'selected' : ''}" onclick="selectQuizOption(${idx})">
        <div class="quiz-option-prefix">${letter}</div>
        <div>${opt}</div>
      </div>
    `;
  }).join('');

  const prevBtn = document.getElementById('quiz-prev-btn');
  const nextBtn = document.getElementById('quiz-next-btn');
  const submitBtn = document.getElementById('quiz-submit-btn');

  prevBtn.style.visibility = currentQuestionIndex === 0 ? 'hidden' : 'visible';

  if (currentQuestionIndex === activeQuizData.questions.length - 1) {
    nextBtn.style.display = 'none';
    submitBtn.style.display = 'inline-flex';
  } else {
    nextBtn.style.display = 'inline-flex';
    submitBtn.style.display = 'none';
  }
}

function selectQuizOption(optionIdx) {
  studentAnswers[currentQuestionIndex] = optionIdx;
  
  const optionItems = document.querySelectorAll('.quiz-option-item');
  optionItems.forEach((item, idx) => {
    if (idx === optionIdx) {
      item.classList.add('selected');
    } else {
      item.classList.remove('selected');
    }
  });
}

function quizNext() {
  if (currentQuestionIndex < activeQuizData.questions.length - 1) {
    currentQuestionIndex++;
    renderQuizQuestion();
  }
}

// Attach to window so onclick inline handlers can see them
window.startQuiz = startQuiz;
window.selectQuizOption = selectQuizOption;
window.backToQuizzesList = backToQuizzesList;

function quizPrev() {
  if (currentQuestionIndex > 0) {
    currentQuestionIndex--;
    renderQuizQuestion();
  }
}

async function submitQuiz() {
  const unanswered = studentAnswers.some(ans => ans === null);
  if (unanswered) {
    if (!confirm('You have unanswered questions. Are you sure you want to submit the test?')) {
      return;
    }
  }

  const submitBtn = document.getElementById('quiz-submit-btn');
  const originalHTML = submitBtn.innerHTML;

  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Submitting... <i class="fas fa-spinner fa-spin"></i>';

    const finalAnswers = studentAnswers.map(ans => ans === null ? -1 : ans);

    const res = await apiCall(`/quizzes/${activeQuizData.id}/submit`, 'POST', { answers: finalAnswers }, true);
    
    showToast(res.message, 'success');
    renderQuizResult(res.result);

  } catch (error) {
    showToast(error.message || 'Failed to submit quiz.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalHTML;
  }
}

function renderQuizResult(result) {
  document.getElementById('quiz-active-view').style.display = 'none';
  document.getElementById('quiz-result-view').style.display = 'block';

  const pct = result.percentage;
  const isPass = pct >= 60;

  const circle = document.getElementById('quiz-result-circle');
  circle.className = `result-score-circle ${isPass ? 'pass' : 'fail'}`;

  document.getElementById('quiz-result-pct').innerText = pct + '%';
  document.getElementById('quiz-result-score').innerText = `${result.score}/${result.total}`;

  const heading = document.getElementById('quiz-result-heading');
  const message = document.getElementById('quiz-result-message');

  if (isPass) {
    heading.innerText = 'Congratulations! You Passed!';
    message.innerText = `Great job! You scored ${result.score} out of ${result.total} questions correct and passed the test with a grade of ${pct}%.`;
    heading.style.color = 'var(--success)';
  } else {
    heading.innerText = 'Test Failed!';
    message.innerText = `You scored ${result.score} out of ${result.total} questions. The passing grade is 60%. Please study and try again.`;
    heading.style.color = 'var(--danger)';
  }

  const reviewContainer = document.getElementById('quiz-answer-review-container');
  reviewContainer.innerHTML = result.feedback.map((f, idx) => {
    const isCorrect = f.isCorrect;
    const statusIcon = isCorrect 
      ? `<i class="fas fa-check-circle" style="color: var(--success); margin-right: 6px;"></i>` 
      : `<i class="fas fa-times-circle" style="color: var(--danger); margin-right: 6px;"></i>`;

    const optionsList = f.options.map((opt, optIdx) => {
      let optClass = '';
      let optBadge = '';

      if (optIdx === f.correctAnswer) {
        optClass = 'correct';
        optBadge = ' <span class="badge approved" style="font-size:9px; padding:2px 6px; margin-left:8px;">Correct Answer</span>';
      } else if (optIdx === f.studentAnswer && !isCorrect) {
        optClass = 'incorrect-selected';
        optBadge = ' <span class="badge failed" style="font-size:9px; padding:2px 6px; margin-left:8px;">Your Selection</span>';
      } else if (optIdx === f.studentAnswer && isCorrect) {
        optBadge = ' <span class="badge approved" style="font-size:9px; padding:2px 6px; margin-left:8px;">Your Choice</span>';
      }

      return `
        <div class="review-option-item ${optClass}">
          <strong>${String.fromCharCode(65 + optIdx)}.</strong> ${opt} ${optBadge}
        </div>
      `;
    }).join('');

    return `
      <div class="review-question-card">
        <p style="font-weight: 600; font-size: 14px; color: var(--text-primary); margin-bottom: 8px;">
          ${statusIcon} Question ${idx + 1}: ${f.questionText}
        </p>
        <div style="padding-left: 20px;">
          ${optionsList}
        </div>
      </div>
    `;
  }).join('');
}

function backToQuizzesList() {
  document.getElementById('quiz-active-view').style.display = 'none';
  document.getElementById('quiz-result-view').style.display = 'none';
  document.getElementById('quiz-list-view').style.display = 'block';
  loadDashboardData();
}

// ==========================================
// ASSIGNMENTS: Render student assignments
// ==========================================
function renderAssignments(assignments, submissions) {
  const container = document.getElementById('assignments-grid-container');
  if (!container) return;

  if (assignments.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 60px 20px;">
        <i class="fas fa-file-alt" style="font-size: 48px; color: var(--text-muted); margin-bottom: 16px; display:block;"></i>
        <h3 style="font-size: 18px; margin-bottom: 8px; color: var(--text-primary);">No Assignments Yet</h3>
        <p>Your instructor hasn't posted any assignments. Check back later!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = assignments.map(a => {
    const submission = submissions.find(s => s.assignmentId === a.id);
    const today = new Date();
    const dueDate = a.dueDate ? new Date(a.dueDate) : null;
    const diffDays = dueDate ? Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24)) : null;

    let dueDateClass = '';
    let dueDateText = 'No due date';
    if (dueDate) {
      dueDateText = `Due: ${dueDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
      if (diffDays < 0) dueDateClass = 'due-date-overdue';
      else if (diffDays <= 3) dueDateClass = 'due-date-near';
    }

    let statusBadge = '<span class="badge-pending-sub"><i class="fas fa-clock"></i> Not Submitted</span>';
    let gradeHTML = '';
    let actionBtn = `<button onclick="openAssignmentModal('${a.id}')" class="btn-primary" style="font-size: 12px; padding: 8px 16px;">
      Submit <i class="fas fa-upload"></i>
    </button>`;

    if (submission) {
      if (submission.status === 'graded') {
        statusBadge = `<span class="badge-graded"><i class="fas fa-check-double"></i> Graded</span>`;
        gradeHTML = `
          <div class="grade-display-box">
            <div class="grade-score">${submission.marks} / ${a.maxMarks}</div>
            ${submission.feedback ? `<div class="grade-feedback"><i class="fas fa-comment" style="color:var(--success); margin-right:4px;"></i> ${submission.feedback}</div>` : ''}
          </div>
        `;
        actionBtn = '';
      } else {
        statusBadge = `<span class="badge-submitted"><i class="fas fa-paper-plane"></i> Submitted</span>`;
        actionBtn = '<button class="btn-secondary" style="font-size:12px; padding:8px 16px; cursor:not-allowed; opacity:0.6;" disabled>Already Submitted</button>';
      }
    }

    return `
      <div class="assignment-card">
        <div class="assignment-card-header">
          <span class="assignment-title">${a.title}</span>
          ${statusBadge}
        </div>
        <div class="assignment-meta">
          <span><i class="fas fa-star" style="color:var(--warning);"></i> Max Marks: <strong>${a.maxMarks}</strong></span>
          <span class="${dueDateClass}"><i class="fas fa-calendar-alt"></i> ${dueDateText}</span>
        </div>
        <p class="assignment-desc">${a.description}</p>
        ${gradeHTML}
        <div class="assignment-footer">
          <span style="font-size: 11px; color: var(--text-muted);"><i class="fas fa-user-tie"></i> By ${a.createdBy || 'Instructor'}</span>
          ${actionBtn}
        </div>
      </div>
    `;
  }).join('');
}

function openAssignmentModal(assignmentId) {
  const assignment = (dashboardData.assignments || []).find(a => a.id === assignmentId);
  if (!assignment) return;

  activeAssignmentData = assignment;
  document.getElementById('submit-assignment-id').value = assignmentId;
  document.getElementById('submit-modal-title').innerText = assignment.title;
  const dueDate = assignment.dueDate
    ? `Due: ${new Date(assignment.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
    : 'No due date set';
  document.getElementById('submit-modal-due').innerText = dueDate;
  document.getElementById('submit-file').value = '';
  document.getElementById('submit-notes').value = '';

  document.getElementById('assignment-submit-modal').classList.add('active');
}

function closeAssignmentModal() {
  document.getElementById('assignment-submit-modal').classList.remove('active');
  activeAssignmentData = null;
}

async function handleAssignmentSubmit(e) {
  e.preventDefault();

  const assignmentId = document.getElementById('submit-assignment-id').value;
  const fileInput = document.getElementById('submit-file');
  const notes = document.getElementById('submit-notes').value.trim();

  const submitBtn = e.target.querySelector('button[type="submit"]');
  const origHTML = submitBtn.innerHTML;

  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Submitting... <i class="fas fa-spinner fa-spin"></i>';

    const formData = new FormData();
    formData.append('notes', notes);
    if (fileInput.files.length > 0) {
      formData.append('file', fileInput.files[0]);
    }

    const token = Auth.getToken();
    const response = await fetch(`${API_URL}/assignments/${assignmentId}/submit`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });

    const res = await response.json();
    if (!response.ok) throw new Error(res.message || 'Submission failed.');

    closeAssignmentModal();
    showToast('Assignment submitted successfully! 🎉', 'success');
    await loadDashboardData();

  } catch (error) {
    showToast(error.message || 'Failed to submit assignment.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = origHTML;
  }
}

// ==========================================
// STREAK TRACKER: Render streak dashboard
// ==========================================
function renderStreakTracker(streak) {
  const current = streak.streak || 0;
  const longest = streak.longestStreak || 0;
  const lastLogin = streak.lastLoginDate;

  // Update hero card
  const countEl = document.getElementById('streak-current-count');
  const heroMsg = document.getElementById('streak-hero-msg');
  const statCurrent = document.getElementById('streak-stat-current');
  const statLongest = document.getElementById('streak-stat-longest');
  const statToday = document.getElementById('streak-stat-today');

  if (countEl) countEl.innerText = current;
  if (statCurrent) statCurrent.innerText = current;
  if (statLongest) statLongest.innerText = longest;
  if (statToday && lastLogin) {
    const d = new Date(lastLogin);
    statToday.innerText = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  }

  if (heroMsg) {
    if (current === 0) {
      heroMsg.innerText = 'Login every day to start your streak!';
    } else if (current < 7) {
      heroMsg.innerText = `🔥 Keep going! ${7 - current} more days to earn the Week Warrior badge!`;
    } else if (current < 30) {
      heroMsg.innerText = `⚡ Amazing! ${30 - current} more days to earn the Monthly Champion badge!`;
    } else {
      heroMsg.innerText = `🏆 Incredible dedication! You're a learning legend!`;
    }
  }

  // Milestone badges configuration
  const MILESTONES = [
    { days: 1,   icon: '🌱', name: 'First Step',      req: '1 day streak' },
    { days: 3,   icon: '⚡', name: 'Getting Warm',    req: '3 day streak' },
    { days: 7,   icon: '🔥', name: 'Week Warrior',    req: '7 day streak' },
    { days: 14,  icon: '💪', name: 'Fortnight Force', req: '14 day streak' },
    { days: 30,  icon: '🏆', name: 'Monthly Champ',   req: '30 day streak' },
    { days: 60,  icon: '🚀', name: 'Rocket Scholar',  req: '60 day streak' },
    { days: 100, icon: '🌟', name: 'Century Star',    req: '100 day streak' },
    { days: 365, icon: '👑', name: 'Legend',          req: '365 day streak' },
  ];

  const badgesGrid = document.getElementById('streak-badges-grid');
  if (!badgesGrid) return;

  badgesGrid.innerHTML = MILESTONES.map(m => {
    const unlocked = current >= m.days;
    return `
      <div class="streak-badge-card ${unlocked ? 'unlocked' : 'locked'}">
        ${unlocked ? '<div class="unlocked-check"><i class="fas fa-check"></i></div>' : ''}
        <span class="badge-icon">${m.icon}</span>
        <span class="badge-name">${m.name}</span>
        <span class="badge-req">${m.req}</span>
      </div>
    `;
  }).join('');
}

