// Global Configurations
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:'
  ? 'http://localhost:5000/api'
  : 'https://sda-gb0m.onrender.com/api';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBN28meMW5FXm9Y21LfeorX87djgRVgv6c",
  authDomain: "sukla-digital-academy.firebaseapp.com",
  projectId: "sukla-digital-academy",
  storageBucket: "sukla-digital-academy.firebasestorage.app",
  messagingSenderId: "995408196238",
  appId: "1:995408196238:web:7de5b13ea979e03759cfdf"
};

// SHA-256 password hashing helper
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// Compress image files to base64 using canvas
async function compressFileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = function (event) {
      const img = new Image();
      img.src = event.target.result;
      img.onload = function () {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        
        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        resolve(dataUrl);
      };
      img.onerror = function(err) {
        resolve(event.target.result); // Fallback to raw base64
      };
    };
    reader.onerror = reject;
  });
}

// Dynamically load Firebase SDK Compat scripts
let firebaseLoadedPromise = null;
function loadFirebaseSDKs() {
  if (firebaseLoadedPromise) return firebaseLoadedPromise;
  firebaseLoadedPromise = new Promise(async (resolve, reject) => {
    if (window.firebase) {
      resolve();
      return;
    }
    const sdkScripts = [
      "https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js",
      "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js",
      "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js"
    ];
    try {
      for (const src of sdkScripts) {
        await new Promise((res, rej) => {
          const s = document.createElement('script');
          s.src = src;
          s.onload = res;
          s.onerror = rej;
          document.head.appendChild(s);
        });
      }
      resolve();
    } catch (err) {
      console.error("Failed to load Firebase scripts:", err);
      reject(err);
    }
  });
  return firebaseLoadedPromise;
}

// Get Firestore Instance
async function getFirestoreDB() {
  await loadFirebaseSDKs();
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  const db = firebase.firestore();
  await seedFirestoreIfNeeded(db);
  return db;
}

// Seed admin and courses if needed
async function seedFirestoreIfNeeded(db) {
  try {
    // Seed admin
    const adminSnap = await db.collection('users').doc('user_admin_01').get({ source: 'server' });
    const ADMIN_PASSWORD = 'Sukla@2008';
    const hashedAdminPassword = await sha256(ADMIN_PASSWORD);
    if (!adminSnap.exists) {
      await db.collection('users').doc('user_admin_01').set({
        id: 'user_admin_01',
        name: 'Ajay Shukla',
        email: 'admin@sukla.com',
        password: hashedAdminPassword,
        plainPassword: ADMIN_PASSWORD,
        role: 'admin',
        createdAt: new Date().toISOString()
      });
    } else {
      // Force-update password if it still uses the old one
      const oldData = adminSnap.data();
      if (oldData.plainPassword !== ADMIN_PASSWORD) {
        await db.collection('users').doc('user_admin_01').update({
          password: hashedAdminPassword,
          plainPassword: ADMIN_PASSWORD
        });
      }
    }
    // Seed courses
    const coursesSnap = await db.collection('courses').get({ source: 'server' });
    const needsSeed = coursesSnap.empty;
    if (needsSeed) {
      const defaultCourses = [
        {
          "id": "course_1",
          "title": "C Programming",
          "duration": "3 Months",
          "level": "Beginner",
          "price": 2999,
          "originalPrice": 5999,
          "rating": 4.8,
          "instructor": "Ajay Shukla",
          "description": "Master C fundamentals — variables, loops, functions, arrays, pointers, structures, and file handling.",
          "category": "language",
          "image": ""
        },
        {
          "id": "course_2",
          "title": "C++ Programming",
          "duration": "3 Months",
          "level": "Beginner",
          "price": 6499,
          "originalPrice": 12999,
          "rating": 4.7,
          "instructor": "Ajay Shukla",
          "description": "Learn OOP in C++ — classes, inheritance, polymorphism, templates, STL, and exception handling.",
          "category": "language",
          "image": ""
        },
        {
          "id": "course_3",
          "title": "C with DSA",
          "duration": "4 Months",
          "level": "Intermediate",
          "price": 6999,
          "originalPrice": 13999,
          "rating": 4.9,
          "instructor": "Ajay Shukla",
          "description": "Data Structures & Algorithms in C — linked lists, stacks, queues, trees, graphs, and sorting algorithms.",
          "category": "dsa",
          "image": ""
        },
        {
          "id": "course_4",
          "title": "C++ with DSA",
          "duration": "4 Months",
          "level": "Intermediate",
          "price": 7499,
          "originalPrice": 14999,
          "rating": 4.9,
          "instructor": "Ajay Shukla",
          "description": "Master DSA in C++ — arrays, recursion, sliding window, backtracking, dynamic programming, and graphs.",
          "category": "dsa",
          "image": ""
        },
        {
          "id": "course_5",
          "title": "Java Core",
          "duration": "3 Months",
          "level": "Beginner",
          "price": 6499,
          "originalPrice": 12999,
          "rating": 4.8,
          "instructor": "Ajay Shukla",
          "description": "Java fundamentals — syntax, OOPs, exceptions, collections, multithreading, and JDBC connectivity.",
          "category": "language",
          "image": ""
        },
        {
          "id": "course_6",
          "title": "Python Programming",
          "duration": "3 Months",
          "level": "Beginner",
          "price": 5999,
          "originalPrice": 11999,
          "rating": 4.7,
          "instructor": "Ajay Shukla",
          "description": "Python from scratch — syntax, OOP, file handling, NumPy, Pandas, automation, and web scraping.",
          "category": "language",
          "image": ""
        },
        {
          "id": "course_7",
          "title": "Web Development",
          "duration": "4 Months",
          "level": "Beginner to Intermediate",
          "price": 7999,
          "originalPrice": 15999,
          "rating": 4.8,
          "instructor": "Ajay Shukla",
          "description": "Full web development — HTML5, CSS3, JavaScript ES6+, responsive design, Git, and deployment.",
          "category": "web",
          "image": ""
        },
        {
          "id": "course_8",
          "title": "MERN Stack",
          "duration": "6 Months",
          "level": "Advanced",
          "price": 8999,
          "originalPrice": 17999,
          "rating": 5,
          "instructor": "Ajay Shukla",
          "description": "Full-stack JS — MongoDB, Express, React, Node.js. Build production-grade apps with payment gateways.",
          "category": "web",
          "image": ""
        }
      ];
      for (const c of defaultCourses) {
        await db.collection('courses').doc(c.id).set(c);
      }
    }
    
    // Clean up duplicate if it exists
    await db.collection('courses').doc('course_c_with_cpp').delete();
    
  } catch (err) {
    console.error("Firebase seeding failed:", err);
  }
}

// Intercept Request Payload (supports application/json and multipart/form-data)
async function parseRequestPayload(init) {
  if (!init || !init.body) return {};
  if (init.body instanceof FormData) {
    const payload = {};
    for (const [key, value] of init.body.entries()) {
      if (value instanceof File || value instanceof Blob) {
        payload[key] = await compressFileToBase64(value);
      } else {
        payload[key] = value;
      }
    }
    return payload;
  }
  try {
    return JSON.parse(init.body);
  } catch (e) {
    return {};
  }
}

// Generate Mock Response expected by call scripts
function makeMockResponse(data, status = 200, ok = true) {
  return {
    ok,
    status,
    headers: {
      get: (header) => {
        if (header.toLowerCase() === 'content-type') return 'application/json';
        return null;
      }
    },
    json: async () => data,
    text: async () => JSON.stringify(data)
  };
}

// Helper to extract studentId from headers
function getStudentIdFromHeaders(init) {
  const user = Auth.getUser();
  return user ? user.id : 'GUEST';
}

// Generic fetch all documents from a collection
async function getCollectionDocs(db, collectionName, options = { source: 'server' }) {
  try {
    const snap = await db.collection(collectionName).get(options);
    const docs = [];
    snap.forEach(d => docs.push({ id: d.id, ...d.data() }));
    return docs;
  } catch (err) {
    // Fallback to cache if offline
    console.warn(`Falling back to cache for ${collectionName}:`, err);
    const snap = await db.collection(collectionName).get({ source: 'cache' });
    const docs = [];
    snap.forEach(d => docs.push({ id: d.id, ...d.data() }));
    return docs;
  }
}

// Handle all mock API requests
async function handleFirebaseRequest(url, init) {
  try {
    const db = await getFirestoreDB();
    
    // Helper to mock create notification inside firebase interceptor
    const createMockNotification = async (userId, message, type = 'general') => {
      const notifId = 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      const newNotif = {
        id: notifId,
        userId,
        message,
        type,
        read: false,
        readBy: [],
        createdAt: new Date().toISOString()
      };
      await db.collection('notifications').doc(notifId).set(newNotif);
      return newNotif;
    };

    const awardMockXP = async (userId, amount) => {
      const userRef = db.collection('users').doc(userId);
      const userDoc = await userRef.get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        const xp = (userData.xp || 0) + amount;
        const level = Math.floor(xp / 500) + 1;
        const oldLevel = userData.level || 1;
        const badges = userData.badges || [];
        
        if (level > oldLevel) {
          await createMockNotification(userId, `🎉 Level Up! You reached Level ${level}!`, 'general');
        }
        if (xp >= 1000 && !badges.includes('xp_1000')) {
          badges.push('xp_1000');
          await createMockNotification(userId, `🏆 Unlocked Badge: Gold Scholar (Earned 1000+ XP)`, 'general');
        }
        if (xp >= 500 && !badges.includes('xp_500')) {
          badges.push('xp_500');
          await createMockNotification(userId, `⭐ Unlocked Badge: Rising Star (Earned 500+ XP)`, 'general');
        }
        await userRef.update({ xp, level, badges });
      }
    };

    const urlObj = new URL(url, window.location.origin);
    const pathname = urlObj.pathname.replace(/\/api$/, '').replace(/^\/api/, '');
    const pathParts = pathname.split('/').filter(Boolean); // e.g. ["login"], ["courses"], ["student", "dashboard", "123"]
    const method = (init && init.method ? init.method.toUpperCase() : 'GET');
    const payload = await parseRequestPayload(init);
    const queryParams = Object.fromEntries(urlObj.searchParams.entries());
    
    // Log the API intercept details
    console.log(`[Firebase API Intercept] ${method} ${pathname}`, { payload, queryParams });
    
    // --- 1. AUTHENTICATION ---
    if (pathParts[0] === 'register' && method === 'POST') {
      const { name, email, password, mobile } = payload;
      if (!name || !email || !password || !mobile) {
        return makeMockResponse({ message: 'Please provide all details (name, email, password, mobile).' }, 400, false);
      }
      
      const cleanedEmail = email.trim().toLowerCase();
      const cleanedMobile = mobile.trim().replace(/[\s\-\(\)\+]+/g, ''); // Remove spaces, dashes, parentheses, plus signs for normalization
      
      // Validate mobile format (should be 10 digits after normalization or at least 10 digits)
      if (cleanedMobile.length < 10) {
        return makeMockResponse({ message: 'Please enter a valid mobile number.' }, 400, false);
      }

      // Check duplicate mobile in database
      const usersList = await getCollectionDocs(db, 'users');
      
      const mobileExists = usersList.some(u => {
        if (!u.mobile) return false;
        const normU = u.mobile.trim().replace(/[\s\-\(\)\+]+/g, '');
        return normU === cleanedMobile || normU.endsWith(cleanedMobile) || cleanedMobile.endsWith(normU);
      });
      if (mobileExists) {
        return makeMockResponse({ message: 'User with this mobile number already exists.' }, 400, false);
      }
      
      // Check duplicate email in database
      const emailExists = usersList.some(u => u.email && u.email.trim().toLowerCase() === cleanedEmail);
      if (emailExists) {
        return makeMockResponse({ message: 'User with this email already exists.' }, 400, false);
      }
      
      const userId = 'user_' + Date.now();
      const newUser = {
        id: userId,
        name: name.trim(),
        email: cleanedEmail,
        mobile: mobile.trim(),
        password: await sha256(password),
        plainPassword: password,
        role: 'student',
        createdAt: new Date().toISOString()
      };
      await db.collection('users').doc(userId).set(newUser);
      
      return makeMockResponse({
        message: 'User registered successfully!',
        token: `mock_token_${userId}`,
        user: { id: userId, name: newUser.name, email: newUser.email, role: 'student' }
      }, 201);
    }
    
    if (pathParts[0] === 'login' && method === 'POST') {
      const { email, password } = payload;
      if (!email || !password) {
        return makeMockResponse({ message: 'Please provide email and password.' }, 400, false);
      }
      
      const emailSnap = await db.collection('users').where('email', '==', email.toLowerCase()).get({ source: 'server' });
      if (emailSnap.empty) {
        return makeMockResponse({ message: 'Invalid credentials.' }, 401, false);
      }
      
      const userDoc = emailSnap.docs[0];
      const userData = userDoc.data();
      const hashed = await sha256(password);
      
      if (userData.password !== hashed && userData.plainPassword !== password && userData.password !== password) {
        // Fallback check for admin credentials
        if (email.toLowerCase() === 'admin@sukla.com' && password === 'Sukla@2008') {
          // OK — admin password match
        } else {
          return makeMockResponse({ message: 'Invalid credentials.' }, 401, false);
        }
      }
      
      return makeMockResponse({
        message: 'Login successful!',
        token: `mock_token_${userData.id}`,
        user: { id: userData.id, name: userData.name, email: userData.email, role: userData.role }
      });
    }
    
    // --- 2. COURSES ---
    if (pathParts[0] === 'courses') {
      if (method === 'GET') {
        let courses = await getCollectionDocs(db, 'courses');
        courses.sort((a, b) => {
          const aPop = a.isPopular === true ? 1 : 0;
          const bPop = b.isPopular === true ? 1 : 0;
          return bPop - aPop;
        });
        return makeMockResponse(courses);
      }
      
      if (method === 'POST') {
        const { title, duration, level, price, originalPrice, description, category, isPopular } = payload;
        const courseId = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        
        const doc = await db.collection('courses').doc(courseId).get({ source: 'server' });
        if (doc.exists) {
          return makeMockResponse({ message: 'A course with a similar title already exists.' }, 400, false);
        }
        
        const newCourse = {
          id: courseId,
          title,
          duration,
          level,
          price: Number(price),
          originalPrice: Number(originalPrice || price * 2),
          rating: 4.8,
          instructor: 'Ajay Shukla',
          description,
          category: category || 'development',
          isPopular: isPopular || false
        };
        await db.collection('courses').doc(courseId).set(newCourse);
        return makeMockResponse({ message: 'Course created successfully!', course: newCourse }, 201);
      }
      
      if (pathParts[1]) {
        const courseId = pathParts[1];
        if (method === 'PUT') {
          await db.collection('courses').doc(courseId).update({
            title: payload.title,
            duration: payload.duration,
            level: payload.level,
            price: Number(payload.price),
            originalPrice: Number(payload.originalPrice),
            description: payload.description,
            category: payload.category,
            isPopular: payload.isPopular
          });
          return makeMockResponse({ message: 'Course updated successfully!' });
        }
        if (method === 'DELETE') {
          await db.collection('courses').doc(courseId).delete();
          return makeMockResponse({ message: 'Course deleted successfully!' });
        }
      }
    }
    
    // --- 3. STUDENT DASHBOARD AGGREGATED ENDPOINT ---
    if (pathParts[0] === 'student' && pathParts[1] === 'dashboard' && pathParts[2]) {
      const studentId = pathParts[2];
      
      const userDoc = await db.collection('users').doc(studentId).get({ source: 'server' });
      const userProfile = userDoc.exists ? userDoc.data() : null;
      if (userProfile) delete userProfile.password;
      
      const allCourses = await getCollectionDocs(db, 'courses');
      const allEnrollments = await getCollectionDocs(db, 'enrollments');
      const allPayments = await getCollectionDocs(db, 'payments');
      const allCertificates = await getCollectionDocs(db, 'certificates');
      const notices = await getCollectionDocs(db, 'notices');
      const announcements = await getCollectionDocs(db, 'announcements');
      const recordedClasses = await getCollectionDocs(db, 'recordedClasses');
      const quizzes = await getCollectionDocs(db, 'quizzes');
      const quizResults = await getCollectionDocs(db, 'quizResults');
      const allLiveClasses = await getCollectionDocs(db, 'liveClasses');
      
      // Filter student-specific documents
      const studentEnrollments = allEnrollments.filter(e => e.studentId === studentId);
      const enrolledCourses = studentEnrollments.map(e => {
        const course = allCourses.find(c => c.id === e.courseId);
        return course ? { ...course, enrollmentStatus: e.status, enrollmentId: e.id } : null;
      }).filter(Boolean);
      
      const purchasedCourses = enrolledCourses.filter(c => c.enrollmentStatus === 'approved');
      
      const pendingPayments = studentEnrollments.filter(e => e.status === 'pending').map(e => {
        const course = allCourses.find(c => c.id === e.courseId);
        return {
          enrollmentId: e.id,
          courseId: e.courseId,
          courseName: course ? course.title : 'Unknown Course',
          amount: course ? course.price : 0,
          createdAt: e.createdAt
        };
      });
      
      const payments = allPayments.filter(p => p.studentId === studentId);
      const certificates = allCertificates.filter(c => c.studentId === studentId);
      
      // Filter student attendance logs
      const attendanceSnap = await db.collection('attendance').get({ source: 'server' });
      const studentAttendanceLogs = [];
      let presentCount = 0, absentCount = 0, lateCount = 0;
      
      attendanceSnap.forEach(doc => {
        const sheet = doc.data();
        const record = sheet.records?.find(r => r.studentId === studentId);
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
      
      studentAttendanceLogs.sort((a, b) => new Date(b.date) - new Date(a.date));
      const totalSessions = studentAttendanceLogs.length;
      const attendancePercentage = totalSessions > 0 ? Math.round(((presentCount + lateCount) / totalSessions) * 100) : 100;
      
      const attendanceSummary = {
        total: totalSessions,
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        percentage: attendancePercentage
      };
      
      // Quizzes matching purchased courses
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
      
      const studentQuizResults = quizResults.filter(r => r.studentId === studentId);
      
      // Filter live classes
      const studentCourseIds = purchasedCourses.map(c => c.id);
      const isDemoStudent = studentEnrollments.some(e => e.type === 'demo' && e.status === 'approved');
      const studentLiveClasses = allLiveClasses.filter(lc => {
        if (lc.courseId === 'all') return true;
        if (lc.courseId === 'all_demo' && isDemoStudent) return true;
        if (studentCourseIds.includes(lc.courseId)) return true;
        return false;
      });
      
      // Inject personal demo link if exists
      const approvedDemo = studentEnrollments.find(e => e.type === 'demo' && e.status === 'approved' && e.demoLink);
      if (approvedDemo) {
        studentLiveClasses.unshift({
          id: 'personal_demo_' + approvedDemo.id,
          title: 'Your Approved Demo Class (' + (approvedDemo.courseId.replace('demo_', '').replace(/_/g, ' ').toUpperCase()) + ')',
          dateTime: 'Available Now',
          link: approvedDemo.demoLink
        });
      }

      return makeMockResponse({
        user: userProfile,
        enrolledCourses,
        purchasedCourses,
        isDemoStudent,
        pendingPayments,
        payments,
        certificates,
        notices,
        announcements,
        recordedClasses,
        liveClasses: studentLiveClasses,
        attendance: {
          records: studentAttendanceLogs,
          summary: attendanceSummary
        },
        quizzes: studentQuizzes,
        quizResults: studentQuizResults
      });
    }

    if (pathParts[0] === 'admin' && pathParts[1] === 'liveclass' && method === 'POST') {
      const { title, courseId, dateTime, link } = payload;
      const classId = 'lc_' + Date.now();
      
      const newClass = {
        id: classId,
        title,
        courseId, // e.g., "all_demo", "all", or specific course id
        dateTime,
        link,
        createdAt: new Date().toISOString()
      };
      
      await db.collection('liveClasses').doc(classId).set(newClass);
      
      // Bonus: we could send a notification to enrolled students here, but for now just save it
      return makeMockResponse({ message: 'Live class link posted successfully!', liveClass: newClass }, 201);
    }

    if (pathParts[0] === 'admin' && pathParts[1] === 'liveclass' && pathParts[2] && method === 'DELETE') {
      const classId = pathParts[2];
      await db.collection('liveClasses').doc(classId).delete();
      return makeMockResponse({ message: 'Live class link deleted successfully.' });
    }

    // --- 2.2 LEADERBOARD ---
    if (pathParts[0] === 'student' && pathParts[1] === 'leaderboard' && method === 'GET') {
      const users = await getCollectionDocs(db, 'users');
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
      return makeMockResponse(leaderboard);
    }
    
    // --- 4. PROFILE UPDATES ---
    if (pathParts[0] === 'student' && pathParts[1] === 'profile-update' && method === 'PUT') {
      const studentId = getStudentIdFromHeaders(init);
      const userRef = db.collection('users').doc(studentId);
      const userDoc = await userRef.get();
      if (!userDoc.exists) return makeMockResponse({ message: 'User not found.' }, 404, false);
      
      const userData = userDoc.data();
      if (payload.currentPassword && payload.newPassword) {
        const currHashed = await sha256(payload.currentPassword);
        if (userData.password !== currHashed) {
          return makeMockResponse({ message: 'Current password does not match.' }, 400, false);
        }
        await userRef.update({ 
          password: await sha256(payload.newPassword),
          plainPassword: payload.newPassword
        });
      }
      
      await userRef.update({
        name: payload.name,
        email: payload.email.toLowerCase(),
        mobile: payload.mobile,
        github: payload.github || '',
        linkedin: payload.linkedin || '',
        portfolio: payload.portfolio || ''
      });
      const updatedDoc = await userRef.get();
      const updatedUser = updatedDoc.data();
      delete updatedUser.password;
      return makeMockResponse({ message: 'Profile updated successfully!', user: updatedUser });
    }
    
    if (pathParts[0] === 'student' && pathParts[1] === 'profile-pic' && method === 'POST') {
      const studentId = getStudentIdFromHeaders(init);
      const userRef = db.collection('users').doc(studentId);
      await userRef.update({ image: payload.profilePic });
      
      const updatedDoc = await userRef.get();
      const updatedUser = updatedDoc.data();
      delete updatedUser.password;
      return makeMockResponse({ message: 'Profile picture updated successfully!', user: updatedUser });
    }
    
    // --- 5. ENROLLMENTS & MANUAL REQUESTS ---
    if (pathParts[0] === 'enroll' && method === 'POST') {
      const studentId = getStudentIdFromHeaders(init);
      const userDoc = await db.collection('users').doc(studentId).get();
      const userData = userDoc.data();
      
      const enrollId = 'enroll_' + Date.now();
      const newEnrollment = {
        id: enrollId,
        studentId,
        courseId: payload.courseId,
        studentName: payload.fullName || userData?.name,
        studentMobile: payload.mobile || userData?.mobile,
        studentEmail: payload.email || userData?.email,
        address: payload.address || '',
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      await db.collection('enrollments').doc(enrollId).set(newEnrollment);
      return makeMockResponse({ message: 'Enrollment request created! Complete payment in Dashboard.', enrollment: newEnrollment }, 201);
    }
    
    if (pathParts[0] === 'course-manual-request' && method === 'POST') {
      const studentId = getStudentIdFromHeaders(init);
      const { fullName, mobile, email, courseId, courseName, amount, screenshot } = payload;
      
      const enrollSnap = await db.collection('enrollments')
        .where('studentId', '==', studentId)
        .where('courseId', '==', courseId)
        .get();
        
      if (!enrollSnap.empty) {
        await db.collection('enrollments').doc(enrollSnap.docs[0].id).update({
          studentName: fullName,
          studentMobile: mobile,
          studentEmail: email,
          screenshot: screenshot
        });
      } else {
        const enrollId = 'enroll_' + Date.now();
        await db.collection('enrollments').doc(enrollId).set({
          id: enrollId,
          studentId,
          courseId,
          studentName: fullName,
          studentMobile: mobile,
          studentEmail: email,
          address: '',
          status: 'pending',
          screenshot: screenshot,
          createdAt: new Date().toISOString()
        });
      }
      
      const payId = 'pay_course_' + Date.now();
      const newPayment = {
        id: payId,
        orderId: 'manual_order_' + Date.now(),
        paymentId: 'MANUAL_' + Date.now(),
        studentId,
        studentName: fullName,
        studentEmail: email,
        studentMobile: mobile,
        courseName,
        paymentType: 'Course Payment',
        amount: Number(amount),
        screenshot,
        status: 'pending',
        date: new Date().toISOString()
      };
      await db.collection('payments').doc(payId).set(newPayment);
      
      return makeMockResponse({
        message: 'Thank you for your submission! Your course enrollment is pending verification by admin.',
        payment: newPayment
      }, 201);
    }
    
    if (pathParts[0] === 'demo-manual-request' && method === 'POST') {
      const studentId = getStudentIdFromHeaders(init);
      const { fullName, mobile, email, courseName, amount, screenshot } = payload;
      
      const enrollId = 'demo_' + Date.now();
      await db.collection('enrollments').doc(enrollId).set({
        id: enrollId,
        studentId,
        courseId: 'demo_' + courseName.replace(/\s+/g, '_').toLowerCase(),
        studentName: fullName,
        studentMobile: mobile,
        studentEmail: email,
        address: '',
        status: 'pending',
        screenshot: screenshot,
        type: 'demo',
        createdAt: new Date().toISOString()
      });
      
      const payId = 'pay_demo_' + Date.now();
      const newPayment = {
        id: payId,
        orderId: 'demo_order_' + Date.now(),
        paymentId: 'MANUAL_' + Date.now(),
        studentId,
        studentName: fullName,
        studentEmail: email,
        studentMobile: mobile,
        courseName: '3 Days Demo: ' + courseName,
        paymentType: 'Demo Class Payment',
        amount: Number(amount),
        screenshot,
        status: 'pending',
        date: new Date().toISOString()
      };
      await db.collection('payments').doc(payId).set(newPayment);
      
      return makeMockResponse({
        message: 'Thank you! Your 3-days demo class registration is pending verification.',
        payment: newPayment
      }, 201);
    }

    if (pathParts[0] === 'certificate-manual-request' && method === 'POST') {
      const studentId = getStudentIdFromHeaders(init);
      const { fullName, mobile, email, courseName, amount, certificateType, address, screenshot } = payload;
      
      const certId = 'cert_' + Date.now();
      const payId = 'pay_cert_' + Date.now();
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
        screenshot,
        paymentId: manualPaymentId,
        status: 'pending',
        date: new Date().toISOString()
      };
      await db.collection('certificates').doc(certId).set(newCertificate);
      
      await db.collection('payments').doc(payId).set({
        id: payId,
        orderId: 'manual_order_' + Date.now(),
        paymentId: manualPaymentId,
        studentId,
        studentName: fullName,
        studentEmail: email,
        studentMobile: mobile,
        courseName,
        paymentType: 'Certificate Payment',
        amount: Number(amount),
        screenshot,
        status: 'pending',
        date: new Date().toISOString()
      });
      
      return makeMockResponse({
        message: 'Thank you for your submission! Your certificate will be received in the next 24 hours.',
        certificate: newCertificate
      }, 201);
    }
    
    // --- 6. ADMIN DASHBOARD DATA & UPDATES ---
    if (pathParts[0] === 'admin' && pathParts[1] === 'demo' && pathParts[2] === 'approve' && method === 'PUT') {
      const { enrollmentId, studentId, meetingLink } = payload;
      
      await db.collection('enrollments').doc(enrollmentId).update({
        status: 'approved',
        demoLink: meetingLink
      });
      
      // Update associated payment to 'captured'
      const pays = await getCollectionDocs(db, 'payments');
      const relatedPayment = pays.find(p => p.studentId === studentId && p.paymentType === 'Demo Class Payment' && p.status === 'pending');
      if (relatedPayment) {
        await db.collection('payments').doc(relatedPayment.id).update({
          status: 'captured'
        });
      }
      
      // Notify the student
      await createMockNotification(studentId, `🎉 Your Demo Class is approved! Click here to join: ${meetingLink}`, 'general');
      
      return makeMockResponse({ message: 'Demo request approved and link sent to student.' });
    }

    if (pathParts[0] === 'admin' && pathParts[1] === 'data' && method === 'GET') {
      const courses = await getCollectionDocs(db, 'courses');
      const users = await getCollectionDocs(db, 'users');
      const contacts = await getCollectionDocs(db, 'contacts');
      const payments = await getCollectionDocs(db, 'payments');
      const enrollments = await getCollectionDocs(db, 'enrollments');
      const certificates = await getCollectionDocs(db, 'certificates');
      const notices = await getCollectionDocs(db, 'notices');
      const announcements = await getCollectionDocs(db, 'announcements');
      const recordedClasses = await getCollectionDocs(db, 'recordedClasses');
      const quizzes = await getCollectionDocs(db, 'quizzes');
      const quizResults = await getCollectionDocs(db, 'quizResults');
      const assignments = await getCollectionDocs(db, 'assignments');
      const submissions = await getCollectionDocs(db, 'submissions');
      const liveClasses = await getCollectionDocs(db, 'liveClasses');
      const feedbacks = await getCollectionDocs(db, 'feedbacks');
      
      // IMPORTANT: Soft-delete system — never lose student data
      // Active students: isActive is true or undefined (legacy records)
      const allStudents = users.filter(u => u.role === 'student');
      const students = allStudents.filter(u => u.isActive !== false);          // active
      const archivedStudents = allStudents.filter(u => u.isActive === false);  // archived/soft-deleted

      const totalCourses = courses.length;
      const totalStudents = students.length;
      const totalContacts = contacts.length;
      const totalPayments = payments.length;
      const totalRevenue = payments.filter(p => p.status === 'captured').reduce((acc, curr) => acc + curr.amount, 0);
      
      return makeMockResponse({
        stats: { totalCourses, totalStudents, totalContacts, totalPayments, totalRevenue },
        students: students.map(s => { const sc = {...s}; return sc; }),
        archivedStudents: archivedStudents.map(s => { const sc = {...s}; return sc; }),
        courses,
        enrollments,
        payments,
        certificates,
        contacts,
        notices,
        announcements,
        recordedClasses,
        achievers: await getCollectionDocs(db, 'achievers'),
        quizzes,
        quizResults,
        assignments,
        submissions,
        liveClasses,
        feedbacks
      });
    }

    
    if (pathParts[0] === 'payments' && pathParts[2] === 'status' && method === 'PUT') {
      const payId = pathParts[1];
      const { status } = payload;
      
      const payRef = db.collection('payments').doc(payId);
      const payDoc = await payRef.get();
      if (!payDoc.exists) return makeMockResponse({ message: 'Payment record not found.' }, 404, false);
      
      const payment = payDoc.data();
      const oldStatus = payment.status;
      await payRef.update({ status });
      
      if (status === 'captured' && oldStatus !== 'captured') {
        if (payment.paymentType === 'Course Payment') {
          // Find and approve enrollment
          const enrollSnap = await db.collection('enrollments')
            .where('studentId', '==', payment.studentId)
            .where('courseId', '==', payment.courseId || payment.courseName)
            .get();
          if (!enrollSnap.empty) {
            await db.collection('enrollments').doc(enrollSnap.docs[0].id).update({ status: 'approved' });
          } else {
            // Find courseId by courseName
            const coursesSnap = await db.collection('courses').where('title', '==', payment.courseName).get();
            if (!coursesSnap.empty) {
              const cid = coursesSnap.docs[0].id;
              const enrollSnap2 = await db.collection('enrollments')
                .where('studentId', '==', payment.studentId)
                .where('courseId', '==', cid)
                .get();
              if (!enrollSnap2.empty) {
                await db.collection('enrollments').doc(enrollSnap2.docs[0].id).update({ status: 'approved' });
              }
            }
          }
        } else if (payment.paymentType === 'Certificate Payment') {
          const certSnap = await db.collection('certificates')
            .where('studentId', '==', payment.studentId)
            .where('courseName', '==', payment.courseName)
            .get();
          if (!certSnap.empty) {
            await db.collection('certificates').doc(certSnap.docs[0].id).update({ status: 'completed' });
          }
        }
      }
      return makeMockResponse({ message: 'Payment status updated manually!' });
    }
    
    if (pathParts[0] === 'certificates' && pathParts[2] === 'status' && method === 'PUT') {
      const certId = pathParts[1];
      const { status } = payload;
      
      const certRef = db.collection('certificates').doc(certId);
      const certDoc = await certRef.get();
      if (!certDoc.exists) return makeMockResponse({ message: 'Certificate request not found.' }, 404, false);
      
      const cert = certDoc.data();
      const oldStatus = cert.status;
      await certRef.update({ status: status || 'completed' });
      
      if ((status === 'completed' || status === 'sent') && oldStatus === 'pending') {
        const paySnap = await db.collection('payments')
          .where('studentId', '==', cert.studentId)
          .where('courseName', '==', cert.courseName)
          .where('paymentType', '==', 'Certificate Payment')
          .get();
        if (!paySnap.empty) {
          await db.collection('payments').doc(paySnap.docs[0].id).update({ status: 'captured' });
        }
      }
      return makeMockResponse({ message: 'Certificate request updated successfully!' });
    }
    
    if (pathParts[0] === 'students' && method === 'DELETE' && pathParts[1]) {
      const studentId = pathParts[1];
      // HARD DELETE
      await db.collection('users').doc(studentId).delete();
      return makeMockResponse({ message: 'Student deleted successfully!' });
    }

    if (pathParts[0] === 'admin' && pathParts[1] === 'payment' && pathParts[2] && method === 'DELETE') {
      const paymentId = pathParts[2];
      await db.collection('payments').doc(paymentId).delete();
      return makeMockResponse({ message: 'Payment deleted successfully!' });
    }
    
    // --- 7. NOTICES, ANNOUNCEMENTS, RECORDED CLASSES ---
    if (pathParts[0] === 'notices') {
      if (method === 'GET') {
        const notices = await getCollectionDocs(db, 'notices');
        notices.sort((a,b) => b.id.localeCompare(a.id));
        return makeMockResponse(notices);
      }
      if (method === 'POST') {
        const newNotice = {
          id: 'notice_' + Date.now(),
          title: payload.title,
          description: payload.description,
          date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        };
        await db.collection('notices').doc(newNotice.id).set(newNotice);
        await createMockNotification('all', `New Notice: ${payload.title}`, 'notice');
        return makeMockResponse({ message: 'Notice added successfully!', notice: newNotice }, 201);
      }
    }
    
    if (pathParts[0] === 'announcements') {
      if (method === 'GET') {
        const anns = await getCollectionDocs(db, 'announcements');
        anns.sort((a,b) => b.id.localeCompare(a.id));
        return makeMockResponse(anns);
      }
      if (method === 'POST') {
        const newAnn = {
          id: 'ann_' + Date.now(),
          message: payload.message,
          date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        };
        await db.collection('announcements').doc(newAnn.id).set(newAnn);
        await createMockNotification('all', `New Announcement: ${payload.message.slice(0, 60)}${payload.message.length > 60 ? '...' : ''}`, 'announcement');
        return makeMockResponse({ message: 'Announcement added successfully!', announcement: newAnn }, 201);
      }
      if (method === 'DELETE' && pathParts[1]) {
        await db.collection('announcements').doc(pathParts[1]).delete();
        return makeMockResponse({ message: 'Announcement deleted successfully!' });
      }
    }
    
    if (pathParts[0] === 'recorded-classes') {
      if (method === 'GET') {
        const classes = await getCollectionDocs(db, 'recordedClasses');
        classes.sort((a,b) => b.id.localeCompare(a.id));
        return makeMockResponse(classes);
      }
      if (method === 'POST') {
        const newClass = {
          id: 'rec_' + Date.now(),
          title: payload.title,
          link: payload.link,
          courseId: payload.courseId || 'all',
          date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        };
        await db.collection('recordedClasses').doc(newClass.id).set(newClass);
        return makeMockResponse({ message: 'Recorded class link added!', recordedClass: newClass }, 201);
      }
    }
    
    // --- 8. ATTENDANCE ---
    if (pathParts[0] === 'admin' && pathParts[1] === 'attendance') {
      if (method === 'GET') {
        const courseId = queryParams.courseId;
        const date = queryParams.date;
        const docId = `att_${courseId}_${date}`;
        const doc = await db.collection('attendance').doc(docId).get();
        if (doc.exists) {
          return makeMockResponse(doc.data());
        }
        return makeMockResponse({ records: [] });
      }
      if (method === 'POST') {
        const { courseId, date, records } = payload;
        const docId = `att_${courseId}_${date}`;
        const newSheet = {
          id: docId,
          courseId,
          date,
          records
        };
        await db.collection('attendance').doc(docId).set(newSheet);
        return makeMockResponse({ message: 'Attendance sheet saved successfully!' });
      }
    }
    
    // --- 9. QUIZZES ---
    if (pathParts[0] === 'quizzes') {
      if (pathParts[2] === 'submit' && method === 'POST') {
        const quizId = pathParts[1];
        const quizDoc = await db.collection('quizzes').doc(quizId).get();
        if (!quizDoc.exists) return makeMockResponse({ message: 'Quiz not found.' }, 404, false);
        const quiz = quizDoc.data();
        
        let score = 0;
        const questions = quiz.questions;
        const studentAnswers = payload.answers || [];
        
        questions.forEach((q, idx) => {
          if (studentAnswers[idx] !== undefined && Number(studentAnswers[idx]) === Number(q.correctAnswerIndex)) {
            score++;
          }
        });
        
        const user = Auth.getUser();
        const resultId = 'res_' + Date.now();
        const quizResult = {
          id: resultId,
          quizId,
          studentId: user.id,
          studentName: user.name,
          quizTitle: quiz.title,
          score,
          totalQuestions: questions.length,
          percentage: Math.round((score / questions.length) * 100),
          submittedAt: new Date().toISOString()
        };
        await db.collection('quizResults').doc(resultId).set(quizResult);
        
        return makeMockResponse({
          message: 'Quiz submitted successfully!',
          score,
          totalQuestions: questions.length,
          percentage: quizResult.percentage
        });
      }
      
      if (method === 'POST') {
        const { courseId, title, questions } = payload;
        const quizId = 'quiz_' + Date.now();
        const newQuiz = { id: quizId, courseId, title, questions, createdAt: new Date().toISOString() };
        await db.collection('quizzes').doc(quizId).set(newQuiz);
        return makeMockResponse({ message: 'Quiz created successfully!' }, 201);
      }
      
      if (pathParts[1]) {
        const quizId = pathParts[1];
        if (method === 'PUT') {
          await db.collection('quizzes').doc(quizId).update({
            courseId: payload.courseId,
            title: payload.title,
            questions: payload.questions
          });
          return makeMockResponse({ message: 'Quiz updated successfully!' });
        }
        if (method === 'DELETE') {
          await db.collection('quizzes').doc(quizId).delete();
          // Clear associated results
          const resultsSnap = await db.collection('quizResults').where('quizId', '==', quizId).get();
          const batch = db.batch();
          resultsSnap.forEach(d => batch.delete(d.ref));
          await batch.commit();
          return makeMockResponse({ message: 'Quiz deleted successfully!' });
        }
      }
    }
    
    // --- 10. ACHIEVERS ---
    if (pathParts[0] === 'achievers') {
      if (method === 'GET') {
        const achievers = await getCollectionDocs(db, 'achievers');
        return makeMockResponse(achievers);
      }
      if (method === 'POST') {
        const achId = 'ach_' + Date.now();
        const newAch = { id: achId, name: payload.name, company: payload.company, image: payload.image || '' };
        await db.collection('achievers').doc(achId).set(newAch);
        return makeMockResponse({ message: 'Achiever added successfully!', achiever: newAch }, 201);
      }
      if (pathParts[1] && method === 'DELETE') {
        const achId = pathParts[1];
        await db.collection('achievers').doc(achId).delete();
        return makeMockResponse({ message: 'Achiever deleted successfully!' });
      }
    }
    
    // --- 11. CONTACT MESSAGES ---
    if (pathParts[0] === 'contact') {
      if (method === 'GET') {
        const contacts = await getCollectionDocs(db, 'contacts');
        contacts.sort((a,b) => b.date.localeCompare(a.date));
        return makeMockResponse(contacts);
      }
      if (method === 'POST') {
        const contactId = 'contact_' + Date.now();
        const newContact = {
          id: contactId,
          name: payload.name,
          email: payload.email,
          phone: payload.phone || '',
          course: payload.course || 'N/A',
          message: payload.message,
          date: new Date().toISOString()
        };
        await db.collection('contacts').doc(contactId).set(newContact);
        return makeMockResponse({ message: 'Message sent successfully! We will get back to you.' }, 201);
      }
    }
    
    // --- 12. ASSIGNMENTS ---
    if (pathParts[0] === 'assignments') {

      // POST /api/assignments/:id/submit — Student submits assignment
      if (pathParts[2] === 'submit' && method === 'POST') {
        const assignmentId = pathParts[1];
        const studentId = getStudentIdFromHeaders(init);

        const asgnDoc = await db.collection('assignments').doc(assignmentId).get();
        if (!asgnDoc.exists) return makeMockResponse({ message: 'Assignment not found.' }, 404, false);
        const asgn = asgnDoc.data();

        // Check duplicate
        const existingSub = await db.collection('submissions')
          .where('assignmentId', '==', assignmentId)
          .where('studentId', '==', studentId)
          .get();
        if (!existingSub.empty) {
          return makeMockResponse({ message: 'You have already submitted this assignment.' }, 400, false);
        }

        const userDoc = await db.collection('users').doc(studentId).get();
        const student = userDoc.data();

        const subId = 'sub_' + Date.now();
        const newSub = {
          id: subId,
          assignmentId,
          assignmentTitle: asgn.title,
          studentId,
          studentName: student?.name || 'Student',
          studentEmail: student?.email || '',
          fileUrl: payload.fileUrl || null,
          notes: payload.notes || '',
          status: 'submitted',
          marks: null,
          feedback: '',
          submittedAt: new Date().toISOString()
        };
        await db.collection('submissions').doc(subId).set(newSub);
        return makeMockResponse({ message: 'Assignment submitted successfully!', submission: newSub }, 201);
      }

      // GET /api/assignments — Get all (admin) or filtered (student)
      if (method === 'GET' && !pathParts[1]) {
        const assignments = await getCollectionDocs(db, 'assignments');
        assignments.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        return makeMockResponse(assignments);
      }

      // POST /api/assignments — Admin creates assignment
      if (method === 'POST' && !pathParts[1]) {
        const asgnId = 'asgn_' + Date.now();
        const user = Auth.getUser();
        const newAsgn = {
          id: asgnId,
          title: payload.title,
          description: payload.description,
          dueDate: payload.dueDate || null,
          courseId: payload.courseId || 'all',
          maxMarks: Number(payload.maxMarks) || 100,
          createdAt: new Date().toISOString(),
          createdBy: user?.name || 'Admin'
        };
        await db.collection('assignments').doc(asgnId).set(newAsgn);
        return makeMockResponse({ message: 'Assignment created successfully!', assignment: newAsgn }, 201);
      }

      // DELETE /api/assignments/:id — Admin deletes assignment
      if (pathParts[1] && method === 'DELETE') {
        await db.collection('assignments').doc(pathParts[1]).delete();
        return makeMockResponse({ message: 'Assignment deleted successfully!' });
      }
    }

    // --- 13. SUBMISSIONS ---
    if (pathParts[0] === 'submissions') {

      // GET /api/submissions — Admin gets all
      if (method === 'GET' && !pathParts[1]) {
        const submissions = await getCollectionDocs(db, 'submissions');
        submissions.sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
        return makeMockResponse(submissions);
      }

      // PUT /api/submissions/:id/grade — Admin grades submission
      if (pathParts[2] === 'grade' && method === 'PUT') {
        const subId = pathParts[1];
        const subRef = db.collection('submissions').doc(subId);
        const subDoc = await subRef.get();
        if (!subDoc.exists) return makeMockResponse({ message: 'Submission not found.' }, 404, false);

        await subRef.update({
          marks: Number(payload.marks),
          feedback: payload.feedback || '',
          status: 'graded',
          gradedAt: new Date().toISOString()
        });
        const updated = (await subRef.get()).data();
        await createMockNotification(
          updated.studentId,
          `Your submission for assignment "${updated.assignmentTitle}" has been graded. Marks: ${payload.marks}.`,
          'assignment'
        );
        return makeMockResponse({ message: 'Submission graded successfully!', submission: updated });
      }
    }

    // --- 14. ENROLLMENT PROGRESS UPDATE ---
    if (pathParts[0] === 'enrollments' && pathParts[2] === 'progress' && method === 'PUT') {
      const enrollId = pathParts[1];
      const progress = Number(payload.progress);
      if (isNaN(progress) || progress < 0 || progress > 100) {
        return makeMockResponse({ message: 'Progress must be between 0 and 100.' }, 400, false);
      }
      const enrollRef = db.collection('enrollments').doc(enrollId);
      const enrollDoc = await enrollRef.get();
      if (!enrollDoc.exists) return makeMockResponse({ message: 'Enrollment not found.' }, 404, false);
      await enrollRef.update({ progress, progressUpdatedAt: new Date().toISOString() });
      const updated = (await enrollRef.get()).data();
      return makeMockResponse({ message: 'Course progress updated!', enrollment: updated });
    }

    // --- 15. NOTIFICATIONS ---
    if (pathParts[0] === 'notifications') {
      const studentId = getStudentIdFromHeaders(init);
      if (method === 'GET') {
        const notifications = await getCollectionDocs(db, 'notifications');
        const userNotifs = notifications
          .filter(n => n.userId === 'all' || n.userId === studentId)
          .map(n => {
            const isRead = n.userId === 'all'
              ? (n.readBy && n.readBy.includes(studentId))
              : n.read;
            return { ...n, read: !!isRead };
          });
        userNotifs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        return makeMockResponse(userNotifs);
      }
      
      if (pathParts[1] === 'read-all' && method === 'POST') {
        const notifications = await getCollectionDocs(db, 'notifications');
        for (const n of notifications) {
          if (n.userId === 'all') {
            if (!n.readBy) n.readBy = [];
            if (!n.readBy.includes(studentId)) {
              n.readBy.push(studentId);
              await db.collection('notifications').doc(n.id).update({ readBy: n.readBy });
            }
          } else if (n.userId === studentId && !n.read) {
            await db.collection('notifications').doc(n.id).update({ read: true });
          }
        }
        return makeMockResponse({ message: 'All notifications marked as read.' });
      }
    }

    // --- ADMIN CLEAR DATABASE ---
    if (pathParts[0] === 'admin' && pathParts[1] === 'clear-database' && method === 'DELETE') {
      const collectionsToClear = [
        'users', 'contacts', 'payments', 'enrollments', 'certificates', 
        'liveClasses', 'notices', 'announcements', 'recordedClasses', 
        'quizzes', 'quizResults', 'achievers', 'attendance', 'assignments', 'submissions', 'notifications', 'forum'
      ];

      for (const col of collectionsToClear) {
        const snap = await db.collection(col).get();
        const batch = db.batch();
        snap.forEach(doc => {
          // Do not delete admin user
          if (col === 'users' && doc.id === 'user_admin_01') return;
          batch.delete(doc.ref);
        });
        await batch.commit();
      }
      return makeMockResponse({ message: 'Database successfully cleared!' });
    }

    // --- 16. AI CHAT ---
    if (pathParts[0] === 'ai' && pathParts[1] === 'chat' && method === 'POST') {
      const { message } = payload;
      const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY_HERE"; // Do not hardcode API keys. Use backend env variables.
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `You are SDA Assistant, an AI built for Sukla Digital Academy. Keep answers concise, helpful and friendly. If they ask about fees, C Programming is ₹2999, C++ is ₹6499, MERN is ₹14999. Student says: ${message}` }] }]
          })
        });
        const data = await response.json();
        if (data.candidates && data.candidates.length > 0) {
          return makeMockResponse({ reply: data.candidates[0].content.parts[0].text });
        }
        throw new Error("Invalid API Response");
      } catch (err) {
        // Fallback if API fails or rate limited
        let reply = "Hello! I am the SDA Assistant. The AI network is currently offline, but I can help you with courses, fees, or demo classes manually!";
        return makeMockResponse({ reply });
      }
    }

    // --- 17. DISCUSSION FORUM ---
    if (pathParts[0] === 'forum' && pathParts[1] === 'posts') {
      const studentId = getStudentIdFromHeaders(init);
      const studentName = Auth.getUser() ? Auth.getUser().name : 'Student';
      
      if (method === 'GET') {
        const posts = await getCollectionDocs(db, 'forum');
        posts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        return makeMockResponse(posts);
      }
      
      if (method === 'POST') {
        if (pathParts[2] === 'replies' && pathParts[1]) {
          const postId = pathParts[1];
          const postRef = db.collection('forum').doc(postId);
          const postDoc = await postRef.get();
          if (!postDoc.exists) return makeMockResponse({ message: 'Post not found.' }, 404, false);
          
          const postData = postDoc.data();
          const replies = postData.replies || [];
          const newReply = {
            id: 'reply_' + Date.now(),
            authorId: studentId,
            authorName: studentName,
            authorRole: Auth.getUser() ? Auth.getUser().role : 'student',
            message: payload.message,
            createdAt: new Date().toISOString()
          };
          replies.push(newReply);
          await postRef.update({ replies });
          
          if (postData.authorId !== studentId) {
            await createMockNotification(
              postData.authorId,
              `💬 ${studentName} replied to your doubt: "${postData.title.slice(0, 30)}..."`,
              'general'
            );
          }
          await awardMockXP(studentId, 15);
          return makeMockResponse({ message: 'Reply added successfully!', reply: newReply }, 201);
        } else {
          const newPost = {
            id: 'post_' + Date.now(),
            authorId: studentId,
            authorName: studentName,
            title: payload.title,
            description: payload.description,
            category: payload.category,
            replies: [],
            createdAt: new Date().toISOString()
          };
          await db.collection('forum').doc(newPost.id).set(newPost);
          
          await awardMockXP(studentId, 20);
          await createMockNotification(
            studentId,
            `You posted a new doubt: "${payload.title}". Earned 20 XP!`,
            'general'
          );
          return makeMockResponse({ message: 'Post created successfully!', post: newPost }, 201);
        }
      }
    }

    if (pathParts[0] === 'feedbacks') {
      if (method === 'GET') {
        const fbs = await getCollectionDocs(db, 'feedbacks');
        return makeMockResponse(fbs.filter(f => f.status === 'approved'));
      }
      if (method === 'POST') {
        const { studentName, message } = payload;
        if (!studentName || !message) return makeMockResponse({ message: 'Required fields missing' }, 400, false);
        const fb = {
          id: 'fb_' + Date.now(),
          studentId: 'public_' + Date.now(),
          studentName,
          message,
          status: 'pending',
          createdAt: new Date().toISOString()
        };
        await db.collection('feedbacks').doc(fb.id).set(fb);
        return makeMockResponse({ message: 'Feedback submitted successfully', feedback: fb }, 201);
      }
    }

    if (pathParts[0] === 'admin' && pathParts[1] === 'feedbacks' && pathParts[2]) {
      const fbId = pathParts[2];
      if (method === 'PUT') {
        const { status } = payload;
        await db.collection('feedbacks').doc(fbId).update({ status });
        return makeMockResponse({ message: 'Feedback status updated' });
      }
      if (method === 'DELETE') {
        await db.collection('feedbacks').doc(fbId).delete();
        return makeMockResponse({ message: 'Feedback deleted' });
      }
    }


    return makeMockResponse({ message: `Mock API: Path '${pathname}' not found.` }, 404, false);

    
  } catch (error) {
    console.error(`[Firebase API Intercept Error]`, error);
    return makeMockResponse({ message: `Database error: ${error.message}` }, 500, false);
  }
}

// Override global fetch function to intercept backend calls
const originalFetch = window.fetch;
window.fetch = async function (input, init) {
  const url = typeof input === 'string' ? input : input.url;
  
  if (url.includes('bypass=true')) {
    const cleanUrl = url.replace(/[\?&]bypass=true/, '');
    return originalFetch.call(this, cleanUrl, init);
  }
  
  // Intercept if it matches local/render API base urls (ignore external services like Piston)
  if (url.startsWith(API_URL) || url.startsWith('/api/') || url.includes('localhost:5000/api') || url.includes('sda-gb0m.onrender.com/api')) {
    return await handleFirebaseRequest(url, init);
  }
  return originalFetch.apply(this, arguments);
};

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
  initTheme();
  initHamburger();
  initFAQ();
  initSidebarToggle();
});

function initNavbar() {
  const authNav = document.getElementById('auth-nav');
  if (!authNav) return;
  
  if (authNav.querySelector('.notification-bell-wrapper') || authNav.hasAttribute('data-no-override')) {
    return;
  }

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

// Add Sidebar Drawer Toggler for Dashboard Pages
function initSidebarToggle() {
  const hamburger = document.querySelector('.hamburger');
  const sidebar = document.querySelector('.sidebar');
  if (hamburger && sidebar) {
    let overlay = document.querySelector('.sidebar-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'sidebar-overlay';
      document.body.appendChild(overlay);
    }
    
    // Toggle sidebar on hamburger click
    const newHamburger = hamburger.cloneNode(true);
    hamburger.parentNode.replaceChild(newHamburger, hamburger);
    
    newHamburger.addEventListener('click', (e) => {
      e.stopPropagation();
      sidebar.classList.toggle('open');
      overlay.classList.toggle('active');
    });
    
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
    });
    
    // Close sidebar when menu item is clicked on mobile/tablet
    const menuItems = sidebar.querySelectorAll('.sidebar-item');
    menuItems.forEach(item => {
      item.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
      });
    });
  }
}

// ==========================================
// DYNAMIC TESTIMONIALS (Public Landing Page)
// ==========================================
async function loadTestimonials() {
  const container = document.getElementById('testimonials-container');
  if (!container) return; // Only runs on index.html where this container exists

  try {
    const feedbacks = await apiCall('/feedbacks', 'GET', null, false);

    if (feedbacks.length === 0) {
      container.innerHTML = '<p style="text-align: center; color: var(--text-muted); grid-column: 1 / -1;">No feedbacks yet. Be the first to share your experience!</p>';
      return;
    }

    container.innerHTML = feedbacks.map(f => {
      // Use the first letter of the name as avatar
      const initial = f.studentName.charAt(0).toUpperCase();
      return `
        <div class="glass-card">
          <p style="font-style: italic; color: var(--text-secondary); margin-bottom: 20px;">"${f.message}"</p>
          <div style="display: flex; gap: 12px; align-items: center;">
            <div class="sidebar-avatar">${initial}</div>
            <div>
              <h4 style="font-size: 15px;">${f.studentName}</h4>
              <p style="font-size: 12px; color: var(--accent-color);">Student @ SDA</p>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('Error loading testimonials:', error);
    container.innerHTML = '<p style="text-align: center; color: var(--danger); grid-column: 1 / -1;">Failed to load feedbacks.</p>';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadTestimonials();

  // Public Feedback Form Submission
  const publicFeedbackForm = document.getElementById('public-feedback-form');
  if (publicFeedbackForm) {
    publicFeedbackForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const studentName = document.getElementById('feedback-name').value.trim();
      const message = document.getElementById('feedback-msg').value.trim();
      const btn = publicFeedbackForm.querySelector('button');

      if (!studentName || !message) {
        showToast('Name and message are required.', 'error');
        return;
      }

      try {
        btn.disabled = true;
        btn.innerHTML = 'Submitting... <i class="fas fa-spinner fa-spin"></i>';
        
        // Passing authenticate=false because this is public
        const res = await apiCall('/feedbacks', 'POST', { studentName, message }, false);
        
        showToast(res.message || 'Feedback submitted successfully!', 'success');
        publicFeedbackForm.reset();
        document.getElementById('feedback-modal').classList.remove('active');
      } catch (error) {
        showToast(error.message || 'Failed to submit feedback.', 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = 'Submit Feedback <i class="fas fa-paper-plane" style="margin-left: 8px;"></i>';
      }
    });
  }
});
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
  const isPopular = course.isPopular === true;
  const popularSticker = isPopular ? `<div style="position: absolute; top: -10px; left: -10px; background: var(--danger); color: white; padding: 4px 12px; font-size: 10px; font-weight: 800; border-radius: 5px; box-shadow: 0 4px 10px rgba(0,0,0,0.3); z-index: 2; transform: rotate(-10deg);">🔥 POPULAR</div>` : '';
  return `
    <div class="glass-card course-card" style="position: relative;">
      ${popularSticker}
      <span class="course-card-badge">${(course.category || '').toUpperCase()}</span>
      <h3 class="course-title" style="margin-top: 12px;">${course.title}</h3>
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
          Enroll Now <i class="fas fa-arrow-right"></i>
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

function initTheme() {
  const currentTheme = localStorage.getItem('sda_theme') || 'dark';
  if (currentTheme === 'light') {
    document.body.classList.add('light-theme');
  }

  const navContainer = document.querySelector('.nav-container');
  if (navContainer && !document.getElementById('theme-toggle-btn')) {
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'theme-toggle-btn';
    toggleBtn.className = 'btn-secondary';
    toggleBtn.style.padding = '8px 12px';
    toggleBtn.style.minWidth = '44px';
    toggleBtn.style.minHeight = '44px';
    toggleBtn.style.display = 'inline-flex';
    toggleBtn.style.alignItems = 'center';
    toggleBtn.style.justifyContent = 'center';
    toggleBtn.style.marginLeft = '10px';
    toggleBtn.style.borderRadius = '50%';
    toggleBtn.style.cursor = 'pointer';

    const isLight = document.body.classList.contains('light-theme');
    toggleBtn.innerHTML = isLight ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
    
    const hamburger = navContainer.querySelector('.hamburger');
    if (hamburger) {
      navContainer.insertBefore(toggleBtn, hamburger);
    } else {
      navContainer.appendChild(toggleBtn);
    }

    toggleBtn.addEventListener('click', () => {
      document.body.classList.toggle('light-theme');
      const isLightNow = document.body.classList.contains('light-theme');
      localStorage.setItem('sda_theme', isLightNow ? 'light' : 'dark');
      toggleBtn.innerHTML = isLightNow ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
      showToast(`Switched to ${isLightNow ? 'Light' : 'Dark'} theme`, 'info');
      if (typeof renderAllAnalyticsCharts === 'function') {
        renderAllAnalyticsCharts();
      }
    });
  }
}
