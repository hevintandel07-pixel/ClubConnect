const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true
    },

    enrollment: {
        type: String,
        required: true,
        unique: true
    },

    email: {
        type: String,
        required: true,
        unique: true
    },

    department: {
        type: String,
        required: true
    },

    semester: {
        type: Number,
        required: true
    },

    password: {
        type: String,
        required: true
    },

    role: {
        type: String,
        default: "student"
    }

}, {
    timestamps: true
});

const User = mongoose.model(
    "User",
    userSchema
);

module.exports = User;