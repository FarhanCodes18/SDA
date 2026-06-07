// Global Configurations
const API_URL = 'http://localhost:5000/api';
const RAZORPAY_KEY_ID = 'rzp_test_SyOt9emCtE5rH8'; // Expose ONLY Razorpay Key ID

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
    localStorage.setItem('sda_token', token);
  },
  getToken() {
    return localStorage.getItem('sda_token');
  },
  removeToken() {
    localStorage.removeItem('sda_token');
    localStorage.removeItem('sda_user');
  },
  saveUser(user) {
    localStorage.setItem('sda_user', JSON.stringify(user));
  },
  getUser() {
    const userStr = localStorage.getItem('sda_user');
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
    const result = await response.json();
    
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

  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      const isVisible = navLinks.style.display === 'flex';
      navLinks.style.display = isVisible ? 'none' : 'flex';
      navLinks.style.flexDirection = 'column';
      navLinks.style.position = 'absolute';
      navLinks.style.top = '80px';
      navLinks.style.left = '0';
      navLinks.style.width = '100%';
      navLinks.style.background = 'rgba(10, 10, 12, 0.95)';
      navLinks.style.padding = '20px';
      navLinks.style.borderBottom = '1px solid var(--border-color)';
    });
  }
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
  return `
    <div class="glass-card course-card">
      <span class="course-card-badge">${course.category.toUpperCase()}</span>
      <h3 class="course-title">${course.title}</h3>
      <div class="course-meta">
        <span><i class="far fa-clock"></i> ${course.duration}</span>
        <span><i class="fas fa-layer-group"></i> ${course.level}</span>
        <span><i class="fas fa-star"></i> ${course.rating || '4.8'}</span>
      </div>
      <p class="course-description">${course.description}</p>
      <div class="course-footer">
        <div class="course-pricing">
          <span class="course-price-current">₹${course.price}</span>
          <span class="course-price-original">₹${course.originalPrice || course.price * 2}</span>
        </div>
        <button onclick="openEnrollmentModal('${course.id}')" class="btn-primary">
          Buy Now <i class="fas fa-shopping-cart"></i>
        </button>
      </div>
    </div>
  `;
}
