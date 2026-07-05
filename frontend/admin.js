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
  loadAdminData();

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
  document.getElementById('add-course-form').addEventListener('submit', handleAddCourse);
  document.getElementById('edit-course-form').addEventListener('submit', handleEditCourse);
  document.getElementById('add-notice-form').addEventListener('submit', handleAddNotice);
  document.getElementById('add-ann-form').addEventListener('submit', handleAddAnnouncement);
  document.getElementById('add-recorded-form').addEventListener('submit', handleAddRecordedClass);
  document.getElementById('manual-payment-form').addEventListener('submit', handleManualPaymentUpdate);
  document.getElementById('add-achiever-form').addEventListener('submit', handleAddAchiever);
});

let adminData = {};

async function loadAdminData() {
  try {
    const data = await apiCall('/admin/data', 'GET', null, true);
    adminData = data;

    // A. Update Overview metrics
    document.getElementById('stat-revenue').innerText = '₹' + data.stats.totalRevenue;
    document.getElementById('stat-students').innerText = data.stats.totalStudents;
    document.getElementById('stat-courses').innerText = data.stats.totalCourses;
    document.getElementById('stat-contacts').innerText = data.stats.totalContacts;

    // B. Populate Overview recent logs
    renderOverviewLogs(data.payments, data.certificates);

    // C. Populate Students table
    renderStudents(data.students);

    // D. Populate Course grid
    renderCourses(data.courses);

    // E. Populate Course options select dropdowns
    populateCourseDropdowns(data.courses);

    // F. Populate Enrollments table
    renderEnrollments(data.enrollments, data.courses);

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

    // L. Populate Video Lectures list
    renderRecordedClasses(data.recordedClasses);

    // M. Populate Placement Achievers list
    renderAdminAchievers(data.achievers);

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
      payTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No payment logs.</td></tr>`;
    } else {
      payTbody.innerHTML = recentPay.map(p => `
        <tr>
          <td style="font-weight: 600; color: var(--text-primary);">${p.studentName}</td>
          <td>${p.courseName}</td>
          <td>₹${p.amount}</td>
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
            <td>${c.address.split(',').pop().trim() || 'ODISHA'}</td>
            <td><span class="badge ${isCompleted ? 'approved' : 'pending'}">${isCompleted ? 'Completed' : 'Pending'}</span></td>
          </tr>
        `;
      }).join('');
    }
  }
}

// Render Students
function renderStudents(students) {
  const tbody = document.getElementById('students-tbody');
  if (!tbody) return;

  if (students.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No students registered yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = students.map(s => `
    <tr>
      <td style="font-family: monospace; font-size:12px;">${s.id}</td>
      <td style="font-weight: 600; color: var(--text-primary);">${s.name}</td>
      <td>${s.email}</td>
      <td>${new Date(s.createdAt).toLocaleDateString('en-IN')}</td>
    </tr>
  `).join('');
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
  if (!select) return;

  // Clear existing items except default
  select.innerHTML = `<option value="all">Accessible to All Students</option>`;
  courses.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.innerText = c.title;
    select.appendChild(opt);
  });
}

// Render Enrollments
function renderEnrollments(enrollments, courses) {
  const tbody = document.getElementById('enrollments-tbody');
  if (!tbody) return;

  if (enrollments.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No course enrollment requests found.</td></tr>`;
    return;
  }

  tbody.innerHTML = enrollments.map(e => {
    const course = courses.find(c => c.id === e.courseId);
    return `
      <tr>
        <td>
          <div style="font-weight: 600; color: var(--text-primary);">${e.studentName}</div>
          <div style="font-size:12px; color:var(--text-muted);">${e.studentEmail} &bull; ${e.studentMobile}</div>
        </td>
        <td>${e.address || 'N/A'}</td>
        <td style="font-weight: 600;">${course ? course.title : e.courseId}</td>
        <td>${new Date(e.createdAt).toLocaleDateString('en-IN')}</td>
        <td><span class="badge ${e.status === 'approved' ? 'approved' : 'pending'}">${e.status}</span></td>
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
        <span class="notice-date">${n.date}</span>
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
    container.innerHTML = `<p style="color: var(--text-muted); text-align: center;">No announcements releases.</p>`;
    return;
  }

  container.innerHTML = announcements.map(a => `
    <div class="glass-card announcement-item" style="margin-bottom: 12px; padding: 16px;">
      <div class="notice-item-header" style="margin-bottom: 4px;">
        <span class="notice-title" style="font-size: 14px; font-weight: 600;"><i class="fas fa-comment-dots" style="color: #3b82f6;"></i> Announcement</span>
        <span class="announcement-date">${a.date}</span>
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
    showToast(error.message || 'Failed to post notice.', 'error');
  }
}

// --- ANNOUNCEMENT BOARD BROADCST HANDLER ---
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

// Bind to window for global inline trigger access
window.approvePaymentDirectly = approvePaymentDirectly;
