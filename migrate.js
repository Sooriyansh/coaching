const mongoose = require('mongoose');
const Student = require('./models/Student');

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/coaching_fees_db')
.then(() => console.log('MongoDB Connected'))
.catch(err => console.log('Error:', err));

async function migrateData() {
    try {
        console.log('Starting migration...');
        
        // Find all students
        const students = await Student.find({});
        console.log(`Found ${students.length} students`);
        
        let updated = 0;
        let alreadyHad = 0;
        
        for (let student of students) {
            // If monthlyFees doesn't exist or is 0, set a default value
            if (!student.monthlyFees || student.monthlyFees === 0) {
                // Check if totalFees exists (old field)
                if (student.totalFees) {
                    // Assume totalFees was for 12 months
                    student.monthlyFees = Math.round(student.totalFees / 12);
                } else {
                    // Set a default value
                    student.monthlyFees = 1000; // Default ₹1000 per month
                }
                
                await student.save();
                console.log(`Updated ${student.studentId}: ${student.name} - Monthly Fees: ₹${student.monthlyFees}`);
                updated++;
            } else {
                alreadyHad++;
            }
        }
        
        console.log('\n--- Migration Complete ---');
        console.log(`Total Students: ${students.length}`);
        console.log(`Updated: ${updated}`);
        console.log(`Already had monthlyFees: ${alreadyHad}`);
        
        process.exit(0);
    } catch (err) {
        console.error('Migration Error:', err);
        process.exit(1);
    }
}

// Run migration
migrateData();