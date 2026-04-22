import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute, RoleRoute } from './ProtectedRoute';
import { ROLES } from '../constants/roles';
import { ROUTES } from '../constants/routes';
import MainLayout from '../layouts/MainLayout';

import Home from '../features/home/Home';
import About from '../features/about/About';
import HowItWorks from '../features/how-it-works/HowItWorks';

// Placeholder Pages
const Login = () => <div className="p-10"><h1>Login Page</h1></div>;
const Register = () => <div className="p-10"><h1>Register Page</h1></div>;
const Dashboard = () => <div className="p-10"><h1>Dashboard</h1><p>Welcome back!</p></div>;

const AppRoutes = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route element={<MainLayout />}>
        <Route path={ROUTES.HOME} element={<Home />} />
        <Route path={ROUTES.ABOUT} element={<About />} />
        <Route path={ROUTES.HOW_IT_WORKS} element={<HowItWorks />} />
      </Route>
      
      <Route path={ROUTES.LOGIN} element={<Login />} />

      {/* Protected Routes */}
      <Route element={<ProtectedRoute />}>
        <Route path={ROUTES.DASHBOARD} element={<Dashboard />} />
        
        {/* Role Specific Routes */}
        <Route element={<RoleRoute allowedRoles={[ROLES.SCHOOL]} />}>
          <Route path={`${ROUTES.SCHOOL.ROOT}/*`} element={<div>School Portal</div>} />
        </Route>

        <Route element={<RoleRoute allowedRoles={[ROLES.VENDOR]} />}>
          <Route path={`${ROUTES.VENDOR.ROOT}/*`} element={<div>Vendor Portal</div>} />
        </Route>

        <Route element={<RoleRoute allowedRoles={[ROLES.ADMIN]} />}>
          <Route path={`${ROUTES.ADMIN.ROOT}/*`} element={<div>Admin Panel</div>} />
        </Route>
      </Route>

      {/* 404 Route */}
      <Route path="*" element={<div>Page Not Found</div>} />
    </Routes>
  );
};

export default AppRoutes;
