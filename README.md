# SchoolEMart

A modern MERN stack application for school management/e-commerce.

## 🚀 Project Structure

- **`backend/`**: Node.js & Express server with MongoDB integration.
- **`frontend/`**: React application built with Vite for speed and efficiency.

## 🛠️ Tech Stack

- **Frontend**: React, Vite
- **Backend**: Node.js, Express
- **Database**: MongoDB (Mongoose)
- **Workflow**: Concurrently for running both services

## 🏁 Getting Started

### Prerequisites

- Node.js (v14+)
- MongoDB (Running locally or a cloud instance)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd SchoolEMart
   ```

2. Install dependencies for the root, frontend, and backend:
   ```bash
   npm install
   cd backend && npm install
   cd ../frontend && npm install
   cd ..
   ```

3. Configure environment variables:
   - Create a `.env` file in `backend/` (see `backend/.env` for boilerplate).
   - Create a `.env` file in `frontend/` (see `frontend/.env` for boilerplate).

### Running the App

Start both the frontend and backend with a single command:

```bash
npm run dev
```

- **Backend API**: http://localhost:5000
- **Frontend Client**: http://localhost:5173

## 📜 Scripts

- `npm run dev`: Run both frontend and backend concurrently.
- `npm run server`: Run only the backend.
- `npm run client`: Run only the frontend.

## 📄 License

This project is licensed under the ISC License.
