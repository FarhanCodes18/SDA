// Global Configurations
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:'
  ? 'http://localhost:5000/api'
  : 'https://sda-gb0m.onrender.com/api';

// 1. Unified Toast Notification System
function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  let iconClass = 'fa-info-circle';
  if (type === 'success') iconClass = 'fa-check-circle';
  if (type === 'error') iconClass = 'fa-exclamation-circle';

  toast.innerHTML = `
    <i class="fas ${iconClass}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  // Automatically remove toast after 4 seconds
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards';
    toast.addEventListener('animationend', () => toast.remove());
  }, 4000);
}

// Add CSS animation keyframes for toast exit
const style = document.createElement('style');
style.innerHTML = `
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
`;
document.head.appendChild(style);

// 2. Authentication Utilities
const Auth = {
  saveToken(token) {
    sessionStorage.setItem('sda_token', token);
  },
  getToken() {
    return sessionStorage.getItem('sda_token');
  },
  removeToken() {
    sessionStorage.removeItem('sda_token');
    sessionStorage.removeItem('sda_user');
  },
  saveUser(user) {
    sessionStorage.setItem('sda_user', JSON.stringify(user));
  },
  getUser() {
    const userStr = sessionStorage.getItem('sda_user');
    try {
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  },
  isLoggedIn() {
    return !!this.getToken();
  },
  logout() {
    this.removeToken();
    showToast('Logged out successfully!', 'info');
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 1000);
  },
  redirectToDashboard() {
    const user = this.getUser();
    if (!user) return;
    if (user.role === 'admin') {
      window.location.href = 'admin-dashboard.html';
    } else {
      window.location.href = 'student-dashboard.html';
    }
  }
};

// 3. Shared Global API Calls
async function apiCall(endpoint, method = 'GET', data = null, authenticate = true) {
  const headers = {
    'Content-Type': 'application/json'
  };

  if (authenticate) {
    const token = Auth.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const config = {
    method,
    headers
  };

  if (data) {
    config.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, config);
    
    let result;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      result = await response.json();
    } else {
      // If server returned an HTML error page (like a 404 or 500)
      const text = await response.text();
      // Try to extract text if it's an express error page
      const match = text.match(/<pre>(.*)<\/pre>/s);
      const errMsg = match ? match[1] : (text.slice(0, 100) || `HTTP error! Status: ${response.status}`);
      throw new Error(errMsg);
    }
    
    if (!response.ok) {
      throw new Error(result.message || 'Something went wrong.');
    }
    return result;
  } catch (error) {
    console.error(`API Call failed to ${endpoint}:`, error);
    throw error;
  }
}

// 4. Global Navbar Init
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initHamburger();
  initFAQ();
});

function initNavbar() {
  const authNav = document.getElementById('auth-nav');
  if (!authNav) return;

  if (Auth.isLoggedIn()) {
    const user = Auth.getUser();
    const dashboardLink = user.role === 'admin' ? 'admin-dashboard.html' : 'student-dashboard.html';
    
    authNav.innerHTML = `
      <a href="${dashboardLink}" class="btn-secondary">
        <i class="fas fa-columns"></i> Dashboard
      </a>
      <button onclick="Auth.logout()" class="btn-primary" style="background: var(--danger); box-shadow: none;">
        <i class="fas fa-sign-out-alt"></i> Logout
      </button>
    `;
  } else {
    authNav.innerHTML = `
      <a href="login.html" style="font-weight:600; color: var(--text-secondary);">Login</a>
      <a href="register.html" class="btn-primary">Register <i class="fas fa-arrow-right"></i></a>
    `;
  }
}

function initHamburger() {
  const hamburger = document.querySelector('.hamburger');
  const navLinks = document.querySelector('.nav-links');

  if (!hamburger || !navLinks) return;

  // Toggle menu open/close
  hamburger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = navLinks.classList.contains('mobile-open');
    if (isOpen) {
      closeMobileMenu(hamburger, navLinks);
    } else {
      openMobileMenu(hamburger, navLinks);
    }
  });

  // Close menu when any nav link is clicked
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      closeMobileMenu(hamburger, navLinks);
    });
  });

  // Close menu when clicking outside the navbar
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.navbar')) {
      closeMobileMenu(hamburger, navLinks);
    }
  });
}

function openMobileMenu(hamburger, navLinks) {
  navLinks.classList.add('mobile-open');
  hamburger.querySelector('i').classList.replace('fa-bars', 'fa-times');
  hamburger.setAttribute('aria-expanded', 'true');
}

function closeMobileMenu(hamburger, navLinks) {
  navLinks.classList.remove('mobile-open');
  hamburger.querySelector('i').classList.replace('fa-times', 'fa-bars');
  hamburger.setAttribute('aria-expanded', 'false');
}

function initFAQ() {
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const header = item.querySelector('.faq-question');
    if (header) {
      header.addEventListener('click', () => {
        const active = document.querySelector('.faq-item.active');
        if (active && active !== item) {
          active.classList.remove('active');
        }
        item.classList.toggle('active');
      });
    }
  });
}

// 5. Course Enrollment Modals and flow
let activeCourseIdToEnroll = null;

function openEnrollmentModal(courseId) {
  if (!Auth.isLoggedIn()) {
    showToast('Please Login or Register to enroll in courses.', 'error');
    setTimeout(() => {
      window.location.href = `login.html?redirect=courses.html`;
    }, 1500);
    return;
  }

  activeCourseIdToEnroll = courseId;
  const user = Auth.getUser();

  // Create enrollment modal structure dynamically if not present
  let modal = document.getElementById('enrollment-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'enrollment-modal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title">Course Enrollment Form</h3>
        <button class="modal-close" onclick="closeEnrollmentModal()"><i class="fas fa-times"></i></button>
      </div>
      <div class="modal-body">
        <form id="enrollment-form">
          <div class="form-group">
            <label>Full Name</label>
            <input type="text" class="form-control" id="enroll-name" value="${user?.name || ''}" required>
          </div>
          <div class="form-group">
            <label>Mobile Number</label>
            <input type="tel" class="form-control" id="enroll-mobile" placeholder="Enter 10-digit number" required>
          </div>
          <div class="form-group">
            <label>Email Address</label>
            <input type="email" class="form-control" id="enroll-email" value="${user?.email || ''}" required>
          </div>
          <div class="form-group">
            <label>Full Address</label>
            <textarea class="form-control" id="enroll-address" placeholder="Enter your delivery address" required></textarea>
          </div>
          <button type="submit" class="btn-primary" style="width: 100%; justify-content: center;">
            Submit Enrollment Request <i class="fas fa-paper-plane"></i>
          </button>
        </form>
      </div>
    </div>
  `;

  modal.classList.add('active');

  // Add submit listener
  const form = document.getElementById('enrollment-form');
  form.addEventListener('submit', handleEnrollmentSubmit);
}

function closeEnrollmentModal() {
  const modal = document.getElementById('enrollment-modal');
  if (modal) {
    modal.classList.remove('active');
  }
}

async function handleEnrollmentSubmit(e) {
  e.preventDefault();

  const fullName = document.getElementById('enroll-name').value;
  const mobile = document.getElementById('enroll-mobile').value;
  const email = document.getElementById('enroll-email').value;
  const address = document.getElementById('enroll-address').value;

  if (!fullName || !mobile || !email || !address) {
    showToast('All form fields are required.', 'error');
    return;
  }

  try {
    const response = await apiCall('/enroll', 'POST', {
      courseId: activeCourseIdToEnroll,
      fullName,
      mobile,
      email,
      address
    });

    closeEnrollmentModal();
    showToast(response.message, 'success');
    
    // Redirect student to dashboard to pay
    setTimeout(() => {
      window.location.href = 'student-dashboard.html';
    }, 2000);

  } catch (error) {
    showToast(error.message || 'Enrollment request failed.', 'error');
  }
}

// 6. Public Course Card Factory Render
function createCourseCard(course) {
  const discount = (course.id === 'course_1' || course.id === 'course_3' || course.id === 'course_5' || course.id === 'course_7' || course.id === 'course_9') ? '10% OFF' : '5% OFF';
  return `
    <div class="glass-card course-card" style="position: relative;">
      <span class="course-card-badge" style="top: 16px; left: 16px; right: auto; background: rgba(16, 185, 129, 0.15); color: var(--success); border: 1px solid var(--success);"><i class="fas fa-tags" style="margin-right: 4px;"></i> ${discount}</span>
      <span class="course-card-badge" style="background: rgba(255, 75, 43, 0.15); color: var(--accent-color); border: 1px solid var(--accent-color);"><i class="fas fa-lock" style="margin-right: 4px;"></i> COMING SOON</span>
      <h3 class="course-title" style="margin-top: 12px;">${course.title}</h3>
      <div class="course-meta">
        <span><i class="far fa-clock"></i> ${course.duration}</span>
        <span><i class="fas fa-layer-group"></i> ${course.level}</span>
        <span><i class="fas fa-star"></i> ${course.rating || '4.8'}</span>
      </div>
      <p class="course-description">${course.description}</p>
      <div style="font-size: 13px; color: var(--accent-color); font-weight: 600; margin-bottom: 16px; display: flex; align-items: center; gap: 6px;">
        <i class="fas fa-calendar-alt"></i> Releasing 20 August 2026
      </div>
      <div class="course-footer">
        <div class="course-pricing">
          <span class="course-price-current">₹${course.price}</span>
          <span class="course-price-original">₹${course.originalPrice || course.price * 2}</span>
          <span style="font-size: 11px; color: var(--warning); font-weight: 700; margin-top: 4px; white-space: nowrap;"><i class="fas fa-fire"></i> First 10 Seats Special Discount</span>
        </div>
        <button class="btn-primary" disabled style="background: var(--text-muted); color: var(--bg-primary); cursor: not-allowed; box-shadow: none; opacity: 0.6;">
          Locked <i class="fas fa-lock"></i>
        </button>
      </div>
    </div>
  `;
}

// 7. Certificate Unlock Flow
function openCertificateUnlockModal() {
  const user = Auth.getUser();

  // Create modal overlay structure if not present
  let modal = document.getElementById('cert-unlock-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'cert-unlock-modal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title">Unlock Your Verified Certificate</h3>
        <button class="modal-close" onclick="closeCertificateUnlockModal()"><i class="fas fa-times"></i></button>
      </div>
      <div class="modal-body">
        <form id="cert-unlock-form">
          <div class="form-group">
            <label>Full Name</label>
            <input type="text" class="form-control" id="cert-unlock-name" value="${user?.name || ''}" required placeholder="Farhan Khan">
          </div>
          <div class="form-group">
            <label>Mobile Number</label>
            <input type="tel" class="form-control" id="cert-unlock-mobile" placeholder="Enter 10-digit mobile number" required>
          </div>
          <div class="form-group">
            <label>Email Address</label>
            <input type="email" class="form-control" id="cert-unlock-email" value="${user?.email || ''}" required placeholder="name@example.com">
          </div>
          <div class="form-group">
            <label>Select Certificate Course</label>
            <select class="form-control" id="cert-unlock-course" required>
              <option value="" disabled selected>Select course to certify</option>
              <option value="C Programming" data-price="499">C Programming — ₹499</option>
              <option value="C++ Programming" data-price="699">C++ Programming — ₹699</option>
              <option value="Python Programming" data-price="799">Python Programming — ₹799</option>
              <option value="Java Programming" data-price="799">Java Programming — ₹799</option>
              <option value="DSA with C++" data-price="999">DSA with C++ — ₹999</option>
              <option value="Web Designer" data-price="1">Web Designer — ₹1</option>
            </select>
          </div>
          
          <div class="price-display-wrapper" id="cert-price-box" style="display:none; background: rgba(255, 75, 43, 0.05); border: 1px dashed rgba(255, 75, 43, 0.2); padding: 14px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
            <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 4px;">Certificate Price</p>
            <h4 style="font-size: 24px; color: var(--accent-color); font-weight: 800;" id="cert-unlock-price-value">₹0</h4>
          </div>

          <div class="qr-code-wrapper" id="cert-qr-box" style="display:none; text-align: center; margin-bottom: 20px; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px;">
            <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px; font-weight:600;"><i class="fas fa-qrcode" style="color: var(--accent-color); margin-right: 6px;"></i> Scan & Pay using any UPI App</p>
            <div style="background: white; padding: 12px; display: inline-block; border-radius: 8px; margin-bottom: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
              <img id="cert-qr-img" src="" alt="UPI QR Code" style="width: 180px; height: 180px; display: block; border-radius: 4px;">
            </div>
            <div style="font-size: 13px; color: var(--text-secondary);">
              <p style="margin-bottom: 4px;">Payee Name: <strong style="color: var(--text-primary);">Ajay Shukla</strong></p>
              <p>UPI ID: <strong style="color: var(--text-primary);" id="upi-string">9302677702@ybl</strong> 
                <button type="button" onclick="navigator.clipboard.writeText('9302677702@ybl'); showToast('UPI ID copied!', 'success');" style="background:none; border:none; color: var(--accent-color); cursor:pointer; padding: 0 4px;" title="Copy UPI ID">
                  <i class="far fa-copy"></i>
                </button>
              </p>
            </div>
          </div>

          <div class="form-group" id="cert-upload-box" style="display:none;">
            <label>Upload Payment Screenshot</label>
            <input type="file" class="form-control" id="cert-unlock-screenshot" accept="image/*" required>
          </div>
          
          <button type="submit" class="btn-primary" id="cert-unlock-btn" style="width: 100%; justify-content: center; padding: 14px;">
            Submit Details & Proof <i class="fas fa-upload" style="margin-left: 8px;"></i>
          </button>
        </form>
      </div>
    </div>
  `;

  modal.classList.add('active');

  // Wire course dropdown price update
  const courseSelect = document.getElementById('cert-unlock-course');
  const priceBox = document.getElementById('cert-price-box');
  const priceVal = document.getElementById('cert-unlock-price-value');
  const qrBox = document.getElementById('cert-qr-box');
  const qrImg = document.getElementById('cert-qr-img');
  const uploadBox = document.getElementById('cert-upload-box');

  courseSelect.addEventListener('change', () => {
    const selectedOption = courseSelect.options[courseSelect.selectedIndex];
    const price = selectedOption.getAttribute('data-price');
    if (price) {
      priceVal.innerText = '₹' + price;
      priceBox.style.display = 'block';

      // Update UPI QR Code URL dynamically
      const upiUrl = `upi://pay?pa=9302677702@ybl&pn=Ajay%20Shukla&am=${price}&cu=INR&tn=Certificate%20Request`;
      qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(upiUrl)}`;
      qrBox.style.display = 'block';
      uploadBox.style.display = 'block';
    } else {
      priceBox.style.display = 'none';
      qrBox.style.display = 'none';
      uploadBox.style.display = 'none';
    }
  });

  // Wire submit handler
  const form = document.getElementById('cert-unlock-form');
  form.addEventListener('submit', handleCertificateUnlockSubmit);
}

function closeCertificateUnlockModal() {
  const modal = document.getElementById('cert-unlock-modal');
  if (modal) {
    modal.classList.remove('active');
  }
}

async function handleCertificateUnlockSubmit(e) {
  e.preventDefault();

  const fullName = document.getElementById('cert-unlock-name').value.trim();
  const mobile = document.getElementById('cert-unlock-mobile').value.trim();
  const email = document.getElementById('cert-unlock-email').value.trim();
  const courseSelect = document.getElementById('cert-unlock-course');
  const courseName = courseSelect.value;
  const selectedOption = courseSelect.options[courseSelect.selectedIndex];
  const price = selectedOption.getAttribute('data-price');
  const screenshotInput = document.getElementById('cert-unlock-screenshot');

  if (!fullName || !mobile || !email || !courseName || !price || screenshotInput.files.length === 0) {
    showToast('Please fill out all details and upload the payment screenshot.', 'error');
    return;
  }

  // Mobile Validation: 10 digit number starting with 6-9
  const phoneRegex = /^[6-9]\d{9}$/;
  if (!phoneRegex.test(mobile)) {
    showToast('Please enter a valid 10-digit mobile number starting with 6-9.', 'error');
    return;
  }

  // Email Validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showToast('Please enter a valid email address.', 'error');
    return;
  }

  const submitBtn = document.getElementById('cert-unlock-btn');
  const originalBtnHTML = submitBtn.innerHTML;

  const formData = new FormData();
  formData.append('fullName', fullName);
  formData.append('mobile', mobile);
  formData.append('email', email);
  formData.append('courseName', courseName);
  formData.append('amount', price);
  formData.append('screenshot', screenshotInput.files[0]);

  try {
    // Disable submit button & show loading state
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.7';
    submitBtn.innerHTML = 'Submitting Request... <i class="fas fa-spinner fa-spin"></i>';

    const token = Auth.getToken();
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(`${API_URL}/certificate-manual-request`, {
      method: 'POST',
      headers: headers,
      body: formData
    });

    const res = await response.json();
    if (!response.ok) {
      throw new Error(res.message || 'Submission failed.');
    }

    closeCertificateUnlockModal();
    showToast(res.message, 'success');
    
    // Show successful unlock modal/feedback
    showCertificateSuccessModal(fullName, courseName);

  } catch (error) {
    showToast(error.message || 'Failed to submit certificate request.', 'error');
    // Reset button state
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
        <h3 style="font-size: 22px; margin-bottom: 12px; font-family: var(--font-header);">Payment Successful!</h3>
        <p style="color: var(--text-secondary); font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
          Your certificate request has been submitted. You will receive your certificate within 24 hours.
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

