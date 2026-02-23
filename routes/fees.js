const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const FeePayment = require('../models/FeePayment');

// Show payment form
router.get('/pay/:studentId', async (req, res) => {
    try {
        const student = await Student.findById(req.params.studentId);
        if (!student) {
            req.flash('error_msg', 'Student not found');
            return res.redirect('/students');
        }

        const pendingMonths = await student.calculatePendingMonths();
        const suggestedAmount = pendingMonths * student.monthlyFees;

        res.render('fees/pay', { 
            student, 
            pendingMonths,
            suggestedAmount 
        });
    } catch (err) {
        console.error('Error in pay form:', err);
        req.flash('error_msg', 'Error loading payment form');
        res.redirect('/students');
    }
});

// Process payment
router.post('/pay/:studentId', async (req, res) => {
    try {
        const student = await Student.findById(req.params.studentId);
        if (!student) {
            req.flash('error_msg', 'Student not found');
            return res.redirect('/students');
        }

        const { amount, monthsPaid, paymentMethod, transactionId, remarks, paymentDate } = req.body;

        // Validate inputs
        if (!amount || !monthsPaid) {
            req.flash('error_msg', 'Amount and months are required');
            return res.redirect(`/fees/pay/${req.params.studentId}`);
        }

        const monthsToPayFor = parseInt(monthsPaid);
        const paymentAmount = parseFloat(amount);

        // Check if months to pay doesn't exceed pending months
        const currentPendingMonths = await student.calculatePendingMonths();
        
        if (monthsToPayFor > currentPendingMonths) {
            req.flash('error_msg', `Cannot pay for ${monthsToPayFor} months. Only ${currentPendingMonths} months are pending.`);
            return res.redirect(`/fees/pay/${req.params.studentId}`);
        }

        // Generate payment months array
        const paymentFor = [];
        
        // Get all previous payments to find which months are already paid
        const previousPayments = await FeePayment.find({ student: student._id })
            .sort({ paymentDate: 1 });

        // Create a set of paid months
        const paidMonths = new Set();
        previousPayments.forEach(payment => {
            if (payment.paymentFor && payment.paymentFor.length > 0) {
                payment.paymentFor.forEach(pf => {
                    paidMonths.add(`${pf.year}-${pf.month}`);
                });
            }
        });

        // Find next unpaid months
        let admissionDate = new Date(student.admissionDate);
        let currentDate = new Date();
        let monthsAdded = 0;
        let checkDate = new Date(admissionDate);

        while (monthsAdded < monthsToPayFor && checkDate <= currentDate) {
            const monthKey = `${checkDate.getFullYear()}-${checkDate.getMonth()}`;
            
            if (!paidMonths.has(monthKey)) {
                paymentFor.push({
                    month: checkDate.getMonth(),
                    year: checkDate.getFullYear()
                });
                monthsAdded++;
            }
            
            checkDate.setMonth(checkDate.getMonth() + 1);
        }

        if (paymentFor.length === 0) {
            req.flash('error_msg', 'No pending months found to pay for.');
            return res.redirect(`/fees/pay/${req.params.studentId}`);
        }

        // Create payment record
        const payment = new FeePayment({
            student: student._id,
            amount: paymentAmount,
            monthsPaid: paymentFor.length,
            paymentFor: paymentFor,
            paymentMethod: paymentMethod || 'Cash',
            transactionId: transactionId || '',
            remarks: remarks || '',
            paymentDate: paymentDate ? new Date(paymentDate) : new Date()
        });

        await payment.save();

        // Update student's total paid fees and last payment date
        student.totalPaidFees = (student.totalPaidFees || 0) + paymentAmount;
        student.lastPaymentDate = payment.paymentDate;
        await student.save();

        req.flash('success_msg', `Payment of ₹${paymentAmount.toLocaleString('en-IN')} received for ${paymentFor.length} month(s)! Receipt: ${payment.receiptNumber}`);
        res.redirect(`/students/view/${student._id}`);
    } catch (err) {
        console.error('Error processing payment:', err);
        req.flash('error_msg', 'Error processing payment: ' + err.message);
        res.redirect(`/fees/pay/${req.params.studentId}`);
    }
});

// Payment history (all students)
router.get('/history', async (req, res) => {
    try {
        const payments = await FeePayment.find()
            .populate('student')
            .sort({ paymentDate: -1 })
            .limit(100);

        res.render('fees/history', { payments });
    } catch (err) {
        console.error('Error fetching payment history:', err);
        req.flash('error_msg', 'Error fetching payment history');
        res.redirect('/');
    }
});

// Pending fees report
router.get('/pending', async (req, res) => {
    try {
        const students = await Student.find({ status: 'Active' });
        
        const pendingReport = [];
        
        for (let student of students) {
            try {
                const pendingMonths = await student.calculatePendingMonths();
                const pendingAmount = pendingMonths * student.monthlyFees;
                const totalPaid = student.totalPaidFees || 0;
                const totalExpected = student.getTotalFeesExpected();
                
                if (pendingMonths > 0 || pendingAmount > 0) {
                    pendingReport.push({
                        student,
                        pendingMonths: pendingMonths,
                        pendingAmount: pendingAmount,
                        totalPaid: totalPaid,
                        totalExpected: totalExpected
                    });
                }
            } catch (err) {
                console.error(`Error calculating for student ${student.studentId}:`, err);
            }
        }

        // Sort by pending amount (highest first)
        pendingReport.sort((a, b) => b.pendingAmount - a.pendingAmount);

        res.render('fees/pending', { pendingReport });
    } catch (err) {
        console.error('Error generating pending report:', err);
        req.flash('error_msg', 'Error generating pending report');
        res.redirect('/');
    }
});

// Delete payment
router.delete('/delete/:id', async (req, res) => {
    try {
        const payment = await FeePayment.findById(req.params.id);
        if (!payment) {
            req.flash('error_msg', 'Payment not found');
            return res.redirect('/fees/history');
        }

        // Update student's total paid fees
        const student = await Student.findById(payment.student);
        if (student) {
            student.totalPaidFees = Math.max(0, (student.totalPaidFees || 0) - payment.amount);
            
            // Update last payment date
            const remainingPayments = await FeePayment.find({ 
                student: student._id,
                _id: { $ne: payment._id }
            }).sort({ paymentDate: -1 }).limit(1);
            
            if (remainingPayments.length > 0) {
                student.lastPaymentDate = remainingPayments[0].paymentDate;
            } else {
                student.lastPaymentDate = undefined;
            }
            
            await student.save();
        }

        await FeePayment.findByIdAndDelete(req.params.id);
        
        req.flash('success_msg', 'Payment deleted successfully');
        res.redirect('/fees/history');
    } catch (err) {
        console.error('Error deleting payment:', err);
        req.flash('error_msg', 'Error deleting payment');
        res.redirect('/fees/history');
    }
});

module.exports = router;