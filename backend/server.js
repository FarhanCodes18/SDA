require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const admin = require('firebase-admin');

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

// Configure Multer for Payment Screenshots
const screenshotStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'uploads', 'payments');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, 'screenshot_' + Date.now() + ext);
  }
});
const uploadScreenshot = multer({ storage: screenshotStorage });

// Configure Multer for Profile Pictures
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'uploads', 'profiles');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, 'profile_' + Date.now() + ext);
  }
});
const uploadProfilePic = multer({ storage: profileStorage });

// Firebase Admin Configuration & Sync
let db = null;
let useFirebase = false;

const firebaseKeyPath = path.join(__dirname, 'firebase-key.json');
if (fs.existsSync(firebaseKeyPath)) {
  try {
    const serviceAccount = require(firebaseKeyPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    db = admin.firestore();
    useFirebase = true;
    console.log('Firebase initialized successfully from firebase-key.json! Connecting to Firestore...');
  } catch (err) {
    console.error('Failed to initialize Firebase Admin SDK from file:', err);
  }
} else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      })
    });
    db = admin.firestore();
    useFirebase = true;
    console.log('Firebase initialized successfully from environment variables! Connecting to Firestore...');
  } catch (err) {
    console.error('Failed to initialize Firebase Admin SDK from environment variables:', err);
  }
} else {
  console.log('--------------------------------------------------');
  console.log('NOTICE: firebase-key.json not found and environment variables not set.');
  console.log('Please provide Firebase credentials to enable cloud persistence.');
  console.log('Falling back to local JSON file database for now.');
  console.log('--------------------------------------------------');
}

// JSON File Database Helper Functions with Firestore Caching / Synchronization
const DATA_DIR = path.join(__dirname, 'data');
const getFilePath = (filename) => path.join(DATA_DIR, filename);

// Local synchronous fallback helpers
const readLocalJSONFile = (filename) => {
  try {
    const filePath = getFilePath(filename);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify([]), 'utf8');
    }
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data || '[]');
  } catch (error) {
    console.error(`Error reading local file ${filename}:`, error);
    return [];
  }
};

const writeLocalJSONFile = (filename, data) => {
  try {
    const filePath = getFilePath(filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error(`Error writing local file ${filename}:`, error);
    return false;
  }
};

// Global in-memory DB cache
const dbCache = {};

// Load cache from Firestore/JSON and then run seedDatabase
const initDatabase = async () => {
  const filenames = [
    'users.json', 'courses.json', 'enrollments.json', 'payments.json',
    'certificates.json', 'notices.json', 'announcements.json',
    'recordedClasses.json', 'achievers.json', 'contacts.json', 'liveclass.json',
    'attendance.json', 'quizzes.json', 'quizResults.json',
    'assignments.json', 'submissions.json', 'forum.json', 'notifications.json'
  ];

  // We perform initial reads from local JSON files to avoid uninitialized state
  for (const filename of filenames) {
    dbCache[filename] = readLocalJSONFile(filename);
  }

  if (useFirebase && db) {
    console.log('Fetching collections from Firebase Firestore to populate cache...');
    for (const filename of filenames) {
      const collectionName = filename.replace('.json', '');
      try {
        const snapshot = await db.collection(collectionName).get();
        if (!snapshot.empty) {
          const data = [];
          snapshot.forEach(doc => {
            data.push({ id: doc.id, ...doc.data() });
          });
          dbCache[filename] = data;
          console.log(`Successfully populated cache for "${filename}" from Firestore (${data.length} docs).`);
        } else {
          // If Firestore is empty, seed it with local JSON backup
          console.log(`Firestore collection "${collectionName}" is empty. Seeding from local backup...`);
          await syncCollectionToFirestore(collectionName, dbCache[filename]);
        }
      } catch (err) {
        console.error(`Failed to load collection "${collectionName}" from Firestore:`, err.message);
      }
    }
  }

  // Run programmatic database seeding
  await seedDatabase();
};

const syncCollectionToFirestore = async (collectionName, data) => {
  if (!useFirebase || !db) return;
  
  try {
    const collectionRef = db.collection(collectionName);
    const snapshot = await collectionRef.get();
    
    // Track existing documents to delete any that are no longer in our local array
    const existingIds = new Set();
    snapshot.forEach(doc => existingIds.add(doc.id));

    // Batch operations
    const batch = db.batch();
    
    for (const item of data) {
      const docId = item.id || `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const docRef = collectionRef.doc(docId);
      
      const docData = { ...item };
      delete docData.id; // Avoid duplicate id inside document body
      
      batch.set(docRef, docData);
      existingIds.delete(docId);
    }

    // Delete elements that are no longer present
    for (const oldId of existingIds) {
      batch.delete(collectionRef.doc(oldId));
    }

    await batch.commit();
    console.log(`[Firestore Sync] Collection "${collectionName}" synced successfully.`);
  } catch (err) {
    console.error(`[Firestore Sync Error] Failed to sync collection "${collectionName}":`, err);
  }
};

// API-facing helper functions
const readJSONFile = (filename) => {
  if (dbCache[filename]) {
    return dbCache[filename];
  }
  dbCache[filename] = readLocalJSONFile(filename);
  return dbCache[filename];
};

const writeJSONFile = (filename, data) => {
  dbCache[filename] = data;
  
  // Backup to local file storage
  writeLocalJSONFile(filename, data);

  // Sync to Firestore asynchronously
  if (useFirebase && db) {
    const collectionName = filename.replace('.json', '');
    syncCollectionToFirestore(collectionName, data).catch(err => {
      console.error(`Error in async sync for ${collectionName}:`, err);
    });
  }
  return true;
};

const createNotification = (userId, message, type = 'general') => {
  try {
    const notifications = readJSONFile('notifications.json');
    const newNotif = {
      id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      userId, // "all" or student id
      message,
      type,
      read: false,
      createdAt: new Date().toISOString()
    };
    notifications.unshift(newNotif);
    writeJSONFile('notifications.json', notifications);
    return newNotif;
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};

const awardXP = (userId, amount) => {
  try {
    const users = readJSONFile('users.json');
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) return;
    
    const user = users[idx];
    user.xp = (user.xp || 0) + amount;
    
    // Level is defined as math.floor(xp/500)+1
    const newLevel = Math.floor(user.xp / 500) + 1;
    const oldLevel = user.level || 1;
    user.level = newLevel;
    
    if (!user.badges) user.badges = [];
    
    if (newLevel > oldLevel) {
      createNotification(userId, `🎉 Level Up! You reached Level ${newLevel}!`, 'general');
    }
    
    // Unlocked badges based on XP milestones
    if (user.xp >= 1000 && !user.badges.includes('xp_1000')) {
      user.badges.push('xp_1000');
      createNotification(userId, `🏆 Unlocked Badge: Gold Scholar (Earned 1000+ XP)`, 'general');
    }
    if (user.xp >= 500 && !user.badges.includes('xp_500')) {
      user.badges.push('xp_500');
      createNotification(userId, `⭐ Unlocked Badge: Rising Star (Earned 500+ XP)`, 'general');
    }
    
    writeJSONFile('users.json', users);
  } catch (err) {
    console.error('Error awarding XP:', err);
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
    const ADMIN_PASSWORD = 'Sukla@2008';
    
    // Seed Admin if not exists, or update password if changed
    const adminIndex = users.findIndex(u => u.email === 'admin@sukla.com');
    if (adminIndex === -1) {
      const hashedAdminPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
      users.push({
        id: 'user_admin_01',
        name: 'Ajay Shukla',
        email: 'admin@sukla.com',
        password: hashedAdminPassword,
        plainPassword: ADMIN_PASSWORD,
        role: 'admin',
        createdAt: new Date().toISOString()
      });
      console.log('Seeded Admin account (admin@sukla.com) with new password.');
    } else if (users[adminIndex].plainPassword !== ADMIN_PASSWORD) {
      // Force update password to new one
      const hashedAdminPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
      users[adminIndex].password = hashedAdminPassword;
      users[adminIndex].plainPassword = ADMIN_PASSWORD;
      console.log('Updated Admin password to Sukla@2008.');
    }

    // Student seeding and default placement achiever seeding disabled by request.
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
    const { name, email, password, mobile, courseId } = req.body;

    if (!name || !email || !password || !mobile) {
      return res.status(400).json({ message: 'Please provide all details (name, email, password, mobile).' });
    }

    const cleanedEmail = email.trim().toLowerCase();
    const cleanedMobile = mobile.trim().replace(/[\s\-\(\)\+]+/g, '');

    const users = readJSONFile('users.json');
    
    // Check duplicate email
    const emailExists = users.some(u => u.email && u.email.trim().toLowerCase() === cleanedEmail);
    if (emailExists) {
      return res.status(400).json({ message: 'User with this email already exists.' });
    }

    // Check duplicate mobile
    const mobileExists = users.some(u => {
      if (!u.mobile) return false;
      const normU = u.mobile.trim().replace(/[\s\-\(\)\+]+/g, '');
      return normU === cleanedMobile || normU.endsWith(cleanedMobile) || cleanedMobile.endsWith(normU);
    });
    if (mobileExists) {
      return res.status(400).json({ message: 'User with this mobile number already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const assignedRole = email.toLowerCase() === 'admin@sukla.com' ? 'admin' : 'student';

    const newUser = {
      id: 'user_' + Date.now(),
      name,
      email: email.toLowerCase(),
      mobile: mobile || '',
      password: hashedPassword,
      plainPassword: password,
      role: assignedRole,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    writeJSONFile('users.json', users);

    // If a course is selected, automatically enroll the student
    if (courseId) {
      const courses = readJSONFile('courses.json');
      const course = courses.find(c => c.id === courseId);
      if (course) {
        const enrollments = readJSONFile('enrollments.json');
        const newEnrollment = {
          id: 'enroll_' + Date.now(),
          studentId: newUser.id,
          courseId,
          studentName: newUser.name,
          studentMobile: mobile || '',
          studentEmail: newUser.email,
          address: '',
          status: 'pending',
          createdAt: new Date().toISOString()
        };
        enrollments.push(newEnrollment);
        writeJSONFile('enrollments.json', enrollments);
      }
    }

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
    const userIndex = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());

    if (userIndex === -1) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const user = users[userIndex];
    const isMatch = await bcrypt.compare(password, user.password) || (user.plainPassword && user.plainPassword === password) || (user.password === password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // ==========================================
    // STREAK TRACKER: Update login streak
    // ==========================================
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const lastLogin = user.lastLoginDate || null;
    let streak = user.streak || 0;
    let longestStreak = user.longestStreak || 0;

    if (lastLogin === today) {
      // Already logged in today — streak stays same
    } else if (lastLogin) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (lastLogin === yesterdayStr) {
        // Consecutive day — increment streak
        streak += 1;
      } else {
        // Missed a day — reset streak
        streak = 1;
      }
    } else {
      // First ever login
      streak = 1;
    }

    if (streak > longestStreak) longestStreak = streak;

    users[userIndex].lastLoginDate = today;
    users[userIndex].streak = streak;
    users[userIndex].longestStreak = longestStreak;
    writeJSONFile('users.json', users);

    if (lastLogin !== today) {
      awardXP(user.id, 50);
    }

    // Refresh user object after potentially awarding XP
    const updatedUsers = readJSONFile('users.json');
    const freshUser = updatedUsers.find(u => u.id === user.id);

    const token = jwt.sign(
      { id: freshUser.id, name: freshUser.name, email: freshUser.email, role: freshUser.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful!',
      token,
      user: {
        id: freshUser.id,
        name: freshUser.name,
        email: freshUser.email,
        role: freshUser.role,
        streak: freshUser.streak,
        longestStreak: freshUser.longestStreak,
        lastLoginDate: today,
        xp: freshUser.xp || 0,
        level: freshUser.level || 1,
        badges: freshUser.badges || []
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
    const quizzes = readJSONFile('quizzes.json');
    const quizResults = readJSONFile('quizResults.json');

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

    const users = readJSONFile('users.json');
    const studentUser = users.find(u => u.id === studentId);
    const userProfile = studentUser ? { ...studentUser } : null;
    if (userProfile) {
      delete userProfile.password;
    }

    // Fetch student attendance logs
    const attendance = readJSONFile('attendance.json');
    const studentAttendanceLogs = [];
    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;

    attendance.forEach(sheet => {
      const record = sheet.records.find(r => r.studentId === studentId);
      if (record) {
        studentAttendanceLogs.push({
          date: sheet.date,
          courseId: sheet.courseId,
          status: record.status
        });
        if (record.status === 'present') presentCount++;
        else if (record.status === 'absent') absentCount++;
        else if (record.status === 'late') lateCount++;
      }
    });

    // Sort logs descending by date
    studentAttendanceLogs.sort((a, b) => new Date(b.date) - new Date(a.date));

    const totalSessions = studentAttendanceLogs.length;
    const attendancePercentage = totalSessions > 0
      ? Math.round(((presentCount + lateCount) / totalSessions) * 100)
      : 100;

    const attendanceSummary = {
      total: totalSessions,
      present: presentCount,
      absent: absentCount,
      late: lateCount,
      percentage: attendancePercentage
    };

    // Filter quizzes matching student's unlocked courses and strip correctAnswerIndex
    const purchasedCourseIds = purchasedCourses.map(c => c.id);
    const studentQuizzes = quizzes
      .filter(q => purchasedCourseIds.includes(q.courseId))
      .map(q => ({
        ...q,
        questions: q.questions.map(quest => {
          const qCopy = { ...quest };
          delete qCopy.correctAnswerIndex;
          return qCopy;
        })
      }));

    // Filter student's quiz submissions
    const studentQuizResults = quizResults.filter(r => r.studentId === studentId);

    // Fetch assignments for courses the student is enrolled in (all enrolled including pending)
    const allAssignments = readJSONFile('assignments.json');
    const enrolledCourseIds = studentEnrollments.map(e => e.courseId);
    const studentAssignments = allAssignments.filter(
      a => a.courseId === 'all' || enrolledCourseIds.includes(a.courseId)
    );

    // Fetch student's submission records
    const allSubmissions = readJSONFile('submissions.json');
    const studentSubmissions = allSubmissions.filter(s => s.studentId === studentId);

    // Streak info from users.json
    const streakInfo = {
      streak: studentUser ? (studentUser.streak || 0) : 0,
      longestStreak: studentUser ? (studentUser.longestStreak || 0) : 0,
      lastLoginDate: studentUser ? (studentUser.lastLoginDate || null) : null
    };

    // Return everything
    res.json({
      user: userProfile,
      enrolledCourses,
      purchasedCourses,
      pendingPayments,
      payments: studentPayments,
      certificates: studentCertificates,
      notices,
      announcements,
      recordedClasses,
      attendance: {
        records: studentAttendanceLogs,
        summary: attendanceSummary
      },
      quizzes: studentQuizzes,
      quizResults: studentQuizResults,
      assignments: studentAssignments,
      submissions: studentSubmissions,
      streak: streakInfo
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
      instructor: req.user.name || 'Ajay Shukla',
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

// 5. MANUAL PAYMENT ENDPOINTS


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
        const courses = readJSONFile('courses.json');
        const course = courses.find(c => c.title === payment.courseName || c.id === payment.courseName);
        const targetCourseId = course ? course.id : payment.courseName;

        const enrollIndex = enrollments.findIndex(e => e.studentId === payment.studentId && (e.courseId === targetCourseId || e.courseId === payment.courseName || e.id === payment.courseId));
        if (enrollIndex !== -1) {
          enrollments[enrollIndex].status = 'approved';
          writeJSONFile('enrollments.json', enrollments);
        }
      } else if (payment.paymentType === 'Certificate Payment') {
        const certificates = readJSONFile('certificates.json');
        const certIndex = certificates.findIndex(c => c.paymentId === payment.paymentId || (c.studentId === payment.studentId && c.courseName === payment.courseName));
        if (certIndex !== -1) {
          certificates[certIndex].status = 'completed';
          writeJSONFile('certificates.json', certificates);
        }
      }
    }

    res.json({ message: 'Payment status updated manually!', payment: payments[payIndex] });
  } catch (error) {
    res.status(500).json({ message: 'Error updating payment status.', error: error.message });
  }
});

// 6. CERTIFICATE ENDPOINTS

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

// Request certificate manually with QR payment screenshot (Public - login optional)
app.post('/api/certificate-manual-request', uploadScreenshot.single('screenshot'), (req, res) => {
  try {
    const { fullName, mobile, email, courseName, amount, certificateType, address } = req.body;
    
    // Extract studentId if token is present
    let studentId = 'GUEST';
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        studentId = decoded.id;
      } catch (err) {
        // Continue as guest if token is invalid or expired
      }
    }

    if (!fullName || !mobile || !email || !courseName || !amount) {
      return res.status(400).json({ message: 'Missing required certificate details.' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Payment screenshot is required.' });
    }

    // Resolve screenshot URL
    const screenshotUrl = `${req.protocol}://${req.get('host')}/uploads/payments/${req.file.filename}`;

    const certificates = readJSONFile('certificates.json');
    const certId = 'cert_' + Date.now();
    const manualPaymentId = 'MANUAL_' + Date.now();

    const newCertificate = {
      id: certId,
      studentId,
      name: fullName,
      mobile,
      email,
      courseName,
      certType: certificateType || 'Verified Course Certificate',
      address: address || 'Online Delivery',
      amount: Number(amount),
      screenshot: screenshotUrl,
      paymentId: manualPaymentId,
      status: 'pending',
      date: new Date().toISOString()
    };

    certificates.push(newCertificate);
    writeJSONFile('certificates.json', certificates);

    // Save as pending payment in payments.json so admin can approve it
    const payments = readJSONFile('payments.json');
    payments.push({
      id: 'pay_cert_' + Date.now(),
      orderId: 'manual_order_' + Date.now(),
      paymentId: manualPaymentId,
      studentId,
      studentName: fullName,
      studentEmail: email,
      studentMobile: mobile,
      courseName: courseName,
      paymentType: 'Certificate Payment',
      amount: Number(amount),
      screenshot: screenshotUrl,
      status: 'pending',
      date: new Date().toISOString()
    });
    writeJSONFile('payments.json', payments);

    res.status(201).json({
      message: 'Thank you for your submission! Your certificate will be received in the next 24 hours.',
      certificate: newCertificate
    });

  } catch (error) {
    res.status(500).json({ message: 'Error processing certificate request.', error: error.message });
  }
});

// Request course enrollment manually with QR payment screenshot
app.post('/api/course-manual-request', authenticateToken, uploadScreenshot.single('screenshot'), (req, res) => {
  try {
    const { fullName, mobile, email, courseId, courseName, amount } = req.body;
    const studentId = req.user.id;

    if (!fullName || !mobile || !email || !courseId || !courseName || !amount) {
      return res.status(400).json({ message: 'Missing required course details.' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Payment screenshot is required.' });
    }

    // Resolve screenshot URL
    const screenshotUrl = `${req.protocol}://${req.get('host')}/uploads/payments/${req.file.filename}`;
    const manualPaymentId = 'MANUAL_' + Date.now();

    // Check if enrollment already exists
    const enrollments = readJSONFile('enrollments.json');
    let existingEnroll = enrollments.find(e => e.studentId === studentId && e.courseId === courseId);
    
    if (existingEnroll) {
      if (existingEnroll.status === 'approved') {
        return res.status(400).json({ message: 'You are already enrolled in this course.' });
      }
      // If it exists as pending, update details
      existingEnroll.studentName = fullName;
      existingEnroll.studentMobile = mobile;
      existingEnroll.studentEmail = email;
      existingEnroll.screenshot = screenshotUrl;
    } else {
      // Create new pending enrollment
      const newEnrollment = {
        id: 'enroll_' + Date.now(),
        studentId,
        courseId,
        studentName: fullName,
        studentMobile: mobile,
        studentEmail: email,
        address: '',
        status: 'pending',
        screenshot: screenshotUrl,
        createdAt: new Date().toISOString()
      };
      enrollments.push(newEnrollment);
    }
    writeJSONFile('enrollments.json', enrollments);

    // Save as pending payment in payments.json so admin can approve it
    const payments = readJSONFile('payments.json');
    const newPayment = {
      id: 'pay_course_' + Date.now(),
      orderId: 'manual_order_' + Date.now(),
      paymentId: manualPaymentId,
      studentId,
      studentName: fullName,
      studentEmail: email,
      studentMobile: mobile,
      courseName: courseName,
      paymentType: 'Course Payment',
      amount: Number(amount),
      screenshot: screenshotUrl,
      status: 'pending',
      date: new Date().toISOString()
    };
    payments.push(newPayment);
    writeJSONFile('payments.json', payments);

    res.status(201).json({
      message: 'Thank you for your submission! Your course enrollment is pending verification by admin.',
      payment: newPayment
    });

  } catch (error) {
    res.status(500).json({ message: 'Error processing course payment request.', error: error.message });
  }
});

// Request certificate (Before payment - locks/saves info as pending)
app.post('/api/certificate-request', authenticateToken, async (req, res) => {
  try {
    const { fullName, mobile, email, courseName, certificateType, address } = req.body;
    const studentId = req.user.id;

    if (!fullName || !mobile || !email || !courseName || !certificateType || !address) {
      return res.status(400).json({ message: 'Missing required certificate details.' });
    }

    // Resolve course price securely from the mapping, fallback to 499
    const price = CERT_PRICES[courseName] || 499;

    const options = {
      amount: price * 100, // Amount in paise
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

// Update certificate status (mark as sent/completed - Admin only)
app.put('/api/certificates/:id/status', authenticateToken, isAdmin, (req, res) => {
  try {
    const certId = req.params.id;
    const { status } = req.body; // 'pending', 'sent' or 'completed'

    const certificates = readJSONFile('certificates.json');
    const certIndex = certificates.findIndex(c => c.id === certId);

    if (certIndex === -1) {
      return res.status(404).json({ message: 'Certificate request not found.' });
    }

    const oldStatus = certificates[certIndex].status;
    certificates[certIndex].status = status || 'completed';
    writeJSONFile('certificates.json', certificates);

    // If marked completed or sent, update matching transaction status in payments.json
    if ((status === 'completed' || status === 'sent') && oldStatus === 'pending') {
      const cert = certificates[certIndex];
      const payments = readJSONFile('payments.json');
      const payIndex = payments.findIndex(p => p.paymentId === cert.paymentId || (p.studentId === cert.studentId && p.courseName === cert.courseName && p.paymentType === 'Certificate Payment'));
      if (payIndex !== -1) {
        payments[payIndex].status = 'captured';
        writeJSONFile('payments.json', payments);
      }
    }

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
    createNotification('all', `New Notice: ${title}`, 'notice');

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
    createNotification('all', `New Announcement: ${message.slice(0, 60)}${message.length > 60 ? '...' : ''}`, 'announcement');

    res.status(201).json({ message: 'Announcement added successfully!', announcement: newAnnouncement });
  } catch (error) {
    res.status(500).json({ message: 'Error adding announcement.', error: error.message });
  }
});

// Delete announcement
app.delete('/api/announcements/:id', authenticateToken, isAdmin, (req, res) => {
  try {
    const id = req.params.id;
    let announcements = readJSONFile('announcements.json');
    const index = announcements.findIndex(a => a.id === id);

    if (index === -1) {
      return res.status(404).json({ message: 'Announcement not found.' });
    }

    announcements.splice(index, 1);
    writeJSONFile('announcements.json', announcements);

    res.json({ message: 'Announcement deleted successfully!' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting announcement.', error: error.message });
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
    const quizzes = readJSONFile('quizzes.json');
    const quizResults = readJSONFile('quizResults.json');
    const assignments = readJSONFile('assignments.json');
    const submissions = readJSONFile('submissions.json');

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
      students: students.map(s => {
        const studentProfile = { ...s };
        // Retain password and plainPassword for admin visibility
        return studentProfile;
      }),
      courses,
      enrollments,
      payments,
      certificates,
      contacts,
      notices,
      announcements,
      recordedClasses,
      achievers: readJSONFile('achievers.json'),
      quizzes,
      quizResults,
      assignments,
      submissions
    });

  } catch (error) {
    res.status(500).json({ message: 'Error fetching admin summary data.', error: error.message });
  }
});

// POST /api/admin/sync - Synchronizes live data from client back to local server JSON storage
app.post('/api/admin/sync', authenticateToken, isAdmin, (req, res) => {
  try {
    const { students, payments, enrollments, certificates } = req.body;
    
    if (students) {
      const currentUsers = readLocalJSONFile('users.json');
      const admins = currentUsers.filter(u => u.role === 'admin');
      const mergedUsers = [...admins];
      students.forEach(student => {
        if (!mergedUsers.some(u => u.id === student.id)) {
          mergedUsers.push(student);
        }
      });
      writeLocalJSONFile('users.json', mergedUsers);
      dbCache['users.json'] = mergedUsers;
    }
    
    if (payments) {
      writeLocalJSONFile('payments.json', payments);
      dbCache['payments.json'] = payments;
    }
    
    if (enrollments) {
      writeLocalJSONFile('enrollments.json', enrollments);
      dbCache['enrollments.json'] = enrollments;
    }
    
    if (certificates) {
      writeLocalJSONFile('certificates.json', certificates);
      dbCache['certificates.json'] = certificates;
    }
    
    res.json({ message: 'Local storage database synchronized successfully!' });
  } catch (error) {
    res.status(500).json({ message: 'Sync failed', error: error.message });
  }
});

// ==========================================
// 11. ASSIGNMENT ENDPOINTS
// ==========================================

// GET /api/assignments - Admin fetches all, student fetches own
app.get('/api/assignments', authenticateToken, (req, res) => {
  try {
    const assignments = readJSONFile('assignments.json');
    if (req.user.role === 'admin') {
      return res.json(assignments);
    }
    // For students, filter by enrolled courses
    const enrollments = readJSONFile('enrollments.json');
    const enrolledIds = enrollments
      .filter(e => e.studentId === req.user.id)
      .map(e => e.courseId);
    const studentAssignments = assignments.filter(
      a => a.courseId === 'all' || enrolledIds.includes(a.courseId)
    );
    res.json(studentAssignments);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching assignments.', error: error.message });
  }
});

// POST /api/assignments - Admin creates assignment
app.post('/api/assignments', authenticateToken, isAdmin, (req, res) => {
  try {
    const { title, description, dueDate, courseId, maxMarks } = req.body;
    if (!title || !description) {
      return res.status(400).json({ message: 'Title and description are required.' });
    }
    const assignments = readJSONFile('assignments.json');
    const newAssignment = {
      id: 'asgn_' + Date.now(),
      title,
      description,
      dueDate: dueDate || null,
      courseId: courseId || 'all',
      maxMarks: Number(maxMarks) || 100,
      createdAt: new Date().toISOString(),
      createdBy: req.user.name
    };
    assignments.unshift(newAssignment);
    writeJSONFile('assignments.json', assignments);
    res.status(201).json({ message: 'Assignment created successfully!', assignment: newAssignment });
  } catch (error) {
    res.status(500).json({ message: 'Error creating assignment.', error: error.message });
  }
});

// DELETE /api/assignments/:id - Admin deletes assignment
app.delete('/api/assignments/:id', authenticateToken, isAdmin, (req, res) => {
  try {
    let assignments = readJSONFile('assignments.json');
    const index = assignments.findIndex(a => a.id === req.params.id);
    if (index === -1) return res.status(404).json({ message: 'Assignment not found.' });
    assignments.splice(index, 1);
    writeJSONFile('assignments.json', assignments);
    res.json({ message: 'Assignment deleted successfully!' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting assignment.', error: error.message });
  }
});

// Configure Multer for Assignment Submissions
const submissionStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'uploads', 'submissions');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, 'submission_' + Date.now() + ext);
  }
});
const uploadSubmission = multer({ storage: submissionStorage });

// POST /api/assignments/:id/submit - Student submits assignment
app.post('/api/assignments/:id/submit', authenticateToken, uploadSubmission.single('file'), (req, res) => {
  try {
    const assignmentId = req.params.id;
    const studentId = req.user.id;
    const { notes } = req.body;

    const assignments = readJSONFile('assignments.json');
    const assignment = assignments.find(a => a.id === assignmentId);
    if (!assignment) return res.status(404).json({ message: 'Assignment not found.' });

    const submissions = readJSONFile('submissions.json');
    // Check if already submitted
    const existing = submissions.find(s => s.assignmentId === assignmentId && s.studentId === studentId);
    if (existing) {
      return res.status(400).json({ message: 'You have already submitted this assignment.' });
    }

    const fileUrl = req.file
      ? `${req.protocol}://${req.get('host')}/uploads/submissions/${req.file.filename}`
      : null;

    const users = readJSONFile('users.json');
    const student = users.find(u => u.id === studentId);

    const newSubmission = {
      id: 'sub_' + Date.now(),
      assignmentId,
      assignmentTitle: assignment.title,
      studentId,
      studentName: student ? student.name : req.user.name,
      studentEmail: student ? student.email : req.user.email,
      fileUrl,
      notes: notes || '',
      status: 'submitted',
      marks: null,
      feedback: '',
      submittedAt: new Date().toISOString()
    };

    submissions.push(newSubmission);
    writeJSONFile('submissions.json', submissions);
    res.status(201).json({ message: 'Assignment submitted successfully!', submission: newSubmission });
  } catch (error) {
    res.status(500).json({ message: 'Error submitting assignment.', error: error.message });
  }
});

// GET /api/submissions - Admin gets all submissions
app.get('/api/submissions', authenticateToken, isAdmin, (req, res) => {
  try {
    const submissions = readJSONFile('submissions.json');
    res.json(submissions);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching submissions.', error: error.message });
  }
});

// PUT /api/submissions/:id/grade - Admin grades submission
app.put('/api/submissions/:id/grade', authenticateToken, isAdmin, (req, res) => {
  try {
    const { marks, feedback } = req.body;
    const submissions = readJSONFile('submissions.json');
    const index = submissions.findIndex(s => s.id === req.params.id);
    if (index === -1) return res.status(404).json({ message: 'Submission not found.' });

    submissions[index].marks = marks !== undefined ? Number(marks) : submissions[index].marks;
    submissions[index].feedback = feedback || submissions[index].feedback;
    submissions[index].status = 'graded';
    submissions[index].gradedAt = new Date().toISOString();
    writeJSONFile('submissions.json', submissions);

    // Create notification for student
    createNotification(
      submissions[index].studentId,
      `Your submission for assignment "${submissions[index].assignmentTitle}" has been graded. Marks: ${marks}.`,
      'assignment'
    );

    res.json({ message: 'Submission graded successfully!', submission: submissions[index] });
  } catch (error) {
    res.status(500).json({ message: 'Error grading submission.', error: error.message });
  }
});

// ==========================================
// 12. ENROLLMENT PROGRESS ENDPOINT
// ==========================================

// PUT /api/enrollments/:id/progress - Admin updates course progress
app.put('/api/enrollments/:id/progress', authenticateToken, isAdmin, (req, res) => {
  try {
    const enrollId = req.params.id;
    const { progress } = req.body; // 0-100
    if (progress === undefined || progress < 0 || progress > 100) {
      return res.status(400).json({ message: 'Progress must be a number between 0 and 100.' });
    }
    const enrollments = readJSONFile('enrollments.json');
    const index = enrollments.findIndex(e => e.id === enrollId);
    if (index === -1) return res.status(404).json({ message: 'Enrollment not found.' });
    enrollments[index].progress = Number(progress);
    enrollments[index].progressUpdatedAt = new Date().toISOString();
    writeJSONFile('enrollments.json', enrollments);
    res.json({ message: 'Course progress updated!', enrollment: enrollments[index] });
  } catch (error) {
    res.status(500).json({ message: 'Error updating progress.', error: error.message });
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

// DELETE /api/students/:id - Admin Only
app.delete('/api/students/:id', authenticateToken, isAdmin, (req, res) => {
  try {
    const studentId = req.params.id;
    let users = readJSONFile('users.json');
    const userIndex = users.findIndex(u => u.id === studentId);

    if (userIndex === -1) {
      return res.status(404).json({ message: 'Student not found.' });
    }

    const user = users[userIndex];
    if (user.role === 'admin') {
      return res.status(400).json({ message: 'Cannot delete admin account.' });
    }

    // Remove user
    users.splice(userIndex, 1);
    writeJSONFile('users.json', users);

    // Clean up student's enrollments, payments, and certificates
    let enrollments = readJSONFile('enrollments.json');
    enrollments = enrollments.filter(e => e.studentId !== studentId);
    writeJSONFile('enrollments.json', enrollments);

    let payments = readJSONFile('payments.json');
    payments = payments.filter(p => p.studentId !== studentId);
    writeJSONFile('payments.json', payments);

    let certificates = readJSONFile('certificates.json');
    certificates = certificates.filter(c => c.studentId !== studentId);
    writeJSONFile('certificates.json', certificates);

    res.json({ message: 'Student and associated records deleted successfully!' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting student.', error: error.message });
  }
});

// ==========================================
// STUDENT PROFILE & SETTINGS ENDPOINTS
// ==========================================

// Upload Student Profile Picture
app.post('/api/student/profile-pic', authenticateToken, uploadProfilePic.single('profilePic'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No profile picture file provided.' });
    }

    const studentId = req.user.id;
    const profilePicUrl = `${req.protocol}://${req.get('host')}/uploads/profiles/${req.file.filename}`;

    const users = readJSONFile('users.json');
    const userIndex = users.findIndex(u => u.id === studentId);

    if (userIndex === -1) {
      return res.status(404).json({ message: 'Student profile not found.' });
    }

    // Clean up old profile picture if exists and is local
    const oldPic = users[userIndex].profilePic;
    if (oldPic && oldPic.includes('/uploads/profiles/')) {
      try {
        const oldFilename = oldPic.split('/').pop();
        const oldFilePath = path.join(__dirname, 'uploads', 'profiles', oldFilename);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      } catch (err) {
        console.error('Failed to delete old profile picture:', err.message);
      }
    }

    users[userIndex].profilePic = profilePicUrl;
    writeJSONFile('users.json', users);

    // Prepare profile copy for response
    const updatedUserProfile = { ...users[userIndex] };
    delete updatedUserProfile.password;

    res.json({
      message: 'Profile picture uploaded successfully!',
      profilePic: profilePicUrl,
      user: updatedUserProfile
    });
  } catch (error) {
    res.status(500).json({ message: 'Error uploading profile picture.', error: error.message });
  }
});

// Update Student Profile Details & Password
app.put('/api/student/profile-update', authenticateToken, async (req, res) => {
  try {
    const studentId = req.user.id;
    const { name, email, mobile, github, linkedin, portfolio, currentPassword, newPassword } = req.body;

    if (!name || !email) {
      return res.status(400).json({ message: 'Name and Email are required fields.' });
    }

    const users = readJSONFile('users.json');
    const userIndex = users.findIndex(u => u.id === studentId);

    if (userIndex === -1) {
      return res.status(404).json({ message: 'Student profile not found.' });
    }

    const user = users[userIndex];

    // Check if email already in use
    const emailConflict = users.some(u => u.id !== studentId && u.email.toLowerCase() === email.toLowerCase());
    if (emailConflict) {
      return res.status(400).json({ message: 'Email address is already in use by another account.' });
    }

    // Update password if newPassword is provided
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ message: 'Current password is required to set a new password.' });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Incorrect current password.' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
    }

    // Update fields
    user.name = name;
    user.email = email.toLowerCase();
    user.mobile = mobile || '';
    user.github = github || '';
    user.linkedin = linkedin || '';
    user.portfolio = portfolio || '';

    writeJSONFile('users.json', users);

    const updatedUser = { ...user };
    delete updatedUser.password;

    res.json({
      message: 'Profile updated successfully!',
      user: updatedUser
    });

  } catch (error) {
    res.status(500).json({ message: 'Error updating profile details.', error: error.message });
  }
});

// ==========================================
// QUIZZES & MCQ ENDPOINTS
// ==========================================

// 1. Get all quizzes (Authenticated - strips correct answers for students)
app.get('/api/quizzes', authenticateToken, (req, res) => {
  try {
    const quizzes = readJSONFile('quizzes.json');
    if (req.user.role === 'admin') {
      return res.json(quizzes);
    }

    // For students, strip out correctAnswerIndex
    const studentQuizzes = quizzes.map(q => ({
      ...q,
      questions: q.questions.map(quest => {
        const qCopy = { ...quest };
        delete qCopy.correctAnswerIndex;
        return qCopy;
      })
    }));
    res.json(studentQuizzes);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching quizzes.', error: error.message });
  }
});

// 2. Get a single quiz details (strips correct answers for students)
app.get('/api/quizzes/:id', authenticateToken, (req, res) => {
  try {
    const quizzes = readJSONFile('quizzes.json');
    const quiz = quizzes.find(q => q.id === req.params.id);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found.' });
    }

    if (req.user.role === 'admin') {
      return res.json(quiz);
    }

    // For students, strip correct answers
    const studentQuiz = {
      ...quiz,
      questions: quiz.questions.map(quest => {
        const qCopy = { ...quest };
        delete qCopy.correctAnswerIndex;
        return qCopy;
      })
    };
    res.json(studentQuiz);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching quiz details.', error: error.message });
  }
});

// 3. Create a quiz (Admin only)
app.post('/api/quizzes', authenticateToken, isAdmin, (req, res) => {
  try {
    const { courseId, title, questions } = req.body;
    if (!courseId || !title || !Array.isArray(questions)) {
      return res.status(400).json({ message: 'Missing courseId, title, or questions list.' });
    }

    const quizzes = readJSONFile('quizzes.json');
    const newQuiz = {
      id: 'quiz_' + Date.now(),
      courseId,
      title,
      questions: questions.map((q, idx) => ({
        id: 'q_' + idx + '_' + Date.now(),
        questionText: q.questionText,
        options: q.options,
        correctAnswerIndex: Number(q.correctAnswerIndex)
      }))
    };

    quizzes.push(newQuiz);
    writeJSONFile('quizzes.json', quizzes);

    res.status(201).json({ message: 'Quiz created successfully!', quiz: newQuiz });
  } catch (error) {
    res.status(500).json({ message: 'Error creating quiz.', error: error.message });
  }
});

// 4. Update a quiz (Admin only)
app.put('/api/quizzes/:id', authenticateToken, isAdmin, (req, res) => {
  try {
    const { courseId, title, questions } = req.body;
    const quizzes = readJSONFile('quizzes.json');
    const index = quizzes.findIndex(q => q.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ message: 'Quiz not found.' });
    }

    quizzes[index] = {
      ...quizzes[index],
      courseId: courseId || quizzes[index].courseId,
      title: title || quizzes[index].title,
      questions: questions ? questions.map((q, idx) => ({
        id: q.id || 'q_' + idx + '_' + Date.now(),
        questionText: q.questionText,
        options: q.options,
        correctAnswerIndex: Number(q.correctAnswerIndex)
      })) : quizzes[index].questions
    };

    writeJSONFile('quizzes.json', quizzes);
    res.json({ message: 'Quiz updated successfully!', quiz: quizzes[index] });
  } catch (error) {
    res.status(500).json({ message: 'Error updating quiz.', error: error.message });
  }
});

// 5. Delete a quiz (Admin only)
app.delete('/api/quizzes/:id', authenticateToken, isAdmin, (req, res) => {
  try {
    const quizzes = readJSONFile('quizzes.json');
    const index = quizzes.findIndex(q => q.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ message: 'Quiz not found.' });
    }

    quizzes.splice(index, 1);
    writeJSONFile('quizzes.json', quizzes);

    // Also delete associated quiz results
    let quizResults = readJSONFile('quizResults.json');
    quizResults = quizResults.filter(r => r.quizId !== req.params.id);
    writeJSONFile('quizResults.json', quizResults);

    res.json({ message: 'Quiz deleted successfully!' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting quiz.', error: error.message });
  }
});

// 6. Submit a quiz (Student only / Authenticated)
app.post('/api/quizzes/:id/submit', authenticateToken, (req, res) => {
  try {
    const quizId = req.params.id;
    const { answers } = req.body; // indices corresponding to options selected by student

    if (!Array.isArray(answers)) {
      return res.status(400).json({ message: 'Missing or invalid answers array.' });
    }

    const quizzes = readJSONFile('quizzes.json');
    const quiz = quizzes.find(q => q.id === quizId);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found.' });
    }

    // Verify enrollment & payment status for this course
    const enrollments = readJSONFile('enrollments.json');
    const enrollment = enrollments.find(e => e.studentId === req.user.id && e.courseId === quiz.courseId);
    if (req.user.role !== 'admin' && (!enrollment || enrollment.status !== 'approved')) {
      return res.status(403).json({ message: 'You must enroll and complete payment for this course to submit the quiz.' });
    }

    let score = 0;
    const total = quiz.questions.length;
    const feedback = [];

    quiz.questions.forEach((q, idx) => {
      const studentAnswer = answers[idx];
      const correctAnswer = q.correctAnswerIndex;
      const isCorrect = studentAnswer === correctAnswer;
      if (isCorrect) score++;

      feedback.push({
        questionText: q.questionText,
        options: q.options,
        studentAnswer,
        correctAnswer,
        isCorrect
      });
    });

    const percentage = total > 0 ? Math.round((score / total) * 100) : 100;

    const quizResults = readJSONFile('quizResults.json');
    const newResult = {
      id: 'res_' + Date.now(),
      quizId,
      quizTitle: quiz.title,
      studentId: req.user.id,
      studentName: req.user.name,
      score,
      total,
      percentage,
      answers,
      date: new Date().toISOString()
    };

    quizResults.push(newResult);
    writeJSONFile('quizResults.json', quizResults);

    // Award XP
    const xpAwarded = percentage >= 50 ? 100 : 50;
    awardXP(req.user.id, xpAwarded);
    createNotification(
      req.user.id,
      `You completed quiz "${quiz.title}" with a score of ${score}/${total} (${percentage}%). Earned ${xpAwarded} XP!`,
      'quiz'
    );

    res.status(201).json({
      message: 'Quiz submitted successfully!',
      result: {
        score,
        total,
        percentage,
        feedback
      }
    });

  } catch (error) {
    res.status(500).json({ message: 'Error submitting quiz.', error: error.message });
  }
});

// 7. Get student's own quiz results
app.get('/api/quiz-results/student/:studentId', authenticateToken, (req, res) => {
  try {
    const studentId = req.params.studentId;
    if (req.user.role !== 'admin' && req.user.id !== studentId) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const quizResults = readJSONFile('quizResults.json');
    const results = quizResults.filter(r => r.studentId === studentId);
    res.json(results);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching quiz results.' });
  }
});

// 8. Get all quiz results (Admin only)
app.get('/api/quiz-results/admin', authenticateToken, isAdmin, (req, res) => {
  try {
    const quizResults = readJSONFile('quizResults.json');
    res.json(quizResults);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching all quiz results.' });
  }
});

// ==========================================
// BATCH ATTENDANCE ENDPOINTS ENDPOINTS
// ==========================================

// Get Attendance Sheet for Course & Date
app.get('/api/admin/attendance', authenticateToken, isAdmin, (req, res) => {
  try {
    const { courseId, date } = req.query;
    if (!courseId || !date) {
      return res.status(400).json({ message: 'Course ID and Date are required parameters.' });
    }

    const attendance = readJSONFile('attendance.json');
    const enrollments = readJSONFile('enrollments.json');

    // Find saved sheet
    const existingRecord = attendance.find(a => a.courseId === courseId && a.date === date);

    // Find all approved students enrolled in this course
    const activeEnrollments = enrollments.filter(e => e.courseId === courseId && e.status === 'approved');

    // Map active students to saved or default status
    const studentRecords = activeEnrollments.map(e => {
      const savedStudent = existingRecord?.records.find(r => r.studentId === e.studentId);
      return {
        studentId: e.studentId,
        studentName: e.studentName,
        studentEmail: e.studentEmail,
        status: savedStudent ? savedStudent.status : 'present' // default to present
      };
    });

    res.json({
      courseId,
      date,
      records: studentRecords
    });

  } catch (error) {
    res.status(500).json({ message: 'Error retrieving attendance sheet.', error: error.message });
  }
});

// Save Attendance Sheet for Course & Date
app.post('/api/admin/attendance', authenticateToken, isAdmin, (req, res) => {
  try {
    const { courseId, date, records } = req.body;
    if (!courseId || !date || !Array.isArray(records)) {
      return res.status(400).json({ message: 'Missing courseId, date, or records list.' });
    }

    const attendance = readJSONFile('attendance.json');
    const index = attendance.findIndex(a => a.courseId === courseId && a.date === date);

    const sheetData = {
      courseId,
      date,
      records: records.map(r => ({
        studentId: r.studentId,
        studentName: r.studentName,
        studentEmail: r.studentEmail,
        status: r.status // 'present', 'absent', 'late'
      }))
    };

    if (index !== -1) {
      // Update existing
      attendance[index].records = sheetData.records;
    } else {
      // Append new
      sheetData.id = 'att_' + Date.now();
      attendance.push(sheetData);
    }

    writeJSONFile('attendance.json', attendance);
    res.json({ message: 'Attendance sheet saved successfully!' });

  } catch (error) {
    res.status(500).json({ message: 'Error saving attendance sheet.', error: error.message });
  }
});

// GET /api/student/leaderboard - Get global student leaderboard
app.get('/api/student/leaderboard', authenticateToken, (req, res) => {
  try {
    const users = readJSONFile('users.json');
    const leaderboard = users
      .filter(u => u.role === 'student')
      .map(s => ({
        id: s.id,
        name: s.name,
        xp: s.xp || 0,
        level: s.level || 1,
        profilePic: s.profilePic || null
      }))
      .sort((a, b) => b.xp - a.xp)
      .slice(0, 20);
    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching leaderboard.', error: error.message });
  }
});

// GET /api/notifications - Retrieve notifications for authenticated student
app.get('/api/notifications', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const notifications = readJSONFile('notifications.json');
    const userNotifs = notifications
      .filter(n => n.userId === 'all' || n.userId === userId)
      .map(n => {
        const isRead = n.userId === 'all'
          ? (n.readBy && n.readBy.includes(userId))
          : n.read;
        return { ...n, read: !!isRead };
      });
    res.json(userNotifs);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching notifications.', error: error.message });
  }
});

// POST /api/notifications/read-all - Mark all notifications as read
app.post('/api/notifications/read-all', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const notifications = readJSONFile('notifications.json');
    let updated = false;
    notifications.forEach(n => {
      if (n.userId === 'all') {
        if (!n.readBy) n.readBy = [];
        if (!n.readBy.includes(userId)) {
          n.readBy.push(userId);
          updated = true;
        }
      } else if (n.userId === userId && !n.read) {
        n.read = true;
        updated = true;
      }
    });
    if (updated) {
      writeJSONFile('notifications.json', notifications);
    }
    res.json({ message: 'All notifications marked as read.' });
  } catch (error) {
    res.status(500).json({ message: 'Error marking notifications read.', error: error.message });
  }
});

// ==========================================
// DISCUSSION FORUM ROUTES
// ==========================================

// 1. Get all forum posts
app.get('/api/forum/posts', authenticateToken, (req, res) => {
  try {
    const posts = readJSONFile('forum.json');
    posts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching forum posts.', error: error.message });
  }
});

// 2. Create new forum post
app.post('/api/forum/posts', authenticateToken, (req, res) => {
  try {
    const { title, description, category } = req.body;
    if (!title || !description || !category) {
      return res.status(400).json({ message: 'Missing title, description, or category.' });
    }

    const posts = readJSONFile('forum.json');
    const newPost = {
      id: 'post_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      authorId: req.user.id,
      authorName: req.user.name,
      title,
      description,
      category,
      replies: [],
      createdAt: new Date().toISOString()
    };

    posts.unshift(newPost);
    writeJSONFile('forum.json', posts);

    awardXP(req.user.id, 20);
    createNotification(
      req.user.id,
      `You posted a new doubt: "${title}". Earned 20 XP!`,
      'general'
    );

    res.status(201).json({ message: 'Forum post created successfully!', post: newPost });
  } catch (error) {
    res.status(500).json({ message: 'Error creating forum post.', error: error.message });
  }
});

// 3. Post reply to a forum post
app.post('/api/forum/posts/:id/replies', authenticateToken, (req, res) => {
  try {
    const postId = req.params.id;
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ message: 'Reply message is required.' });
    }

    const posts = readJSONFile('forum.json');
    const postIndex = posts.findIndex(p => p.id === postId);

    if (postIndex === -1) {
      return res.status(404).json({ message: 'Post not found.' });
    }

    const post = posts[postIndex];
    const newReply = {
      id: 'reply_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      authorId: req.user.id,
      authorName: req.user.name,
      authorRole: req.user.role,
      message,
      createdAt: new Date().toISOString()
    };

    post.replies.push(newReply);
    writeJSONFile('forum.json', posts);

    if (post.authorId !== req.user.id) {
      createNotification(
        post.authorId,
        `💬 ${req.user.name} replied to your doubt: "${post.title.slice(0, 30)}..."`,
        'general'
      );
    }

    awardXP(req.user.id, 15);

    res.status(201).json({ message: 'Reply added successfully!', reply: newReply });
  } catch (error) {
    res.status(500).json({ message: 'Error adding reply.', error: error.message });
  }
});

// POST /api/ai/chat - AI Doubt Solver (Gemini Integration)
app.post('/api/ai/chat', authenticateToken, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ message: 'Message is required.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.json({
        reply: `👋 Hello! I am your **SDA AI Doubt Solver**.\n\nI can help you debug code, understand algorithms, and solve doubts.\n\n⚠️ *System Note: Please configure your \`GEMINI_API_KEY\` in the backend \`.env\` file to enable real AI responses.*\n\n**Here is a sample code structure for a MERN Stack API endpoint:**\n\`\`\`javascript\napp.get('/api/example', (req, res) => {\n  res.json({ success: true, data: "Hello World" });\n});\n\`\`\``
      });
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `You are an expert programming tutor for Sukla Digital Academy (SDA). Answer the student's question clearly, concisely, and provide code snippets where helpful.\n\nStudent's query: ${message}`
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: Status ${response.status}`);
    }

    const result = await response.json();
    const reply = result.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I couldn't generate a response. Please try again.";
    
    res.json({ reply });

  } catch (error) {
    res.status(500).json({ message: 'Error communicating with AI tutor.', error: error.message });
  }
});

// Start Express server and run db seeder
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await initDatabase();
});
