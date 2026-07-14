document.addEventListener('DOMContentLoaded', () => {
  // 1. Auth Validation
  if (!Auth.isLoggedIn()) {
    showToast('Unauthorized access. Please login.', 'error');
    window.location.href = 'login.html';
    return;
  }

  const user = Auth.getUser();
  if (user.role !== 'admin') {
    window.location.href = 'student-dashboard.html';
    return;
  }

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

  // 3. Load Admin Workspace Data
  loadAdminData().then(async () => {
    try {
      const db = await getFirestoreDB();
      let isFirstUserLoad = true;
      let isFirstPaymentLoad = true;
      let isFirstEnrollmentLoad = true;
      let isFirstCertLoad = true;
      let isFirstContactLoad = true;

      let isFirstCourseLoad = true;

      db.collection('users').onSnapshot(() => {
        if (isFirstUserLoad) { isFirstUserLoad = false; return; }
        console.log("Real-time update: users collection changed. Refreshing dashboard...");
        loadAdminData();
      });
      db.collection('courses').onSnapshot(() => {
        if (isFirstCourseLoad) { isFirstCourseLoad = false; return; }
        console.log("Real-time update: courses collection changed. Refreshing dashboard...");
        loadAdminData();
      });
      db.collection('payments').onSnapshot(() => {
        if (isFirstPaymentLoad) { isFirstPaymentLoad = false; return; }
        console.log("Real-time update: payments collection changed. Refreshing dashboard...");
        loadAdminData();
      });
      db.collection('enrollments').onSnapshot(() => {
        if (isFirstEnrollmentLoad) { isFirstEnrollmentLoad = false; return; }
        console.log("Real-time update: enrollments collection changed. Refreshing dashboard...");
        loadAdminData();
      });
      db.collection('certificates').onSnapshot(() => {
        if (isFirstCertLoad) { isFirstCertLoad = false; return; }
        console.log("Real-time update: certificates collection changed. Refreshing dashboard...");
        loadAdminData();
      });
      db.collection('contacts').onSnapshot(() => {
        if (isFirstContactLoad) { isFirstContactLoad = false; return; }
        console.log("Real-time update: contacts collection changed. Refreshing dashboard...");
        loadAdminData();
      });
    } catch (e) {
      console.error("Failed to setup Firestore real-time listeners:", e);
    }
  });

  // Auto-refresh when admin switches back to this tab
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      console.log("Tab became active. Refreshing admin dashboard...");
      loadAdminData();
    }
  });

  // Add Certificate Filter Listener
  const certFilter = document.getElementById('admin-cert-filter');
  if (certFilter) {
    certFilter.addEventListener('change', () => {
      if (adminData && adminData.certificates) {
        renderCertificates(adminData.certificates);
      }
    });
  }

  // 4. Form Submit Listeners
  const addCourseForm = document.getElementById('add-course-form');
  if (addCourseForm) addCourseForm.addEventListener('submit', handleAddCourse);

  const editCourseForm = document.getElementById('edit-course-form');
  if (editCourseForm) editCourseForm.addEventListener('submit', handleEditCourse);

  const addNoticeForm = document.getElementById('add-notice-form');
  if (addNoticeForm) addNoticeForm.addEventListener('submit', handleAddNotice);

  const addAnnForm = document.getElementById('add-ann-form');
  if (addAnnForm) addAnnForm.addEventListener('submit', handleAddAnnouncement);

  const addRecordedForm = document.getElementById('add-recorded-form');
  if (addRecordedForm) addRecordedForm.addEventListener('submit', handleAddRecordedClass);

  const manualPaymentForm = document.getElementById('manual-payment-form');
  if (manualPaymentForm) manualPaymentForm.addEventListener('submit', handleManualPaymentUpdate);

  const addAchieverForm = document.getElementById('add-achiever-form');
  if (addAchieverForm) addAchieverForm.addEventListener('submit', handleAddAchiever);
  
  // Quiz Form submission
  const quizForm = document.getElementById('quiz-form');
  if (quizForm) {
    quizForm.addEventListener('submit', handleQuizFormSubmit);
  }

  // Set attendance date to today
  const attDateInput = document.getElementById('att-date-input');
  if (attDateInput) {
    const today = new Date().toISOString().split('T')[0];
    attDateInput.value = today;
  }

  // Attendance Sheet load form submission
  const attControlForm = document.getElementById('attendance-control-form');
  if (attControlForm) {
    attControlForm.addEventListener('submit', handleLoadAttendanceSheet);
  }

  // Save Attendance Sheet click listener
  const saveAttBtn = document.getElementById('save-attendance-btn');
  if (saveAttBtn) {
    saveAttBtn.addEventListener('click', handleSaveAttendanceSheet);
  }

  // Assignment form listener
  const addAssignForm = document.getElementById('add-assignment-form');
  if (addAssignForm) addAssignForm.addEventListener('submit', handleAddAssignment);
});

let adminData = {};
let quizzesList = [];
let quizResultsList = [];

async function loadAdminData() {
  try {
    const data = await apiCall('/admin/data', 'GET', null, true);
    adminData = data;

    // Sync Firestore data back to local backend JSON storage if running on localhost
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      apiCall('/admin/sync?bypass=true', 'POST', {
        students: data.students,
        payments: data.payments,
        enrollments: data.enrollments,
        certificates: data.certificates
      }, true).catch(err => console.warn('Local background database sync failed:', err));
    }

    // A. Update Overview metrics
    document.getElementById('stat-revenue').innerText = '₹' + data.stats.totalRevenue;
    document.getElementById('stat-students').innerText = data.stats.totalStudents;
    document.getElementById('stat-courses').innerText = data.stats.totalCourses;
    document.getElementById('stat-contacts').innerText = data.stats.totalContacts;
    document.getElementById('stat-registrations').innerText = data.stats.totalStudents;
    document.getElementById('stat-payments-count').innerText = data.stats.totalPayments;

    // B. Populate Overview recent logs
    renderOverviewLogs(data.payments, data.certificates);

    // C. Populate Students table
    renderStudents(data.students, data.archivedStudents || []);

    // D. Populate Course grid
    renderCourses(data.courses);

    // E. Populate Course options select dropdowns
    populateCourseDropdowns(data.courses);

    // F. Populate Enrollments table
    renderEnrollments(data.enrollments, data.courses);
    
    // F2. Populate Demo Requests table
    renderDemoRequests(data.enrollments);

    // G. Populate Payments table
    renderPayments(data.payments);

    // H. Populate Certificate Claims queue
    renderCertificates(data.certificates);

    // I. Populate Contact Messages table
    renderContacts(data.contacts);

    // J. Populate Notice logs
    renderNotices(data.notices);

    // K. Populate Announcement logs
    renderAnnouncements(data.announcements);
    
    // K2. Populate Live Classes
    renderLiveClassesAdmin(data.liveClasses || [], data.courses || []);

    // L. Populate Video Lectures list
    renderRecordedClasses(data.recordedClasses);

    // M. Populate Placement Achievers list
    renderAdminAchievers(data.achievers);

    // N. Populate Quizzes List & Logs
    quizzesList = data.quizzes || [];
    quizResultsList = data.quizResults || [];
    renderAdminQuizzes();
    renderQuizResultsLogs();
    populateQuizCourseDropdown(data.courses);

    // O. Populate Assignments Manager
    renderAdminAssignments(data.assignments || [], data.courses || []);
    renderAdminSubmissions(data.submissions || [], data.assignments || []);

    // P. Populate Feedbacks
    renderFeedbacks(data.feedbacks || []);

  } catch (error) {
    console.error('Error fetching admin data:', error);
    showToast('Failed to load admin panel data.', 'error');
  }
}

// Render Overview Logs
function renderOverviewLogs(payments, certificates) {
  const payTbody = document.getElementById('overview-payments-tbody');
  const certTbody = document.getElementById('overview-certificates-tbody');

  if (payTbody) {
    const recentPay = payments.slice(0, 5);
    if (recentPay.length === 0) {
      payTbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No payment logs.</td></tr>`;
    } else {
      payTbody.innerHTML = recentPay.map(p => `
        <tr>
          <td style="font-weight: 600; color: var(--text-primary);">${p.studentName}</td>
          <td>${p.courseName}</td>
          <td>₹${p.amount}</td>
          <td>
            ${p.screenshot 
              ? `<a href="${p.screenshot}" target="_blank" class="btn-secondary" style="padding: 4px 8px; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;"><i class="fas fa-image"></i> View Receipt</a>` 
              : '<span style="color: var(--text-muted);">N/A</span>'
            }
          </td>
          <td><span class="badge ${p.status === 'captured' ? 'approved' : (p.status === 'pending' ? 'pending' : 'failed')}">${p.status === 'captured' ? 'Received' : p.status}</span></td>
          <td>
            ${p.status === 'pending'
              ? `<button onclick="approvePaymentDirectly('${p.id}')" class="btn-primary" style="padding: 4px 8px; font-size: 11px; background: var(--success); border-color: var(--success); box-shadow: none;">
                   Approve
                 </button>`
              : '<span style="color: var(--text-muted); font-size: 11px;">N/A</span>'
            }
          </td>
        </tr>
      `).join('');
    }
  }

  if (certTbody) {
    const recentCert = certificates.slice(0, 5);
    if (recentCert.length === 0) {
      certTbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">No certificate claims.</td></tr>`;
    } else {
      certTbody.innerHTML = recentCert.map(c => {
        const isCompleted = c.status === 'sent' || c.status === 'completed';
        return `
          <tr>
            <td style="font-weight: 600; color: var(--text-primary);">${c.name}</td>
            <td>${c.address.split(',').pop().trim() || 'BALAGHAT'}</td>
            <td><span class="badge ${isCompleted ? 'approved' : 'pending'}">${isCompleted ? 'Completed' : 'Pending'}</span></td>
          </tr>
        `;
      }).join('');
    }
  }
}

// Render Students
function renderStudents(students, archivedStudents) {
  const tbody = document.getElementById('students-tbody');
  if (!tbody) return;

  if (students.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 32px;">No active students registered yet.</td></tr>`;
  } else {
    tbody.innerHTML = students.map(s => `
    <tr>
      <td style="font-family: monospace; font-size:12px;">${s.id}</td>
      <td style="font-weight: 600; color: var(--text-primary);">${s.name}</td>
      <td>${s.email}</td>
      <td style="font-family: monospace; font-size: 13px; color: var(--accent-color);">${s.plainPassword || s.password || '<span style="color:var(--text-muted)">N/A</span>'}</td>
      <td>${s.mobile || '<span style="color:var(--text-muted)">N/A</span>'}</td>
      <td>${new Date(s.createdAt).toLocaleDateString('en-IN')}</td>
      <td>
        <div style="display: flex; gap: 8px;">
          <button onclick="openStudentDetailsModal('${s.id}')" class="btn-secondary" style="padding: 6px 12px; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;">
            <i class="fas fa-eye"></i> View
          </button>
          <button onclick="handleDeleteStudent('${s.id}')" class="btn-primary" style="background: var(--danger); border-color: var(--danger); box-shadow: none; padding: 6px 12px; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;">
            <i class="fas fa-trash-alt"></i> Delete
          </button>
        </div>
      </td>
    </tr>
  `).join('');
  }

  // — Archived Students Section —
  const archiveContainer = document.getElementById('archived-students-section');
  if (!archiveContainer) return;

  if (!archivedStudents || archivedStudents.length === 0) {
    archiveContainer.style.display = 'none';
    return;
  }

  archiveContainer.style.display = 'block';
  const archiveTbody = document.getElementById('archived-students-tbody');
  if (!archiveTbody) return;

  archiveTbody.innerHTML = archivedStudents.map(s => `
    <tr style="opacity: 0.7;">
      <td style="font-family: monospace; font-size:12px;">${s.id}</td>
      <td style="font-weight: 600; color: var(--text-primary);">${s.name}</td>
      <td>${s.email}</td>
      <td>${s.mobile || '<span style="color:var(--text-muted)">N/A</span>'}</td>
      <td style="color: var(--danger); font-size:11px;">${s.archivedAt ? new Date(s.archivedAt).toLocaleDateString('en-IN') : 'N/A'}</td>
      <td>
        <button onclick="handleRestoreStudent('${s.id}')" class="btn-secondary" style="padding: 6px 14px; font-size: 11px; display: inline-flex; align-items: center; gap: 4px; border-color: #16a34a; color: #16a34a;">
          <i class="fas fa-undo"></i> Restore
        </button>
      </td>
    </tr>
  `).join('');
}

// ── Archive All Active Students (Soft Delete) ────────────────────────────────
async function handleClearAllStudents() {
  const confirmed = confirm(
    '⚠️ ARCHIVE ALL STUDENTS\n\nYeh students ko archive karega (permanently delete NAHI karega).\n\nArchive section mein dekh sakte hain aur restore bhi kar sakte hain.\n\nAre you sure?'
  );
  if (!confirmed) return;

  const btn = document.getElementById('clear-all-students-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Archiving...';
  }

  try {
    const db = await getFirestoreDB();

    // Get all non-admin, currently active users from Firebase
    const usersSnap = await db.collection('users').get({ source: 'server' });
    const archivePromises = [];

    usersSnap.forEach(doc => {
      const data = doc.data();
      if (data.role !== 'admin' && data.isActive !== false) {
        // SOFT DELETE — mark as archived, never erase from Firebase
        archivePromises.push(doc.ref.update({
          isActive: false,
          archivedAt: new Date().toISOString(),
          archivedByAdmin: true
        }));
      }
    });

    await Promise.all(archivePromises);

    showToast(`✅ ${archivePromises.length} student(s) archived. Data preserved in Firebase.`, 'success');
    await loadAdminData();

  } catch (err) {
    console.error('Archive all students error:', err);
    showToast('Failed to archive students: ' + err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-archive"></i> Archive All Students';
    }
  }
}

// ── Restore a single archived student ────────────────────────────────────────
async function handleRestoreStudent(studentId) {
  try {
    const db = await getFirestoreDB();
    await db.collection('users').doc(studentId).update({
      isActive: true,
      restoredAt: new Date().toISOString()
    });
    showToast('✅ Student restored successfully!', 'success');
    await loadAdminData();
  } catch (err) {
    showToast('Failed to restore student: ' + err.message, 'error');
  }
}



// Render Courses Grid
function renderCourses(courses) {
  const grid = document.getElementById('admin-courses-grid');
  if (!grid) return;

  if (courses.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1; text-align: center; color: var(--text-muted);">No courses created yet.</div>`;
    return;
  }

  grid.innerHTML = courses.map(c => `
    <div class="glass-card course-card">
      <span class="course-card-badge">${c.category.toUpperCase()}</span>
      <h3 class="course-title">${c.title}</h3>
      <div class="course-meta">
        <span><i class="far fa-clock"></i> ${c.duration}</span>
        <span><i class="fas fa-layer-group"></i> ${c.level}</span>
      </div>
      <p class="course-description">${c.description}</p>
      <div class="course-footer" style="gap: 12px; align-items: center;">
        <div class="course-pricing" style="margin-right: auto;">
          <span class="course-price-current">₹${c.price}</span>
        </div>
        <button onclick="openEditCourseModal('${c.id}')" class="btn-secondary" style="padding: 6px 12px; font-size: 12px;">
          <i class="fas fa-edit"></i> Edit
        </button>
        <button onclick="handleDeleteCourse('${c.id}')" class="btn-primary" style="background: var(--danger); box-shadow: none; padding: 6px 12px; font-size: 12px;">
          <i class="fas fa-trash"></i> Delete
        </button>
      </div>
    </div>
  `).join('');
}

// Populate course select options
function populateCourseDropdowns(courses) {
  const select = document.getElementById('rec-course');
  const attSelect = document.getElementById('att-course-select');
  const asgnSelect = document.getElementById('asgn-course');

  if (select) {
    select.innerHTML = `<option value="all">Accessible to All Students</option>`;
    courses.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.innerText = c.title;
      select.appendChild(opt);
    });
  }

  if (attSelect) {
    attSelect.innerHTML = `<option value="" disabled selected>Select Course Batch</option>`;
    courses.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.innerText = c.title;
      attSelect.appendChild(opt);
    });
  }

  if (asgnSelect) {
    asgnSelect.innerHTML = `<option value="all">All Students</option>`;
    courses.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.innerText = c.title;
      asgnSelect.appendChild(opt);
    });
  }
}

// Render Enrollments
function renderEnrollments(enrollments, courses) {
  const tbody = document.getElementById('enrollments-tbody');
  if (!tbody) return;

  if (enrollments.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted);">No course enrollment requests found.</td></tr>`;
    return;
  }

  tbody.innerHTML = enrollments.map(e => {
    const course = courses.find(c => c.id === e.courseId);
    const courseTitle = course ? course.title : e.courseId;

    // Fallback: try to find payment with matching student and course
    const matchingPayment = adminData.payments?.find(p => 
      p.studentId === e.studentId && 
      (p.courseName === courseTitle || p.courseName === e.courseId) && 
      p.paymentType === 'Course Payment'
    );
    
    const screenshot = e.screenshot || matchingPayment?.screenshot;
    const paymentId = matchingPayment?.id;
    const progress = e.progress !== undefined ? e.progress : 0;
    const progressInputId = `progress-${e.id}`;

    // Streak info for this student
    const studentData = adminData.students?.find(s => s.id === e.studentId);
    const streak = studentData?.streak || 0;

    return `
      <tr>
        <td>
          <div style="font-weight: 600; color: var(--text-primary);">${e.studentName}</div>
          <div style="font-size:12px; color:var(--text-muted);">${e.studentEmail} &bull; ${e.studentMobile}</div>
          ${streak > 0 ? `<span class="streak-admin-badge" style="margin-top:4px;"><i class="fas fa-fire"></i> ${streak} Day Streak</span>` : ''}
        </td>
        <td>${e.address || 'N/A'}</td>
        <td style="font-weight: 600;">${courseTitle}</td>
        <td>${new Date(e.createdAt).toLocaleDateString('en-IN')}</td>
        <td>
          ${screenshot 
            ? `<a href="${screenshot}" target="_blank" class="btn-secondary" style="padding: 4px 8px; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;"><i class="fas fa-image"></i> View Receipt</a>` 
            : '<span style="color: var(--text-muted);">No proof uploaded</span>'
          }
        </td>
        <td><span class="badge ${e.status === 'approved' ? 'approved' : 'pending'}">${e.status}</span></td>
        <td>
          <button onclick="handleDeleteEnrollment('${e.id}')" title="Delete Enrollment" class="btn-primary" style="background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); color: var(--danger); box-shadow: none; padding: 6px 12px; font-size: 11px;">
            <i class="fas fa-trash"></i> Delete
          </button>
        </td>
        <td>
          ${e.status === 'approved' ? `
            <div style="min-width:160px;">
              <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;">
                <div class="course-progress-bar-track" style="flex:1; height:6px;">
                  <div class="course-progress-bar-fill" style="width:${progress}%;"></div>
                </div>
                <span style="font-size:12px; font-weight:800; color:var(--accent-color); min-width:30px;">${progress}%</span>
              </div>
              <div class="progress-update-row">
                <input type="number" id="${progressInputId}" value="${progress}" min="0" max="100" placeholder="0-100">
                <button onclick="updateEnrollmentProgress('${e.id}', '${progressInputId}')" class="btn-primary" style="font-size:11px; padding:5px 10px;">Set</button>
              </div>
            </div>
          ` : '<span style="color:var(--text-muted); font-size:12px;">Pending approval</span>'}
        </td>
        <td>
          ${e.status === 'pending' && paymentId
            ? `<button onclick="approvePaymentDirectly('${paymentId}')" class="btn-primary" style="padding: 6px 12px; font-size: 11px; background: var(--success); border-color: var(--success); box-shadow: none;">
                 <i class="fas fa-check"></i> Approve
               </button>`
            : '<span style="color: var(--text-muted); font-size: 11px;">N/A</span>'
          }
        </td>
      </tr>
    `;
  }).join('');
}


// Render Payments Logs
function renderPayments(payments) {
  const tbody = document.getElementById('payments-tbody');
  if (!tbody) return;

  if (payments.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align: center; color: var(--text-muted);">No payment logs found.</td></tr>`;
    return;
  }

  tbody.innerHTML = payments.map(p => `
    <tr>
      <td style="font-weight: 600; color: var(--text-primary);">${p.studentName}</td>
      <td>${p.studentMobile || 'N/A'}</td>
      <td>${p.studentEmail}</td>
      <td style="font-weight: 600;">${p.courseName}</td>
      <td>₹${p.amount}</td>
      <td>${p.paymentType}</td>
      <td style="font-family: monospace; font-size:12px;">${p.paymentId || 'MANUAL'}</td>
      <td>
        ${p.screenshot 
          ? `<a href="${p.screenshot}" target="_blank" class="btn-secondary" style="padding: 4px 8px; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;"><i class="fas fa-image"></i> View Receipt</a>` 
          : '<span style="color: var(--text-muted);">N/A</span>'
        }
      </td>
      <td><span class="badge ${p.status === 'captured' ? 'approved' : (p.status === 'pending' ? 'pending' : 'failed')}">${p.status === 'captured' ? 'Received' : p.status}</span></td>
      <td>${new Date(p.date).toLocaleDateString('en-IN')}</td>
      <td>
        <div style="display: flex; gap: 6px; align-items: center;">
          ${p.status === 'pending'
            ? `<button onclick="approvePaymentDirectly('${p.id}')" class="btn-primary" style="padding: 6px 12px; font-size: 11px; background: var(--success); border-color: var(--success); box-shadow: none;">
                 <i class="fas fa-check"></i> Approve
               </button>`
            : ''
          }
          <button onclick="openManualPaymentModal('${p.id}', '${p.status}')" class="btn-secondary" style="padding: 6px 12px; font-size: 11px;">
            Update
          </button>
          <button onclick="handleDeletePayment('${p.id}')" class="btn-primary" style="background: var(--danger); border-color: var(--danger); box-shadow: none; padding: 6px 12px; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// Render Certificate Requests Queue
function renderCertificates(certificates) {
  const tbody = document.getElementById('certificates-tbody');
  if (!tbody) return;

  if (certificates.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-muted);">No certificate requests found.</td></tr>`;
    return;
  }

  // Get active filter status
  const filterVal = document.getElementById('admin-cert-filter')?.value || 'all';
  
  let filteredCerts = certificates;
  if (filterVal === 'pending') {
    filteredCerts = certificates.filter(c => c.status === 'pending');
  } else if (filterVal === 'completed') {
    filteredCerts = certificates.filter(c => c.status === 'sent' || c.status === 'completed');
  }

  if (filteredCerts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-muted);">No certificate requests match this status.</td></tr>`;
    return;
  }

  tbody.innerHTML = filteredCerts.map(c => {
    const isCompleted = c.status === 'sent' || c.status === 'completed';
    return `
      <tr>
        <td style="font-weight: 600; color: var(--text-primary);">${c.name}</td>
        <td>${c.mobile}</td>
        <td>${c.email}</td>
        <td style="font-weight: 600;">${c.courseName}</td>
        <td>₹${c.amount || 499}</td>
        <td style="font-family: monospace; font-size: 12px;">${c.paymentId || 'N/A'}</td>
        <td>
          ${c.screenshot 
            ? `<a href="${c.screenshot}" target="_blank" class="btn-secondary" style="padding: 4px 8px; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;"><i class="fas fa-image"></i> View Receipt</a>` 
            : '<span style="color: var(--text-muted);">N/A</span>'
          }
        </td>
        <td>
          <span class="badge ${isCompleted ? 'approved' : 'pending'}">
            ${isCompleted ? 'Completed' : 'Pending'}
          </span>
        </td>
        <td>${new Date(c.date).toLocaleDateString('en-IN')}</td>
        <td>
          ${!isCompleted 
            ? `<button onclick="handleMarkCertCompleted('${c.id}')" class="btn-primary" style="padding: 6px 12px; font-size: 11px;">Mark Completed <i class="fas fa-check"></i></button>`
            : `<i class="fas fa-check-double" style="color: var(--success); font-size: 16px;"></i> Completed`
          }
        </td>
      </tr>
    `;
  }).join('');
}

// Render Contact Messages
function renderContacts(contacts) {
  const tbody = document.getElementById('contacts-tbody');
  if (!tbody) return;

  if (contacts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No inbound messages logs.</td></tr>`;
    return;
  }

  tbody.innerHTML = contacts.map(c => `
    <tr>
      <td>
        <div style="font-weight: 600; color: var(--text-primary);">${c.name}</div>
        <div style="font-size:12px; color:var(--text-muted);">${c.email}</div>
      </td>
      <td>${c.phone || 'N/A'}</td>
      <td style="font-weight: 600; color: var(--accent-color);">${c.course || 'N/A'}</td>
      <td style="max-width: 300px; word-break: break-all;">${c.message}</td>
      <td>${new Date(c.date).toLocaleString('en-IN')}</td>
    </tr>
  `).join('');
}

// Render notices
function renderNotices(notices) {
  const container = document.getElementById('admin-notices-container');
  if (!container) return;

  if (notices.length === 0) {
    container.innerHTML = `<p style="color: var(--text-muted); text-align: center;">No notice releases.</p>`;
    return;
  }

  container.innerHTML = notices.map(n => `
    <div class="glass-card notice-item" style="margin-bottom: 12px; padding: 16px;">
      <div class="notice-item-header">
        <h4 class="notice-title" style="font-size: 16px;"><i class="fas fa-info-circle" style="color: var(--accent-color);"></i> ${n.title}</h4>
        <div style="display: flex; align-items: center; gap: 10px;">
          <span class="notice-date">${n.date}</span>
          <button onclick="handleDeleteNotice('${n.id}')" title="Delete Notice"
            style="background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); color: var(--danger); border-radius: 6px; padding: 4px 8px; cursor: pointer; font-size: 12px; transition: all 0.2s;"
            onmouseover="this.style.background='rgba(239,68,68,0.25)'" onmouseout="this.style.background='rgba(239,68,68,0.1)'">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
      <div class="notice-body" style="font-size: 13px;">${n.description}</div>
    </div>
  `).join('');
}

// Render Announcements
function renderAnnouncements(announcements) {
  const container = document.getElementById('admin-ann-container');
  if (!container) return;

  if (announcements.length === 0) {
    container.innerHTML = `<p style="color: var(--text-muted); text-align: center;">No announcements released yet.</p>`;
    return;
  }

  container.innerHTML = announcements.map(a => `
    <div class="glass-card announcement-item" style="margin-bottom: 12px; padding: 16px;">
      <div class="notice-item-header" style="margin-bottom: 4px;">
        <span class="notice-title" style="font-size: 14px; font-weight: 600;"><i class="fas fa-comment-dots" style="color: #3b82f6;"></i> Announcement</span>
        <div style="display: flex; align-items: center; gap: 10px;">
          <span class="announcement-date">${a.date}</span>
          <button onclick="handleDeleteAnnouncement('${a.id}')" title="Delete Announcement"
            style="background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); color: var(--danger); border-radius: 6px; padding: 4px 8px; cursor: pointer; font-size: 12px; transition: all 0.2s;"
            onmouseover="this.style.background='rgba(239,68,68,0.25)'" onmouseout="this.style.background='rgba(239,68,68,0.1)'">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
      <div class="announcement-body" style="font-size: 13px;">${a.message}</div>
    </div>
  `).join('');
}

// Render Video Lecture links
function renderRecordedClasses(classes) {
  const container = document.getElementById('admin-recorded-container');
  if (!container) return;

  if (classes.length === 0) {
    container.innerHTML = `<div style="grid-column:1/-1; text-align: center; color: var(--text-muted);">No video lectures uploaded yet.</div>`;
    return;
  }

  container.innerHTML = classes.map(c => `
    <div class="glass-card" style="padding: 16px;">
      <h4 style="font-size: 14px; margin-bottom: 8px;"><i class="fas fa-play-circle" style="color: var(--accent-color);"></i> ${c.title}</h4>
      <p style="font-size:11px; color: var(--text-muted); margin-bottom: 12px;">Course: ${c.courseId} &bull; Uploaded: ${c.date}</p>
      <a href="${c.link}" target="_blank" class="btn-secondary" style="font-size: 12px; padding: 6px 12px;">Open Video <i class="fas fa-external-link-alt"></i></a>
    </div>
  `).join('');
}

// --- COURSE CRUD ACTION HANDLERS ---
function openAddCourseModal() {
  document.getElementById('add-course-modal').classList.add('active');
}

function closeAddCourseModal() {
  document.getElementById('add-course-modal').classList.remove('active');
}

async function handleAddCourse(e) {
  e.preventDefault();

  const title = document.getElementById('add-course-title').value.trim();
  const duration = document.getElementById('add-course-duration').value.trim();
  const level = document.getElementById('add-course-level').value.trim();
  const price = document.getElementById('add-course-price').value;
  const originalPrice = document.getElementById('add-course-original').value;
  const category = document.getElementById('add-course-category').value;
  const description = document.getElementById('add-course-description').value.trim();

  try {
    const res = await apiCall('/courses', 'POST', {
      title, duration, level, price, originalPrice, category, description
    }, true);

    showToast(res.message, 'success');
    closeAddCourseModal();
    document.getElementById('add-course-form').reset();
    await loadAdminData();

  } catch (error) {
    showToast(error.message || 'Failed to create course.', 'error');
  }
}

function openEditCourseModal(courseId) {
  const course = adminData.courses.find(c => c.id === courseId);
  if (!course) return;

  document.getElementById('edit-course-id').value = course.id;
  document.getElementById('edit-course-title').value = course.title;
  document.getElementById('edit-course-duration').value = course.duration;
  document.getElementById('edit-course-level').value = course.level;
  document.getElementById('edit-course-price').value = course.price;
  document.getElementById('edit-course-original').value = course.originalPrice || '';
  document.getElementById('edit-course-category').value = course.category;
  document.getElementById('edit-course-description').value = course.description;

  document.getElementById('edit-course-modal').classList.add('active');
}

function closeEditCourseModal() {
  document.getElementById('edit-course-modal').classList.remove('active');
}

async function handleEditCourse(e) {
  e.preventDefault();

  const id = document.getElementById('edit-course-id').value;
  const title = document.getElementById('edit-course-title').value.trim();
  const duration = document.getElementById('edit-course-duration').value.trim();
  const level = document.getElementById('edit-course-level').value.trim();
  const price = document.getElementById('edit-course-price').value;
  const originalPrice = document.getElementById('edit-course-original').value;
  const category = document.getElementById('edit-course-category').value;
  const description = document.getElementById('edit-course-description').value.trim();

  try {
    const res = await apiCall(`/courses/${id}`, 'PUT', {
      title, duration, level, price, originalPrice, category, description
    }, true);

    showToast(res.message, 'success');
    closeEditCourseModal();
    await loadAdminData();

  } catch (error) {
    showToast(error.message || 'Failed to update course.', 'error');
  }
}

async function handleDeleteCourse(id) {
  if (!confirm('Are you sure you want to delete this course program?')) return;

  try {
    const res = await apiCall(`/courses/${id}`, 'DELETE', null, true);
    showToast(res.message, 'success');
    await loadAdminData();
  } catch (error) {
    showToast(error.message || 'Failed to delete course.', 'error');
  }
}

// --- NOTICE BOARD PUBLISH HANDLER ---
async function handleAddNotice(e) {
  e.preventDefault();

  const title = document.getElementById('notice-title').value.trim();
  const description = document.getElementById('notice-desc').value.trim();

  try {
    const res = await apiCall('/notices', 'POST', { title, description }, true);
    showToast(res.message, 'success');
    document.getElementById('add-notice-form').reset();
    await loadAdminData();
  } catch (error) {
    showToast(error.message || 'Failed to add notice.', 'error');
  }
}

async function handleDeleteNotice(id) {
  if (!confirm('Are you sure you want to delete this notice?')) return;
  try {
    const res = await apiCall(`/notices/${id}`, 'DELETE', null, true);
    showToast(res.message, 'success');
    await loadAdminData();
  } catch (error) {
    showToast(error.message || 'Failed to delete notice.', 'error');
  }
}

async function handleDeleteEnrollment(id) {
  if (!confirm('Are you sure you want to delete this enrollment/active program?')) return;
  try {
    const res = await apiCall(`/enrollments/${id}`, 'DELETE', null, true);
    showToast(res.message, 'success');
    await loadAdminData();
  } catch (error) {
    showToast(error.message || 'Failed to delete enrollment.', 'error');
  }
}

// ==========================================
// DEMO REQUESTS LOGIC
// ==========================================
function renderDemoRequests(enrollments) {
  const tbody = document.getElementById('admin-demo-tbody');
  if (!tbody) return;

  const demoRequests = enrollments.filter(e => e.type === 'demo');

  if (demoRequests.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">No demo requests found.</td></tr>`;
    return;
  }

  tbody.innerHTML = demoRequests.map(d => {
    const isPending = d.status === 'pending';
    let actionHtml = '';
    if (isPending) {
      actionHtml = `
        <button onclick="openApproveDemoModal('${d.id}', '${d.studentId}')" class="btn-primary" style="padding: 6px 12px; font-size: 11px; margin-right: 4px;">
          Approve
        </button>
      `;
    } else {
      actionHtml = `<span style="font-size: 11px; color: var(--success);"><i class="fas fa-check-circle"></i> Sent Link</span>`;
    }

    const screenshotBtn = d.screenshot 
      ? `<button onclick="viewScreenshot('${d.screenshot}')" class="btn-secondary" style="padding: 4px 8px; font-size: 11px;">View Receipt</button>`
      : `<span style="font-size:11px; color:var(--text-muted);">None</span>`;

    return `
      <tr>
        <td style="font-family: monospace; font-size: 11px;">${d.id.slice(-8).toUpperCase()}</td>
        <td style="font-weight: 600;">${d.studentName}</td>
        <td>${d.courseId.replace('demo_', '').toUpperCase()}</td>
        <td style="font-size: 12px;">${d.studentMobile}<br>${d.studentEmail}</td>
        <td>${screenshotBtn}</td>
        <td><span class="badge ${isPending ? 'pending' : 'approved'}">${isPending ? 'Pending' : 'Approved'}</span></td>
        <td>${actionHtml}</td>
      </tr>
    `;
  }).join('');
}

function openApproveDemoModal(enrollmentId, studentId) {
  document.getElementById('demo-req-enrollment-id').value = enrollmentId;
  document.getElementById('demo-req-student-id').value = studentId;
  document.getElementById('demo-meeting-link').value = '';
  
  const modal = document.getElementById('approve-demo-modal');
  if (modal) modal.classList.add('active');
}

function closeApproveDemoModal() {
  const modal = document.getElementById('approve-demo-modal');
  if (modal) {
    modal.classList.remove('active');
    document.getElementById('approve-demo-form').reset();
  }
}

async function handleApproveDemoSubmit(e) {
  e.preventDefault();
  
  const enrollmentId = document.getElementById('demo-req-enrollment-id').value;
  const studentId = document.getElementById('demo-req-student-id').value;
  const meetingLink = document.getElementById('demo-meeting-link').value.trim();
  
  if (!meetingLink) {
    showToast('Meeting link is required.', 'error');
    return;
  }
  
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalBtnHTML = submitBtn.innerHTML;
  
  try {
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.7';
    submitBtn.innerHTML = 'Approving... <i class="fas fa-spinner fa-spin"></i>';
    
    const token = Auth.getToken();
    const response = await fetch(`${API_URL}/admin/demo/approve`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ enrollmentId, studentId, meetingLink })
    });
    
    const res = await response.json();
    if (!response.ok) {
      throw new Error(res.message || 'Approval failed.');
    }
    
    closeApproveDemoModal();
    showToast(res.message || 'Demo request approved and link sent.', 'success');
    
    await loadAdminData(); // Refresh UI
    
  } catch (error) {
    showToast(error.message || 'Failed to approve demo request.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.style.opacity = '1';
    submitBtn.innerHTML = originalBtnHTML;
  }
}

// ==========================================
// LIVE CLASSES LOGIC
// ==========================================
function renderLiveClassesAdmin(classes, courses) {
  const container = document.getElementById('admin-liveclasses-container');
  const dropdown = document.getElementById('liveclass-course');
  
  if (!container || !dropdown) return;
  
  // Populate dropdown
  if (dropdown.options.length <= 1) { // Only populate if empty (or just default)
    dropdown.innerHTML = `
      <option value="">-- Select Target Course --</option>
      <option value="all">All Active Students</option>
      <option value="all_demo">All Approved Demo Students</option>
      ${courses.map(c => `<option value="${c.id}">${c.title}</option>`).join('')}
    `;
  }
  
  // Render posted live classes
  if (classes.length === 0) {
    container.innerHTML = `<p style="color: var(--text-muted); grid-column: 1/-1;">No live classes scheduled yet.</p>`;
    return;
  }
  
  container.innerHTML = classes.map(lc => {
    let targetName = 'Unknown';
    if (lc.courseId === 'all') targetName = 'All Active Students';
    else if (lc.courseId === 'all_demo') targetName = 'All Approved Demo Students';
    else {
      const c = courses.find(course => course.id === lc.courseId);
      if (c) targetName = c.title;
    }
    
    return `
      <div class="glass-card course-card" style="position: relative;">
        <button onclick="deleteLiveClass('${lc.id}')" style="position: absolute; top: 12px; right: 12px; background: none; border: none; color: var(--danger); cursor: pointer; font-size: 16px;" title="Delete Live Class">
          <i class="fas fa-trash-alt"></i>
        </button>
        <h4 style="font-size: 15px; margin-bottom: 8px; padding-right: 24px;">${lc.title}</h4>
        <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;">Target: <strong style="color: var(--text-primary);">${targetName}</strong></p>
        <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 12px;"><i class="far fa-clock"></i> ${lc.dateTime}</p>
        <a href="${lc.link}" target="_blank" class="btn-primary" style="font-size: 11px; padding: 6px 12px;">Meeting Link <i class="fas fa-external-link-alt"></i></a>
      </div>
    `;
  }).join('');
}

async function handlePostLiveClass(e) {
  e.preventDefault();
  
  const title = document.getElementById('liveclass-title').value.trim();
  const courseId = document.getElementById('liveclass-course').value;
  const dateTime = document.getElementById('liveclass-datetime').value.trim();
  const link = document.getElementById('liveclass-link').value.trim();
  
  if (!title || !courseId || !dateTime || !link) {
    showToast('Please fill out all live class details.', 'error');
    return;
  }
  
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalBtnHTML = submitBtn.innerHTML;
  
  try {
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.7';
    submitBtn.innerHTML = 'Publishing... <i class="fas fa-spinner fa-spin"></i>';
    
    const token = Auth.getToken();
    const response = await fetch(`${API_URL}/admin/liveclass`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ title, courseId, dateTime, link })
    });
    
    const res = await response.json();
    if (!response.ok) {
      throw new Error(res.message || 'Failed to post live class.');
    }
    
    document.getElementById('add-liveclass-form').reset();
    showToast(res.message, 'success');
    
    await loadAdminData();
    
  } catch (error) {
    showToast(error.message || 'Error posting live class.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.style.opacity = '1';
    submitBtn.innerHTML = originalBtnHTML;
  }
}

async function deleteLiveClass(classId) {
  if (!confirm('Are you sure you want to delete this live class link?')) return;
  
  try {
    const token = Auth.getToken();
    const response = await fetch(`${API_URL}/admin/liveclass/${classId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const res = await response.json();
    if (!response.ok) {
      throw new Error(res.message || 'Failed to delete live class.');
    }
    
    showToast(res.message, 'success');
    await loadAdminData(); // Refresh UI
    
  } catch (error) {
    showToast(error.message || 'Error deleting live class.', 'error');
  }
}

// --- ANNOUNCEMENT BOARD BROADCAST HANDLER ---
async function handleAddAnnouncement(e) {
  e.preventDefault();

  const message = document.getElementById('ann-message').value.trim();

  try {
    const res = await apiCall('/announcements', 'POST', { message }, true);
    showToast(res.message, 'success');
    document.getElementById('add-ann-form').reset();
    await loadAdminData();
  } catch (error) {
    showToast(error.message || 'Failed to post announcement.', 'error');
  }
}

async function handleDeleteAnnouncement(id) {
  if (!confirm('Are you sure you want to delete this announcement?')) return;
  try {
    const res = await apiCall(`/announcements/${id}`, 'DELETE', null, true);
    showToast(res.message || 'Announcement deleted!', 'success');
    await loadAdminData();
  } catch (error) {
    showToast(error.message || 'Failed to delete announcement.', 'error');
  }
}

// --- RECORDED LECTURE ADD HANDLER ---
async function handleAddRecordedClass(e) {
  e.preventDefault();

  const title = document.getElementById('rec-title').value.trim();
  const link = document.getElementById('rec-link').value.trim();
  const courseId = document.getElementById('rec-course').value;

  try {
    const res = await apiCall('/recorded-classes', 'POST', { title, link, courseId }, true);
    showToast(res.message, 'success');
    document.getElementById('add-recorded-form').reset();
    await loadAdminData();
  } catch (error) {
    showToast(error.message || 'Failed to upload recorded video link.', 'error');
  }
}

// --- CERTIFICATE COMPLETED MARK HANDLER ---
async function handleMarkCertCompleted(id) {
  try {
    const res = await apiCall(`/certificates/${id}/status`, 'PUT', { status: 'completed' }, true);
    showToast(res.message, 'success');
    await loadAdminData();
  } catch (error) {
    showToast(error.message || 'Failed to update certificate status.', 'error');
  }
}

// --- MANUAL PAYMENT ADJUSTER HANDLERS ---
function openManualPaymentModal(paymentId, currentStatus) {
  document.getElementById('manual-payment-id').value = paymentId;
  document.getElementById('manual-payment-status').value = currentStatus;
  document.getElementById('manual-payment-modal').classList.add('active');
}

function closeManualPaymentModal() {
  document.getElementById('manual-payment-modal').classList.remove('active');
}

async function handleManualPaymentUpdate(e) {
  e.preventDefault();

  const payId = document.getElementById('manual-payment-id').value;
  const status = document.getElementById('manual-payment-status').value;

  try {
    const res = await apiCall(`/payments/${payId}/status`, 'PUT', { status }, true);
    showToast(res.message, 'success');
    closeManualPaymentModal();
    await loadAdminData();
  } catch (error) {
    showToast(error.message || 'Failed to adjust payment status.', 'error');
  }
}

// --- PLACEMENT ACHIEVERS SPOTLIGHT HANDLERS ---

function renderAdminAchievers(achievers) {
  const container = document.getElementById('admin-achievers-container');
  if (!container) return;

  if (achievers.length === 0) {
    container.innerHTML = `<div style="grid-column:1/-1; text-align: center; color: var(--text-muted); padding: 40px;">No placement achievers registered.</div>`;
    return;
  }

  container.innerHTML = achievers.map(a => {
    const imgUrl = a.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(a.name)}&background=ff4b2b&color=fff&size=150&font-size=0.33`;
    return `
      <div class="glass-card" style="padding: 20px; display: flex; flex-direction: column; justify-content: space-between;">
        <div style="text-align: center; margin-bottom: 20px;">
          <div style="width: 120px; height: 120px; border-radius: 50%; overflow: hidden; margin: 0 auto 12px auto; border: 2px solid var(--border-color);">
            <img src="${imgUrl}" alt="${a.name}" style="width:100%; height:100%; object-fit:cover;">
          </div>
          <h4 style="font-size: 16px; color: var(--text-primary); font-family: var(--font-header);">${a.name}</h4>
          <p style="font-size: 12px; color: var(--text-secondary); letter-spacing: 1px; text-transform: uppercase;">${a.company}</p>
        </div>
        <button onclick="handleDeleteAchiever('${a.id}')" class="btn-primary" style="background: var(--danger); box-shadow: none; font-size: 12px; padding: 8px 12px; justify-content: center; width: 100%;">
          Delete Achiever <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
  }).join('');
}

async function handleAddAchiever(e) {
  e.preventDefault();

  const name = document.getElementById('achiever-student-name').value.trim();
  const company = document.getElementById('achiever-company-name').value.trim();
  const fileInput = document.getElementById('achiever-image');
  
  if (!name || !company || fileInput.files.length === 0) {
    showToast('All fields including student image are required.', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('name', name);
  formData.append('company', company);
  formData.append('image', fileInput.files[0]);

  try {
    showToast('Uploading achiever details and image...', 'info');

    const token = Auth.getToken();
    const response = await fetch(`${API_URL}/achievers`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    const res = await response.json();
    if (!response.ok) {
      throw new Error(res.message || 'Failed to upload achiever.');
    }

    showToast(res.message, 'success');
    document.getElementById('add-achiever-form').reset();
    await loadAdminData();
  } catch (error) {
    showToast(error.message || 'Failed to add achiever.', 'error');
  }
}

async function handleDeleteAchiever(id) {
  if (!confirm('Are you sure you want to delete this placement achiever?')) return;

  try {
    const res = await apiCall(`/achievers/${id}`, 'DELETE', null, true);
    showToast(res.message, 'success');
    await loadAdminData();
  } catch (error) {
    showToast(error.message || 'Failed to delete achiever.', 'error');
  }
}

// Quick manual payment approval action
async function approvePaymentDirectly(payId) {
  if (!confirm('Are you sure you want to approve this payment request? This will immediately activate enrollment/certificate for the student.')) {
    return;
  }

  try {
    showToast('Approving payment...', 'info');
    const res = await apiCall(`/payments/${payId}/status`, 'PUT', { status: 'captured' }, true);
    showToast(res.message || 'Payment approved successfully!', 'success');
    await loadAdminData();
  } catch (error) {
    showToast(error.message || 'Failed to approve payment.', 'error');
  }
}

// Delete student registration and clean up records
async function handleDeleteStudent(studentId) {
  if (!confirm('Are you sure you want to permanently delete this student registration? This action cannot be undone.')) {
    return;
  }

  try {
    showToast('Deleting student records...', 'info');
    const res = await apiCall(`/students/${studentId}`, 'DELETE', null, true);
    showToast(res.message || 'Student deleted successfully!', 'success');
    await loadAdminData();
  } catch (error) {
    showToast(error.message || 'Failed to delete student.', 'error');
  }
}

async function handleDeletePayment(paymentId) {
  if (!confirm('Are you sure you want to delete this payment log? This action cannot be undone.')) {
    return;
  }
  
  try {
    showToast('Deleting payment log...', 'info');
    const res = await apiCall(`/admin/payment/${paymentId}`, 'DELETE', null, true);
    showToast(res.message || 'Payment deleted successfully!', 'success');
    await loadAdminData();
  } catch (error) {
    showToast(error.message || 'Failed to delete payment.', 'error');
  }
}

// Bind to window for global inline trigger access
window.approvePaymentDirectly = approvePaymentDirectly;
window.handleDeleteStudent = handleDeleteStudent;
window.openStudentDetailsModal = openStudentDetailsModal;
window.closeStudentDetailsModal = closeStudentDetailsModal;

// ==========================================
// STUDENT PROFILE MODAL & ATTENDANCE LOGIC
// ==========================================

function openStudentDetailsModal(studentId) {
  const student = adminData.students.find(s => s.id === studentId);
  if (!student) return;

  document.getElementById('detail-fullname').innerText = student.name;
  document.getElementById('detail-regid').innerText = 'ID: ' + student.id;
  document.getElementById('detail-email').innerText = student.email;
  document.getElementById('detail-mobile').innerText = student.mobile || 'N/A';

  const passwordEl = document.getElementById('detail-password');
  if (passwordEl) {
    passwordEl.innerText = student.plainPassword || student.password || 'N/A';
  }

  // Set avatar or profile image
  const displayEl = document.getElementById('detail-avatar-display');
  if (displayEl) {
    if (student.profilePic) {
      displayEl.innerHTML = `<img src="${student.profilePic}" alt="${student.name}" style="width:100%; height:100%; border-radius:50%; object-fit:cover; display:block;">`;
    } else {
      displayEl.innerHTML = student.name.charAt(0).toUpperCase();
    }
  }

  // Set social links
  const socialConfigs = [
    { key: 'github', linkId: 'detail-github', naId: 'detail-github-na' },
    { key: 'linkedin', linkId: 'detail-linkedin', naId: 'detail-linkedin-na' },
    { key: 'portfolio', linkId: 'detail-portfolio', naId: 'detail-portfolio-na' }
  ];

  socialConfigs.forEach(cfg => {
    const val = student[cfg.key];
    const linkEl = document.getElementById(cfg.linkId);
    const naEl = document.getElementById(cfg.naId);
    if (linkEl && naEl) {
      if (val) {
        linkEl.href = val;
        linkEl.style.display = 'inline-flex';
        naEl.style.display = 'none';
      } else {
        linkEl.style.display = 'none';
        naEl.style.display = 'inline';
      }
    }
  });

  document.getElementById('student-details-modal').classList.add('active');
}

function closeStudentDetailsModal() {
  document.getElementById('student-details-modal').classList.remove('active');
}

// ------------------------------------------
// Clear Database
// ------------------------------------------
async function clearDatabase() {
  if (!confirm('WARNING: Are you sure you want to completely clear the entire database? All students, payments, and enrollments will be deleted permanently. This cannot be undone!')) return;
  if (!confirm('Please confirm again. Type OK to proceed.')) return;
  
  try {
    const token = Auth.getToken();
    const response = await fetch(`${API_URL}/admin/clear-database`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) throw new Error('Failed to clear database');
    const res = await response.json();
    showToast(res.message, 'success');
    
    // Reload dashboard
    await loadAdminData();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

let loadedAttendanceData = null;

async function handleLoadAttendanceSheet(e) {
  e.preventDefault();
  const courseId = document.getElementById('att-course-select').value;
  const date = document.getElementById('att-date-input').value;

  if (!courseId || !date) {
    showToast('Please select a course batch and date.', 'error');
    return;
  }

  try {
    showToast('Loading roll list...', 'info');
    const res = await apiCall(`/admin/attendance?courseId=${courseId}&date=${date}`, 'GET', null, true);
    loadedAttendanceData = res;

    renderAttendanceSheet(res.records);

    // Show sheet card
    document.getElementById('attendance-sheet-card').style.display = 'block';
    document.getElementById('att-sheet-title').innerText = `Student Roll List — ${date}`;

  } catch (error) {
    showToast(error.message || 'Failed to load attendance sheet.', 'error');
  }
}

function renderAttendanceSheet(records) {
  const tbody = document.getElementById('attendance-tbody');
  if (!tbody) return;

  if (records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 20px;">No students enrolled & approved in this course yet.</td></tr>`;
    document.getElementById('save-attendance-btn').style.display = 'none';
    return;
  }

  document.getElementById('save-attendance-btn').style.display = 'inline-flex';

  tbody.innerHTML = records.map((r, index) => {
    return `
      <tr>
        <td style="font-weight: 600; color: var(--text-primary);">${r.studentName}</td>
        <td>${r.studentEmail}</td>
        <td>
          <div class="attendance-options" style="display: flex; gap: 15px; justify-content: center; align-items: center;">
            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size:13px;">
              <input type="radio" name="status-${index}" value="present" ${r.status === 'present' ? 'checked' : ''} style="accent-color: var(--success); width:16px; height:16px;">
              <span style="color: var(--success); font-weight:600;">Present</span>
            </label>
            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size:13px;">
              <input type="radio" name="status-${index}" value="absent" ${r.status === 'absent' ? 'checked' : ''} style="accent-color: var(--danger); width:16px; height:16px;">
              <span style="color: var(--danger); font-weight:600;">Absent</span>
            </label>
            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size:13px;">
              <input type="radio" name="status-${index}" value="late" ${r.status === 'late' ? 'checked' : ''} style="accent-color: var(--warning); width:16px; height:16px;">
              <span style="color: var(--warning); font-weight:600;">Late</span>
            </label>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function handleSaveAttendanceSheet() {
  if (!loadedAttendanceData) return;

  const tbody = document.getElementById('attendance-tbody');
  const rows = tbody.querySelectorAll('tr');
  const records = [];

  for (let i = 0; i < loadedAttendanceData.records.length; i++) {
    const originalRecord = loadedAttendanceData.records[i];
    const radios = document.getElementsByName(`status-${i}`);
    let selectedStatus = 'present';

    for (const r of radios) {
      if (r.checked) {
        selectedStatus = r.value;
        break;
      }
    }

    records.push({
      studentId: originalRecord.studentId,
      studentName: originalRecord.studentName,
      studentEmail: originalRecord.studentEmail,
      status: selectedStatus
    });
  }

  const courseId = loadedAttendanceData.courseId;
  const date = loadedAttendanceData.date;

  try {
    showToast('Saving attendance...', 'info');
    const res = await apiCall('/admin/attendance', 'POST', {
      courseId,
      date,
      records
    }, true);

    showToast(res.message, 'success');
    // Refresh sheet data locally
    loadedAttendanceData.records = records;

  } catch (error) {
    showToast(error.message || 'Failed to save attendance.', 'error');
  }
}

// ==========================================
// ADMIN QUIZ MANAGER TAB & FORM LOGIC
// ==========================================

function switchAdminQuizTab(tabName) {
  const manageTab = document.getElementById('admin-quizzes-manage-tab');
  const logsTab = document.getElementById('admin-quizzes-logs-tab');
  const manageBtn = document.getElementById('tab-manage-quizzes-btn');
  const logsBtn = document.getElementById('tab-quiz-logs-btn');

  if (!manageTab || !logsTab || !manageBtn || !logsBtn) return;

  if (tabName === 'manage') {
    manageTab.style.display = 'block';
    logsTab.style.display = 'none';
    manageBtn.classList.add('active');
    logsBtn.classList.remove('active');
  } else {
    manageTab.style.display = 'none';
    logsTab.style.display = 'block';
    manageBtn.classList.remove('active');
    logsBtn.classList.add('active');
  }
}

function populateQuizCourseDropdown(courses) {
  const select = document.getElementById('quiz-course-select');
  if (!select) return;
  
  select.innerHTML = '<option value="" disabled selected>Select course batch...</option>';
  courses.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.innerText = c.title;
    select.appendChild(opt);
  });
}

function renderAdminQuizzes() {
  const grid = document.getElementById('admin-quizzes-grid');
  if (!grid) return;

  if (quizzesList.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1; text-align: center; color: var(--text-muted); padding: 40px;">No quizzes created yet. Click 'Create New Quiz' above.</div>`;
    return;
  }

  grid.innerHTML = quizzesList.map(quiz => {
    const course = adminData.courses?.find(c => c.id === quiz.courseId);
    const courseTitle = course ? course.title : quiz.courseId;
    return `
      <div class="glass-card course-card" style="padding: 20px; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <span class="course-card-badge" style="background: rgba(255, 75, 43, 0.1); border-color: rgba(255,75,43,0.25); color: var(--accent-color); font-size:10px;">${quiz.courseId.toUpperCase()}</span>
          <h4 style="font-size: 16px; margin-top: 16px; margin-bottom: 8px; color: var(--text-primary);">${quiz.title}</h4>
          <div class="course-meta" style="font-size: 11px; margin-bottom: 12px; gap: 10px;">
            <span><i class="far fa-question-circle"></i> ${quiz.questions.length} Questions</span>
          </div>
        </div>
        <div class="course-footer" style="padding-top: 12px; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; gap: 8px;">
          <button onclick="openEditQuizModal('${quiz.id}')" class="btn-secondary" style="padding: 4px 8px; font-size: 11px;">
            <i class="fas fa-edit"></i> Edit
          </button>
          <button onclick="handleDeleteQuiz('${quiz.id}')" class="btn-primary" style="background: var(--danger); border-color: var(--danger); box-shadow: none; padding: 4px 8px; font-size: 11px;">
            <i class="fas fa-trash"></i> Delete
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function renderQuizResultsLogs() {
  const tbody = document.getElementById('quiz-logs-tbody');
  if (!tbody) return;

  if (quizResultsList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 20px;">No quiz attempts recorded yet.</td></tr>`;
    return;
  }

  const sorted = [...quizResultsList].sort((a, b) => new Date(b.date) - new Date(a.date));

  tbody.innerHTML = sorted.map(r => {
    const isPass = r.percentage >= 60;
    return `
      <tr>
        <td style="font-weight: 600; color: var(--text-primary);">${r.studentName}</td>
        <td>${r.quizTitle}</td>
        <td>${r.score}/${r.total}</td>
        <td>
          <span class="badge ${isPass ? 'approved' : 'failed'}">${r.percentage}% (${isPass ? 'Pass' : 'Fail'})</span>
        </td>
        <td>${new Date(r.date).toLocaleString('en-IN')}</td>
      </tr>
    `;
  }).join('');
}

function openAddQuizModal() {
  document.getElementById('quiz-modal-title').innerText = 'Create Program Quiz';
  document.getElementById('quiz-edit-id').value = '';
  document.getElementById('quiz-form').reset();
  document.getElementById('modal-questions-list-wrapper').innerHTML = '';
  addQuizQuestionField();
  document.getElementById('quiz-modal').classList.add('active');
}

function closeQuizModal() {
  document.getElementById('quiz-modal').classList.remove('active');
}

function openEditQuizModal(quizId) {
  const quiz = quizzesList.find(q => q.id === quizId);
  if (!quiz) return;

  document.getElementById('quiz-modal-title').innerText = 'Edit Program Quiz';
  document.getElementById('quiz-edit-id').value = quiz.id;
  document.getElementById('quiz-title-input').value = quiz.title;
  document.getElementById('quiz-course-select').value = quiz.courseId;

  const wrapper = document.getElementById('modal-questions-list-wrapper');
  wrapper.innerHTML = '';

  quiz.questions.forEach((q, idx) => {
    addQuizQuestionField(q);
  });

  document.getElementById('quiz-modal').classList.add('active');
}

function addQuizQuestionField(qData = null) {
  const wrapper = document.getElementById('modal-questions-list-wrapper');
  if (!wrapper) return;
  const index = wrapper.children.length;

  const item = document.createElement('div');
  item.className = 'admin-question-builder-item';
  item.innerHTML = `
    <button type="button" class="remove-question-btn" onclick="this.parentElement.remove()">Remove</button>
    <div style="font-weight: 700; font-size:13px; color: var(--text-secondary); margin-bottom: 12px;"><i class="fas fa-question-circle" style="color: var(--accent-color);"></i> Question #${index + 1}</div>
    
    <div class="form-group" style="margin-bottom: 12px;">
      <label style="font-size:12px;">Question Text</label>
      <input type="text" class="form-control question-text-input" value="${qData ? qData.questionText.replace(/"/g, '&quot;') : ''}" required placeholder="Enter question description...">
    </div>

    <div class="responsive-grid-two-col" style="gap: 12px; margin-bottom: 12px;">
      <div class="form-group" style="margin-bottom: 0;">
        <label style="font-size:12px;">Option A</label>
        <input type="text" class="form-control option-input" value="${qData ? qData.options[0].replace(/"/g, '&quot;') : ''}" required placeholder="Option A text">
      </div>
      <div class="form-group" style="margin-bottom: 0;">
        <label style="font-size:12px;">Option B</label>
        <input type="text" class="form-control option-input" value="${qData ? qData.options[1].replace(/"/g, '&quot;') : ''}" required placeholder="Option B text">
      </div>
      <div class="form-group" style="margin-bottom: 0;">
        <label style="font-size:12px;">Option C</label>
        <input type="text" class="form-control option-input" value="${qData ? qData.options[2].replace(/"/g, '&quot;') : ''}" required placeholder="Option C text">
      </div>
      <div class="form-group" style="margin-bottom: 0;">
        <label style="font-size:12px;">Option D</label>
        <input type="text" class="form-control option-input" value="${qData ? qData.options[3].replace(/"/g, '&quot;') : ''}" required placeholder="Option D text">
      </div>
    </div>

    <div class="form-group" style="margin-bottom: 0;">
      <label style="font-size:12px;">Correct Answer Option</label>
      <select class="form-control correct-option-select" required style="width: 200px; padding: 8px 12px; font-size:13px;">
        <option value="0" ${qData && qData.correctAnswerIndex === 0 ? 'selected' : ''}>Option A</option>
        <option value="1" ${qData && qData.correctAnswerIndex === 1 ? 'selected' : ''}>Option B</option>
        <option value="2" ${qData && qData.correctAnswerIndex === 2 ? 'selected' : ''}>Option C</option>
        <option value="3" ${qData && qData.correctAnswerIndex === 3 ? 'selected' : ''}>Option D</option>
      </select>
    </div>
  `;

  wrapper.appendChild(item);
}

async function handleQuizFormSubmit(e) {
  e.preventDefault();

  const quizId = document.getElementById('quiz-edit-id').value;
  const courseId = document.getElementById('quiz-course-select').value;
  const title = document.getElementById('quiz-title-input').value.trim();

  const questionItems = document.querySelectorAll('.admin-question-builder-item');
  if (questionItems.length === 0) {
    showToast('Please add at least one question to the quiz.', 'error');
    return;
  }

  const questions = [];
  let validationError = false;

  questionItems.forEach(item => {
    const questionText = item.querySelector('.question-text-input').value.trim();
    const optionInputs = item.querySelectorAll('.option-input');
    const options = Array.from(optionInputs).map(inp => inp.value.trim());
    const correctAnswerIndex = parseInt(item.querySelector('.correct-option-select').value);

    if (!questionText || options.some(opt => !opt)) {
      validationError = true;
    }

    questions.push({
      questionText,
      options,
      correctAnswerIndex
    });
  });

  if (validationError) {
    showToast('Please fill out all question and option fields.', 'error');
    return;
  }

  const url = quizId ? `/quizzes/${quizId}` : '/quizzes';
  const method = quizId ? 'PUT' : 'POST';

  try {
    const res = await apiCall(url, method, { courseId, title, questions }, true);
    
    showToast(res.message, 'success');
    closeQuizModal();
    await loadAdminData();

  } catch (error) {
    showToast(error.message || 'Failed to save quiz details.', 'error');
  }
}

async function handleDeleteQuiz(quizId) {
  if (!confirm('Are you sure you want to delete this quiz? Student results for this quiz will also be removed.')) return;

  try {
    const res = await apiCall(`/quizzes/${quizId}`, 'DELETE', null, true);
    showToast(res.message, 'success');
    await loadAdminData();
  } catch (error) {
    showToast(error.message || 'Failed to delete quiz.', 'error');
  }
}

// Attach functions to global window object
window.switchAdminQuizTab = switchAdminQuizTab;
window.openAddQuizModal = openAddQuizModal;
window.closeQuizModal = closeQuizModal;
window.openEditQuizModal = openEditQuizModal;
window.addQuizQuestionField = addQuizQuestionField;
window.handleDeleteQuiz = handleDeleteQuiz;

// ==========================================
// ASSIGNMENTS MANAGER (Admin)
// ==========================================

function switchAdminAssignTab(tab) {
  const manageTab = document.getElementById('admin-assign-manage-tab');
  const submissionsTab = document.getElementById('admin-submissions-tab');
  const createBtn = document.getElementById('tab-create-assign-btn');
  const submissionsBtn = document.getElementById('tab-submissions-btn');

  if (tab === 'create') {
    if (manageTab) manageTab.style.display = 'block';
    if (submissionsTab) submissionsTab.style.display = 'none';
    if (createBtn) createBtn.classList.add('active');
    if (submissionsBtn) submissionsBtn.classList.remove('active');
  } else {
    if (manageTab) manageTab.style.display = 'none';
    if (submissionsTab) submissionsTab.style.display = 'block';
    if (createBtn) createBtn.classList.remove('active');
    if (submissionsBtn) submissionsBtn.classList.add('active');
  }
}

function renderAdminAssignments(assignments, courses) {
  const grid = document.getElementById('admin-assignments-grid');
  if (!grid) return;

  if (assignments.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:var(--text-muted); padding:40px;">
      <i class="fas fa-file-alt" style="font-size:40px; margin-bottom:12px; display:block;"></i>
      <p>No assignments created yet. Use the form above to create one.</p>
    </div>`;
    return;
  }

  grid.innerHTML = assignments.map(a => {
    const courseName = a.courseId === 'all' 
      ? 'All Students' 
      : (courses.find(c => c.id === a.courseId)?.title || a.courseId);
    const dueText = a.dueDate 
      ? new Date(a.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) 
      : 'No due date';
    return `
      <div class="assignment-card">
        <div class="assignment-card-header">
          <span class="assignment-title">${a.title}</span>
          <span class="badge-submitted" style="white-space:nowrap;"><i class="fas fa-users"></i> ${courseName}</span>
        </div>
        <div class="assignment-meta">
          <span><i class="fas fa-star" style="color:var(--warning);"></i> Max: ${a.maxMarks} marks</span>
          <span><i class="fas fa-calendar-alt"></i> ${dueText}</span>
        </div>
        <p class="assignment-desc">${a.description}</p>
        <div class="assignment-footer">
          <span style="font-size:11px; color:var(--text-muted);"><i class="fas fa-clock"></i> Created: ${new Date(a.createdAt).toLocaleDateString('en-IN')}</span>
          <button onclick="handleDeleteAssignment('${a.id}')" class="btn-primary" style="background:var(--danger); box-shadow:none; font-size:12px; padding:7px 14px;">
            <i class="fas fa-trash"></i> Delete
          </button>
        </div>
      </div>
    `;
  }).join('');
}

async function handleAddAssignment(e) {
  e.preventDefault();
  const title = document.getElementById('asgn-title').value.trim();
  const description = document.getElementById('asgn-desc').value.trim();
  const courseId = document.getElementById('asgn-course').value;
  const dueDate = document.getElementById('asgn-due').value || null;
  const maxMarks = document.getElementById('asgn-marks').value;

  const submitBtn = e.target.querySelector('button[type="submit"]');
  const origHTML = submitBtn.innerHTML;

  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Creating... <i class="fas fa-spinner fa-spin"></i>';
    const res = await apiCall('/assignments', 'POST', { title, description, courseId, dueDate, maxMarks }, true);
    showToast(res.message, 'success');
    e.target.reset();
    await loadAdminData();
  } catch (error) {
    showToast(error.message || 'Failed to create assignment.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = origHTML;
  }
}

async function handleDeleteAssignment(id) {
  if (!confirm('Are you sure you want to delete this assignment?')) return;
  try {
    const res = await apiCall(`/assignments/${id}`, 'DELETE', null, true);
    showToast(res.message, 'success');
    await loadAdminData();
  } catch (error) {
    showToast(error.message || 'Failed to delete assignment.', 'error');
  }
}

function renderAdminSubmissions(submissions, assignments) {
  const tbody = document.getElementById('submissions-tbody');
  if (!tbody) return;

  if (submissions.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding:32px;">No student submissions yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = submissions.map(s => {
    const asgn = assignments.find(a => a.id === s.assignmentId);
    const maxMarks = asgn ? asgn.maxMarks : '—';
    const statusBadge = s.status === 'graded'
      ? `<span class="badge-graded"><i class="fas fa-check-double"></i> Graded</span>`
      : `<span class="badge-pending-sub"><i class="fas fa-clock"></i> Pending Review</span>`;
    return `
      <tr>
        <td>
          <div style="font-weight:600; color:var(--text-primary);">${s.studentName}</div>
          <div style="font-size:11px; color:var(--text-muted);">${s.studentEmail}</div>
        </td>
        <td style="font-weight:600;">${s.assignmentTitle}</td>
        <td>${new Date(s.submittedAt).toLocaleDateString('en-IN')}</td>
        <td style="max-width:180px; font-size:12px; color:var(--text-secondary);">${s.notes || '—'}</td>
        <td>
          ${s.fileUrl
            ? `<a href="${s.fileUrl}" target="_blank" class="btn-secondary" style="font-size:11px; padding:4px 8px;">
                <i class="fas fa-download"></i> Download
              </a>`
            : '<span style="color:var(--text-muted);">No file</span>'
          }
        </td>
        <td>${statusBadge}</td>
        <td>${s.marks !== null ? `<strong style="color:var(--success);">${s.marks}</strong> / ${maxMarks}` : `— / ${maxMarks}`}</td>
        <td>
          ${s.status !== 'graded'
            ? `<button onclick="openGradeModal('${s.id}', ${maxMarks})" class="btn-primary" style="font-size:11px; padding:6px 12px;">
                <i class="fas fa-star"></i> Grade
              </button>`
            : `<button onclick="openGradeModal('${s.id}', ${maxMarks})" class="btn-secondary" style="font-size:11px; padding:6px 12px;">
                <i class="fas fa-edit"></i> Update
              </button>`
          }
        </td>
      </tr>
    `;
  }).join('');
}

// Grade modal (inline dynamic creation)
let activeGradeSubmissionId = null;
let activeGradeMaxMarks = 100;

function openGradeModal(submissionId, maxMarks) {
  activeGradeSubmissionId = submissionId;
  activeGradeMaxMarks = maxMarks || 100;

  let modal = document.getElementById('grade-submission-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'grade-submission-modal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-content" style="max-width: 420px;">
      <div class="modal-header">
        <h3 class="modal-title">Grade Submission</h3>
        <button class="modal-close" onclick="closeGradeModal()"><i class="fas fa-times"></i></button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Marks Awarded (out of ${maxMarks})</label>
          <input type="number" id="grade-marks-input" class="form-control" min="0" max="${maxMarks}" placeholder="e.g. 85">
        </div>
        <div class="form-group">
          <label>Feedback / Comments</label>
          <textarea id="grade-feedback-input" class="form-control" placeholder="Add instructor feedback here..."></textarea>
        </div>
        <button onclick="gradeSubmission()" class="btn-primary" style="width:100%; justify-content:center;">
          Save Grade <i class="fas fa-check"></i>
        </button>
      </div>
    </div>
  `;
  modal.classList.add('active');
}

function closeGradeModal() {
  const modal = document.getElementById('grade-submission-modal');
  if (modal) modal.classList.remove('active');
}

async function gradeSubmission() {
  const marks = document.getElementById('grade-marks-input').value;
  const feedback = document.getElementById('grade-feedback-input').value.trim();

  if (marks === '' || Number(marks) < 0 || Number(marks) > activeGradeMaxMarks) {
    showToast(`Please enter valid marks between 0 and ${activeGradeMaxMarks}.`, 'error');
    return;
  }

  try {
    const res = await apiCall(`/submissions/${activeGradeSubmissionId}/grade`, 'PUT', { marks, feedback }, true);
    showToast(res.message, 'success');
    closeGradeModal();
    await loadAdminData();
  } catch (error) {
    showToast(error.message || 'Failed to grade submission.', 'error');
  }
}

// ==========================================
// ENROLLMENT PROGRESS UPDATE (Admin)
// ==========================================
async function updateEnrollmentProgress(enrollId, inputId) {
  const progress = document.getElementById(inputId).value;
  if (progress === '' || progress < 0 || progress > 100) {
    showToast('Please enter a valid progress value (0-100).', 'error');
    return;
  }
  try {
    const res = await apiCall(`/enrollments/${enrollId}/progress`, 'PUT', { progress: Number(progress) }, true);
    showToast(`Progress updated to ${progress}%!`, 'success');
    await loadAdminData();
  } catch (error) {
    showToast(error.message || 'Failed to update progress.', 'error');
  }
}

// ==========================================
// FEEDBACKS (Admin)
// ==========================================
function renderFeedbacks(feedbacks) {
  const tbody = document.getElementById('feedbacks-tbody');
  if (!tbody) return;

  if (feedbacks.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No student feedbacks found.</td></tr>`;
    return;
  }

  tbody.innerHTML = feedbacks.map(f => `
    <tr>
      <td>
        <span style="font-weight: 600;">${f.studentName}</span>
      </td>
      <td style="max-width: 300px; white-space: normal; line-height: 1.4;">${f.message}</td>
      <td>${new Date(f.createdAt).toLocaleDateString()}</td>
      <td>
        <span class="badge ${f.status === 'approved' ? 'approved' : 'pending'}">
          ${f.status.charAt(0).toUpperCase() + f.status.slice(1)}
        </span>
      </td>
      <td>
        <div style="display: flex; gap: 8px;">
          ${f.status === 'pending' ? `
            <button onclick="handleApproveFeedback('${f.id}')" title="Approve Feedback" class="btn-primary" style="background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.2); color: var(--success); box-shadow: none; padding: 6px 12px; font-size: 11px;">
              <i class="fas fa-check"></i> Approve
            </button>
          ` : ''}
          <button onclick="handleDeleteFeedback('${f.id}')" title="Delete Feedback" class="btn-primary" style="background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); color: var(--danger); box-shadow: none; padding: 6px 12px; font-size: 11px;">
            <i class="fas fa-trash"></i> Delete
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function handleApproveFeedback(id) {
  if (!confirm('Approve this feedback to display on the public homepage?')) return;
  try {
    const res = await apiCall(`/admin/feedbacks/${id}`, 'PUT', { status: 'approved' }, true);
    showToast(res.message, 'success');
    await loadAdminData();
  } catch (error) {
    showToast(error.message || 'Failed to approve feedback.', 'error');
  }
}

async function handleDeleteFeedback(id) {
  if (!confirm('Delete this feedback permanently?')) return;
  try {
    const res = await apiCall(`/admin/feedbacks/${id}`, 'DELETE', null, true);
    showToast(res.message, 'success');
    await loadAdminData();
  } catch (error) {
    showToast(error.message || 'Failed to delete feedback.', 'error');
  }
}

// Attach new functions to global window
window.switchAdminAssignTab = switchAdminAssignTab;
window.handleDeleteAssignment = handleDeleteAssignment;
window.openGradeModal = openGradeModal;
window.closeGradeModal = closeGradeModal;
window.gradeSubmission = gradeSubmission;
window.updateEnrollmentProgress = updateEnrollmentProgress;
window.handleDeleteAnnouncement = handleDeleteAnnouncement;
window.handleApproveFeedback = handleApproveFeedback;
window.handleDeleteFeedback = handleDeleteFeedback;
