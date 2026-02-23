const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
    studentId: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    fatherName: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    phone: {
        type: String,
        required: true
    },
    address: {
        type: String,
        required: true
    },
    class: {
        type: String,
        required: true
    },
    course: {
        type: String,
        required: true
    },
    admissionDate: {
        type: Date,
        default: Date.now
    },
    monthlyFees: {
        type: Number,
        required: true
    },
    totalPaidFees: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive'],
        default: 'Active'
    },
    lastPaymentDate: {
        type: Date
    }
}, {
    timestamps: true
});

// Calculate total months from admission to now
studentSchema.methods.getTotalMonthsSinceAdmission = function() {
    const admissionDate = new Date(this.admissionDate);
    const currentDate = new Date();
    
    const yearsDiff = currentDate.getFullYear() - admissionDate.getFullYear();
    const monthsDiff = currentDate.getMonth() - admissionDate.getMonth();
    
    let totalMonths = yearsDiff * 12 + monthsDiff + 1; // +1 to include current month
    
    return Math.max(totalMonths, 0);
};

// Calculate total months paid
studentSchema.methods.getTotalMonthsPaid = async function() {
    const FeePayment = require('./FeePayment');
    
    const result = await FeePayment.aggregate([
        { $match: { student: this._id } },
        { $group: { _id: null, totalMonths: { $sum: '$monthsPaid' } } }
    ]);
    
    return result.length > 0 ? result[0].totalMonths : 0;
};

// Calculate pending months
studentSchema.methods.calculatePendingMonths = async function() {
    try {
        const totalMonthsSinceAdmission = this.getTotalMonthsSinceAdmission();
        const totalMonthsPaid = await this.getTotalMonthsPaid();
        
        const pendingMonths = totalMonthsSinceAdmission - totalMonthsPaid;
        
        return Math.max(pendingMonths, 0);
    } catch (err) {
        console.error('Error calculating pending months:', err);
        return 0;
    }
};

// Calculate total fees that should have been paid till now
studentSchema.methods.getTotalFeesExpected = function() {
    const totalMonths = this.getTotalMonthsSinceAdmission();
    return totalMonths * this.monthlyFees;
};

// Calculate remaining fees
studentSchema.methods.getRemainingFees = function() {
    const totalExpected = this.getTotalFeesExpected();
    const totalPaid = this.totalPaidFees || 0;
    return Math.max(totalExpected - totalPaid, 0);
};

module.exports = mongoose.model('Student', studentSchema);