const mongoose = require('mongoose');

const feePaymentSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: true
    },
    receiptNumber: {
        type: String,
        unique: true
    },
    paymentDate: {
        type: Date,
        required: true,
        default: Date.now
    },
    amount: {
        type: Number,
        required: true
    },
    monthsPaid: {
        type: Number,
        required: true,
        default: 1
    },
    // Month and Year for which fee is paid
    paymentFor: [{
        month: {
            type: Number, // 0-11 (JavaScript month format)
            required: true
        },
        year: {
            type: Number,
            required: true
        }
    }],
    paymentMethod: {
        type: String,
        enum: ['Cash', 'Online', 'Cheque', 'UPI'],
        default: 'Cash'
    },
    transactionId: {
        type: String
    },
    remarks: {
        type: String
    },
    collectedBy: {
        type: String,
        default: 'Admin'
    }
}, {
    timestamps: true
});

// Generate receipt number before saving
feePaymentSchema.pre('save', async function() {
    if (!this.receiptNumber) {
        const count = await mongoose.model('FeePayment').countDocuments();
        const year = new Date().getFullYear();
        this.receiptNumber = `RCP${year}${String(count + 1).padStart(5, '0')}`;
            }
});

module.exports = mongoose.model('FeePayment', feePaymentSchema);
