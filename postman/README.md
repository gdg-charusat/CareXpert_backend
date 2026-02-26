# CareXpert Postman Collection & Environment Guide

This directory contains Postman collection and environment files for testing the CareXpert backend API.

## Files

### `carexpert-collection.json`
Complete API collection covering all backend endpoints organized by feature modules:
- **Authentication** - Signup, Login, Token Management
- **User Profile** - Profile management for patients and doctors
- **Doctor Endpoints** - Appointments, Time Slots, Prescriptions, etc.
- **Patient Endpoints** - Search doctors, book appointments, view prescriptions
- **Chat & Messaging** - Room messages, Direct messages, Video call tokens
- **AI Chat** - AI-powered symptom analysis
- **Notifications** - Notification management
- **Symptoms** - Symptom tracking
- **Reports** - Medical report management
- **Admin** - User management, statistics, doctor verification
- **Analytics** - Application and doctor analytics

### `carexpert-environment.json`
Environment configuration with variables for:
- **Base URL** - API endpoint (default: `http://localhost:3000`)
- **Authentication Tokens** - Access tokens and refresh tokens
- **Test Credentials** - Sample user credentials for all roles
- **Dynamic Variables** - IDs for resources created during testing

## Setup Instructions

### 1. Import into Postman

#### Option A: Import in GUI
1. Open Postman
2. Click **"Import"** in the top left
3. Go to the **"File"** tab
4. Select `carexpert-collection.json`
5. Click **"Import"**
6. Repeat for `carexpert-environment.json`

#### Option B: Import via Link
1. Click **"+"** to create a new request
2. Paste collection/environment file path or content
3. Import

### 2. Select Environment
1. In Postman, click the **Environment dropdown** (top right)
2. Select **"CareXpert Environment"**

### 3. Configure Variables
Update the environment variables with your actual values:
- `base_url` - Your API server URL
- `access_token` - Generated after login
- Other variables as needed during testing
