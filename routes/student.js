const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const FeePayment = require('../models/FeePayment');

// Get all students
router.get('/', async (req, res) => {
    try {
        const students = await Student.find().sort({ createdAt: -1 });
        
        // Calculate pending months for each student
        for (let student of students) {
            student.pendingMonths = await student.calculatePendingMonths();
        }
        
        res.render('students/list', { students });
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error fetching students');
        res.redirect('/');
    }
});

// Show add student form
router.get('/add', (req, res) => {
    res.render('students/add');
});

// Add new student
router.post('/add', async (req, res) => {
    try {
        const {
            studentId,
            name,
            fatherName,
            email,
            phone,
            address,
            class: studentClass,
            course,
            admissionDate,
            monthlyFees
        } = req.body;

        // Check if student ID already exists
        const existingStudent = await Student.findOne({ studentId });
        if (existingStudent) {
            req.flash('error_msg', 'Student ID already exists');
            return res.redirect('/students/add');
        }

        const newStudent = new Student({
            studentId,
            name,
            fatherName,
            email,
            phone,
            address,
            class: studentClass,
            course,
            admissionDate,
            monthlyFees
        });

        await newStudent.save();
        req.flash('success_msg', 'Student added successfully');
        res.redirect('/students');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error adding student');
        res.redirect('/students/add');
    }
});

// View single student with payment history
router.get('/view/:id', async (req, res) => {
    try {
        const student = await Student.findById(req.params.id);
        const payments = await FeePayment.find({ student: req.params.id })
            .sort({ paymentDate: -1 });
        
        const pendingMonths = await student.calculatePendingMonths();
        const totalDue = pendingMonths * student.monthlyFees;
        
        res.render('students/view', { 
            student, 
            payments, 
            pendingMonths,
            totalDue 
        });
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Student not found');
        res.redirect('/students');
    }
});

// Delete student
router.delete('/:id', async (req, res) => {
    try {
        // Also delete all payment records
        await FeePayment.deleteMany({ student: req.params.id });
        await Student.findByIdAndDelete(req.params.id);
        
        req.flash('success_msg', 'Student deleted successfully');
        res.redirect('/students');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error deleting student');
        res.redirect('/students');
    }
});

module.exports = router;