const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');
const app = express();
require('dotenv').config();

//  || 'mongodb://localhost:27017/coaching_center'
const MONGODB_URI = process.env.MONGODB_URI;
const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log("✅ MongoDB Connected");
  } catch (err) {
    console.error("❌ MongoDB Connection Failed:", err.message);
    process.exit(1); // crash instead of buffering forever
  }
};

connectDB();
// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

// Session & Flash
app.use(session({
    secret: 'coaching_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));
app.use(flash());

// Global Variables
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    next();
});

// View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
const studentRoutes = require('./routes/student');
const feesRoutes = require('./routes/fees');

app.use('/students', studentRoutes);
app.use('/fees', feesRoutes);

// Home Route
app.get('/', async (req, res) => {
    try {
        const Student = require('./models/Student');
        const FeePayment = require('./models/FeePayment');
        
        const totalStudents = await Student.countDocuments({ status: 'Active' });
        const totalPayments = await FeePayment.countDocuments();
        
        // Calculate total revenue
        const payments = await FeePayment.find();
        const totalRevenue = payments.reduce((sum, payment) => sum + payment.amount, 0);
        
        // Calculate pending fees
        const students = await Student.find({ status: 'Active' });
        let totalPending = 0;
        for (let student of students) {
            const pendingMonths = await student.calculatePendingMonths();
            totalPending += pendingMonths * student.monthlyFees;
        }
        
        res.render('index', { 
            totalStudents, 
            totalPayments, 
            totalRevenue,
            totalPending 
        });
    } catch (err) {
        console.error('Dashboard Error:', err);
        res.render('index', { 
            totalStudents: 0, 
            totalPayments: 0, 
            totalRevenue: 0,
            totalPending: 0 
        });
    }
});

// 404 Handler
app.use((req, res) => {
    res.status(404).send('<h1>404 - Page Not Found</h1><a href="/">Go Home</a>');
});

// Error Handler
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).send('<h1>500 - Server Error</h1><p>' + err.message + '</p>');
});

// Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`http://localhost:${PORT}`);
});