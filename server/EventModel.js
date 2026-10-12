
const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    clubName: {
        type: String,
        required: true,
        trim: true
    },
    date: {
        type: Date,
        required: true,
        validate: {
            validator: value => !Number.isNaN(value.getTime()),
            message: "Please enter a valid event date."
        }
    },
    time: {
        type: String,
        required: true,
        trim: true
    },
    venue: {
        type: String,
        required: true,
        trim: true
    },
    totalSeats: {
        type: Number,
        required: true,
        min: 1,
        validate: {
            validator: Number.isInteger,
            message: "Total seats must be a whole number."
        }
    },
    availableSeats: {
        type: Number,
        required: true,
        min: 0,
        validate: {
            validator: Number.isInteger,
            message: "Available seats must be a whole number."
        }
    },
    description: {
        type: String,
        default: "",
        trim: true
    },
    image: {
        type: String,
        default: ""
    }
}, {
    timestamps: true
});

module.exports = mongoose.model("Event", eventSchema);
