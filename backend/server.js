require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Razorpay = require('razorpay');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'sukla_digital_academy_super_secret_key_2026';

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_SyOt9emCtE5rH8',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'C8A0LCcGKEsptz4jbrXehOtT'
});

// Middleware
app.use(cors());
app.use(express.json());

// Serve static upload files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configure Multer for File Uploads
const multer = require('multer');
const UPLOAD_DIR = path.join(__dirname, 'uploads', 'achievers');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, 'achiever_' + Date.now() + ext);
  }
});

const upload = multer({ storage });

// JSON File Database Helper Functions
const DATA_DIR = path.join(__dirname, 'data');

const getFilePath = (filename) => path.join(DATA_DIR, filename);

const readJSONFile = (filename) => {
  try {
    const filePath = getFilePath(filename);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify([]), 'utf8');
    }
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data || '[]');
  } catch (error) {
    console.error(`Error reading ${filename}:`, error);
    return [];
  }
};

const writeJSONFile = (filename, data) => {
  try {
    const filePath = getFilePath(filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error(`Error writing to ${filename}:`, error);
    return false;
  }
};

// Middleware for JWT Authentication
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access denied. Token missing.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token.' });
    }
    req.user = user;
    next();
  });
};

// Middleware for Admin Authorization
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
  }
};

// Programmatic DB Seeding Function
const seedDatabase = async () => {
  try {
    const users = readJSONFile('users.json');
    
    // Seed Admin if not exists
    const adminExists = users.some(u => u.email === 'admin@sukla.com');
    if (!adminExists) {
      const hashedAdminPassword = await bcrypt.hash('admin123', 10);
      users.push({
        id: 'user_admin_01',
        name: 'Admin Instructor',
        email: 'admin@sukla.com',
        password: hashedAdminPassword,
        role: 'admin',
        createdAt: new Date().toISOString()
      });
      console.log('Seeded Admin account (admin@sukla.com)');
    }

    // Seed Student if not exists
    const studentExists = users.some(u => u.email === 'student@sukla.com');
    if (!studentExists) {
      const hashedStudentPassword = await bcrypt.hash('student123', 10);
      users.push({
        id: 'user_student_01',
        name: 'Student Learner',
        email: 'student@sukla.com',
        password: hashedStudentPassword,
        role: 'student',
        createdAt: new Date().toISOString()
      });
      console.log('Seeded Student account (student@sukla.com)');
    }

    // Seed default placement achievers if none exists
    const achievers = readJSONFile('achievers.json');
    if (achievers.length === 0) {
      const defaultAchievers = [
        { id: 'ach_1', name: 'Preksha Dwivedi', company: 'Zenus Group', image: '' },
        { id: 'ach_2', name: 'Yojna Pardhi', company: 'Zenus Group', image: '' },
        { id: 'ach_3', name: 'Himanshu Patle', company: 'Zenus Group', image: '' },
        { id: 'ach_4', name: 'Vishakha Baghele', company: 'First Step Innovation', image: '' },
        { id: 'ach_5', name: 'Dewang Malewar', company: 'First Step Innovation', image: '' }
      ];
      writeJSONFile('achievers.json', defaultAchievers);
      console.log('Seeded 5 default placement achievers');
    }

    writeJSONFile('users.json', users);
  } catch (error) {
    console.error('Database seeding failed:', error);
  }
};

// ==========================================
// API ENDPOINTS
// ==========================================

// 1. AUTHENTICATION ENDPOINTS

// Register
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please provide name, email, and password.' });
    }

    const users = readJSONFile('users.json');
    const userExists = users.some(u => u.email.toLowerCase() === email.toLowerCase());

    if (userExists) {
      return res.status(400).json({ message: 'User with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const assignedRole = email.toLowerCase() === 'admin@sukla.com' ? 'admin' : 'student';

    const newUser = {
      id: 'user_' + Date.now(),
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: assignedRole,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    writeJSONFile('users.json', users);

    // Generate JWT
    const token = jwt.sign(
      { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User registered successfully!',
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role
      }
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error during registration.', error: error.message });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password.' });
    }

    const users = readJSONFile('users.json');
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful!',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error during login.', error: error.message });
  }
});

// 2. STUDENT DASHBOARD AGGREGATED ENDPOINT
app.get('/api/student/dashboard/:studentId', authenticateToken, (req, res) => {
  try {
    const studentId = req.params.studentId;
    
    // Check access permissions (students can only fetch their own dashboard, admin can fetch any)
    if (req.user.role !== 'admin' && req.user.id !== studentId) {
      return res.status(403).json({ message: 'Access denied. Unauthorized dashboard view.' });
    }

    const courses = readJSONFile('courses.json');
    const enrollments = readJSONFile('enrollments.json');
    const payments = readJSONFile('payments.json');
    const certificates = readJSONFile('certificates.json');
    const notices = readJSONFile('notices.json');
    const announcements = readJSONFile('announcements.json');
    const recordedClasses = readJSONFile('recordedClasses.json');

    // Filter student-specific data
    const studentEnrollments = enrollments.filter(e => e.studentId === studentId);
    
    // Map enrolled courses details
    const enrolledCourses = studentEnrollments.map(e => {
      const course = courses.find(c => c.id === e.courseId);
      return course ? { ...course, enrollmentStatus: e.status, enrollmentId: e.id } : null;
    }).filter(Boolean);

    const purchasedCourses = enrolledCourses.filter(c => c.enrollmentStatus === 'approved');
    const pendingPayments = studentEnrollments.filter(e => e.status === 'pending').map(e => {
      const course = courses.find(c => c.id === e.courseId);
      return {
        enrollmentId: e.id,
        courseId: e.courseId,
        courseName: course ? course.title : 'Unknown Course',
        amount: course ? course.price : 0,
        createdAt: e.createdAt
      };
    });

    const studentPayments = payments.filter(p => p.studentId === studentId);
    const studentCertificates = certificates.filter(c => c.studentId === studentId);

    // Return everything
    res.json({
      enrolledCourses,
      purchasedCourses,
      pendingPayments,
      payments: studentPayments,
      certificates: studentCertificates,
      notices,
      announcements,
      recordedClasses
    });

  } catch (error) {
    res.status(500).json({ message: 'Error fetching student dashboard details.', error: error.message });
  }
});

// 3. COURSE ENDPOINTS

// Get all courses (Public)
app.get('/api/courses', (req, res) => {
  try {
    const courses = readJSONFile('courses.json');
    res.json(courses);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching courses.' });
  }
});

// Add a course (Admin only)
app.post('/api/courses', authenticateToken, isAdmin, (req, res) => {
  try {
    const { title, duration, level, price, originalPrice, description, category } = req.body;

    if (!title || !duration || !level || !price || !description) {
      return res.status(400).json({ message: 'Missing required course fields.' });
    }

    const courses = readJSONFile('courses.json');
    const courseId = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // Check duplicate
    if (courses.some(c => c.id === courseId)) {
      return res.status(400).json({ message: 'A course with a similar title already exists.' });
    }

    const newCourse = {
      id: courseId,
      title,
      duration,
      level,
      price: Number(price),
      originalPrice: Number(originalPrice || price * 2),
      rating: 4.8,
      instructor: req.user.name || 'Farhan Khan',
      description,
      category: category || 'development'
    };

    courses.push(newCourse);
    writeJSONFile('courses.json', courses);

    res.status(201).json({ message: 'Course created successfully!', course: newCourse });
  } catch (error) {
    res.status(500).json({ message: 'Error saving course.', error: error.message });
  }
});

// Update a course (Admin only)
app.put('/api/courses/:id', authenticateToken, isAdmin, (req, res) => {
  try {
    const courseId = req.params.id;
    const { title, duration, level, price, originalPrice, description, category } = req.body;

    const courses = readJSONFile('courses.json');
    const courseIndex = courses.findIndex(c => c.id === courseId);

    if (courseIndex === -1) {
      return res.status(404).json({ message: 'Course not found.' });
    }

    courses[courseIndex] = {
      ...courses[courseIndex],
      title: title || courses[courseIndex].title,
      duration: duration || courses[courseIndex].duration,
      level: level || courses[courseIndex].level,
      price: price ? Number(price) : courses[courseIndex].price,
      originalPrice: originalPrice ? Number(originalPrice) : courses[courseIndex].originalPrice,
      description: description || courses[courseIndex].description,
      category: category || courses[courseIndex].category
    };

    writeJSONFile('courses.json', courses);
    res.json({ message: 'Course updated successfully!', course: courses[courseIndex] });
  } catch (error) {
    res.status(500).json({ message: 'Error updating course.', error: error.message });
  }
});

// Delete a course (Admin only)
app.delete('/api/courses/:id', authenticateToken, isAdmin, (req, res) => {
  try {
    const courseId = req.params.id;
    let courses = readJSONFile('courses.json');
    
    const courseIndex = courses.findIndex(c => c.id === courseId);
    if (courseIndex === -1) {
      return res.status(404).json({ message: 'Course not found.' });
    }

    courses.splice(courseIndex, 1);
    writeJSONFile('courses.json', courses);

    res.json({ message: 'Course deleted successfully!' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting course.', error: error.message });
  }
});

// 4. ENROLLMENT ENDPOINTS

// Enroll (Student enroll request)
app.post('/api/enroll', authenticateToken, (req, res) => {
  try {
    const { courseId, fullName, mobile, email, address } = req.body;
    const studentId = req.user.id;

    if (!courseId) {
      return res.status(400).json({ message: 'Course ID is required.' });
    }

    const courses = readJSONFile('courses.json');
    const course = courses.find(c => c.id === courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found.' });
    }

    const enrollments = readJSONFile('enrollments.json');

    // Check if enrollment already exists
    const existingEnroll = enrollments.find(e => e.studentId === studentId && e.courseId === courseId);
    if (existingEnroll) {
      if (existingEnroll.status === 'approved') {
        return res.status(400).json({ message: 'You are already enrolled and paid for this course.' });
      } else {
        return res.status(200).json({ message: 'Enrollment requested already. Complete payment in Dashboard.', enrollment: existingEnroll });
      }
    }

    const newEnrollment = {
      id: 'enroll_' + Date.now(),
      studentId,
      courseId,
      studentName: fullName || req.user.name,
      studentMobile: mobile || '',
      studentEmail: email || req.user.email,
      address: address || '',
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    enrollments.push(newEnrollment);
    writeJSONFile('enrollments.json', enrollments);

    res.status(201).json({ message: 'Enrollment request created! Complete payment in Dashboard.', enrollment: newEnrollment });
  } catch (error) {
    res.status(500).json({ message: 'Error enrolling in course.', error: error.message });
  }
});

// Get all enrollments (Admin only)
app.get('/api/enrollments', authenticateToken, isAdmin, (req, res) => {
  try {
    const enrollments = readJSONFile('enrollments.json');
    res.json(enrollments);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching enrollments.' });
  }
});

// Get enrollments for a specific student
app.get('/api/enrollments/:studentId', authenticateToken, (req, res) => {
  try {
    const studentId = req.params.studentId;

    if (req.user.role !== 'admin' && req.user.id !== studentId) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const enrollments = readJSONFile('enrollments.json');
    const studentEnrollments = enrollments.filter(e => e.studentId === studentId);
    res.json(studentEnrollments);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching student enrollments.' });
  }
});

// 5. RAZORPAY & PAYMENT ENDPOINTS

// Create order
app.post('/api/create-order', authenticateToken, async (req, res) => {
  try {
    const { amount, currency } = req.body;
    
    if (!amount) {
      return res.status(400).json({ message: 'Amount is required' });
    }

    const options = {
      amount: Math.round(Number(amount) * 100), // Amount in paise
      currency: currency || 'INR',
      receipt: 'rcpt_' + Date.now()
    };

    const order = await razorpay.orders.create(options);
    res.json({ orderId: order.id, amount: order.amount, currency: order.currency });
  } catch (error) {
    res.status(500).json({ message: 'Error creating Razorpay order', error: error.message });
  }
});

// Verify signature and save payments
app.post('/api/verify-payment', authenticateToken, (req, res) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      paymentType, // 'Course Payment' or 'Certificate Payment'
      courseId, // if course payment
      studentName,
      studentEmail,
      studentMobile,
      certificateDetails, // if certificate payment
      amount
    } = req.body;

    const studentId = req.user.id;

    // Verify signature
    const hmac = crypto.createHmac('sha256', razorpay.key_secret);
    hmac.update(razorpay_order_id + '|' + razorpay_payment_id);
    const generated_signature = hmac.digest('hex');

    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({ message: 'Invalid payment signature. Verification failed.' });
    }

    // Resolve course details
    const courses = readJSONFile('courses.json');
    const course = courses.find(c => c.id === courseId);
    const resolvedCourseName = paymentType === 'Course Payment'
      ? (course ? course.title : courseId)
      : certificateDetails.courseName;

    // Capture payment in JSON
    const payments = readJSONFile('payments.json');
    const newPayment = {
      id: 'pay_' + Date.now(),
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      studentId,
      studentName: studentName || req.user.name,
      studentEmail: studentEmail || req.user.email,
      studentMobile: paymentType === 'Certificate Payment' ? certificateDetails.mobile : (studentMobile || ''),
      courseName: resolvedCourseName,
      paymentType,
      amount: Number(amount),
      status: 'captured',
      date: new Date().toISOString()
    };
    payments.push(newPayment);
    writeJSONFile('payments.json', payments);

    if (paymentType === 'Course Payment') {
      // Approve enrollment directly
      const enrollments = readJSONFile('enrollments.json');
      const enrollIndex = enrollments.findIndex(e => e.studentId === studentId && e.courseId === courseId);
      
      if (enrollIndex !== -1) {
        enrollments[enrollIndex].status = 'approved';
        enrollments[enrollIndex].studentName = studentName || enrollments[enrollIndex].studentName;
        enrollments[enrollIndex].studentEmail = studentEmail || enrollments[enrollIndex].studentEmail;
        enrollments[enrollIndex].studentMobile = studentMobile || enrollments[enrollIndex].studentMobile;
      } else {
        // Create matching enrollment as approved directly
        enrollments.push({
          id: 'enroll_' + Date.now(),
          studentId,
          courseId,
          studentName: studentName || req.user.name,
          studentEmail: studentEmail || req.user.email,
          studentMobile: studentMobile || '',
          address: '',
          status: 'approved',
          createdAt: new Date().toISOString()
        });
      }
      writeJSONFile('enrollments.json', enrollments);
    } else if (paymentType === 'Certificate Payment') {
      // Unlock certificate & save request
      const certificates = readJSONFile('certificates.json');
      const certId = 'cert_' + Date.now();
      certificates.push({
        id: certId,
        studentId,
        name: certificateDetails.fullName || certificateDetails.name,
        mobile: certificateDetails.mobile,
        email: certificateDetails.email,
        courseName: certificateDetails.courseName,
        certType: certificateDetails.certificateType || certificateDetails.certType,
        address: certificateDetails.address,
        status: 'pending', // Pending sending by admin
        date: new Date().toISOString()
      });
      writeJSONFile('certificates.json', certificates);
    }

    res.json({ message: 'Payment verified and recorded successfully!', paymentId: razorpay_payment_id });

  } catch (error) {
    res.status(500).json({ message: 'Error verifying signature.', error: error.message });
  }
});

// Get all payments (Admin only)
app.get('/api/payments', authenticateToken, isAdmin, (req, res) => {
  try {
    const payments = readJSONFile('payments.json');
    res.json(payments);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching payments.' });
  }
});

// Get payments for a specific student
app.get('/api/payments/:studentId', authenticateToken, (req, res) => {
  try {
    const studentId = req.params.studentId;

    if (req.user.role !== 'admin' && req.user.id !== studentId) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const payments = readJSONFile('payments.json');
    const studentPayments = payments.filter(p => p.studentId === studentId);
    res.json(studentPayments);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching student payments.' });
  }
});

// Admin manual payment status/details update
app.put('/api/payments/:id/status', authenticateToken, isAdmin, (req, res) => {
  try {
    const payId = req.params.id;
    const { status } = req.body;

    const payments = readJSONFile('payments.json');
    const payIndex = payments.findIndex(p => p.id === payId);

    if (payIndex === -1) {
      return res.status(404).json({ message: 'Payment record not found.' });
    }

    const oldStatus = payments[payIndex].status;
    payments[payIndex].status = status;
    writeJSONFile('payments.json', payments);

    // If manual update is to "captured", approve corresponding enrollment if relevant
    if (status === 'captured' && oldStatus !== 'captured') {
      const payment = payments[payIndex];
      if (payment.paymentType === 'Course Payment') {
        const enrollments = readJSONFile('enrollments.json');
        const enrollIndex = enrollments.findIndex(e => e.studentId === payment.studentId && (e.courseId === payment.courseName || e.id === payment.courseId));
        if (enrollIndex !== -1) {
          enrollments[enrollIndex].status = 'approved';
          writeJSONFile('enrollments.json', enrollments);
        }
      }
    }

    res.json({ message: 'Payment status updated manually!', payment: payments[payIndex] });
  } catch (error) {
    res.status(500).json({ message: 'Error updating payment status.', error: error.message });
  }
});

// 6. CERTIFICATE ENDPOINTS

// Request certificate (Before payment - locks/saves info as pending)
app.post('/api/certificate-request', authenticateToken, async (req, res) => {
  try {
    const { fullName, mobile, email, courseName, certificateType, address } = req.body;
    const studentId = req.user.id;

    if (!fullName || !mobile || !email || !courseName || !certificateType || !address) {
      return res.status(400).json({ message: 'Missing required certificate details.' });
    }

    // We don't save to certificates.json yet, or we save it as a draft/pending payment.
    // The spec states:
    // "Before payment, open form modal and collect ... After form submit, open Razorpay payment. After successful payment ... Save full payment details in backend."
    // So the frontend collects form data, submits to `/api/create-order` or `/api/certificate-request` to generate a Razorpay order, then completes payment.
    // Let's create the Razorpay order here directly!
    // Certificate cost is Rs 499 (standard price)
    const options = {
      amount: 499 * 100, // 499 INR in paise
      currency: 'INR',
      receipt: 'cert_rcpt_' + Date.now()
    };

    const order = await razorpay.orders.create(options);
    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      message: 'Certificate payment order created successfully.'
    });

  } catch (error) {
    res.status(500).json({ message: 'Error generating certificate request.', error: error.message });
  }
});

// Get all certificates (Admin only)
app.get('/api/certificates', authenticateToken, isAdmin, (req, res) => {
  try {
    const certificates = readJSONFile('certificates.json');
    res.json(certificates);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching certificates.' });
  }
});

// Update certificate status (mark as sent - Admin only)
app.put('/api/certificates/:id/status', authenticateToken, isAdmin, (req, res) => {
  try {
    const certId = req.params.id;
    const { status } = req.body; // 'pending' or 'sent'

    const certificates = readJSONFile('certificates.json');
    const certIndex = certificates.findIndex(c => c.id === certId);

    if (certIndex === -1) {
      return res.status(404).json({ message: 'Certificate request not found.' });
    }

    certificates[certIndex].status = status || 'sent';
    writeJSONFile('certificates.json', certificates);

    res.json({ message: 'Certificate request status updated!', certificate: certificates[certIndex] });
  } catch (error) {
    res.status(500).json({ message: 'Error updating certificate status.', error: error.message });
  }
});

// 7. NOTICE, ANNOUNCEMENT, RECORDED CLASSES ENDPOINTS

// Notices
app.get('/api/notices', (req, res) => {
  try {
    const notices = readJSONFile('notices.json');
    res.json(notices);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching notices.' });
  }
});

app.post('/api/notices', authenticateToken, isAdmin, (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title || !description) {
      return res.status(400).json({ message: 'Title and description are required.' });
    }

    const notices = readJSONFile('notices.json');
    const newNotice = {
      id: 'notice_' + Date.now(),
      title,
      description,
      date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    };
    notices.unshift(newNotice); // Latest first
    writeJSONFile('notices.json', notices);

    res.status(201).json({ message: 'Notice added successfully!', notice: newNotice });
  } catch (error) {
    res.status(500).json({ message: 'Error adding notice.', error: error.message });
  }
});

// Announcements
app.get('/api/announcements', (req, res) => {
  try {
    const announcements = readJSONFile('announcements.json');
    res.json(announcements);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching announcements.' });
  }
});

app.post('/api/announcements', authenticateToken, isAdmin, (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ message: 'Message content is required.' });
    }

    const announcements = readJSONFile('announcements.json');
    const newAnnouncement = {
      id: 'ann_' + Date.now(),
      message,
      date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    };
    announcements.unshift(newAnnouncement);
    writeJSONFile('announcements.json', announcements);

    res.status(201).json({ message: 'Announcement added successfully!', announcement: newAnnouncement });
  } catch (error) {
    res.status(500).json({ message: 'Error adding announcement.', error: error.message });
  }
});

// Recorded Classes
app.get('/api/recorded-classes', (req, res) => {
  try {
    const classes = readJSONFile('recordedClasses.json');
    res.json(classes);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching recorded classes.' });
  }
});

app.post('/api/recorded-classes', authenticateToken, isAdmin, (req, res) => {
  try {
    const { title, link, courseId } = req.body;
    if (!title || !link) {
      return res.status(400).json({ message: 'Title and video link are required.' });
    }

    const classes = readJSONFile('recordedClasses.json');
    const newClass = {
      id: 'rec_' + Date.now(),
      title,
      link,
      courseId: courseId || 'all',
      date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    };
    classes.unshift(newClass);
    writeJSONFile('recordedClasses.json', classes);

    res.status(201).json({ message: 'Recorded class link added!', recordedClass: newClass });
  } catch (error) {
    res.status(500).json({ message: 'Error adding recorded class link.', error: error.message });
  }
});

// 8. CONTACT ENDPOINT
app.post('/api/contact', (req, res) => {
  try {
    const { name, email, phone, course, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ message: 'Name, email, and message are required.' });
    }

    const contacts = readJSONFile('contacts.json');
    const newContact = {
      id: 'contact_' + Date.now(),
      name,
      email,
      phone: phone || '',
      course: course || 'N/A',
      message,
      date: new Date().toISOString()
    };

    contacts.push(newContact);
    writeJSONFile('contacts.json', contacts);

    res.status(201).json({ message: 'Message sent successfully! We will get back to you.' });
  } catch (error) {
    res.status(500).json({ message: 'Error saving contact message.' });
  }
});

// GET /api/contact - Admin only
app.get('/api/contact', authenticateToken, isAdmin, (req, res) => {
  try {
    const contacts = readJSONFile('contacts.json');
    const sortedContacts = [...contacts].sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(sortedContacts);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching contact messages.' });
  }
});

// 9. ADMIN SUMMARY DATA ENDPOINT
app.get('/api/admin/data', authenticateToken, isAdmin, (req, res) => {
  try {
    const courses = readJSONFile('courses.json');
    const users = readJSONFile('users.json');
    const contacts = readJSONFile('contacts.json');
    const payments = readJSONFile('payments.json');
    const enrollments = readJSONFile('enrollments.json');
    const certificates = readJSONFile('certificates.json');
    const notices = readJSONFile('notices.json');
    const announcements = readJSONFile('announcements.json');
    const recordedClasses = readJSONFile('recordedClasses.json');

    const students = users.filter(u => u.role === 'student');

    // Aggregate statistics
    const totalCourses = courses.length;
    const totalStudents = students.length;
    const totalContacts = contacts.length;
    const totalPayments = payments.length;
    const totalRevenue = payments.filter(p => p.status === 'captured').reduce((acc, curr) => acc + curr.amount, 0);

    res.json({
      stats: {
        totalCourses,
        totalStudents,
        totalContacts,
        totalPayments,
        totalRevenue
      },
      students: students.map(s => ({
        id: s.id,
        name: s.name,
        email: s.email,
        createdAt: s.createdAt
      })),
      courses,
      enrollments,
      payments,
      certificates,
      contacts,
      notices,
      announcements,
      recordedClasses,
      achievers: readJSONFile('achievers.json')
    });

  } catch (error) {
    res.status(500).json({ message: 'Error fetching admin summary data.', error: error.message });
  }
});

// 10. PLACEMENT ACHIEVERS ENDPOINTS

// GET /api/achievers - Public
app.get('/api/achievers', (req, res) => {
  try {
    const achievers = readJSONFile('achievers.json');
    res.json(achievers);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching achievers.', error: error.message });
  }
});

// POST /api/achievers - Admin Only, Multer upload
app.post('/api/achievers', authenticateToken, isAdmin, upload.single('image'), (req, res) => {
  try {
    const { name, company } = req.body;

    if (!name || !company) {
      return res.status(400).json({ message: 'Student name and company name are required.' });
    }

    const achievers = readJSONFile('achievers.json');
    const imageUrl = req.file 
      ? `${req.protocol}://${req.get('host')}/uploads/achievers/${req.file.filename}` 
      : '';

    const newAchiever = {
      id: 'ach_' + Date.now(),
      name,
      company,
      image: imageUrl
    };

    achievers.push(newAchiever);
    writeJSONFile('achievers.json', achievers);

    res.status(201).json({ message: 'Achiever added successfully!', achiever: newAchiever });
  } catch (error) {
    res.status(500).json({ message: 'Error adding achiever.', error: error.message });
  }
});

// DELETE /api/achievers/:id - Admin Only
app.delete('/api/achievers/:id', authenticateToken, isAdmin, (req, res) => {
  try {
    const id = req.params.id;
    let achievers = readJSONFile('achievers.json');
    const index = achievers.findIndex(a => a.id === id);

    if (index === -1) {
      return res.status(404).json({ message: 'Achiever not found.' });
    }

    const achiever = achievers[index];

    // Remove file if exists
    if (achiever.image) {
      try {
        const filename = achiever.image.split('/').pop();
        const filePath = path.join(UPLOAD_DIR, filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        console.error('Failed to delete achiever image file:', err);
      }
    }

    achievers.splice(index, 1);
    writeJSONFile('achievers.json', achievers);

    res.json({ message: 'Achiever removed successfully!' });
  } catch (error) {
    res.status(500).json({ message: 'Error removing achiever.', error: error.message });
  }
});

// Start Express server and run db seeder
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await seedDatabase();
});
