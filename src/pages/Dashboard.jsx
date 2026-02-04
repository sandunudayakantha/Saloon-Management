import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';

const Dashboard = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/calendar');
  }, [navigate]);

  return (
    <>
      <Helmet>
        <title>Dashboard - Therapy Booking System</title>
        <meta name="description" content="Therapy booking dashboard overview" />
      </Helmet>
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-gray-900">Redirecting...</p>
      </div>
    </>
  );
};

export default Dashboard;