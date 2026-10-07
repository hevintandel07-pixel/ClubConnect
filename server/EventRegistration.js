const mongoose = require("mongoose");

const eventRegistrationSchema = new mongoose.Schema({

    // Student who registered
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    // Event for which student registered
    event: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Event",
        required: true
    },

    // Registration date
    registrationDate: {
        type: Date,
        default: Date.now
    },

    // Registration status
    status: {
        type: String,
        enum: ["Registered", "Cancelled"],
        default: "Registered"
    }

});


// Prevent duplicate registration
eventRegistrationSchema.index(
    {
        student: 1,
        event: 1
    },
    {
        unique: true
    }
);


const EventRegistration =
    mongoose.model(
        "EventRegistration",
        eventRegistrationSchema
    );


module.exports = EventRegistration;